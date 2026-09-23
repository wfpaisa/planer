/**
 * La conversación con la IA que esta a medias, guardada fuera de quien la
 * dibuja.
 *
 * La barra se abre y se cierra todo el rato: si la conversación viviera dentro
 * de ella, cerrar borraria lo escrito y habria que repetir la petición. Aquí
 * sobrevive a cerrar y volver a abrir.
 *
 * Se guarda por página. Dos páginas de la misma aplicación no comparten
 * conversación: cada petición escribe sobre la página donde se hizo, y
 * mezclarlas haria creer que la IA tiene delante otra cosa.
 *
 * Es memoria de esta visita, no del servidor. Lo que tiene que durar ya vive
 * en las conversaciones guardadas de la aplicación.
 *
 * Abierta, en cambio, hay una sola en toda la aplicación --la ultima en la que
 * se hablo-- y eso si lo guarda el servidor: ver mas abajo.
 *
 * El almacen es reactivo --de ahi el `.svelte.ts`-- porque no hay un solo
 * lector: el panel dibuja lo que hay aquí, y quien escribe puede ser un hilo de
 * avisos que empezo en un panel que ya se desmonto. Con una copia dentro del
 * componente, la respuesta de una petición que termino después de ir a otra
 * sección y volver no aparecia hasta recargar.
 */
import { aiNearestThinking } from "@shared/aiCatalog";
import type {
  AccessChange,
  AiChatFile,
  AiChoice,
  AiConfigView,
  AiOpenChat,
  AiQuestion,
  AiStep,
  AiThinking,
  AiUsage,
  PickedBlock,
} from "@shared/types";
import { SvelteMap } from "svelte/reactivity";

import type { DraftFile } from "./aiFiles";
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
   * la del ultimo turno: elegir manda una petición nueva, y una pregunta vieja
   * ya se resolvio de una forma o de otra.
   */
  question?: AiQuestion;
  /**
   * El plan con el que este turno cerro el modo Plan, si lo cerro. Mismo papel
   * que `question`: se lee la tarjeta aunque se recargue o se relea después.
   */
  plan?: { texto: string; implementado: boolean };
  /**
   * Los accesos que la IA quiere dar y todavía no dio. Viven en la entrada del
   * turno que los pidio: lo que hay que leer para decidir es la frase que la
   * IA escribio ahi, no un botón en otra pantalla.
   */
  access?: AccessChange[];
  /** Lo que penso el modelo antes de responder, si su servidor lo envio. */
  reasoning?: string;
  /** El contexto que se le mando al modelo, si se pidio verlo desde Ajustes. */
  context?: string;
  /**
   * Los archivos que se adjuntaron a esta petición: su nombre y la referencia
   * de lo guardado. El contenido no esta aquí --vive en el almacen de
   * adjuntos-- pero con la referencia la burbuja puede abrirlo.
   */
  files?: AiChatFile[];
  /**
   * Como se llamaba cada elemento senalado con el cursor. Por lo mismo que los
   * archivos: el HTML ya viajo, y lo que queda es con que se pidio.
   */
  picked?: string[];
  /**
   * El turno termino sin respuesta: fallo, o se detuvo a mitad.
   *
   * Es lo que decide que su proceso no se pliegue. Un turno que cerro bien se
   * pliega porque la respuesta es lo que hay que leer; en uno que no llego a
   * cerrar, lo que hay que leer es justo por donde iba.
   */
  unfinished?: boolean;
}

/** Una petición escrita mientras la IA trabajaba, esperando su turno. */
export interface QueuedAsk {
  id: number;
  /** El texto que se va a mandar. */
  text: string;
  /** Lo que se lee en el badge, si es distinto de lo que se manda. */
  label?: string;
  picks: PickedBlock[];
  files: DraftFile[];
}

export interface Conversation {
  entries: Entry[];
  /** La conversación guardada a la que pertenece, si ya nacio. */
  chatId: string;
  /** Lo escrito y todavía sin enviar. */
  draft: string;
  /**
   * Los elementos senalados con el cursor, cada uno con su badge. Viven aquí
   * por lo mismo que los atajos: quitar uno antes de enviar no puede costar lo
   * que se llevaba escrito.
   */
  picks: PickedBlock[];
  /**
   * Los archivos adjuntos a la petición que se esta escribiendo, ya subidos o
   * todavía subiendose. Viven aquí por lo mismo que lo senalado: quitar uno
   * antes de enviar no puede costar lo que se llevaba escrito, y esconder el
   * dock no los pierde.
   */
  files: DraftFile[];
  /**
   * Las peticiones que se enviaron mientras la IA trabajaba y esperan turno.
   *
   * Viven en el navegador y no en el servidor: la que esta en marcha ya
   * sobrevive a recargar porque el servidor la reconoce, pero lo encolado
   * todavía no existe para el. Por eso, al recargar, vuelve al campo de texto
   * en vez de perderse. Ver `design.md` D7.
   */
  queue: QueuedAsk[];
  /**
   * Lo que ocupo la ultima petición de esta conversación. Se queda para poder
   * seguir viendo cuanto contexto se gasto después de que termine.
   */
  usage?: AiUsage;
}

const EMPTY: Conversation = { entries: [], chatId: "", draft: "", picks: [], files: [], queue: [] };

const store = new SvelteMap<string, Conversation>();

export const conversationKey = (appId: string, pageId: string) => `${appId}:${pageId}`;

/*
 * Las conversaciones que esta pestana ya esta escuchando.
 *
 * Una petición sigue viva en el servidor aunque se esconda el dock, y el hilo
 * de avisos que la escucha sobrevive a que el panel se desmonte: lo que llegue
 * acaba en la conversación de arriba igual. Sin esta marca, volver a abrir el
 * dock se engancharia por segunda vez a la misma petición y su respuesta
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
 * Se pregunta una sola vez por visita: repetirlo cuando la petición ya termino
 * volveria a recoger el mismo resultado y lo dejaria dos veces. La marca vive
 * aquí y no dentro del panel porque el panel se monta mas de una vez --React lo
 * hace a propósito en desarrollo-- y una marca que muere con el no marca nada.
 */
const resumed = new Set<string>();

export const wasResumed = (key: string) => resumed.has(key);

export const markResumed = (key: string) => {
  resumed.add(key);
};

/*
 * Las páginas a las que ya se les miro si la conversación abierta era la suya.
 *
 * Se mira una sola vez por visita: quien empieza una conversación nueva y se
 * va a otra página no puede encontrarse la vieja repuesta encima al volver.
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
/* Lo que quedo en cola al recargar                                     */
/* ------------------------------------------------------------------ */

/*
 * La cola vive en esta pestana, así que recargar la pierde. Perderla en
 * silencio seria tragarse lo que alguien escribio, así que lo encolado se
 * apunta en el navegador y, al volver, se devuelve al campo de texto y se dice.
 *
 * Se apunta solo el texto. Lo senalado no sobrevive a recargar --el documento
 * se volvio a dibujar-- y los adjuntos tampoco se reponen: el texto es lo que
 * se escribio, y es lo único que se puede prometer.
 */
const QUEUE_KEY = "plane_ai_queue";

const queueKeyOf = (key: string) => `${QUEUE_KEY}:${key}`;

/** Apunta lo que hay en cola, para que recargar no se lo trague. */
export function rememberQueue(key: string, queue: QueuedAsk[]): void {
  try {
    const texts = queue.map((q) => q.text).filter(Boolean);
    if (texts.length) localStorage.setItem(queueKeyOf(key), JSON.stringify(texts));
    else localStorage.removeItem(queueKeyOf(key));
  } catch {
    /* sin sitio donde apuntarlo, recargar lo pierde y no hay mas que decir */
  }
}

/**
 * Lo que había quedado en cola antes de recargar, y lo borra: se devuelve una
 * sola vez, al campo de texto de quien vuelve.
 */
export function takeQueue(key: string): string[] {
  try {
    const raw = localStorage.getItem(queueKeyOf(key));
    localStorage.removeItem(queueKeyOf(key));
    if (!raw) return [];
    const texts: unknown = JSON.parse(raw);
    return Array.isArray(texts) ? texts.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* La conversación abierta                                              */
/* ------------------------------------------------------------------ */

/*
 * Guardadas hay muchas; abierta hay una sola en toda la aplicación: la ultima
 * en la que se hablo, en la página que fuera.
 *
 * Antes cada página reponia la suya al abrirse, y recorrer la aplicación iba
 * dejando delante en cada página una conversación de cualquier dia, como si se
 * acabara de hablar ahi. Ahora se repone solo en la página que la tiene, y las
 * demás empiezan en blanco; lo de antes sigue en "Conversaciones anteriores".
 *
 * Cual es lo guarda el servidor, no esta pestana: quien sigue desde otro
 * navegador tiene que encontrarse delante la que dejo, y solo esa.
 */
const openPath = (appId: string) => `/api/apps/${appId}/conversaciones/abierta`;

/*
 * Lo que el servidor contesto, por aplicación. Se pregunta una vez por visita:
 * desde entonces quien la mueve es esta pestana, y lo que sabe de ella es mas
 * nuevo que lo que volveria a contestar.
 */
const open = new Map<string, Promise<AiOpenChat | null>>();

/** La abierta de esta aplicación, o ninguna. */
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
 * Apuntar la que acaba de quedar abierta. Solo aquí: el servidor ya la apunto
 * por su cuenta al guardar la petición.
 *
 * `shown` es la conversación que quien construye tiene delante. Esa no se
 * suelta aunque la que quede abierta sea de otra página: una petición que
 * termina en la página de al lado no puede borrarle de los ojos lo que esta
 * leyendo.
 */
export function markOpenChat(appId: string, chat: AiOpenChat | null, shown = ""): void {
  open.set(appId, Promise.resolve(chat));
  closeOthers(appId, chat, shown);
}

/**
 * Dejar abierta otra --o ninguna-- porque quien construye lo pidio: empezar una
 * conversación nueva, o abrir una de la lista.
 *
 * No se espera al servidor: lo que hay delante ya cambio, y apuntarlo es para
 * la proxima visita. Si no llega, lo abierto sigue siendo lo de antes, que es
 * lo que había.
 */
export function setOpenChat(appId: string, chat: AiOpenChat | null, shown = ""): void {
  markOpenChat(appId, chat, shown);
  void put(openPath(appId), { chatId: chat?.chat ?? "" }).catch(() => {
    /* sin apuntarlo, la proxima visita repone la de antes */
  });
}

/*
 * Soltar lo que las demás páginas tenian delante.
 *
 * Es lo que significa que abierta haya una sola: en cuanto se habla en una
 * página, volver a otra empieza en blanco, también en esta visita. Sin esto,
 * ir y volver dentro de la visita ensenaria una cosa y recargar otra.
 *
 * Lo escrito sin enviar --el texto, lo senalado y lo adjunto-- se queda donde
 * estaba: no se preparo para esta petición, y perderlo por haber pedido algo en
 * otra página seria tirar trabajo de quien construye.
 *
 * Una conversación que esta escuchando una petición no se toca: lo que llegue
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
 * no de la página ni de la conversación: quien eligio un modelo lo eligio para
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
 * La eleccion que de verdad se puede usar hoy.
 *
 * Se comprueba contra lo que hay conectado ahora mismo: un modelo que se quito
 * de los ajustes no puede quedarse elegido, porque el servidor lo cambiaria por
 * otro sin que aquí se notara.
 */
export function resolveChoice(cfg: AiConfigView, saved: Partial<AiChoice> | null): AiChoice {
  const provider = cfg.providers.find((p) => p.id === saved?.provider);
  const model = provider?.models.find((m) => m.id === saved?.model);
  const wanted: AiThinking = saved?.thinking ?? cfg.fallback.thinking;

  const choice: AiChoice = model
    ? { provider: provider?.id ?? "", model: model.id, thinking: wanted }
    : { ...cfg.fallback, thinking: wanted };

  // El nivel también tiene que existir: cada modelo ofrece los suyos, y uno que
  // se guardo con otro modelo puede no valer para este.
  const target =
    model ??
    cfg.providers.find((p) => p.id === choice.provider)?.models.find((m) => m.id === choice.model);
  return target ? { ...choice, thinking: aiNearestThinking(target, choice.thinking) } : choice;
}
