/**
 * El registro de depuracion de la IA: la ultima petición de cada página.
 *
 * Una fila por página, sobrescrita en cada petición. No es un historial --eso
 * creceria sin tope-- sino lo que hace falta para entender después un fallo
 * que no se puede reproducir: lo que se pidio, el contexto que se le mando al
 * modelo tal cual, el razonamiento, la respuesta, el modelo y cuanto tardo.
 *
 * Se escribe siempre, no solo con el modo debug encendido: si hubiera que
 * encenderlo y repetir la petición, llegaria tarde justo para el fallo que
 * vale depurar. El tamaño no crece con las peticiones, lo acota el número de
 * páginas.
 *
 * Solo entra el servidor: la colección no tiene reglas de acceso, y quien lo
 * lee lo hace por una ruta que comprueba que la aplicación es suya.
 */
import type { AiDebugEntry } from "../../shared/types.ts";
import { INTERNAL } from "../config.ts";
import { quote } from "../filter.ts";
import { createRecord, deleteRecord, firstRecord, listRecords, updateRecord } from "../pb.ts";

/**
 * Lo que cabe en el contexto guardado.
 *
 * La columna admite dos millones de caracteres; se deja margen para que un
 * conteo distinto al del servidor de la base no haga fallar la escritura. El
 * contexto lleva el HTML entero de la página, así que una página grande llega
 * de verdad hasta aquí.
 */
const MAX_CONTEXT = 1_900_000;

/** Lo demás es texto corto al lado del contexto, pero también tiene tope. */
const MAX_PROMPT = 100_000;
const MAX_ANSWER = 500_000;

const cut = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

/**
 * Guarda la constancia de una petición, sobrescribiendo la de esa página.
 *
 * No devuelve nada y nunca falla hacia afuera: se llama después de entregar el
 * resultado, y un fallo al guardar no puede cambiar lo que recibe quien
 * construye.
 */
export async function saveAiDebug(entry: {
  appId: string;
  pageId: string;
  prompt: string;
  context: string;
  reasoning: string;
  answer: string;
  model: string;
  ms: number;
}): Promise<void> {
  try {
    const truncated = entry.context.length > MAX_CONTEXT;
    const body = {
      app: entry.appId,
      page: entry.pageId,
      prompt: cut(entry.prompt, MAX_PROMPT),
      context: cut(entry.context, MAX_CONTEXT),
      reasoning: cut(entry.reasoning, MAX_ANSWER),
      answer: cut(entry.answer, MAX_ANSWER),
      model: entry.model.slice(0, 200),
      ms: entry.ms,
      truncated,
    };

    const existing = await firstRecord<{ id: string }>(
      INTERNAL.aiDebug,
      `page = "${quote(entry.pageId)}"`,
      { fields: "id" },
    );
    if (existing) await updateRecord(INTERNAL.aiDebug, existing.id, body);
    else await createRecord(INTERNAL.aiDebug, body);
  } catch {
    /* la petición ya se entrego: no poder dejar constancia no la deshace */
  }
}

/** La constancia de una página. `null`: no hay ninguna guardada. */
export function readAiDebug(appId: string, pageId: string): Promise<AiDebugEntry | null> {
  return firstRecord<AiDebugEntry>(
    INTERNAL.aiDebug,
    `app = "${quote(appId)}" && page = "${quote(pageId)}"`,
  );
}

/**
 * Borra todas las constancias de la instalacion.
 *
 * Es una operacion de instalacion, no de una aplicación: por eso vive en los
 * ajustes generales. No toca conversaciones ni páginas.
 */
export async function clearAiDebug(): Promise<number> {
  // Se lee siempre la primera página porque cada vuelta borra la anterior. El
  // tope de vueltas es la red de seguridad: una fila que se resista a
  // desaparecer no puede dejar esto girando para siempre.
  let removed = 0;
  for (let round = 0; round < 200; round++) {
    const res = await listRecords<{ id: string }>(INTERNAL.aiDebug, {
      perPage: 200,
      skipTotal: 1,
      fields: "id",
    });
    if (!res.items.length) return removed;
    let gone = 0;
    for (const row of res.items) {
      await deleteRecord(INTERNAL.aiDebug, row.id).catch(() => {});
      gone++;
    }
    removed += gone;
  }
  return removed;
}
