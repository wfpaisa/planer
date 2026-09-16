import PocketBase, { LocalAuthStore } from "pocketbase";

/** Sesion del panel (quien construye). */
export const pb = new PocketBase("/pb", new LocalAuthStore("plane_builder"));

/** Sesion de las apps publicadas (quien las usa). */
export const pbApp = new PocketBase("/pb", new LocalAuthStore("plane_member"));

pb.autoCancellation(false);
pbApp.autoCancellation(false);

export class ApiError extends Error {}

/**
 * El cuerpo de una respuesta, cuando de verdad viene en JSON.
 *
 * No siempre viene: un proxy que se cae, el servidor de desarrollo apagado o
 * una pagina de error del navegador llegan en HTML, y ahi `JSON.parse` lanzaba
 * un `SyntaxError: Unexpected token '<'` que subia tal cual hasta la pantalla.
 * Lo que se le ensena a quien construye tiene que ser una frase suya, asi que
 * lo que no se entiende cuenta como que no vino nada.
 */
export function jsonBody(text: string): { error?: string; codigo?: string } | null {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as { error?: string; codigo?: string };
  } catch {
    return null;
  }
}

/** El mensaje de una respuesta que fallo, siempre legible. */
export const httpError = (res: Response, data: { error?: string } | null): ApiError =>
  new ApiError(data?.error ?? `El servidor respondio ${res.status}`);

/** Llama a la API propia de la plataforma con la sesion del panel. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (pb.authStore.token) headers.set("authorization", pb.authStore.token);
  if (init.body) headers.set("content-type", "application/json");

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const data = jsonBody(text);

  if (!res.ok) throw httpError(res, data);
  return data as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

/**
 * Una peticion que llega por partes, a medida que el servidor la produce.
 *
 * Se usa donde esperar al final seria esperar a ciegas. Cada parte se entrega
 * en cuanto llega; el resultado de verdad viaja dentro de una de ellas, y de
 * eso ya sabe quien llama.
 */
export async function stream<T>(
  path: string,
  body: unknown,
  onPart: (part: T) => void,
): Promise<void> {
  const headers = new Headers({ "content-type": "application/json" });
  if (pb.authStore.token) headers.set("authorization", pb.authStore.token);

  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    throw httpError(res, jsonBody(await res.text()));
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    // Cada parte termina en linea en blanco. Lo que queda sin cerrar espera al
    // siguiente trozo: partirlo a medias daria un JSON roto.
    let cut = buffer.indexOf("\n\n");
    while (cut !== -1) {
      const chunk = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 2);
      if (chunk.startsWith("data:")) {
        try {
          onPart(JSON.parse(chunk.slice(5).trim()) as T);
        } catch {
          /* una parte ilegible no vale la pena tirar toda la peticion */
        }
      }
      cut = buffer.indexOf("\n\n");
    }
  }
}

/** Lo que una respuesta fallida dice que paso, recogido tal como viene. */
interface ApiFault {
  /** Las columnas rechazadas: la unica parte que se lee sin saber de la base. */
  fields: { field: string; message: string; code?: string }[];
  /** El mensaje de cada nivel, de fuera adentro y sin repetirse. */
  trail: string[];
  /** El estado HTTP mas hondo que aparezca. */
  status?: number;
}

/**
 * Lee una respuesta fallida de PocketBase sin tirar nada.
 *
 * La API de lote anida: el nivel de fuera solo dice "Batch transaction failed",
 * que no nombra ni la columna ni el motivo, y lo que de verdad paso vive en
 * `requests.N.response`. De ahi la recursion. Se guardan los tres niveles
 * --columnas, mensajes y estado-- porque un fallo que nadie previo no tiene por
 * que caber en el primero, y lo que no se recoge aqui no se puede ensenar.
 */
function readFault(response: unknown, fault: ApiFault, depth = 0): void {
  if (!response || typeof response !== "object" || depth > 4) return;
  const level = response as { message?: unknown; status?: unknown; data?: unknown };

  if (typeof level.message === "string" && level.message.trim()) {
    const text = level.message.trim();
    if (!fault.trail.includes(text)) fault.trail.push(text);
  }
  if (typeof level.status === "number") fault.status = level.status;
  if (!level.data || typeof level.data !== "object") return;

  for (const [key, value] of Object.entries(level.data as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;

    // `requests` no es una columna: es la lista de pedidos del lote, y cada uno
    // trae dentro su propia respuesta, que es la que sabe que fallo.
    if (key === "requests") {
      for (const request of Object.values(value as Record<string, unknown>)) {
        const inner = request as { response?: unknown } | null;
        readFault(inner?.response, fault, depth + 1);
      }
      continue;
    }

    const entry = value as { code?: unknown; message?: unknown; response?: unknown };
    if (entry.response) {
      readFault(entry.response, fault, depth + 1);
      continue;
    }
    if (typeof entry.message === "string" && entry.message.trim()) {
      fault.fields.push({
        field: key,
        message: entry.message.trim(),
        code: typeof entry.code === "string" ? entry.code : undefined,
      });
    }
  }
}

/** Lo que cabe en el renglon de detalle antes de cortarlo. */
const DETAIL_MAX = 300;

const clamp = (text: string) =>
  text.length > DETAIL_MAX ? `${text.slice(0, DETAIL_MAX - 1)}\u2026` : text;

/**
 * Mensaje legible para cualquier error que llegue del servidor.
 *
 * Dos renglones: arriba lo que hay que arreglar --la columna y lo que se le
 * objeta-- y debajo lo que dijo la API para llegar hasta ahi, con su codigo y
 * su estado. El de abajo esta por los fallos que nadie previo: sin el, una
 * respuesta con una forma que este codigo no reconoce se resumia en "Algo salio
 * mal" y quien construye se quedaba sin nada que mirar ni que copiar --y el
 * aviso se selecciona con el raton justamente para copiarlo--.
 *
 * Un error de la API propia de la plataforma no pasa por aqui: ya llega escrito
 * en una frase suya (ver `httpError`).
 */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (!err || typeof err !== "object") return "Algo salio mal";

  const e = err as { message?: string; response?: unknown };
  const fault: ApiFault = { fields: [], trail: [] };
  readFault(e.response, fault);

  const head = fault.fields.length
    ? fault.fields.map((f) => `${f.field}: ${f.message}`).join(" \u00b7 ")
    : (fault.trail[0] ?? e.message?.trim() ?? "Algo salio mal");

  const parts: string[] = [];
  const rest = fault.trail.filter((t) => t !== head);
  if (rest.length) parts.push(rest.join(" \u2192 "));
  const codes = [...new Set(fault.fields.map((f) => f.code).filter(Boolean))];
  if (codes.length) parts.push(codes.join(", "));
  /*
   * De la respuesta no salio nada legible --ni columnas ni un mensaje suyo--,
   * asi que se ensena su cuerpo tal cual. Es feo a proposito, es JSON, y es lo
   * unico que sirve cuando la forma no es ninguna de las previstas: sin esto el
   * aviso se quedaba en "Algo salio mal" y no habia nada que mirar ni copiar.
   */
  if (!fault.trail.length && !fault.fields.length && e.response) {
    try {
      const raw = JSON.stringify(e.response);
      if (raw && raw !== "{}" && raw !== head) parts.push(raw);
    } catch {
      /* un cuerpo que no se puede serializar no cuenta como detalle */
    }
  }
  /*
   * El estado acompana a un fallo, no es un fallo por si solo: se pone cuando
   * ya hay algo mas que contar. Un "Failed to authenticate." --que es lo que ve
   * quien se equivoca de clave al entrar en una aplicacion publicada-- no tiene
   * por que llevar un HTTP 400 detras.
   */
  if (fault.status && parts.length) parts.push(`HTTP ${fault.status}`);

  return parts.length ? `${head}\n${clamp(parts.join(" \u00b7 "))}` : head;
}

/**
 * Si el fallo fue por pedir demasiado rapido, mire donde mire.
 *
 * Un lote lo dice por dentro: el pedido que se paso del limite trae su `429` y
 * el lote entero responde `400`, asi que el estado de fuera no sirve para
 * reconocerlo. Se busca en todos los niveles, que es lo que permite volver a
 * intentar el tramo en vez de tumbar la importacion. Ver
 * `shared/importBatch.ts`.
 */
export function isRateLimited(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 6) return false;
  const node = err as Record<string, unknown>;
  if (node.status === 429) return true;
  return Object.values(node).some((value) => isRateLimited(value, depth + 1));
}

/** URL de un archivo guardado en PocketBase. */
export function fileUrl(
  record: { id: string; collectionId?: string; collectionName?: string },
  filename: string,
  thumb?: string,
): string {
  if (!filename) return "";
  const collection = record.collectionId ?? record.collectionName ?? "";
  // Codificado: un nombre de archivo con un `#` o un `?` dentro partiria la
  // direccion y el navegador pediria otra cosa.
  const base = `/pb/api/files/${encodeURIComponent(collection)}/${encodeURIComponent(
    record.id,
  )}/${encodeURIComponent(filename)}`;
  return thumb ? `${base}?thumb=${encodeURIComponent(thumb)}` : base;
}
