/**
 * El ciclo de vida de una petición a la IA: abrir el hilo de avisos, ir
 * acumulando lo que llega y dejar el resultado en la conversación.
 *
 * Da igual si es la que se acaba de mandar o una que ya venia en marcha desde
 * antes de recargar: lo que llega se mira en vivo, y lo que quede al final
 * entra en la conversación por el mismo sitio.
 *
 * No es un modulo de estado como `aiRun.svelte.ts` o `aiConversation.svelte.ts`
 * --no declara ni un `$state`--: lo que se ve vive en esos dos, y aquí esta
 * quien los va escribiendo. Lo único que se guarda es el avance de la petición
 * en curso, a propósito fuera del estado: el trozo entra en cada aviso del
 * servidor y el redibujado se pide agrupado, con lo ultimo que haya.
 *
 * De `AiPanel.svelte` solo necesita lo que es suyo --a donde mira la columna,
 * que filas estan desplegadas, el marco escondido de las pruebas-- y eso llega
 * como funciones.
 */
import type {
  AccessChange,
  AiPageResult,
  AiProgress,
  AiQuestion,
  AiStep,
  DataImpact,
} from "@shared/types";

import { setAiWorking } from "./aiActivity.svelte";
import {
  markListening,
  markOpenChat,
  nextEntryId,
  readConversation,
  writeConversation,
} from "./aiConversation.svelte";
import { NO_PROGRESS, type Progress, taken } from "./aiProgress";
import { closeRun, markRun, openRun } from "./aiRun.svelte";
import { frameThrottle } from "./frameThrottle";
import { errorMessage, stream } from "./pb";

/*
 * Lo que se vio llegar, fuera del estado: el trozo entra aquí en cada aviso
 * del servidor y el redibujado se pide agrupado, con lo ultimo que haya.
 */
let seen: Progress = NO_PROGRESS;
/** De que petición es lo visto: lo agrupado se sirve a la que sigue en marcha. */
let seenKey = "";
const showProgress = frameThrottle(() => {
  markRun(seenKey, { progress: seen });
});

/*
 * Cada paso que la IA da ya quedo escrito en la base --la página se guarda
 * al momento, no al final--, así que lo único que falta es que el lienzo
 * vuelva a leerla. Sin esto, lo que se ve mientras trabaja es siempre lo de
 * antes de empezar, aunque el paso ya este hecho.
 *
 * Un aviso por paso podria ser una racha de peticiones seguidas; se deja
 * pasar como mucho una por segundo y medio, con la ultima siempre servida.
 */
const REFRESH_MS = 1500;
const refresh: { timer: ReturnType<typeof setTimeout> | null; pending: boolean } = {
  timer: null,
  pending: false,
};

function refreshCanvas(onChanged: () => Promise<void> | void): void {
  if (refresh.timer) {
    refresh.pending = true;
    return;
  }
  void onChanged();
  refresh.timer = setTimeout(() => {
    refresh.timer = null;
    if (refresh.pending) {
      refresh.pending = false;
      refreshCanvas(onChanged);
    }
  }, REFRESH_MS);
}

/**
 * Corta el reloj del lienzo. Lo llama el panel al desmontarse: trabajaria sobre
 * una pantalla que ya no esta.
 *
 * El avance no se toca: lo que agrupa vive en `aiRun` y quien vuelva a esta
 * página tiene que encontrarlo donde iba.
 */
export function cancelCanvasRefresh(): void {
  if (refresh.timer) clearTimeout(refresh.timer);
  refresh.timer = null;
  refresh.pending = false;
}

/** Lo que el panel pone de su parte: lo que solo el sabe o solo el puede hacer. */
export interface ListenHooks {
  /** La conversación a la que pertenece lo que llegue. */
  key: string;
  /** La página sobre la que escribe esta petición. */
  pageId: string;
  appId: string;
  /** Escuchar es querer ver: la vista vuelve al final aunque se estuviera leyendo mas arriba. */
  onListening: () => void;
  /** Lo único que se contesta hacia atras: se monta el marco escondido y se sigue. */
  onProbe: (probe: { probeId: string; hash: string }) => void;
  /**
   * Lo que se desplego mientras trabajaba sigue desplegado: es la misma fila en
   * otro estado, no una nueva. Llega el id que le toco a la entrada aterrizada.
   */
  onLanded: (entryId: number) => void;
  /** El lienzo tiene que volver a leer la página. */
  onChanged: () => Promise<void> | void;
  /** Hay cambios con riesgo esperando decision. */
  onImpact: (impact: DataImpact) => void;
}

/**
 * Escuchar una petición y dejar su resultado en la conversación.
 *
 * `since` es ahora mismo al mandar una petición nueva, y cuando de verdad
 * empezo al volver a una que ya venia en marcha --si no, el reloj se
 * reiniciaria en cada recarga aunque la IA llevara rato trabajando--. Quien se
 * engancha tarde recibe primero, de golpe, todo lo que ya había pasado.
 */
export async function listen(
  path: string,
  payload: unknown,
  since: number | undefined,
  hooks: ListenHooks,
): Promise<void> {
  const { key, pageId, appId, onListening, onProbe, onLanded, onChanged, onImpact } = hooks;
  const mine = key;
  const minePage = pageId;
  markListening(mine, true);
  // La senal de que la IA trabaja aquí: la escribe quien escucha el hilo de
  // avisos, que es el único que sabe cuando empieza y cuando termina.
  setAiWorking(minePage, true);
  openRun(mine, since ?? Date.now());
  onListening();
  seen = NO_PROGRESS;
  /** El id de la ejecución en el servidor: la llave de sus sumas de uso. */
  let runId = "";
  seenKey = mine;

  let result: AiPageResult | null = null;
  let failure = "";
  /*
   * La pregunta llega antes del final, en su propio aviso. Se guarda aquí
   * para que siga pintandose aunque el hilo se corte entre esa pregunta y el
   * resultado: lo que la IA quiso preguntar no se pierde por eso.
   */
  let asked: AiQuestion | null = null;
  /** El plan con el que se cerro el modo Plan, si se cerro. Mismo papel que `asked`. */
  let closedPlan: {
    texto: string;
    implementado: boolean;
    estado?: "implementando" | "incompleto";
  } | null = null;
  /** Los accesos que la IA dejo pedidos y hay que autorizar uno a uno. */
  let grants: AccessChange[] = [];

  const land = (
    text: string,
    steps?: AiStep[],
    notices?: string[],
    reasoning?: string,
    context?: string,
    /** Termino sin respuesta: fallo o se detuvo. Su proceso no se pliega. */
    unfinished = false,
  ) => {
    const now = readConversation(mine);
    const id = nextEntryId();
    writeConversation(mine, {
      ...now,
      ...(result ? { chatId: result.chatId } : {}),
      entries: [
        ...now.entries.map((entry) =>
          entry.plan?.estado === "implementando" ||
          (result?.implementation &&
            entry === now.entries.findLast((item) => item.plan && !item.plan.implementado))
            ? {
                ...entry,
                plan: {
                  ...entry.plan!,
                  implementado: result?.implementation === "implementado",
                  estado:
                    result?.implementation === "implementado" ? undefined : ("incompleto" as const),
                },
              }
            : entry,
        ),
        {
          id,
          from: "ia",
          text,
          steps,
          notices,
          reasoning,
          context,
          ...(unfinished ? { unfinished: true } : {}),
          ...(asked ? { question: asked } : {}),
          ...(closedPlan ? { plan: closedPlan } : {}),
          ...(grants.length ? { access: grants } : {}),
        },
      ],
    });
    onLanded(id);
    // El servidor ya la dejo abierta al guardarla: apuntarlo aquí es lo que
    // hace que ir a otra página la encuentre en blanco en vez de reponer la
    // que tuvo alli alguna vez.
    if (result) markOpenChat(appId, { chat: result.chatId, page: minePage }, key);
  };

  try {
    await stream<AiProgress>(path, payload, (part) => {
      if (part.tipo === "inicio") {
        // El servidor la tiene apuntada: a partir de aquí recargar o cerrar
        // ya no la pierde.
        markRun(mine, { runId: part.runId });
        runId = part.runId;
        return;
      }
      if (part.tipo === "pregunta") {
        // No es avance que mostrar --el paso de "preguntar" ya salio-- sino
        // lo que hara falta al aterrizar la respuesta.
        asked = part.pregunta;
        return;
      }
      if (part.tipo === "plan") {
        // Lo mismo que con la pregunta: se guarda para aterrizarlo con la
        // respuesta, y para que la tarjeta se pinte en cuanto se cierra.
        closedPlan = part.plan;
        return;
      }
      if (part.tipo === "probar") {
        onProbe({ probeId: part.probeId, hash: part.hash });
        return;
      }
      const now = seen;
      if (part.tipo === "texto") {
        seen = { ...now, text: part.texto };
      } else if (part.tipo === "paso") {
        // Que ya haya un paso dice que la ronda que pensaba termino: lo
        // que llevaba pensado se archiva antes de que la proxima ronda
        // lo reemplace, o se veria como si se hubiera borrado.
        const closing = now.reasoning
          ? {
              reasoningLog: [...now.reasoningLog, { id: nextEntryId(), text: now.reasoning }],
              reasoning: "",
            }
          : {};
        seen = {
          ...now,
          ...closing,
          steps: [...now.steps, { id: nextEntryId(), step: part.paso }],
        };
        // Este paso ya escribio su cambio; el lienzo lo puede leer ya.
        refreshCanvas(onChanged);
      } else if (part.tipo === "razonamiento") {
        seen = { ...now, reasoning: part.texto };
      } else if (part.tipo === "contexto") {
        seen = { ...now, context: part.texto };
      } else if (part.tipo === "uso") {
        // El contexto gastado se ve subir mientras trabaja, y se queda
        // apuntado en la conversación cuando termina.
        const now = readConversation(mine);
        writeConversation(mine, {
          ...now,
          usage: part.uso,
          ...(part.uso.totals
            ? { usageRuns: { ...now.usageRuns, [runId || `inicio:${since}`]: part.uso.totals } }
            : {}),
        });
        return;
      } else if (part.tipo === "fin") {
        result = part.resultado;
      } else {
        failure = part.mensaje;
      }
      showProgress();
    });

    if (result) {
      const done: AiPageResult = result;
      grants = done.access ?? [];
      // "cortar" cierra el plan sin pasar por el aviso de progreso -- no le
      // manda texto nuevo al modelo, así que no hay ronda que lo suelte
      // antes de tiempo-- y el resultado es lo único que lo trae.
      if (!closedPlan && done.plan) closedPlan = done.plan;
      land(
        done.message,
        done.steps,
        done.notices,
        done.reasoning,
        seen.context || undefined,
        // Detenida a mitad: no hay respuesta que dejar encima, así que lo
        // que se alcanzo a hacer se queda a la vista.
        done.stopped,
      );
      if (done.changed || done.notices.length) await onChanged();
      if (done.impact) onImpact(done.impact);
    } else {
      // Se corto antes del final. Lo escrito hasta aquí no se tira.
      land(
        failure || "La petición no llegó a terminar.",
        taken(seen),
        undefined,
        seen.reasoning || undefined,
        seen.context || undefined,
        true,
      );
    }
  } catch (err) {
    // Lo escrito hasta el fallo se queda en la conversación, con el porque.
    const written = seen.text;
    const detail = errorMessage(err);
    const explanation = /fetch|network|connection/i.test(detail)
      ? "Se perdió la conexión. Vuelve a abrir esta página para comprobar si la solicitud terminó antes de enviarla otra vez."
      : detail;
    land(
      written ? `${written}\n\n${explanation}` : explanation,
      taken(seen),
      undefined,
      seen.reasoning || undefined,
      seen.context || undefined,
      true,
    );
  } finally {
    seen = NO_PROGRESS;
    closeRun(mine);
    markListening(mine, false);
    setAiWorking(minePage, false);
  }
}
