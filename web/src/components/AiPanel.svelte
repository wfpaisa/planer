<!--
  La conversacion con la inteligencia artificial, dentro del dock.

  Su campo de texto es la unica entrada a la IA. Se llama "Conversaciones",
  nunca "historial": ese nombre es de los cambios de una pagina.

  Cada peticion escribe sobre la pagina abierta y solo sobre ella, y las
  conversaciones son de esa misma pagina: la lista ensena solo las suyas, asi
  que ninguna necesita decir en cual se hizo.

  Lo escrito y lo conversado no vive aqui sino en `aiConversation`, para que
  esconder el dock no lo borre; y la peticion en marcha, en `aiRun`, para que
  salir de la seccion y volver la encuentre donde iba.
-->
<script lang="ts">
  import { aiUsable } from "@shared/aiCatalog";
  import type {
    AiChat,
    AiChatSummary,
    AiChoice,
    AiConfigView,
    AiDebugRead,
    AiPlanIntent,
    AiQuestionOption,
    AiRunInfo,
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
    markResumed,
    nextEntryId,
    type QueuedAsk,
    readChoice,
    readConversation,
    readDebug,
    rememberQueue,
    resolveChoice,
    setOpenChat,
    takeQueue,
    wasHydrated,
    wasResumed,
    writeChoice,
    writeConversation,
    writeDebug,
  } from "../lib/aiConversation.svelte";
  import {
    AI_FILE_ACCEPT,
    cancelUpload,
    draftAiFile,
    type DraftFile,
    MAX_AI_FILES,
    onFilesForAi,
    pastedAsFile,
    pastedFiles,
    sendFilesToAi,
    uploadAiFile,
    wasCancelled,
  } from "../lib/aiFiles";
  import { cancelCanvasRefresh, listen as listenToRun } from "../lib/aiListen";
  import { NO_PROGRESS } from "../lib/aiProgress";
  import { liveRun, markRun } from "../lib/aiRun.svelte";
  import { useBuilder } from "../lib/builderContext";
  import { cx } from "../lib/cx";
  import { frameThrottle } from "../lib/frameThrottle";
  import { appDocLoader } from "../lib/htmlDocs";
  import { onPicked, picker, setPickerActive } from "../lib/pagePicker.svelte";
  import { api, errorMessage, pb, post } from "../lib/pb";
  import { QUICK_ASK, QUICK_ASK_IDS, type QuickAskId, SAMPLES } from "../lib/quickAsk";
  import { navigate } from "../lib/router.svelte";
  import AccessGrant from "./ai/AccessGrant.svelte";
  import ChatList from "./ai/ChatList.svelte";
  import ContextMeter from "./ai/ContextMeter.svelte";
  import CopyLine from "./ai/CopyLine.svelte";
  import DebugContext from "./ai/DebugContext.svelte";
  import FileBadges from "./ai/FileBadges.svelte";
  import ModelPicker from "./ai/ModelPicker.svelte";
  import ModePicker from "./ai/ModePicker.svelte";
  import Notices from "./ai/Notices.svelte";
  import PickedBadges from "./ai/PickedBadges.svelte";
  import PlanCard from "./ai/PlanCard.svelte";
  import PlanCut from "./ai/PlanCut.svelte";
  import Process from "./ai/Process.svelte";
  import Question from "./ai/Question.svelte";
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

  // Lo conversado se lee del almacen, que es reactivo: lo que escriba el hilo
  // de avisos --tambien el de una peticion que empezo en un panel anterior--
  // se ve aqui sin copiarlo dentro.
  const chat = $derived(readConversation(key));
  /**
   * La intencion local de activar el modo Plan para la proxima peticion.
   *
   * No es el estado que se muestra: cerrado e implementado se leen del ultimo
   * mensaje del hilo, que manda sobre esto (D1 de `ia-modo-plan`). Esto solo
   * cubre "activo", que mientras se sigue conversando no deja ninguna marca
   * propia en el hilo -- ver la pregunta que se le hizo a quien construye
   * antes de implementarlo.
   */
  let planWanted = $state(false);
  /** Como se muestra el boton de Plan: activo, cerrado o apagado. */
  const planStatus = $derived.by(() => {
    const last = chat.entries[chat.entries.length - 1];
    if (last?.from === "ia" && last.plan) return last.plan.implementado ? "off" : "closed";
    return planWanted ? "active" : "off";
  });
  let config = $state<AiConfigView | null>(null);
  /**
   * Con que se pide: el modelo y cuanto se le pide pensar. Sale de lo que se
   * eligio la ultima vez, o de lo que dejo puesto quien administra.
   */
  let choice = $state<AiChoice | null>(null);
  /** Ver el contexto que se le manda al modelo. Dura entre visitas. */
  let debug = $state(untrack(() => readDebug()));
  /**
   * La IA quiere ver si la pagina que escribio se dibuja sin errores.
   *
   * Es lo unico que el servidor pide de vuelta a mitad de una peticion: aqui
   * hay navegador y alli no. Se dibuja escondida y se contesta con lo que la
   * consola solto.
   */
  let probe = $state<ProbeRequest | null>(null);
  let list = $state<AiChatSummary[] | null>(null);
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

  /*
   * La peticion en marcha de la pagina abierta, si la hay.
   *
   * Vive fuera del componente --`lib/aiRun`-- porque el panel se desmonta al
   * salir de la seccion y la peticion no se corta con el: asi volver a la
   * pagina la encuentra donde iba, en vez de en blanco hasta recargar.
   */
  const run = $derived(liveRun(key));
  /** Hay una peticion en marcha en la pagina abierta. */
  const working = $derived(!!run);
  /** Lo que la IA lleva producido en esta peticion. Solo para mirar. */
  const progress = $derived(run?.progress ?? NO_PROGRESS);
  /** Desde cuando trabaja la peticion en marcha. Mueve el reloj de "Working". */
  const startedAt = $derived(run?.startedAt ?? 0);
  /** Como la llama el servidor. Vacio: salir todavia la pierde. */
  const runId = $derived(run?.runId ?? "");
  /** Se pidio detenerla y todavia no ha llegado el final. */
  const stopping = $derived(run?.stopping ?? false);

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
   * cuando ya se cambio de pagina, y tiene que caer en la conversacion donde se
   * pidio, no en la que se este mirando. Lo que hay delante sale del almacen,
   * asi que escribir ahi es lo unico que hace falta: si lo escrito es de la
   * pagina abierta se ve solo, y si es de otra no la toca.
   */
  function update(next: Conversation, forKey: string = key): void {
    writeConversation(forKey, next);
  }

  /*
   * Cambiar de pagina trae la conversacion de esa pagina.
   *
   * Lo conversado lo trae el almacen solo --la clave cambio-- pero la portada
   * y la lista de conversaciones no: son de esta pantalla, y sin esto se
   * quedarian como estaban en la pagina de la que se viene.
   */
  let shown = untrack(() => key);
  $effect(() => {
    const mine = key;
    const pageId = page.id;

    if (mine !== shown) {
      shown = mine;
      phase = untrack(() => (readConversation(mine).entries.length ? "gone" : "hero"));
      // La lista era la de la pagina de la que se viene.
      list = null;
      // La intencion de modo Plan era de la conversacion de la que se viene.
      planWanted = false;
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

  /*
   * Lo que habia quedado en cola antes de recargar.
   *
   * La cola vive en esta pestana, asi que recargar la pierde: se devuelve al
   * campo de texto y se dice, que es la unica forma honesta de no prometer lo
   * que no se guardo. Se hace una vez por pagina y visita, con la misma marca
   * que repone la conversacion abierta.
   */
  $effect(() => {
    const mine = key;
    const pending = takeQueue(mine);
    if (!pending.length) return;
    const now = readConversation(mine);
    update(
      {
        ...now,
        draft: [now.draft, ...pending].filter(Boolean).join("\n\n"),
        entries: [
          ...now.entries,
          {
            id: nextEntryId(),
            from: "ia",
            text:
              pending.length === 1
                ? "Lo que habías dejado en cola no se envió: al recargar se pierde. Te lo devolví al campo de texto."
                : `Las ${pending.length} peticiones que habías dejado en cola no se enviaron: al recargar se pierden. Te las devolví al campo de texto.`,
          },
        ],
      },
      mine,
    );
    if (mine === key) phase = "gone";
  });

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
   * Las subidas que esta pestana tiene en marcha, y las que ya terminaron.
   *
   * La primera sirve para que enviar espere lo justo --lo que falte por subir,
   * no mas-- y la segunda para recoger la referencia de un archivo cuyo badge
   * ya salio de la conversacion al enviarla.
   */
  const inFlight = new Map<string, Promise<unknown>>();
  const settled = new Map<string, DraftFile>();

  /** Un aviso escrito como si lo dijera la IA. No es una peticion fallida. */
  function say(text: string, forKey: string = key): void {
    const now = readConversation(forKey);
    update({ ...now, entries: [...now.entries, { id: nextEntryId(), from: "ia", text }] }, forKey);
    if (forKey === key) phase = "gone";
  }

  /*
   * Los archivos que se sueltan encima del editor y se mandan a la
   * conversacion.
   *
   * Se suben en cuanto se sueltan, no al enviar: para cuando se termina de
   * escribir que hacer con ellos, ya estan guardados. Mientras suben, su badge
   * lo dice y el campo de texto sigue libre --escribir no espera a nadie--, y
   * quitar el badge antes de que termine corta la subida.
   *
   * El que no se pueda adjuntar se cuenta como una respuesta de la IA. Es un
   * aviso, no una peticion fallida: los demas del mismo lote entran igual.
   */
  $effect(() =>
    onFilesForAi((dropped) => {
      const mine = key;
      for (const file of dropped) {
        const now = readConversation(mine);
        if (now.files.length >= MAX_AI_FILES) {
          say(`No caben más de ${MAX_AI_FILES} archivos en una misma petición.`, mine);
          break;
        }

        let draft: DraftFile;
        try {
          draft = draftAiFile(file);
        } catch (err) {
          say(errorMessage(err), mine);
          continue;
        }

        /*
         * Un modelo sin vista no puede mirar la imagen. Se adjunta igual --su
         * nombre sigue contando en el contexto-- pero se dice, en vez de dejar
         * que responda como si la hubiera visto.
         */
        update({ ...now, files: [...now.files, draft] }, mine);
        if (draft.kind === "image" && blind) {
          say(
            "El modelo elegido no mira imágenes. Se adjunta igual, pero solo verá su nombre: elige uno con vista para que la lea.",
            mine,
          );
        }

        const climbing = (async () => {
          try {
            const saved = await uploadAiFile(appId, draft, file);
            settled.set(draft.id, saved);
            const before = readConversation(mine);
            // Quitar el badge mientras subia es cancelar: si ya no esta, lo
            // subido no vuelve a la conversacion.
            if (!before.files.some((f) => f.id === draft.id)) return;
            update(
              { ...before, files: before.files.map((f) => (f.id === draft.id ? saved : f)) },
              mine,
            );
          } catch (err) {
            if (wasCancelled(err)) return;
            const before = readConversation(mine);
            update({ ...before, files: before.files.filter((f) => f.id !== draft.id) }, mine);
            say(errorMessage(err), mine);
          } finally {
            inFlight.delete(draft.id);
          }
        })();
        inFlight.set(draft.id, climbing);
      }
      // El foco no se lleva aqui: la pregunta que trajo el archivo todavia
      // puede estar en pantalla, y al cerrarse se lo llevaria detras. Se
      // pide, y se cumple despues del siguiente dibujado.
      focusRequests += 1;
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
  let stuck = true;

  /*
   * Se mueve la columna, no un elemento dentro de ella: `scrollIntoView`
   * arrastra tambien a los contenedores de arriba, y el dock vive dentro de la
   * escena de la pagina.
   */
  function jump(behavior: ScrollBehavior): void {
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior });
  }

  // Mientras la respuesta llega, sin suavizado; el suave es para lo que se
  // mueve de golpe. Vale `working` y no una marca propia: con la peticion
  // viviendo fuera del panel, volver a la pagina la encuentra en marcha.
  const scrollToEnd = frameThrottle(() => jump(working ? "auto" : "smooth"));

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

  // Lo pedido a los frames para desplazar la columna y el reloj del lienzo se
  // cancelan al desmontar: los dos trabajarian sobre un panel que ya no esta en
  // pantalla. El avance no: lo que agrupa vive fuera --`lib/aiRun`-- y quien
  // vuelva a esta pagina tiene que encontrarlo donde iba.
  $effect(() => () => {
    scrollToEnd.cancel();
    cancelCanvasRefresh();
  });

  /**
   * Escuchar una peticion y dejar su resultado en la conversacion. Todo el
   * ciclo --abrir el hilo, acumular el avance, aterrizar el resultado-- vive en
   * `lib/aiListen.ts`; de aqui solo sale lo que es del panel.
   */
  const listen = (path: string, payload: unknown, since?: number): Promise<void> =>
    listenToRun(path, payload, since, {
      key,
      pageId: page.id,
      appId,
      onListening: () => {
        // Escuchar es querer ver: la vista vuelve al final aunque se estuviera
        // leyendo mas arriba.
        stuck = true;
        atEnd = true;
      },
      onProbe: (next) => (probe = next),
      onLanded: (id) => {
        if (!opened.has(LIVE)) return;
        const next = new Set(opened);
        next.delete(LIVE);
        next.add(id);
        opened = next;
      },
      onChanged,
      onImpact,
    });

  /**
   * Manda una peticion ya resuelta: el campo de texto o un atajo, da igual.
   *
   * `label`, si viene, es lo que se lee en la burbuja en vez del texto --un
   * atajo manda un pedido largo en ingles, y la burbuja muestra su rotulo
   * corto en espanol--. `keepDraft` deja el campo de texto como estaba: un
   * atajo se manda solo, sin tocar lo que se llevaba escrito para lo
   * siguiente.
   *
   * Con una peticion en marcha no se descarta: se encola. El campo se vacia
   * igual --lo escrito ya salio de ahi-- y lo encolado se ve y se puede quitar
   * antes de que le llegue el turno.
   */
  async function dispatch(
    text: string,
    opts?: { label?: string; keepDraft?: boolean; plan?: AiPlanIntent },
  ): Promise<void> {
    // La IA trabaja en otra pagina: lo escrito se queda donde esta, esperando
    // a que aquello termine.
    if (blocked) return;
    const value = text.trim();
    if (!value) return;
    const asked = readConversation(key);

    if (working) {
      const queued: QueuedAsk = {
        id: nextEntryId(),
        text: value,
        ...(opts?.label ? { label: opts.label } : {}),
        picks: asked.picks,
        files: asked.files,
      };
      const queue = [...asked.queue, queued];
      update({
        ...asked,
        ...(opts?.keepDraft ? {} : { draft: "" }),
        picks: [],
        files: [],
        queue,
      });
      rememberQueue(key, queue);
      return;
    }

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
    const entryId = nextEntryId();
    update({
      ...asked,
      ...(opts?.keepDraft ? {} : { draft: "" }),
      picks: [],
      files: [],
      entries: [
        ...asked.entries,
        {
          id: entryId,
          from: "yo",
          text: value,
          ...(opts?.label ? { label: opts.label } : {}),
          // Los adjuntos quedan nombrados en el mensaje: al releer la
          // conversacion se entiende con que se pidio lo que se pidio.
          ...(files.length ? { files: files.map(asChatFile) } : {}),
          ...(picked.length ? { picked: picked.map((p) => p.label) } : {}),
        },
      ],
    });

    /*
     * Lo que falte por subir se espera aqui y no antes: el campo ya se vacio y
     * la burbuja ya esta puesta, asi que escribir nunca espero a una subida.
     * Lo que se manda son referencias, y un archivo sin ella todavia no es una
     * referencia.
     */
    const ready = await settle(files);
    // Los que subieron mientras se enviaba se reponen en la burbuja ya con su
    // referencia: es lo que la deja abrirse.
    if (files.some((f) => !f.ref)) patchFiles(entryId, ready);

    // Fuera de una accion explicita (cortar, implementar), la peticion lleva
    // la intencion del boton mientras siga encendido: es lo unico que hace
    // que el modo Plan siga activo turno tras turno (D1 de `ia-modo-plan`).
    const planIntent = opts?.plan ?? (planWanted ? "activar" : undefined);

    await listen(`/api/apps/${appId}/paginas/${page.id}/ia`, {
      prompt: value,
      chatId: readConversation(key).chatId || undefined,
      ...(picked.length ? { picked } : {}),
      ...(ready.length ? { files: ready.map(asChatFile) } : {}),
      ...(choice ? { choice } : {}),
      ...(debug && config?.debugButton ? { debug: true } : {}),
      ...(planIntent ? { plan: planIntent } : {}),
    });
  }

  /** Lo que de un adjunto queda nombrado en la conversacion. */
  const asChatFile = (file: DraftFile) => ({
    ref: file.ref,
    name: file.name,
    kind: file.kind,
    size: file.size,
  });

  /**
   * Espera lo que falte por subir y devuelve los adjuntos que ya son
   * referencia. El que no llego a subirse se queda fuera: su fallo ya se conto
   * en la conversacion cuando ocurrio.
   */
  async function settle(files: DraftFile[]): Promise<DraftFile[]> {
    const waiting = files.map((f) => inFlight.get(f.id)).filter(Boolean);
    if (waiting.length) await Promise.allSettled(waiting);
    return files.map((f) => (f.ref ? f : (settled.get(f.id) ?? f))).filter((f) => !!f.ref);
  }

  /** Repone en la burbuja los adjuntos ya con su referencia, para poder abrirlos. */
  function patchFiles(entryId: number, files: DraftFile[]): void {
    const now = readConversation(key);
    update({
      ...now,
      entries: now.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              ...(files.length ? { files: files.map(asChatFile) } : { files: undefined }),
            }
          : entry,
      ),
    });
  }

  /*
   * Atender lo siguiente de la cola en cuanto haya sitio.
   *
   * Va como efecto y no dentro del cierre de la peticion porque una peticion
   * puede terminar cuando ya se esta mirando otra pagina, y mandarla desde alli
   * la escribiria sobre la pagina equivocada. Asi, lo encolado espera a estar
   * delante, que es donde se puede atender.
   *
   * `starting` cubre el hueco entre sacar algo de la cola y que el servidor
   * reconozca la peticion: sin el, el efecto volveria a correr y sacaria
   * tambien la siguiente.
   */
  let starting = false;

  $effect(() => {
    if (blocked || working || starting) return;
    const [first, ...rest] = chat.queue;
    if (!first) return;

    starting = true;
    const mine = key;
    update(
      { ...readConversation(mine), queue: rest, picks: first.picks, files: first.files },
      mine,
    );
    rememberQueue(mine, rest);
    void dispatch(first.text, { label: first.label, keepDraft: true }).finally(() => {
      starting = false;
    });
  });

  /** Quitar algo de la cola antes de que le llegue el turno. */
  function dropQueued(id: number): void {
    const now = readConversation(key);
    const going = now.queue.find((q) => q.id === id);
    for (const file of going?.files ?? []) cancelUpload(file.id);
    const queue = now.queue.filter((q) => q.id !== id);
    update({ ...now, queue });
    rememberQueue(key, queue);
  }

  const send = (text: string) => dispatch(text);

  /**
   * Contestar una pregunta de la IA.
   *
   * Lo que se manda es lo que se eligio, y nada mas: la peticion lleva los
   * turnos anteriores de la conversacion, asi que el modelo ya tiene delante lo
   * que se pidio y lo que el mismo pregunto. Repetirselo dentro del texto era
   * la forma de suplir una memoria que ahora si existe.
   */
  function answer(option: AiQuestionOption): void {
    const chosen = option.description ? `${option.label} (${option.description})` : option.label;
    void dispatch(chosen, { label: option.label, keepDraft: true });
  }

  /**
   * Contestar una pregunta de la IA con algo que no estaba entre las opciones.
   *
   * Va sin `label`: lo que se escribio es lo que se lee en la burbuja, porque
   * aqui no hay un rotulo corto que lo resuma --lo elegido, en las otras, era
   * el boton-- y esconderlo detras de "Otro" dejaria la conversacion sin lo
   * unico que dijo esa respuesta.
   */
  function answerOther(text: string): void {
    void dispatch(text, { keepDraft: true });
  }

  /** Un atajo, a un clic: manda de una vez, sin pasar por el campo de texto. */
  const runQuickAsk = (id: QuickAskId) =>
    dispatch(QUICK_ASK[id].prompt, { label: QUICK_ASK[id].label, keepDraft: true });

  /**
   * Elegir con que animo se pide: Crear (cambiar ya) o Plan (conversar antes).
   *
   * Solo manda la intencion; quien decide el estado real es el servidor, a
   * partir del hilo (D1 de `ia-modo-plan`). Volver a Crear con un plan ya
   * cerrado sin implementar no lo descarta: la tarjeta se queda en el hilo
   * como esta, y la siguiente peticion se comporta como hoy (D5).
   */
  function setPlan(on: boolean): void {
    planWanted = on;
  }

  /**
   * La orden de implementar a mitad de conversacion (D4): un boton, no un
   * texto que se manda al modelo para que lo interprete como orden de cierre.
   * Cierra el plan con lo que la IA tenia hasta ahora y lo deja listo para
   * construir.
   */
  function cutPlan(): void {
    planWanted = false;
    void dispatch("Implementar ahora.", {
      label: "Implementar ahora",
      keepDraft: true,
      plan: "cortar",
    });
  }

  /**
   * Pasar a modo Implementador desde un plan ya cerrado.
   *
   * Lo que se manda al modelo es el plan concretado: la burbuja ensena un
   * rotulo corto, igual que al elegir la opcion de una pregunta.
   *
   * El servidor marca implementado el plan guardado, pero esta entrada ya
   * esta pintada en el navegador con lo que tenia al cerrarse: sin marcarla
   * tambien aqui, su tarjeta seguiria ofreciendo el boton hasta recargar.
   */
  function implementPlan(entryId: number, plan: { texto: string; implementado: boolean }): void {
    planWanted = false;
    const now = readConversation(key);
    update({
      ...now,
      entries: now.entries.map((entry) =>
        entry.id === entryId ? { ...entry, plan: { ...plan, implementado: true } } : entry,
      ),
    });
    void dispatch(plan.texto, { label: "Implementar", keepDraft: true, plan: "implementar" });
  }

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
    if (!working || stopping) return;
    markRun(key, { stopping: true });
    try {
      await post(`/api/apps/${appId}/paginas/${page.id}/ia/detener`);
    } catch {
      // O ya habia terminado, o nunca llego a arrancar: el final llega igual.
    }
  }

  /**
   * Abre un archivo adjuntado en una pestana nueva.
   *
   * No es un `<a href>` a secas: esa direccion exige la sesion del panel, y un
   * navegador no manda esa cabecera al navegar. La pestana se abre en el mismo
   * click --si no, el bloqueador de ventanas emergentes la corta-- y se rellena
   * en cuanto llega el archivo.
   */
  async function openAiFile(ref: string): Promise<void> {
    const win = window.open("", "_blank");
    try {
      const res = await fetch(`/api/apps/${appId}/ia/archivos/${ref}`, {
        headers: pb.authStore.token ? { authorization: pb.authStore.token } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `El servidor respondió ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
    } catch (err) {
      win?.close();
      say(errorMessage(err));
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
   * volveria a recoger el mismo resultado --el servidor guarda la ultima para
   * que recargar justo al acabar no lo pierda--. La marca se pone al recibir la
   * respuesta, no al preguntar, porque el panel se monta mas de una vez y una
   * marca puesta antes de tiempo dejaria fuera al montaje que si sigue vivo.
   *
   * La excepcion es que la senal de actividad diga que aqui hay una peticion en
   * marcha y esta pestana no la este escuchando: entonces se vuelve a preguntar
   * aunque ya se hubiera preguntado antes. Esa senal solo cuenta las que no han
   * terminado, asi que no puede recoger dos veces un resultado; sin esto, una
   * peticion que empezo en otra ventana se quedaria senalada en el sidebar y en
   * blanco aqui, hasta recargar.
   */
  $effect(() => {
    const mine = key;
    const id = appId;
    const pageId = page.id;
    const signalled = aiActivity.has(pageId);
    if (isListening(mine) || liveRun(mine)) return;
    if (wasResumed(mine) && !signalled) return;

    let dropped = false;
    api<AiRunInfo | null>(`/api/apps/${id}/paginas/${pageId}/ia`)
      .then((run) => {
        if (dropped || isListening(mine) || liveRun(mine)) return;
        markResumed(mine);
        if (!run) {
          // La senal decia que aqui se trabajaba y el servidor dice que no.
          // Manda el servidor: sin esto el sidebar seguiria senalando esta
          // pagina el resto de la visita, y aqui no habria nada que ensenar.
          if (signalled) setAiWorking(pageId, false);
          return;
        }
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
    if (!working || runId) return;
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
    plan: m.plan,
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
        queue: now.queue,
        entries: saved.messages.map(toEntry),
      });
      // La intencion de modo Plan era de la conversacion que se deja: la de
      // la que se abre la dice su propio ultimo mensaje.
      planWanted = false;
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

  /**
   * Quitar un archivo adjunto. Lo escrito no se toca, y si todavia se estaba
   * guardando, se corta: quitarlo es decir que ya no hace falta.
   */
  function removeFile(id: string): void {
    cancelUpload(id);
    settled.delete(id);
    const now = readConversation(key);
    update({ ...now, files: now.files.filter((f) => f.id !== id) });
  }

  /** Empezar de cero es un acto pedido, nunca un efecto de cerrar y abrir. */
  function startNew(): void {
    update({ entries: [], chatId: "", draft: "", picks: [], files: [], queue: [] });
    rememberQueue(key, []);
    // La aplicacion se queda sin ninguna abierta: volver aqui --o entrar desde
    // otro navegador-- empieza igual de limpio, no con la de antes repuesta.
    setOpenChat(appId, null, key);
    phase = "hero";
    planWanted = false;
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

  /*
   * Lo que se desplego a mano sigue desplegado durante la visita.
   *
   * Vive aqui y no dentro de cada fila porque el turno cambia de componente al
   * cerrarse --la fila viva pasa a ser la del turno guardado-- y con el estado
   * dentro, desplegar mientras trabaja se perdia justo al terminar.
   *
   * No se guarda entre visitas: es una decision de este rato, no una
   * preferencia.
   */
  const LIVE = 0;
  let opened = $state(new Set<number>());

  function toggleProcess(id: number): void {
    const next = new Set(opened);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    opened = next;
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
  <Button
    variant="soft"
    size="sm"
    disabled={working}
    tip={working ? "Espera a que termine o detenla" : undefined}
    buttonClass="btn-previous-conversations"
    onclick={() => void openList()}
  >
    <Icon name="bubble-chat-delay" size={18} /> Chats anteriores
  </Button>
  {#if chat.entries.length > 0}
    <Button
      variant="soft"
      size="sm"
      disabled={working}
      tip={working ? "Espera a que termine o detenla" : undefined}
      buttonClass="btn-new-conversation"
      onclick={startNew}
    >
      <Icon name="bubble-chat-add" size={18} /> Nuevo
    </Button>
  {/if}
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
        <div bind:this={scroller} onscroll={onScroll} class="chat-log h-full flex flex-col">
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
                    {#each entry.files ?? [] as file (file.name)}
                      <!-- Un archivo que sigue guardado se puede abrir para ver
                           lo que se adjunto; uno de antes del almacen, no. -->
                      {#if file.ref}
                        <button
                          type="button"
                          onclick={() => openAiFile(file.ref)}
                          class="link-user-file"
                        >
                          <Tag tone="tint-2" class="badge-user-file" tip={`Ver ${file.name}`}>
                            <Icon name="attachment-01" />
                            <span class="entry-file-name">{file.name}</span>
                          </Tag>
                        </button>
                      {:else}
                        <Tag tone="tint-2" class="badge-user-file">
                          <Icon name="attachment-01" />
                          <span class="entry-file-name">{file.name}</span>
                        </Tag>
                      {/if}
                    {/each}
                    {#each entry.picked ?? [] as label (label)}
                      <Tag class="badge-user-picked">
                        <Icon name="square-dashed" />
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

                El proceso va encima de la respuesta: lo que ocurrio antes se
                dibuja antes, y saber que hizo la IA no obliga a pasar por
                debajo de lo que respondio.
              -->
              <div class="chat-entry-ai rise group" style="animation-delay: 100ms">
                {#if entry.reasoning || entry.steps?.length}
                  <Process
                    reasoning={entry.reasoning}
                    steps={entry.steps}
                    folded={!entry.unfinished}
                    open={opened.has(entry.id)}
                    onToggle={() => toggleProcess(entry.id)}
                  />
                {/if}

                <div class="header-ai-response flex items-center">
                  <Icon name="ai-magic" size={16} />
                  <span class="header-ai-label">Inteligencia artificial</span>
                  <CopyLine text={entry.text} />
                </div>

                <div class="content-ai-response">
                  <Markdown text={entry.text} />
                </div>

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

                <!-- Lo que no tenia riesgo ya esta hecho: se cuenta, no se pregunta. -->
                {#if entry.notices?.length}
                  <Notices notices={entry.notices} />
                {/if}

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

                <!--
                  La IA cerro el turno preguntando. Solo se contesta la del
                  ultimo turno: mas atras, la pregunta ya se resolvio y se
                  queda como lo que es, parte de lo que se lee.
                -->
                {#if entry.question}
                  <Question
                    question={entry.question}
                    live={!working && entry.id === chat.entries[chat.entries.length - 1]?.id}
                    onChoose={(option) => answer(option)}
                    onOther={(text) => answerOther(text)}
                  />
                {/if}

                <!--
                  El plan con el que se cerro el modo Plan. Solo se puede
                  pasar a construir desde el del ultimo turno: uno cerrado mas
                  atras, o ya implementado, se lee pero no se toca (D2 de
                  `ia-modo-plan`).
                -->
                {#if entry.plan}
                  <PlanCard
                    plan={entry.plan}
                    live={!working && entry.id === chat.entries[chat.entries.length - 1]?.id}
                    onImplement={() => entry.plan && implementPlan(entry.id, entry.plan)}
                  />
                {/if}

                <!--
                  Cortar el plan a mitad de conversacion (D4). Solo al pie del
                  ultimo turno, con el modo activo y sin nada en marcha: si ese
                  turno ya trae plan cerrado, quien ofrece construir es su
                  tarjeta, no esto.
                -->
                {#if planStatus === "active" && !working && !entry.plan && entry.id === lastAiEntry}
                  <PlanCut onCut={cutPlan} />
                {/if}
              </div>
            {/if}
          {/each}

          {#if working}
            <div class="rise" style="animation-delay: 140ms">
              <!--
                Empieza cerrada: lo que va escribiendo es HTML, y para la
                mayoria de peticiones eso es ruido. Quien quiera mirar la abre,
                y una vez abierta se queda abierta mientras dure la visita.
              -->
              <Process
                {progress}
                since={startedAt}
                open={opened.has(LIVE)}
                onToggle={() => toggleProcess(LIVE)}
              />
            </div>
          {/if}

          <!--
            Lo que se escribio mientras la IA trabajaba y espera turno. Se ve
            --no se descarta en silencio-- y se puede quitar antes de que le
            llegue el turno.
          -->
          {#each chat.queue as queued (queued.id)}
            <div class="chat-entry-queued rise flex flex-col items-end gap-1">
              <p class="bubble-user-message is-queued">{queued.label ?? queued.text}</p>
              <button
                type="button"
                onclick={() => dropQueued(queued.id)}
                class="btn-drop-queued flex items-center gap-1"
              >
                <Icon name="clock-01" size={12} />
                <span>En cola · quitar</span>
              </button>
            </div>
          {/each}
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
          <div class="chat-composer w-full" inert={blocked}>
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
                <Dropdown up wrapClass="composer-quick-wrap">
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

                    <!--
                    Para quien quiere ver por que la IA respondio lo que
                    respondio: el sistema, las herramientas y los mensajes tal
                    cual se le mandaron. Se aplica a la proxima peticion, no a
                    la que este en marcha. Solo aparece si se encendio en
                    Ajustes: no es algo que la mayoria necesite ver siempre.
                  -->
                    {#if config?.debugButton}
                      {#snippet debugIcon()}
                        <Icon name="code-xml" size={14} />
                      {/snippet}
                      <MenuItem
                        icon={debugIcon}
                        onclick={() => {
                          close();
                          debug = !debug;
                          writeDebug(debug);
                        }}
                      >
                        {debug ? "Modo debug activo" : "Ver el contexto enviado"}
                      </MenuItem>
                    {/if}

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
                  <Icon name="square-dashed-mouse-pointer" size={18} />
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

                <!-- Cuanto contexto lleva gastado lo que se esta pidiendo. -->
                {#if chat.usage}
                  <ContextMeter usage={chat.usage} />
                {/if}

                <!--
                Con que animo se pide: cambiar ya, o conversar el plan antes.
                Vive pegado al boton de enviar porque es lo ultimo que se mira
                antes de mandar, y porque el rotulo dice en cual se esta.
              -->
                <ModePicker status={planStatus} onPick={setPlan} />

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
                    size="md"
                    disabled={!canSend}
                    tip="Enviar (Enter)"
                    tipSide="left"
                    class="btn-icon btn-rounded btn-send-ai"
                    onclick={() => void send(chat.draft)}
                  >
                    <Icon name="arrow-up-01" size={24} />
                  </Button>
                {/if}
              </div>
            </div>
          </div>

          {#if blocked}
            <div class="veil-ai-elsewhere flex flex-col items-center justify-center gap-2">
              <!-- prettier-ignore -->
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
    /* El acolchado de arriba lo nombra una variable porque no es solo aire: la
       cabecera pegajosa del proceso lo descuenta para pegarse al borde de
       verdad de la columna. Ver `components/ai/Process.svelte`. */
    --chat-pad-top: var(--sp-16);
    /* Un turno se separa del siguiente mas de lo que sus partes se separan
       entre si --`--sp-8` dentro del turno, ver `.header-ai-response`-- para
       que se vea donde acaba uno y empieza otro sin leerlo. */
    gap: var(--sp-24);
    overflow-y: auto;
    /* La barra de desplazamiento se aparta del borde derecho los 12px que
       ocupa el asa del dock --`components/AiDock.svelte`--, que si no queda
       encima de ella. El acolchado devuelve esos pixeles, asi que lo escrito
       cae donde caia. */
    margin-right: var(--sp-12);
    padding: var(--chat-pad-top) var(--sp-4) var(--sp-16) var(--sp-16);
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
    border-bottom-right-radius: 0px;
    background: color-mix(in srgb, var(--accent) 50%, #000);
    padding: var(--sp-8) var(--sp-14);
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
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
    font-size: var(--text-base);
    /* line-height: var(--text-base--line-height); */
    line-height: var(--text-md--line-height);
    color: var(--text-primary);
    padding-left: 1rem;
    padding-right: 2rem;
    text-wrap: balance;

    :global(ul li, ol li) {
      margin-bottom: 0.5rem;
    }
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

  /*
   * EL DESTELLO DEL CAMPO
   *
   * Al entrar el cursor, una luz recorre el contorno una sola vuelta y se
   * apaga. Un anillo que gira sin parar --lo que habia antes-- dice "esto
   * esta pasando" todo el rato, y aqui no pasa nada: solo se ha entrado a
   * escribir. Una vuelta y silencio.
   *
   * El arco se dibuja con un cono que gira sobre `--sweep-angle` (la
   * propiedad esta registrada en `global.css`: sin registro el degradado se
   * quedaria quieto) y dos mascaras, la de fuera menos la de dentro, que
   * dejan solo la franja del contorno.
   */
  @keyframes composer-sweep {
    from {
      --sweep-angle: 0deg;
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    to {
      --sweep-angle: 360deg;
      opacity: 0;
    }
  }

  /* La caja es `.card.card-solid` del catalogo --en oscuro la del catalogo
     es translucida y esta se posa sobre el fondo del panel--; aqui la sombra
     que la despega del panel, el contorno mas marcado que el de la tarjeta
     --es el sitio donde se escribe, no una ficha que se lee-- y el borde que
     se tine mientras el cursor de seleccion esta encendido. */
  .chat-composer-box {
    --composer-ring: 2px;

    /* La luz del destello y la sombra, una por tema. En oscuro la luz es
       blanca; en claro el blanco no se ve contra el papel, asi que el
       reflejo es azul. Es un azul fijo y no `--accent`: el destello no lo
       tine la paleta de la aplicacion, que cambia cada dos apps. La sombra
       en claro va mas floja --el mismo negro pesa mucho mas sobre el papel
       que sobre el fondo oscuro--. Las dos se declaran aqui, en el elemento
       que las usa: `light-dark()` mira el `color-scheme` de donde se declara
       la variable, no el del ancestro. */
    --composer-sweep: light-dark(oklch(62% 0.25 256), oklch(100% 0 271 / 0.5));
    --composer-shadow: light-dark(oklch(0 0 0 / 0.18), oklch(0 0 0 / 0.4));

    position: relative;
    border-width: var(--composer-ring);
    border-color: light-dark(var(--border), var(--border-strong));
    box-shadow: 0 0 1.25rem var(--composer-shadow);
    transition: border-color 150ms;

    /* El cursor de seleccion esta encendido. */
    &.composer-picking {
      border-color: var(--accent);
    }

    /* El anillo va por fuera, encima del propio borde: de ahi el desplazado
       negativo y el radio de la tarjeta mas esos dos pixeles, para que las
       dos curvas sean concentricas y la luz no se despegue en las esquinas. */
    &::after {
      content: "";
      position: absolute;
      inset: calc(-1 * var(--composer-ring));
      border-radius: calc(var(--radius-lg) + var(--composer-ring));
      padding: var(--composer-ring);
      background: conic-gradient(
        from var(--sweep-angle),
        transparent 0deg,
        var(--composer-sweep) 14deg,
        transparent 38deg
      );
      mask-image: linear-gradient(#000 0 0), linear-gradient(#000 0 0);
      mask-clip: content-box, border-box;
      mask-composite: exclude;
      opacity: 0;
      pointer-events: none;
    }

    /* Una vuelta por cada vez que se entra al campo: la regla aparece con el
       foco, y con ella la animacion arranca desde cero. */
    &:has(textarea:focus)::after {
      animation: composer-sweep 2100ms ease-out;
    }

    @media (prefers-reduced-motion: reduce) {
      &:has(textarea:focus)::after {
        animation: none;
      }
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
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
    color: var(--text-primary);
    outline: none;

    &::placeholder {
      color: var(--text-muted);
    }
  }

  /* Los controles respiran: a `--sp-6` se leian como un bloque y no como
     cuatro cosas distintas --adjuntar, senalar, el modelo, enviar--. */
  .chat-composer-actions {
    gap: var(--sp-12);
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
    color: var(--text-subtle);
  }

  /* --- Lo que espera turno --- */

  .bubble-user-message.is-queued {
    background: transparent;
    border: var(--border-width) dashed var(--border-strong);
    color: var(--text-muted);
  }

  .btn-drop-queued {
    cursor: pointer;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-subtle);
    transition: color 150ms;

    &:hover {
      color: var(--text-secondary);
    }
  }

  /* El badge de un adjunto que se puede abrir: el boton no lo redecora. */
  .link-user-file {
    all: unset;
    cursor: pointer;
    color: inherit;
  }
</style>
