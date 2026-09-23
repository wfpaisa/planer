/**
 * Llevarse una aplicación desde el panel: duplicarla, guardarla en un archivo
 * `.planer` o traer una de otro servidor.
 *
 * Las tres hablan con la API propia y no con la base: crear una aplicación
 * entera --con sus colecciones, sus columnas y sus filas-- no es algo que el
 * navegador pueda hacer directo. Ver `server/appTransfer.ts`.
 */
import { PLANER_EXT, transferFileName, type TransferResult } from "@shared/transfer";

import { api, httpError, jsonBody, pb, post } from "./pb";
import { downloadBlob } from "./tableExport";

/** Lo que el selector de archivos ofrece abrir. */
export const PLANER_ACCEPT = `${PLANER_EXT},application/zip`;

/**
 * Descarga la aplicación en un archivo `.planer`.
 *
 * No se puede resolver con un enlace normal: la descarga va con la sesión del
 * constructor en la cabecera, y un `<a href>` no la lleva. Así que se pide
 * aquí y lo que llega se guarda como archivo.
 */
export async function exportApp(
  app: { id: string; slug: string },
  opts: { datos: boolean },
): Promise<void> {
  const headers = new Headers();
  if (pb.authStore.token) headers.set("authorization", pb.authStore.token);

  const res = await fetch(`/api/apps/${app.id}/exportar?datos=${opts.datos ? "1" : "0"}`, {
    headers,
  });
  if (!res.ok) throw httpError(res, jsonBody(await res.text()));

  downloadBlob(transferFileName(app.slug), await res.blob());
}

/** Crea una copia de la aplicación y devuelve lo que entro en ella. */
export const duplicateApp = (appId: string, opts: { datos: boolean; nombre?: string }) =>
  post<TransferResult>(`/api/apps/${appId}/duplicar`, {
    datos: opts.datos,
    nombre: opts.nombre ?? "",
  });

/** Levanta una aplicación nueva a partir de un archivo `.planer`. */
export function importApp(file: File, nombre = ""): Promise<TransferResult> {
  const form = new FormData();
  form.set("archivo", file);
  if (nombre.trim()) form.set("nombre", nombre.trim());
  // Por `api` y no por `post`: `post` serializa el cuerpo a JSON, y un
  // formulario con un archivo dentro no cabe en JSON.
  return api<TransferResult>("/api/apps/importar", { method: "POST", body: form });
}

/**
 * Lo que entro, en una frase.
 *
 * Los avisos no van aquí: son renglones aparte porque son lo que hay que
 * mirar, y un resumen con una excepcion dentro se lee como si no hubiera
 * pasado nada.
 */
export function transferSummary(result: TransferResult): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const partes = [
    plural(result.tablas, "tabla", "tablas"),
    plural(result.paginas, "página", "páginas"),
  ];
  if (result.filas) partes.push(plural(result.filas, "fila", "filas"));
  if (result.archivos) partes.push(plural(result.archivos, "archivo", "archivos"));
  return `"${result.name}" quedó lista con ${partes.join(", ")}.`;
}
