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

/** Mensaje legible para cualquier error que llegue del servidor. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      response?: { message?: string; data?: Record<string, { message?: string }> };
    };
    const fields = e.response?.data;
    if (fields) {
      const first = Object.entries(fields)[0];
      if (first?.[1]?.message) return `${first[0]}: ${first[1].message}`;
    }
    return e.response?.message ?? e.message ?? "Algo salio mal";
  }
  return "Algo salio mal";
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
