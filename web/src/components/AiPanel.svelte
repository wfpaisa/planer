<!--
  La conversacion con la inteligencia artificial, dentro del dock.

  Su campo de texto es la unica entrada a la IA. Se llama "Conversaciones",
  nunca "historial": ese nombre es de los cambios de una pagina.

  Cada peticion escribe sobre la pagina abierta y solo sobre ella, y las
  conversaciones son de esa misma pagina: la lista ensena solo las suyas, asi
  que ninguna necesita decir en cual se hizo.

  Lo escrito y lo conversado no vive aqui sino en `aiConversation`, para que
  esconder el dock no lo borre.
-->
<script lang="ts">
  import { aiUsable } from "@shared/aiCatalog";
  import type {
    AccessChange,
    AiChat,
    AiChatSummary,
    AiChoice,
    AiConfigView,
    AiDebugRead,
    AiPageResult,
    AiProgress,
    AiQuestion,
    AiQuestionOption,
    AiRunInfo,
    AiStep,
    DataImpact,
    PageIssue,
    PageRecord,
  } from "@shared/types";
  import { untrack } from "svelte";

  import { aiActivity, setAiWorking } from "../lib/aiActivity.svelte";
  import {
    type Conversation,
    conversationKey,
    isListening,
    loadOpenChat,
    markHydrated,
    markListening,
    markOpenChat,
    markResumed,
    nextEntryId,
    readChoice,
    readConversation,
    readDebug,
    resolveChoice,
    setOpenChat,
    wasHydrated,
    wasResumed,
    writeChoice,
    writeConversation,
    writeDebug,
  } from "../lib/aiConversation";
  import {
    AI_FILE_ACCEPT,
    MAX_AI_FILES,
    onFilesForAi,
    pastedAsFile,
    pastedFiles,
    readAiFile,
    sendFilesToAi,
  } from "../lib/aiFiles";
  import { NO_PROGRESS, type Progress, taken } from "../lib/aiProgress";
  import { useBuilder } from "../lib/builderContext";
  import { cx } from "../lib/cx";
  import { frameThrottle } from "../lib/frameThrottle";
  import { appDocLoader } from "../lib/htmlDocs";
  import { onPicked, picker, setPickerActive } from "../lib/pagePicker.svelte";
  import { api, errorMessage, pb, post, stream } from "../lib/pb";
  import { QUICK_ASK, QUICK_ASK_IDS, type QuickAskId, SAMPLES } from "../lib/quickAsk";
  import { navigate } from "../lib/router.svelte";
  import AccessGrant from "./ai/AccessGrant.svelte";
  import ChatList from "./ai/ChatList.svelte";
  import ContextMeter from "./ai/ContextMeter.svelte";
  import CopyLine from "./ai/CopyLine.svelte";
  import DebugContext from "./ai/DebugContext.svelte";
  import FileBadges from "./ai/FileBadges.svelte";
  import ModelPicker from "./ai/ModelPicker.svelte";
  import Notices from "./ai/Notices.svelte";
  import PickedBadges from "./ai/PickedBadges.svelte";
  import Question from "./ai/Question.svelte";
  import Reasoning from "./ai/Reasoning.svelte";
  import Steps from "./ai/Steps.svelte";
  import Working from "./ai/Working.svelte";
  import Icon from "./Icon.svelte";
  import Markdown from "./Markdown.svelte";
  import OmniPanel from "./OmniPanel.svelte";
  import PageProbe, { type ProbeRequest } from "./PageProbe.svelte";
  import PlanerAvatar from "./PlanerAvatar.svelte";
  import { Button, Dropdown, MenuItem, MenuLabel, MenuSeparator, Spinner, Tag } from "./ui";

  let {
    appId,
    page,
    onClose,
    onChanged,
    onImpact,
  }: {
    appId: string;
    /** La pagina sobre la que escribe esta peticion. */
    page: PageRecord;
    /** Esconder el dock. No borra lo escrito ni lo conversado. */
    onClose: () => void;
    onChanged: () => Promise<void> | void;
    /** Hay cambios con riesgo esperando decision. */
    onImpact: (impact: DataImpact) => void;
  } = $props();

  const key = $derived(conversationKey(appId, page.id));

  const builder = useBuilder();

  /*
   * La IA esta trabajando en otra pagina de esta aplicacion.
   *
   * El servidor no cambia: sigue admitiendo una peticion por pagina y varias
   * paginas a la vez. El limite de una a la vez es esta condicion y nada mas,
   * asi que levantarlo el dia que se quiera trabajar en paralelo es quitarla.
   */
  const elsewhere = $derived(aiActivity.pages.find((id) => id !== page.id) ?? "");
  const blockedBy = $derived(builder.pages.find((p) => p.id === elsewhere) ?? null);
  const blocked = $derived(!!elsewhere);

  // Lo conversado se lee una vez al montar; a partir de ahi lo escrito aqui y
  // lo guardado fuera van a la par, porque cada cambio pasa por `update`.
  let chat = $state<Conversation>(untrack(() => readConversation(key)));
  let config = $state<AiConfigView | null>(null);
  /**
   * Con que se pide: el modelo y cuanto se le pide pensar. Sale de lo que se
   * eligio la ultima vez, o de lo que dejo puesto quien administra.
   */
  let choice = $state<AiChoice | null>(null);
  /** Ver el contexto que se le manda al modelo. Dura entre visitas. */
  let debug = $state(untrack(() => readDebug()));
  let busy = $state(false);
  /**
   * La pagina cuya peticion se esta escuchando. Vacio: no se escucha ninguna.
   *
   * El hilo de avisos sobrevive a cambiar de pagina --la peticion sigue su
   * curso-- asi que "hay una peticion en marcha" y "la hay en esta pagina" no
   * son lo mismo. Lo que se pinta como trabajo en curso es lo segundo.
   */
  let listeningPage = $state("");
  /**
   * La peticion en marcha, tal y como la conoce el servidor. Mientras tenga
   * nombre, la peticion no depende de esta ventana: se puede recargar o cerrar
   * y al volver a esta pagina se sigue viendo. Vacio mientras se pide y si el
   * servidor no llega a reconocerla; entonces salir si la pierde.
   */
  let runId = $state("");
  /** Se pidio detenerla y todavia no ha llegado el final. */
  let stopping = $state(false);
  /**
   * La IA quiere ver si la pagina que escribio se dibuja sin errores.
   *
   * Es lo unico que el servidor pide de vuelta a mitad de una peticion: aqui
   * hay navegador y alli no. Se dibuja escondida y se contesta con lo que la
   * consola solto.
   */
  let probe = $state<ProbeRequest | null>(null);
  let list = $state<AiChatSummary[] | null>(null);
  /** Lo que la IA lleva producido en esta peticion. Solo para mirar. */
  let progress = $state<Progress>(NO_PROGRESS);
  let scroller = $state<HTMLDivElement | null>(null);
  /** Si la vista esta pegada al final. Mientras lo este, se sigue sola. */
  let atEnd = $state(true);
  let box = $state<HTMLTextAreaElement | null>(null);
  /** El selector nativo de archivos, escondido: lo abre el menu del "+". */
  let fileInput = $state<HTMLInputElement | null>(null);
  /**
   * El hero es la portada de la conversacion vacia. Al mandar la primera
   * peticion sale hacia arriba y se desvanece mientras el primer mensaje sube.
   * `leaving` conserva el hero un instante para que se vea salir.
   */
  let phase = $state<"hero" | "leaving" | "gone">(
    untrack(() => (chat.entries.length ? "gone" : "hero")),
  );

  const loadDoc = $derived(appDocLoader(appId));

  /** La peticion que se esta escuchando es la de la pagina abierta. */
  const working = $derived(busy && listeningPage === page.id);

  /* Lo que de verdad se puede mandar: sin texto ni nada anadido no hay peticion. */
  const canSend = $derived(
    !blocked && (!!chat.draft.trim() || chat.picks.length > 0 || chat.files.length > 0),
  );

  /*
   * Encendida no basta: sin un servidor con clave y con algun modelo no hay a
   * quien pedirle nada, y es mejor decirlo aqui que dejar que falle al enviar.
   */
  const ready = $derived(aiUsable(config));

  /** El modelo elegido no mira imagenes. Se lee al adjuntar. */
  const blind = $derived.by(() => {
    const now = choice;
    if (!now) return false;
    const provider = config?.providers.find((p) => p.id === now.provider);
    return !provider?.models.find((m) => m.id === now.model)?.vision;
  });

  /**
   * Cada cambio se guarda fuera, para que cerrar la barra no lo pierda.
   *
   * `forKey` existe para lo que llega tarde: una respuesta puede aterrizar
   * cuando ya se cambio de pagina, y tiene que caer en la conversacion donde
   * se pidio, no en la que se este mirando. Lo de pantalla solo se toca cuando
   * las dos son la misma.
   */
  function update(next: Conversation, forKey: string = key): void {
    writeConversation(forKey, next);
    if (forKey === key) chat = next;
  }

  /*
   * Cambiar de pagina trae la conversacion de esa pagina.
   *
   * Lo conversado se lee al montar y no vuelve a leerse solo, asi que sin esto
   * el dock seguiria ensenando la conversacion de la pagina anterior --y el
   * siguiente cambio la escribiria bajo la clave de la nueva, pisando la que
   * de verdad era suya--.
   *
   * No hay nada que conservar a mano cuando la IA esta trabajando aqui: lo que
   * el hilo de avisos va dejando se guarda en la conversacion de esta pagina,
   * asi que volver a leerla es volver a lo que esta pasando ahora mismo.
   */
  let shown = untrack(() => key);
  $effect(() => {
    const mine = key;
    const pageId = page.id;

    if (mine !== shown) {
      shown = mine;
      const now = readConversation(mine);
      chat = now;
      phase = now.entries.length ? "gone" : "hero";
      // La lista era la de la pagina de la que se viene.
      list = null;
    }

    void reopenOpen(mine, pageId);
  });

  /**
   * Al llegar a una pagina, reponer la conversacion abierta si es la suya.
   *
   * Abierta hay una sola en toda la aplicacion: la ultima en la que se hablo.
   * Asi, recorrer las paginas no va dejando en cada una una conversacion de
   * cualquier dia delante, como si se acabara de hablar ahi. Las demas empiezan
   * en blanco y lo de antes sigue a un clic, en "Conversaciones anteriores".
   *
   * Cual esta abierta lo dice el servidor, no esta pestana: quien sigue desde
   * otro navegador se encuentra delante la que dejo, y solo esa.
   *
   * Se mira una sola vez por pagina y visita: lo que pase despues --empezar una
   * conversacion nueva, abrir otra de la lista-- manda sobre esto, y volver a
   * la pagina no puede reponer nada encima.
   */
  async function reopenOpen(mine: string, pageId: string): Promise<void> {
    if (wasHydrated(mine)) return;
    markHydrated(mine);
    // Ya hay algo delante, o el hilo de avisos esta trayendo una peticion en
    // marcha: eso es lo que se estaba viendo y no se pisa.
    if (readConversation(mine).entries.length || isListening(mine)) return;

    try {
      const open = await loadOpenChat(appId);
      // La abierta es de otra pagina: aqui se empieza en blanco.
      if (!open || open.page !== pageId) return;
      const saved = await api<AiChat>(`/api/apps/${appId}/conversaciones/${open.chat}`);

      // Entre preguntar y recibir pudo empezar algo aqui: eso es mas nuevo.
      const now = readConversation(mine);
      if (now.entries.length || isListening(mine)) return;

      update({ ...now, chatId: saved.id, entries: saved.messages.map(toEntry) }, mine);
      if (mine === key) phase = "gone";
    } catch {
      /* sin respuesta se empieza en blanco, que es lo que ya se estaba viendo */
    }
  }

  $effect(() => {
    api<AiConfigView>("/api/ai/config")
      .then((cfg) => {
        config = cfg;
        choice = resolveChoice(cfg, readChoice());
      })
      .catch(() => {
        config = null;
      });
  });

  /** Cambiar de modelo o de nivel: dura mas alla de esta pagina y esta visita. */
  function pick(patch: Partial<AiChoice>): void {
    if (!choice) return;
    const next = { ...choice, ...patch };
    choice = next;
    writeChoice(next);
  }

  /*
   * El cursor de seleccion. Lo senalado se queda en la conversacion de esta
   * pagina, junto a lo que se esta escribiendo; el mismo elemento senalado dos
   * veces no deja dos badges.
   *
   * La suscripcion se hace una sola vez: la clave se lee dentro del aviso, que
   * corre fuera del efecto, asi que cambiar de pagina no la vuelve a montar.
   */
  $effect(() =>
    onPicked((block) => {
      const now = readConversation(key);
      const already = now.picks.some((p) => (p.name || p.path) === (block.name || block.path));
      if (already) return;
      update({ ...now, picks: [...now.picks, block] });
    }),
  );

  /**
   * Cuantas veces se ha pedido llevar el foco al campo de texto. Sube uno cada
   * vez que se pide; el numero en si no significa nada, solo que hubo peticion
   * nueva.
   */
  let focusRequests = $state(0);

  /*
   * Los archivos que se sueltan encima del editor y se mandan a la
   * conversacion. Se leen aqui, en el navegador, y se quedan como badges hasta
   * que se envie la peticion: lo que el archivo aporta lo decide quien escribe,
   * asi que el foco se va al campo de texto para que lo diga.
   *
   * El que no se pueda leer se cuenta como una respuesta de la IA. Es un aviso,
   * no una peticion fallida: los demas del mismo lote entran igual.
   */
  $effect(() =>
    onFilesForAi((dropped) => {
      void (async () => {
        for (const file of dropped) {
          const now = readConversation(key);
          if (now.files.length >= MAX_AI_FILES) {
            update({
              ...now,
              entries: [
                ...now.entries,
                {
                  id: nextEntryId(),
                  from: "ia",
                  text: `No caben más de ${MAX_AI_FILES} archivos en una misma petición.`,
                },
              ],
            });
            phase = "gone";
            return;
          }
          try {
            const read = await readAiFile(file);
            const before = readConversation(key);
            /*
             * Un modelo sin vista no puede mirar la imagen. Se adjunta igual
             * --su nombre sigue contando en el contexto-- pero se dice, en
             * vez de dejar que responda como si la hubiera visto.
             */
            const unseen = read.kind === "image" && blind;
            update({
              ...before,
              files: [...before.files, read],
              entries: unseen
                ? [
                    ...before.entries,
                    {
                      id: nextEntryId(),
                      from: "ia",
                      text: "El modelo elegido no mira imágenes. Se adjunta igual, pero solo verá su nombre: elige uno con vista para que la lea.",
                    },
                  ]
                : before.entries,
            });
            if (unseen) phase = "gone";
          } catch (err) {
            const before = readConversation(key);
            update({
              ...before,
              entries: [
                ...before.entries,
                { id: nextEntryId(), from: "ia", text: errorMessage(err) },
              ],
            });
            phase = "gone";
          }
        }
        // El foco no se lleva aqui: la pregunta que trajo el archivo todavia
        // puede estar en pantalla, y al cerrarse se lo llevaria detras. Se
        // pide, y se cumple despues del siguiente dibujado.
        focusRequests += 1;
      })();
    }),
  );

  /*
   * Llevar el cursor al campo de texto.
   *
   * Dos cosas lo piden y cuentan igual. Adjuntar: el archivo es la mitad de la
   * peticion y la otra mitad --que hacer con el-- hay que escribirla. Y el
   * boton del documento en blanco, que trae la columna para escribir ya; ese
   * llega desde fuera, y la columna puede acabar de dibujarse, asi que se lee
   * la cuenta del dock y no un evento que se habria perdido antes de montar.
   */
  const focusAsked = $derived(focusRequests + builder.dock.focusAsks);
  /* Hasta que peticion se atendio. Sin esto no habria como distinguir "hay una
     nueva" de "el campo se volvio a montar y la cuenta sigue donde estaba". */
  let focusDone = 0;

  $effect(() => {
    const asked = focusAsked;
    /* Se mira el campo, no se ignora: el boton del documento en blanco trae la
       columna y pide el cursor en el mismo gesto, asi que la peticion llega
       antes de que el campo exista y hay que volver cuando aparezca. */
    const field = box;
    if (asked > focusDone && field) {
      focusDone = asked;
      field.focus();
    }
  });

  /* Salir del cursor con escape tambien desde el panel: el documento solo se
     entera de la tecla cuando el foco esta dentro de su marco. */
  $effect(() => {
    if (!picker.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerActive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* Esconder el dock apaga el cursor: sin el boton no habria como apagarlo. */
  $effect(() => () => setPickerActive(false));

  /*
   * Seguir el final de la conversacion. Mientras la respuesta llega por partes
   * va al mismo ritmo que los redibujados --uno cada pocos frames-- y sin
   * suavizado: un desplazamiento suave por token pelea contra el que hace a
   * mano quien esta leyendo mas arriba.
   *
   * Y solo si la vista ya estaba al final: subir a releer algo mientras la IA
   * escribe no puede acabar en un tiron hacia abajo cada pocos frames. Cuando
   * no lo esta aparece el boton que baja de un toque.
   */
  let streaming = false;
  let stuck = true;

  /*
   * Se mueve la columna, no un elemento dentro de ella: `scrollIntoView`
   * arrastra tambien a los contenedores de arriba, y el dock vive dentro de la
   * escena de la pagina.
   */
  function jump(behavior: ScrollBehavior): void {
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior });
  }

  const scrollToEnd = frameThrottle(() => jump(streaming ? "auto" : "smooth"));

  function follow(): void {
    if (stuck) scrollToEnd();
  }

  /** Bajar del todo a mano, y volver a engancharse al final. */
  function goToEnd(): void {
    stuck = true;
    atEnd = true;
    jump("smooth");
  }

  // "Al final" con holgura: un par de lineas de margen para que redondeos y
  // fuentes a medio cargar no desenganchen la vista sin motivo.
  function onScroll(): void {
    const el = scroller;
    if (!el) return;
    const end = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    stuck = end;
    atEnd = end;
  }

  $effect(() => {
    if (chat.entries.length) follow();
  });

  $effect(() => {
    if (!working) return;
    // Sin nada llegado todavia no hay final nuevo al que ir.
    if (progress.text || progress.reasoning || progress.steps.length) follow();
  });

  /*
   * El campo crece con lo escrito, hasta un tope. Se mide en cada cambio: hay
   * que devolverlo a "auto" antes de leer su alto real, o borrar una linea no
   * lo encogeria nunca.
   */
  $effect(() => {
    void chat.draft;
    const el = box;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  });

  /*
   * Lo que se vio llegar, fuera del estado: el trozo entra aqui en cada aviso
   * del servidor y el redibujado se pide agrupado, con lo ultimo que haya.
   */
  let seen: Progress = NO_PROGRESS;
  const showProgress = frameThrottle(() => {
    progress = seen;
  });

  /** Desde cuando trabaja la peticion en marcha. Mueve el reloj de "Working". */
  let startedAt = $state(0);

  /*
   * Cada paso que la IA da ya quedo escrito en la base --la pagina se guarda
   * al momento, no al final--, asi que lo unico que falta es que el lienzo
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

  function refreshCanvas(): void {
    if (refresh.timer) {
      refresh.pending = true;
      return;
    }
    void onChanged();
    refresh.timer = setTimeout(() => {
      refresh.timer = null;
      if (refresh.pending) {
        refresh.pending = false;
        refreshCanvas();
      }
    }, REFRESH_MS);
  }

  // Lo pedido a los frames y el reloj del lienzo se cancelan al desmontar: los
  // dos trabajarian sobre un panel que ya no esta en pantalla.
  $effect(() => () => {
    scrollToEnd.cancel();
    showProgress.cancel();
    if (refresh.timer) clearTimeout(refresh.timer);
  });

  /**
   * Escuchar una peticion y dejar su resultado en la conversacion.
   *
   * Da igual si es la que se acaba de mandar o una que ya venia en marcha desde
   * antes de recargar: lo que llega se mira en vivo, y lo que quede al final
   * entra en la conversacion por el mismo sitio. Quien se engancha tarde recibe
   * primero, de golpe, todo lo que ya habia pasado.
   */
  async function listen(path: string, payload: unknown, since?: number): Promise<void> {
    const mine = key;
    const minePage = page.id;
    markListening(mine, true);
    listeningPage = minePage;
    // La senal de que la IA trabaja aqui: la escribe quien escucha el hilo de
    // avisos, que es el unico que sabe cuando empieza y cuando termina.
    setAiWorking(minePage, true);
    busy = true;
    stopping = false;
    runId = "";
    // Al mandar una peticion nueva, "since" es ahora mismo. Al volver a una
    // que ya venia en marcha, es cuando de verdad empezo --si no, el reloj
    // se reiniciaria en cada recarga, aunque la IA llevara rato trabajando.
    startedAt = since ?? Date.now();
    streaming = true;
    // Escuchar es querer ver: la vista vuelve al final aunque se estuviera
    // leyendo mas arriba.
    stuck = true;
    atEnd = true;
    seen = NO_PROGRESS;
    progress = NO_PROGRESS;

    let result: AiPageResult | null = null;
    let failure = "";
    /*
     * La pregunta llega antes del final, en su propio aviso. Se guarda aqui
     * para que siga pintandose aunque el hilo se corte entre esa pregunta y el
     * resultado: lo que la IA quiso preguntar no se pierde por eso.
     */
    let asked: AiQuestion | null = null;
    /** Los accesos que la IA dejo pedidos y hay que autorizar uno a uno. */
    let grants: AccessChange[] = [];

    const land = (
      text: string,
      steps?: AiStep[],
      notices?: string[],
      reasoning?: string,
      context?: string,
    ) => {
      const now = readConversation(mine);
      update(
        {
          ...now,
          ...(result ? { chatId: result.chatId } : {}),
          entries: [
            ...now.entries,
            {
              id: nextEntryId(),
              from: "ia",
              text,
              steps,
              notices,
              reasoning,
              context,
              ...(asked ? { question: asked } : {}),
              ...(grants.length ? { access: grants } : {}),
            },
          ],
        },
        mine,
      );
      // El servidor ya la dejo abierta al guardarla: apuntarlo aqui es lo que
      // hace que ir a otra pagina la encuentre en blanco en vez de reponer la
      // que tuvo alli alguna vez.
      if (result) markOpenChat(appId, { chat: result.chatId, page: minePage }, key);
    };

    try {
      await stream<AiProgress>(path, payload, (part) => {
        if (part.tipo === "inicio") {
          // El servidor la tiene apuntada: a partir de aqui recargar o cerrar
          // ya no la pierde.
          runId = part.runId;
          return;
        }
        if (part.tipo === "pregunta") {
          // No es avance que mostrar --el paso de "preguntar" ya salio-- sino
          // lo que hara falta al aterrizar la respuesta.
          asked = part.pregunta;
          return;
        }
        if (part.tipo === "probar") {
          // Lo unico que se contesta hacia atras. No es avance que mostrar:
          // se monta el marco escondido y se sigue.
          probe = { probeId: part.probeId, hash: part.hash };
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
          refreshCanvas();
        } else if (part.tipo === "razonamiento") {
          seen = { ...now, reasoning: part.texto };
        } else if (part.tipo === "contexto") {
          seen = { ...now, context: part.texto };
        } else if (part.tipo === "uso") {
          // El contexto gastado se ve subir mientras trabaja, y se queda
          // apuntado en la conversacion cuando termina.
          update({ ...readConversation(mine), usage: part.uso }, mine);
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
        land(done.message, done.steps, done.notices, done.reasoning, seen.context || undefined);
        if (done.changed || done.notices.length) await onChanged();
        if (done.impact) onImpact(done.impact);
      } else {
        // Se corto antes del final. Lo escrito hasta aqui no se tira.
        land(
          failure || "La petición no llegó a terminar.",
          taken(seen),
          undefined,
          seen.reasoning || undefined,
          seen.context || undefined,
        );
      }
    } catch (err) {
      // Lo escrito hasta el fallo se queda en la conversacion, con el porque.
      const written = seen.text;
      land(
        written ? `${written}\n\n${errorMessage(err)}` : errorMessage(err),
        taken(seen),
        undefined,
        seen.reasoning || undefined,
        seen.context || undefined,
      );
    } finally {
      streaming = false;
      busy = false;
      stopping = false;
      runId = "";
      seen = NO_PROGRESS;
      progress = NO_PROGRESS;
      markListening(mine, false);
      setAiWorking(minePage, false);
      listeningPage = "";
    }
  }

  /**
   * Manda una peticion ya resuelta: el campo de texto o un atajo, da igual.
   *
   * `label`, si viene, es lo que se lee en la burbuja en vez del texto --un
   * atajo manda un pedido largo en ingles, y la burbuja muestra su rotulo
   * corto en espanol--. `keepDraft` deja el campo de texto como estaba: un
   * atajo se manda solo, sin tocar lo que se llevaba escrito para lo
   * siguiente.
   */
  async function dispatch(
    text: string,
    opts?: { label?: string; keepDraft?: boolean },
  ): Promise<void> {
    if (busy) return;
    // La IA trabaja en otra pagina: lo escrito se queda donde esta, esperando
    // a que aquello termine.
    if (blocked) return;
    const value = text.trim();
    if (!value) return;
    const asked = readConversation(key);
    // La primera peticion echa a la portada: sube y se desvanece.
    if (phase === "hero") {
      phase = "leaving";
      setTimeout(() => {
        phase = "gone";
      }, 450);
    }
    // Lo senalado y lo adjunto viajan con la peticion y se sueltan al enviarla:
    // la siguiente no arrastra lo que se preparo para esta.
    const picked = asked.picks;
    const files = asked.files;
    update({
      ...asked,
      ...(opts?.keepDraft ? {} : { draft: "" }),
      picks: [],
      files: [],
      entries: [
        ...asked.entries,
        {
          id: nextEntryId(),
          from: "yo",
          text: value,
          ...(opts?.label ? { label: opts.label } : {}),
          // Los adjuntos quedan nombrados en el mensaje: al releer la
          // conversacion se entiende con que se pidio lo que se pidio.
          ...(files.length ? { files: files.map((f) => f.name) } : {}),
          ...(picked.length ? { picked: picked.map((p) => p.label) } : {}),
        },
      ],
    });

    await listen(`/api/apps/${appId}/paginas/${page.id}/ia`, {
      prompt: value,
      chatId: asked.chatId || undefined,
      ...(picked.length ? { picked } : {}),
      ...(files.length ? { files } : {}),
      ...(choice ? { choice } : {}),
      ...(debug && config?.debugButton ? { debug: true } : {}),
    });
  }

  const send = (text: string) => dispatch(text);

  /**
   * Contestar una pregunta de la IA.
   *
   * La peticion anterior ya termino y cada peticion abre una conversacion
   * nueva con el modelo: una respuesta suelta llegaria sin nada a lo que
   * contestar. Por eso el prompt lleva dentro las tres cosas que hacen falta
   * --lo que se pidio, lo que se pregunto y lo que se eligio-- y la burbuja
   * muestra solo lo elegido, que es lo unico que se decidio aqui.
   */
  function answer(question: AiQuestion, option: AiQuestionOption): void {
    // Lo que motivo la pregunta: sin ello el modelo sabe la respuesta pero no
    // para que. Es el ultimo turno de quien construye, que es el que pregunto.
    const asked = [...readConversation(key).entries].reverse().find((e) => e.from === "yo");
    const lines = [
      asked ? `Lo que se pidió: ${asked.label ?? asked.text}` : "",
      `Se preguntó: ${question.question}`,
      `Se eligió: ${option.label}${option.description ? ` (${option.description})` : ""}`,
      "Continúa con eso: no vuelvas a preguntar lo mismo.",
    ].filter(Boolean);
    void dispatch(lines.join("\n"), { label: option.label, keepDraft: true });
  }

  /** Un atajo, a un clic: manda de una vez, sin pasar por el campo de texto. */
  const runQuickAsk = (id: QuickAskId) =>
    dispatch(QUICK_ASK[id].prompt, { label: QUICK_ASK[id].label, keepDraft: true });

  /** Abrir el archivo elegido con el selector nativo del "+" a la conversacion. */
  function attachFiles(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files?.length) sendFilesToAi(Array.from(input.files));
    input.value = "";
  }

  /**
   * Detener lo que la IA esta haciendo.
   *
   * No corta el hilo de avisos: se le pide al servidor que pare, la peticion
   * corta por el primer sitio seguro y el final llega por donde llegan todos.
   * Asi lo que se alcanzo a hacer queda contado en la conversacion.
   */
  async function stop(): Promise<void> {
    if (!busy || stopping) return;
    stopping = true;
    try {
      await post(`/api/apps/${appId}/paginas/${page.id}/ia/detener`);
    } catch {
      // O ya habia terminado, o nunca llego a arrancar: el final llega igual.
    }
  }

  /*
   * Volver a una peticion que seguia en marcha.
   *
   * La peticion vive en el servidor, no en esta ventana: recargar, cerrar el
   * dock o volver mas tarde a esta pagina no la corta. Al abrir el panel se
   * pregunta si hay alguna y, si la hay, se retoma donde iba --con lo que se
   * pidio delante, que tras recargar ya no lo tiene nadie mas--.
   *
   * Se retoma una sola vez por pagina: repetirlo cuando la peticion ya termino
   * volveria a recoger el mismo resultado. La marca se pone al recibir la
   * respuesta, no al preguntar, porque el panel se monta mas de una vez y una
   * marca puesta antes de tiempo dejaria fuera al montaje que si sigue vivo.
   */
  $effect(() => {
    const mine = key;
    const id = appId;
    const pageId = page.id;
    if (wasResumed(mine) || isListening(mine)) return;

    let dropped = false;
    api<AiRunInfo | null>(`/api/apps/${id}/paginas/${pageId}/ia`)
      .then((run) => {
        if (dropped || wasResumed(mine) || isListening(mine)) return;
        markResumed(mine);
        if (!run) return;
        const now = readConversation(mine);
        // Tras recargar no queda ni lo que se pidio: se repone antes de seguir,
        // o la respuesta apareceria sola, sin pregunta delante.
        const asked = now.entries.some((e) => e.from === "yo" && e.text === run.prompt);
        if (!asked) {
          update(
            {
              ...now,
              entries: [...now.entries, { id: nextEntryId(), from: "yo", text: run.prompt }],
            },
            mine,
          );
        }
        if (mine === key) phase = "gone";
        void listen(`/api/apps/${id}/paginas/${pageId}/ia/seguir`, {}, Date.parse(run.started));
      })
      .catch(() => {
        /* sin respuesta no hay nada que retomar */
      });

    return () => {
      dropped = true;
    };
  });

  /*
   * Salir con una peticion que el servidor todavia no reconoce si la pierde:
   * no hay a que volver a engancharse. En cuanto la reconoce --que es lo
   * normal-- este aviso desaparece, porque salir deja de costar nada.
   */
  $effect(() => {
    if (!busy || runId) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  });

  async function openList(): Promise<void> {
    list = [];
    try {
      list = await api<AiChatSummary[]>(
        `/api/apps/${appId}/conversaciones?pagina=${encodeURIComponent(page.id)}`,
      );
    } catch {
      list = [];
    }
  }

  /**
   * Un mensaje guardado, tal como se pinta en la conversacion.
   *
   * Con que se pidio --los archivos y lo senalado-- vuelve a la burbuja como
   * estaba: es lo que hace entendible una conversacion que se relee dias
   * despues.
   */
  const toEntry = (m: AiChat["messages"][number]) => ({
    id: nextEntryId(),
    from: m.from,
    text: m.text,
    steps: m.steps,
    question: m.question,
    reasoning: m.reasoning,
    files: m.files,
    picked: m.picked,
  });

  async function openChat(id: string): Promise<void> {
    try {
      const saved = await api<AiChat>(`/api/apps/${appId}/conversaciones/${id}`);
      const now = readConversation(key);
      update({
        chatId: saved.id,
        draft: now.draft,
        picks: now.picks,
        files: now.files,
        entries: saved.messages.map(toEntry),
      });
      // Abrir una es dejarla abierta: es la que se repone al volver, aqui y
      // desde cualquier otro navegador.
      setOpenChat(appId, { chat: saved.id, page: saved.page }, key);
      phase = "gone";
      list = null;
    } catch (err) {
      update({
        ...readConversation(key),
        entries: [{ id: nextEntryId(), from: "ia", text: errorMessage(err) }],
      });
      phase = "gone";
      list = null;
    }
  }

  /**
   * Se acabo de probar la pagina: se devuelve lo que solto.
   *
   * Si falla el envio no se reintenta. La espera del servidor vence sola y la
   * IA se entera de que no se pudo probar, que es justo lo que paso.
   */
  function sendProbe(report: { probeId: string; issues: PageIssue[]; warnings: string[] }): void {
    probe = null;
    void post(`/api/apps/${appId}/paginas/${page.id}/ia/prueba`, report).catch(() => {});
  }

  /** Quitar un elemento senalado. Lo escrito no se toca. */
  function removePick(id: string): void {
    const now = readConversation(key);
    update({ ...now, picks: now.picks.filter((p) => p.id !== id) });
  }

  /** Quitar un archivo adjunto. Lo escrito no se toca. */
  function removeFile(id: string): void {
    const now = readConversation(key);
    update({ ...now, files: now.files.filter((f) => f.id !== id) });
  }

  /** Empezar de cero es un acto pedido, nunca un efecto de cerrar y abrir. */
  function startNew(): void {
    update({ entries: [], chatId: "", draft: "", picks: [], files: [] });
    // La aplicacion se queda sin ninguna abierta: volver aqui --o entrar desde
    // otro navegador-- empieza igual de limpio, no con la de antes repuesta.
    setOpenChat(appId, null, key);
    phase = "hero";
    setPickerActive(false);
    box?.focus();
  }

  /**
   * El contexto que quedo guardado de la ultima peticion de esta pagina.
   *
   * Se escribe siempre, termine bien o mal, asi que existe despues del fallo
   * aunque nadie hubiera encendido nada antes. Se pide al desplegar: lleva el
   * HTML entero de la pagina y casi nunca se mira.
   */
  async function loadSavedContext(): Promise<{ text: string; truncated: boolean } | null> {
    const saved = await api<AiDebugRead>(`/api/apps/${appId}/paginas/${page.id}/ia/depuracion`);
    return saved ? { text: saved.context, truncated: saved.truncated } : null;
  }

  /** La ultima respuesta de la IA: la unica a la que pertenece lo guardado. */
  const lastAiEntry = $derived([...chat.entries].reverse().find((e) => e.from === "ia")?.id ?? 0);

  /** Escribir un ejemplo en el campo. Se manda cuando quien pide lo decida. */
  function pickSample(text: string): void {
    update({ ...readConversation(key), draft: text });
    box?.focus();
  }
</script>

<PageProbe
  request={probe}
  {appId}
  pageId={page.id}
  sources={page.sources}
  client={pb}
  {loadDoc}
  onDone={sendProbe}
/>

<!--
  Los dos caminos que antes solo existian en la portada: en cuanto habia una
  conversacion empezada no habia forma de abrir las anteriores ni de empezar
  otra sin salir. Aqui estan siempre.

  Con una peticion en marcha los dos se cierran: cambiar de conversacion ahora
  dejaria caer la respuesta en la que no es. Se espera, o se detiene.
-->
{#snippet actions()}
  {#if chat.entries.length > 0}
    <Button
      variant="soft"
      disabled={working}
      tip={working ? "Espera a que termine o detenla" : "Conversacion nueva"}
      buttonClass="btn-new-conversation"
      class="btn-icon"
      onclick={startNew}
    >
      <Icon name="square-pen" size={20} />
    </Button>
  {/if}
  <Button
    variant="soft"
    disabled={working}
    tip={working ? "Espera a que termine o detenla" : "Conversaciones anteriores"}
    buttonClass="btn-previous-conversations"
    class="btn-icon"
    onclick={() => void openList()}
  >
    <Icon name="messages-square" size={20} />
  </Button>
{/snippet}

<!-- Sin titulo: la cabecera de la conversacion la llenan sus propios mandos. -->
<OmniPanel {onClose} flush={!list && ready} actions={ready && !list ? actions : undefined}>
  {#if !ready}
    <p class="chat-no-server text-center">
      No hay ningun servidor de inteligencia artificial conectado. Se conecta en los ajustes de tu
      cuenta.
    </p>
  {:else if list}
    <ChatList chats={list} onOpen={(id) => void openChat(id)} onBack={() => (list = null)} />
  {:else}
    <div class="panel-body-ai flex h-full flex-col">
      <div class="panel-scroll-ai flex-1">
        <div bind:this={scroller} onscroll={onScroll} class="chat-log h-full flex flex-col gap-5">
          {#if phase !== "gone"}
            <div
              class={cx(
                "chat-hero hero-ai",
                phase === "hero" && "hero-in",
                phase === "leaving" && "hero-leave",
              )}
            >
              <!--
                Aqui esta la cara, asi que lo escrito es lo que dice ella: en
                primera persona y hablando de tu a quien lee. Contarlo desde
                fuera --"la inteligencia artificial lo construye"-- pone a un
                narrador entre los dos y deja al personaje de adorno.
              -->
              <PlanerAvatar mood="ok" size={60} icon="message-01" />
              <p class="chat-hero-title">¿Qué quieres ver en esta página?</p>
              <p class="chat-hero-subtitle">Describe una pantalla o un cambio y lo construiré.</p>

              <!--
                Dos grupos, dos gestos distintos. Los atajos son peticiones ya
                completas: un clic las manda de una vez, sin pasar por el campo
                ni por el boton de enviar. Los ejemplos describen una pantalla
                nueva y hace falta leerlos y ajustarlos, asi que solo llenan el
                campo.
              -->
              <div class="chat-hero-suggestions flex flex-col">
                <div class="hero-quick-group flex flex-col">
                  <p class="hero-group-label eyebrow">Autocomandos</p>
                  <div class="hero-group-items flex flex-col">
                    {#each QUICK_ASK_IDS as id (id)}
                      <button
                        type="button"
                        onclick={() => runQuickAsk(id)}
                        class="btn-quick-ask btn sm w-full"
                      >
                        <Icon name={QUICK_ASK[id].icon} size={18} class="quick-ask-icon" />
                        <span class="quick-ask-label">{QUICK_ASK[id].label}</span>
                        <Icon name="message-01" size={18} class="quick-ask-run" />
                      </button>
                    {/each}
                  </div>
                </div>

                <div class="hero-quick-group flex flex-col">
                  <p class="hero-group-label eyebrow">Sugerencias</p>
                  <div class="hero-group-items flex flex-col">
                    {#each SAMPLES as sample (sample)}
                      <button
                        type="button"
                        onclick={() => pickSample(sample)}
                        class="btn-sample-prompt opt"
                      >
                        <span class="sample-prompt-label opt-body">{sample}</span>
                        <Icon name="message-add-01" size={18} class="sample-arrow" />
                      </button>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          {#each chat.entries as entry (entry.id)}
            {#if entry.from === "yo"}
              <div class="chat-entry-user rise flex flex-col items-end gap-1">
                <!-- Con que se pidio. Van encima del texto y en su mismo borde
                     para que se lean como parte del mismo turno. -->
                {#if entry.files?.length || entry.picked?.length}
                  <div class="group-user-files flex flex-wrap justify-end gap-1">
                    {#each entry.files ?? [] as name (name)}
                      <Tag tone="tint-2" class="badge-user-file">
                        <Icon name="attachment-01" />
                        <span class="entry-file-name">{name}</span>
                      </Tag>
                    {/each}
                    {#each entry.picked ?? [] as label (label)}
                      <Tag class="badge-user-picked">
                        <Icon name="cursor-01" />
                        <span class="entry-file-name">{label}</span>
                      </Tag>
                    {/each}
                  </div>
                {/if}
                <p class="bubble-user-message">
                  {entry.label ?? entry.text}
                </p>
              </div>
            {:else}
              <!--
                La respuesta no va en burbuja: ocupa el ancho entero y se lee
                como un texto, que es lo que es. Lo que la separa del turno
                anterior es su encabezado, no un marco.
              -->
              <div class="chat-entry-ai rise group" style="animation-delay: 100ms">
                <div class="header-ai-response flex items-center">
                  <Icon name="ai-magic" size={16} />
                  <span class="header-ai-label"> Inteligencia artificial </span>
                  <CopyLine text={entry.text} />
                </div>

                <div class="content-ai-response">
                  <Markdown text={entry.text} />
                </div>

                <!-- Lo que penso antes de responder, plegado por defecto. -->
                {#if entry.reasoning}
                  <Reasoning text={entry.reasoning} />
                {/if}

                <!--
                  Lo que se le mando al modelo. El de esta visita llega con la
                  peticion, si se pidio en modo debug; sin el, el ultimo turno
                  ofrece el que quedo guardado en el servidor, que es lo que
                  sobrevive a recargar despues de un fallo.
                -->
                {#if entry.context}
                  <div class="context-debug-wrap">
                    <DebugContext text={entry.context} />
                  </div>
                {:else if config?.debugButton && entry.id === lastAiEntry}
                  <div class="context-debug-wrap">
                    <DebugContext load={loadSavedContext} />
                  </div>
                {/if}

                {#if entry.steps?.length}
                  <Steps steps={entry.steps} />
                {/if}

                <!-- Lo que no tenia riesgo ya esta hecho: se cuenta, no se pregunta. -->
                {#if entry.notices?.length}
                  <Notices notices={entry.notices} />
                {/if}

                <!--
                  La IA cerro el turno preguntando. Solo se contesta la del
                  ultimo turno: mas atras, la pregunta ya se resolvio y se
                  queda como lo que es, parte de lo que se lee.
                -->
                <!--
                  Dar acceso no se hizo: se autoriza aqui, leyendo lo que esa
                  persona va a poder hacer. Quitarlo ya se aplico y sale como
                  aviso, no como decision.
                -->
                {#if entry.access?.length}
                  {#each entry.access as change (change.personId)}
                    <AccessGrant {change} {appId} onResolved={() => onChanged()} />
                  {/each}
                {/if}

                {#if entry.question}
                  <Question
                    question={entry.question}
                    live={!working && entry.id === chat.entries[chat.entries.length - 1]?.id}
                    onChoose={(option) => answer(entry.question as AiQuestion, option)}
                  />
                {/if}
              </div>
            {/if}
          {/each}

          {#if working}
            <div class="rise" style="animation-delay: 140ms">
              <Working {progress} since={startedAt} />
            </div>
          {/if}
        </div>

        <!-- Se dejo de seguir el final: un toque para volver a el. -->
        {#if !atEnd && (chat.entries.length > 0 || working)}
          <button
            type="button"
            onclick={goToEnd}
            aria-label="Ir al final de la conversacion"
            class="btn-jump-to-end flex items-center justify-center"
          >
            <Icon name="arrow-down-01" size={15} />
          </button>
        {/if}
      </div>

      <!--
        Todo lo que compone una peticion dentro de un mismo marco: lo senalado,
        lo escrito y lo adjunto. Es una sola cosa --lo que se va a mandar-- y
        por eso se ve como una sola cosa.
      -->
      <div class="panel-composer-ai shrink-0">
        <!-- El selector nativo, escondido: lo abre "Adjuntar archivo" del menu. -->
        <input
          bind:this={fileInput}
          type="file"
          multiple
          accept={AI_FILE_ACCEPT}
          class="input-attach-ai"
          onchange={attachFiles}
          tabindex="-1"
          aria-hidden="true"
        />

        <!--
          La IA trabaja en otra pagina: el campo se tapa entero.

          No se atenua ni se deshabilita pieza a pieza --un campo apagado sigue
          pareciendo un sitio donde escribir-- sino que se le pone encima un
          velo opaco con la unica salida que hay: ir a la pagina que trabaja.
          Debajo, `inert` deja el campo fuera del tabulador y del puntero, para
          que el teclado no se cuele por detras del velo.

          Lo escrito sin enviar no se pierde: sigue en la conversacion de esta
          pagina y vuelve a estar delante en cuanto el bloqueo se levanta.
        -->
        <div class="composer-shell-ai">
          <div class="chat-composer aura aura-ia w-full" inert={blocked}>
            <div
              class={cx(
                "chat-composer-box card card-solid ia-text",
                picker.active && "composer-picking",
              )}
            >
              {#if chat.picks.length > 0 || chat.files.length > 0}
                <div class="composer-badges flex flex-col">
                  {#if chat.files.length > 0}
                    <FileBadges files={chat.files} onRemove={removeFile} />
                  {/if}
                  {#if chat.picks.length > 0}
                    <PickedBadges picks={chat.picks} onRemove={removePick} />
                  {/if}
                </div>
              {/if}

              <textarea
                bind:this={box}
                value={chat.draft}
                oninput={(e) => update({ ...chat, draft: e.currentTarget.value })}
                onpaste={(e) => {
                  /*
                   * Lo que se pega y no es lo que se escribe entra por donde
                   * entran los archivos: una captura, y el texto tan largo que
                   * ya no es una peticion sino material. Lo demas cae en el
                   * campo, que es donde se queria poner.
                   *
                   * Los archivos primero: copiar una imagen de una pagina trae
                   * tambien su HTML, y lo que se quiso copiar fue la imagen.
                   */
                  const attached = pastedFiles(e.clipboardData);
                  if (attached.length === 0) {
                    const file = pastedAsFile(e.clipboardData?.getData("text/plain") ?? "");
                    if (!file) return;
                    attached.push(file);
                  }
                  e.preventDefault();
                  sendFilesToAi(attached);
                }}
                onkeydown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
                    e.preventDefault();
                    void send(chat.draft);
                  }
                }}
                rows={1}
                placeholder="Pide un cambio o describe una pantalla"
                class="area-ai-prompt block w-full"></textarea>

              <div class="chat-composer-actions flex items-center">
                <!--
                Lo que se anade a la peticion sin escribirla: un archivo o un
                atajo. Va primero porque es la puerta de entrada de las dos
                cosas que no son texto.
              -->
                <Dropdown wrapClass="composer-quick-wrap">
                  {#snippet trigger({ toggle, open })}
                    <Button
                      size="sm"
                      tip="Adjuntar o usar un autocomando"
                      aria-pressed={open}
                      buttonClass="btn-toggle-quick-menu"
                      class="btn-icon btn-rounded"
                      onclick={toggle}
                    >
                      <Icon name="add-01" size={16} />
                    </Button>
                  {/snippet}
                  {#snippet children(close)}
                    {#snippet attachIcon()}
                      <Icon name="attachment-01" size={14} />
                    {/snippet}
                    <MenuItem
                      icon={attachIcon}
                      onclick={() => {
                        close();
                        fileInput?.click();
                      }}
                    >
                      Adjuntar archivo
                    </MenuItem>

                    <MenuSeparator />
                    <MenuLabel>Autocomando</MenuLabel>
                    {#each QUICK_ASK_IDS as id (id)}
                      {#snippet askIcon()}
                        <Icon name={QUICK_ASK[id].icon} size={14} />
                      {/snippet}
                      <MenuItem
                        icon={askIcon}
                        onclick={() => {
                          close();
                          runQuickAsk(id);
                        }}
                      >
                        {QUICK_ASK[id].label}
                      </MenuItem>
                    {/each}
                  {/snippet}
                </Dropdown>

                <Button
                  size="sm"
                  tip={picker.active
                    ? "Salir del cursor (Esc) · ↑↓ ensancha lo señalado"
                    : "Señalar un elemento de la página"}
                  aria-pressed={picker.active}
                  buttonClass="btn-toggle-picker"
                  class="btn-icon btn-rounded"
                  onclick={() => setPickerActive(!picker.active)}
                >
                  <Icon name="cursor-01" size={15} />
                </Button>

                <!--
                Con que se va a pedir. Vive pegado al campo porque es parte de la
                peticion, como lo senalado y los atajos: se mira justo antes de
                enviar. Cambiar de modelo a media peticion no cambia la que ya
                esta en marcha, asi que ahi no se deja tocar.
              -->
                {#if config && choice}
                  <ModelPicker {config} {choice} onPick={pick} disabled={working} />
                {/if}

                <div class="composer-spacer flex-1"></div>

                <!--
                Para quien quiere ver por que la IA respondio lo que respondio:
                el sistema, las herramientas y los mensajes tal cual se le
                mandaron. Se aplica a la proxima peticion, no a la que este en
                marcha. Solo aparece si se encendio en Ajustes: no es algo que
                la mayoria necesite ver siempre.
              -->
                {#if config?.debugButton}
                  <Button
                    size="sm"
                    variant="ghost"
                    tip={debug
                      ? "Modo debug activo: ver contexto enviado"
                      : "Ver el contexto enviado"}
                    aria-pressed={debug}
                    class="btn-icon btn-rounded btn-toggle-debug"
                    onclick={() => {
                      debug = !debug;
                      writeDebug(debug);
                    }}
                  >
                    <Icon name="code-xml" size={14} />
                  </Button>
                {/if}

                <!-- Cuanto contexto lleva gastado lo que se esta pidiendo. -->
                {#if chat.usage}
                  <ContextMeter usage={chat.usage} />
                {/if}

                <!--
                El mismo sitio manda y para. Mientras la IA trabaja, el boton de
                enviar es el de detener: es lo unico que se puede querer hacer
                ahi en ese momento, y no hay que buscarlo en otro lado.
              -->
                {#if working}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={stopping}
                    tip={stopping ? "Deteniendo" : "Detener"}
                    tipSide="left"
                    class="btn-icon btn-rounded btn-stop-ai"
                    onclick={() => void stop()}
                  >
                    {#if stopping}
                      <Spinner />
                    {:else}
                      <Icon name="square" size={13} />
                    {/if}
                  </Button>
                {:else}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canSend}
                    tip="Enviar (Enter)"
                    tipSide="left"
                    class="btn-icon btn-rounded btn-send-ai"
                    onclick={() => void send(chat.draft)}
                  >
                    <Icon name="arrow-up-01" size={16} />
                  </Button>
                {/if}
              </div>
            </div>
          </div>

          {#if blocked}
            <div class="veil-ai-elsewhere flex flex-col items-center justify-center gap-2">
              <p class="veil-ai-elsewhere-text text-center">
                <Icon name="ai-magic" size={14} class="veil-ai-elsewhere-icon" />
                La inteligencia artificial está trabajando en
                <strong>{blockedBy?.name ?? "otra página"}</strong>.
              </p>
              {#if blockedBy}
                <Button
                  size="sm"
                  variant="secondary"
                  buttonClass="btn-go-to-busy-page"
                  onclick={() => navigate(`/a/${appId}/app/${blockedBy.id}`)}
                >
                  <Icon name="arrow-right-01" size={13} /> Ir a la página
                </Button>
              {/if}
            </div>
          {/if}
        </div>

        <!--
          Con una peticion en marcha, lo que hay que saber es si se puede salir.
          Se puede en cuanto el servidor la reconoce: sigue sola y vuelve al
          abrir esta pagina. Mientras no la reconozca, salir la pierde y se dice.
        -->
        <p class="chat-hint text-center">
          {#if blocked}
            Aquí no se puede pedir hasta que esa petición termine
          {:else if !working}
            Enter envía · Shift+Enter salto de línea
          {:else if runId}
            Puedes recargar o cerrar: la petición sigue y vuelve al abrir esta página
          {:else}
            Si sales ahora se pierde lo que la IA está haciendo
          {/if}
        </p>
      </div>
    </div>
  {/if}
</OmniPanel>

<style>
  .panel-body-ai {
    min-height: 0;
  }

  /* El campo y, cuando toca, el velo que lo tapa. */
  .composer-shell-ai {
    position: relative;
  }

  /*
    Opaco de verdad, no traslucido: debajo hay un campo de texto, y dejarlo
    entrever invita a intentar escribir en el. Ocupa el sitio exacto del campo
    --el resto del panel se sigue leyendo y la conversacion se sigue
    desplazando-- y solo ofrece la salida que hay.
  */
  .veil-ai-elsewhere {
    position: absolute;
    inset: 0;
    z-index: 1;
    border: var(--border-width) solid var(--border);
    border-radius: calc(var(--radius-md) + 0.125rem);
    background: var(--bg-level2);
    padding: var(--sp-10);
  }

  .veil-ai-elsewhere-text {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);

    & strong {
      color: var(--text-primary);
      font-weight: 500;
    }
  }

  /* El icono lo dibuja `Icon`, con la clase que le pasamos. */
  .veil-ai-elsewhere-text :global(.veil-ai-elsewhere-icon) {
    display: inline-block;
    vertical-align: -0.125em;
    margin-right: var(--sp-4);
    color: var(--accent);
  }

  .chat-no-server {
    padding: var(--sp-24) 0;
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  .panel-scroll-ai {
    position: relative;
    min-height: 0;
  }

  .chat-log {
    overflow-y: auto;
    /* La barra de desplazamiento se aparta del borde derecho los 12px que
       ocupa el asa del dock --`components/AiDock.svelte`--, que si no queda
       encima de ella. El acolchado devuelve esos pixeles, asi que lo escrito
       cae donde caia. */
    margin-right: var(--sp-12);
    padding: var(--sp-16) var(--sp-4) var(--sp-16) var(--sp-16);
  }

  /* --- La portada de la conversacion vacia --- */

  .chat-hero {
    padding: 2rem 0.25rem;
  }

  .chat-hero-glyph {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--radius-lg);
    background: color-mix(in oklab, var(--accent) 12%, transparent);
    color: var(--accent);
  }

  .chat-hero-title {
    margin-top: var(--sp-12);
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
    font-weight: 600;
    color: var(--text-primary);
  }

  .chat-hero-subtitle {
    margin-top: var(--sp-4);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  /* Los dos grupos --autocomandos y sugerencias-- con aire entre ellos. */
  .chat-hero-suggestions {
    margin-top: var(--sp-16);
    gap: var(--sp-14);
  }

  .hero-group-items {
    gap: var(--sp-6);
  }

  /* El rotulo es `.eyebrow` del catalogo; aqui solo su hueco. */
  .hero-group-label {
    margin-bottom: var(--sp-6);
    padding: 0 0.125rem;
  }

  /* Los iconos de los atajos van dentro de Icon (un componente). */
  :global(.quick-ask-icon) {
    color: var(--accent);
  }

  /* Senala que el atajo manda de una vez, sin pasar por el campo. */
  :global(.quick-ask-run) {
    opacity: 0.5;
  }

  :global(.quick-ask-label) {
    min-width: 0;
    flex: 1 1 0%;
    text-align: left;
  }

  /* Cada sugerencia es `.opt` del catalogo; aqui solo su letra, que en el
     panel de la IA es un punto mas chica que en una pantalla, y el cerco que
     se tine del acento al apuntarla --lo que hay debajo es una peticion, no
     un ajuste--. */
  .btn-sample-prompt {
    padding: var(--sp-8) var(--sp-12);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);

    &:hover {
      border-color: color-mix(in oklab, var(--accent) 50%, transparent);
    }
  }

  :global(.sample-arrow) {
    opacity: 0.5;
  }

  :global(.sample-prompt-label) {
    min-width: 0;
    flex: 1 1 0%;
  }

  /* --- Los turnos --- */

  .group-user-files {
    max-width: 88%;
  }

  .entry-file-name {
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bubble-user-message {
    max-width: 88%;
    white-space: pre-wrap;
    border-radius: var(--radius-lg);
    border-bottom-right-radius: var(--radius-sm);
    background: var(--bg-field);
    padding: var(--sp-8) var(--sp-14);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-primary);
  }

  .header-ai-response {
    gap: var(--sp-6);
    margin-top: var(--sp-8);
    margin-bottom: var(--sp-4);
  }

  .header-ai-label {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    font-weight: 500;
    color: var(--text-muted);
  }

  .content-ai-response {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-primary);
  }

  .context-debug-wrap {
    margin-top: var(--sp-8);
  }

  /* Se dejo de seguir el final: un toque para volver a el. */
  .btn-jump-to-end {
    position: absolute;
    bottom: 0.75rem;
    left: 50%;
    transform: translateX(-50%);
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    border-radius: 62.5rem;
    border: var(--border-width) solid var(--border);
    background: var(--bg-level2);
    color: var(--text-secondary);
    box-shadow: var(--shadow-sm);
    transition:
      background-color 150ms,
      color 150ms;

    &:hover {
      background: var(--bg-field);
      color: var(--text-primary);
    }
  }

  /* --- El marco de la peticion --- */

  .panel-composer-ai {
    padding: 0 var(--sp-12) var(--sp-12);
  }

  /* El selector nativo de archivos: fuera de la vista, lo abre el menu del "+". */
  .input-attach-ai {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* La caja es `.card.card-solid` del catalogo --en oscuro la del catalogo
     es translucida y esta se posa sobre el fondo del panel--; aqui solo la
     sombra y el borde que se tine mientras el cursor de seleccion esta
     encendido. */
  /* `.aura` es `inline-block` --es lo que quiere el halo del boton de la
     barra-- y se declara despues de las utilidades, asi que aqui gana el
     catalogo: un `block` en el marcado no haria nada. De linea, la caja
     arrastraria el hueco del descenso de la linea debajo del campo. */
  .chat-composer {
    display: block;
  }

  .chat-composer-box {
    box-shadow: var(--shadow-sm);
    transition: border-color 150ms;

    /* El cursor de seleccion esta encendido. */
    &.composer-picking {
      border-color: var(--accent);
    }
  }

  .composer-badges {
    gap: var(--sp-6);
    padding: var(--sp-10) var(--sp-10) 0;
  }

  .area-ai-prompt {
    max-height: 11rem;
    resize: none;
    background: transparent;
    padding: var(--sp-16) var(--sp-12);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-primary);
    outline: none;

    &::placeholder {
      color: var(--text-muted);
    }
  }

  .chat-composer-actions {
    gap: var(--sp-6);
    padding: 0 var(--sp-8) var(--sp-8);
  }

  .composer-spacer {
    min-width: 0;
  }

  .btn-stop-ai {
    border: var(--border-width) solid var(--border);
  }

  .chat-hint {
    margin-top: var(--sp-6);
    font-size: 0.6875rem;
    line-height: 1.5;
    color: var(--text-muted);
  }
</style>
