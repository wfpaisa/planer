/**
 * La conversacion con la IA que esta a medias, guardada fuera de quien la
 * dibuja.
 *
 * La barra se abre y se cierra todo el rato: si la conversacion viviera dentro
 * de ella, cerrar borraria lo escrito y habria que repetir la peticion. Aqui
 * sobrevive a cerrar y volver a abrir.
 *
 * Se guarda por pagina. Dos paginas de la misma aplicacion no comparten
 * conversacion: cada peticion escribe sobre la pagina donde se hizo, y
 * mezclarlas haria creer que la IA tiene delante otra cosa.
 *
 * Es memoria de esta visita, no del servidor. Lo que tiene que durar ya vive
 * en las conversaciones guardadas de la aplicacion.
 *
 * Abierta, en cambio, hay una sola en toda la aplicacion --la ultima en la que
 * se hablo-- y eso si lo guarda el servidor: ver mas abajo.
 *
 * El almacen es reactivo --de ahi el `.svelte.ts`-- porque no hay un solo
 * lector: el panel dibuja lo que hay aqui, y quien escribe puede ser un hilo de
 * avisos que empezo en un panel que ya se desmonto. Con una copia dentro del
 * componente, la respuesta de una peticion que termino despues de ir a otra
 * seccion y volver no aparecia hasta recargar.
 */
import { aiNearestThinking } from "@shared/aiCatalog";
import type {
  AccessChange,
  AiChoice,
  AiConfigView,
  AiFile,
  AiOpenChat,
  AiQuestion,
  AiStep,
  AiThinking,
  AiUsage,
  PickedBlock,
} from "@shared/types";
import { SvelteMap } from "svelte/reactivity";

import { api, put } from "./pb";

export interface Entry {
  id: number;
  from: "yo" | "ia";
  text: string;
  /**
   * Lo que se lee en la burbuja en vez del texto, si es distinto de lo que se
   * mando. Un atajo manda un pedido largo en ingles; la burbuja muestra su
   * rotulo corto en espanol.
   */
  label?: string;
  steps?: AiStep[];
  /** Lo que se aplico solo por no tener riesgo. */
  notices?: string[];
  /**
   * La pregunta con la que la IA cerro el turno, si pregunto. Solo se contesta
   * la del ultimo turno: elegir manda una peticion nueva, y una pregunta vieja
   * ya se resolvio de una forma o de otra.
   */
  question?: AiQuestion;
  /**
   * Los accesos que la IA quiere dar y todavia no dio. Viven en la entrada del
   * turno que los pidio: lo que hay que leer para decidir es la frase que la
   * IA escribio ahi, no un boton en otra pantalla.
   */
  access?: AccessChange[];
  /** Lo que penso el modelo antes de responder, si su servidor lo envio. */
  reasoning?: string;
  /** El contexto que se le mando al modelo, si se pidio verlo en modo debug. */
  context?: string;
  /**
   * Los nombres de los archivos que se adjuntaron a esta peticion. Solo los
   * nombres: el contenido ya viajo y no hay por que guardarlo aqui otra vez.
   */
  files?: string[];
  /**
   * Como se llamaba cada elemento senalado con el cursor. Por lo mismo que los
   * archivos: el HTML ya viajo, y lo que queda es con que se pidio.
   */
  picked?: string[];
}

export interface Conversation {
  entries: Entry[];
  /** La conversacion guardada a la que pertenece, si ya nacio. */
  chatId: string;
  /** Lo escrito y todavia sin enviar. */
  draft: string;
  /**
   * Los elementos senalados con el cursor, cada uno con su badge. Viven aqui
   * por lo mismo que los atajos: quitar uno antes de enviar no puede costar lo
   * que se llevaba escrito.
   */
  picks: PickedBlock[];
  /**
   * Los archivos adjuntos a la peticion que se esta escribiendo, ya leidos.
   * Viven aqui por lo mismo que lo senalado: quitar uno antes de enviar no
   * puede costar lo que se llevaba escrito, y esconder el dock no los pierde.
   */
  files: AiFile[];
  /**
   * Lo que ocupo la ultima peticion de esta conversacion. Se queda para poder
   * seguir viendo cuanto contexto se gasto despues de que termine.
   */
  usage?: AiUsage;
}

const EMPTY: Conversation = { entries: [], chatId: "", draft: "", picks: [], files: [] };

const store = new SvelteMap<string, Conversation>();

export const conversationKey = (appId: string, pageId: string) => `${appId}:${pageId}`;

/*
 * Las conversaciones que esta pestana ya esta escuchando.
 *
 * Una peticion sigue viva en el servidor aunque se esconda el dock, y el hilo
 * de avisos que la escucha sobrevive a que el panel se desmonte: lo que llegue
 * acaba en la conversacion de arriba igual. Sin esta marca, volver a abrir el
 * dock se engancharia por segunda vez a la misma peticion y su respuesta
 * entraria dos veces.
 */
const listening = new Set<string>();

export const isListening = (key: string) => listening.has(key);

export function markListening(key: string, on: boolean): void {
  if (on) listening.add(key);
  else listening.delete(key);
}

/*
 * Las conversaciones a las que ya se les pregunto si tenian algo en marcha.
 *
 * Se pregunta una sola vez por visita: repetirlo cuando la peticion ya termino
 * volveria a recoger el mismo resultado y lo dejaria dos veces. La marca vive
 * aqui y no dentro del panel porque el panel se monta mas de una vez --React lo
 * hace a proposito en desarrollo-- y una marca que muere con el no marca nada.
 */
const resumed = new Set<string>();

export const wasResumed = (key: string) => resumed.has(key);

export const markResumed = (key: string) => {
  resumed.add(key);
};

/*
 * Las paginas a las que ya se les miro si la conversacion abierta era la suya.
 *
 * Se mira una sola vez por visita: quien empieza una conversacion nueva y se
 * va a otra pagina no puede encontrarse la vieja repuesta encima al volver.
 */
const hydrated = new Set<string>();

export const wasHydrated = (key: string) => hydrated.has(key);

export const markHydrated = (key: string) => {
  hydrated.add(key);
};

export function readConversation(key: string): Conversation {
  return store.get(key) ?? EMPTY;
}

export function writeConversation(key: string, next: Conversation): void {
  store.set(key, next);
}

/** Empezar de cero. Solo cuando quien construye lo pide. */
export function clearConversation(key: string): void {
  store.delete(key);
  resumed.delete(key);
  hydrated.delete(key);
}

/* ------------------------------------------------------------------ */
/* La conversacion abierta                                              */
/* ------------------------------------------------------------------ */

/*
 * Guardadas hay muchas; abierta hay una sola en toda la aplicacion: la ultima
 * en la que se hablo, en la pagina que fuera.
 *
 * Antes cada pagina reponia la suya al abrirse, y recorrer la aplicacion iba
 * dejando delante en cada pagina una conversacion de cualquier dia, como si se
 * acabara de hablar ahi. Ahora se repone solo en la pagina que la tiene, y las
 * demas empiezan en blanco; lo de antes sigue en "Conversaciones anteriores".
 *
 * Cual es lo guarda el servidor, no esta pestana: quien sigue desde otro
 * navegador tiene que encontrarse delante la que dejo, y solo esa.
 */
const openPath = (appId: string) => `/api/apps/${appId}/conversaciones/abierta`;

/*
 * Lo que el servidor contesto, por aplicacion. Se pregunta una vez por visita:
 * desde entonces quien la mueve es esta pestana, y lo que sabe de ella es mas
 * nuevo que lo que volveria a contestar.
 */
const open = new Map<string, Promise<AiOpenChat | null>>();

/** La abierta de esta aplicacion, o ninguna. */
export function loadOpenChat(appId: string): Promise<AiOpenChat | null> {
  const asked = open.get(appId);
  if (asked) return asked;
  // Sin respuesta se sigue como si no hubiera ninguna, que es empezar en
  // blanco: es lo que ya se esta viendo.
  const one = api<AiOpenChat | null>(openPath(appId)).catch(() => null);
  open.set(appId, one);
  return one;
}

/**
 * Apuntar la que acaba de quedar abierta. Solo aqui: el servidor ya la apunto
 * por su cuenta al guardar la peticion.
 *
 * `shown` es la conversacion que quien construye tiene delante. Esa no se
 * suelta aunque la que quede abierta sea de otra pagina: una peticion que
 * termina en la pagina de al lado no puede borrarle de los ojos lo que esta
 * leyendo.
 */
export function markOpenChat(appId: string, chat: AiOpenChat | null, shown = ""): void {
  open.set(appId, Promise.resolve(chat));
  closeOthers(appId, chat, shown);
}

/**
 * Dejar abierta otra --o ninguna-- porque quien construye lo pidio: empezar una
 * conversacion nueva, o abrir una de la lista.
 *
 * No se espera al servidor: lo que hay delante ya cambio, y apuntarlo es para
 * la proxima visita. Si no llega, lo abierto sigue siendo lo de antes, que es
 * lo que habia.
 */
export function setOpenChat(appId: string, chat: AiOpenChat | null, shown = ""): void {
  markOpenChat(appId, chat, shown);
  void put(openPath(appId), { chatId: chat?.chat ?? "" }).catch(() => {
    /* sin apuntarlo, la proxima visita repone la de antes */
  });
}

/*
 * Soltar lo que las demas paginas tenian delante.
 *
 * Es lo que significa que abierta haya una sola: en cuanto se habla en una
 * pagina, volver a otra empieza en blanco, tambien en esta visita. Sin esto,
 * ir y volver dentro de la visita ensenaria una cosa y recargar otra.
 *
 * Lo escrito sin enviar --el texto, lo senalado y lo adjunto-- se queda donde
 * estaba: no se preparo para esta peticion, y perderlo por haber pedido algo en
 * otra pagina seria tirar trabajo de quien construye.
 *
 * Una conversacion que esta escuchando una peticion no se toca: lo que llegue
 * aterriza ahi, y dejarla sin lo que se pidio haria aparecer la respuesta sola.
 */
function closeOthers(appId: string, chat: AiOpenChat | null, shown: string): void {
  const keep = chat ? conversationKey(appId, chat.page) : "";
  for (const [key, conversation] of store) {
    if (key === keep || key === shown) continue;
    if (!key.startsWith(`${appId}:`) || isListening(key)) continue;
    if (!conversation.entries.length && !conversation.chatId) continue;
    store.set(key, { ...conversation, entries: [], chatId: "", usage: undefined });
  }
}

let counter = 0;
export const nextEntryId = () => ++counter;

/* ------------------------------------------------------------------ */
/* El modelo elegido                                                    */
/* ------------------------------------------------------------------ */

/*
 * Con que se piden las cosas: el modelo y cuanto se le pide pensar.
 *
 * Esto si dura entre visitas --vive en el navegador-- y es de quien construye,
 * no de la pagina ni de la conversacion: quien eligio un modelo lo eligio para
 * trabajar, no para un rato. Lo que se guarda es solo la eleccion; si el modelo
 * desaparece de los ajustes, se cae en el que este puesto por defecto.
 */
const CHOICE_KEY = "plane_ai_choice";

export function readChoice(): Partial<AiChoice> | null {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    return raw ? (JSON.parse(raw) as Partial<AiChoice>) : null;
  } catch {
    return null;
  }
}

export function writeChoice(choice: AiChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    /* sin sitio donde guardarlo la eleccion dura lo que dure la visita */
  }
}

/**
 * Ver el contexto que se le manda al modelo en cada ronda.
 *
 * Es de quien construye, no de la conversacion: dura entre visitas y aplica a
 * cualquier pagina en la que pida algo, hasta que lo apague.
 */
const DEBUG_KEY = "plane_ai_debug";

export function readDebug(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDebug(on: boolean): void {
  try {
    localStorage.setItem(DEBUG_KEY, on ? "1" : "0");
  } catch {
    /* sin sitio donde guardarlo dura lo que dure la visita */
  }
}

/**
 * La eleccion que de verdad se puede usar hoy.
 *
 * Se comprueba contra lo que hay conectado ahora mismo: un modelo que se quito
 * de los ajustes no puede quedarse elegido, porque el servidor lo cambiaria por
 * otro sin que aqui se notara.
 */
export function resolveChoice(cfg: AiConfigView, saved: Partial<AiChoice> | null): AiChoice {
  const provider = cfg.providers.find((p) => p.id === saved?.provider);
  const model = provider?.models.find((m) => m.id === saved?.model);
  const wanted: AiThinking = saved?.thinking ?? cfg.fallback.thinking;

  const choice: AiChoice = model
    ? { provider: provider?.id ?? "", model: model.id, thinking: wanted }
    : { ...cfg.fallback, thinking: wanted };

  // El nivel tambien tiene que existir: cada modelo ofrece los suyos, y uno que
  // se guardo con otro modelo puede no valer para este.
  const target =
    model ??
    cfg.providers.find((p) => p.id === choice.provider)?.models.find((m) => m.id === choice.model);
  return target ? { ...choice, thinking: aiNearestThinking(target, choice.thinking) } : choice;
}
