/**
 * Archivos sueltos convertidos en contexto para la IA.
 *
 * Es la unica puerta: un archivo que se suelta encima del editor y no se va a
 * volver ni pagina ni tabla acaba aqui, se sube al almacen de adjuntos de la
 * aplicacion y viaja con la siguiente peticion como una referencia.
 *
 * La subida arranca al soltarlo, no al enviar: para cuando se termina de
 * escribir que hacer con el, el archivo ya esta guardado. Mientras va en
 * camino, su badge lo dice y no impide seguir escribiendo; quitarlo antes de
 * que termine cancela la subida.
 *
 * Lo que la IA sabe hacer con el lo decide quien escribe: aqui solo se le pone
 * delante. "Toma como referencia este HTML para crear la pantalla de pedidos"
 * es una peticion; el archivo es lo que la hace posible.
 *
 * Una hoja de calculo se sube ya convertida a filas y columnas: leer un `.xlsx`
 * depende de una libreria que solo vive en el navegador, y lo que un modelo lee
 * bien es el CSV. Lo demas se sube tal cual, sin recortar: lo que se recorta es
 * lo que se le ensena al modelo, y eso lo decide el servidor.
 */
import type { AiFile, AiFileKind } from "@shared/types";

import { api } from "./pb";

/** Y una imagen, en bytes. Por encima de esto casi ningun modelo la acepta. */
export const MAX_AI_IMAGE_BYTES = 5_000_000;

/** Cuantos archivos caben en una misma peticion. */
export const MAX_AI_FILES = 8;

/**
 * A partir de cuanto un pegado deja de ser lo que se escribe y pasa a ser
 * material.
 *
 * Pegar una pagina entera en la barra no es una peticion: es poner algo
 * delante para que se mire. Se trata como tal --entra como adjunto, con su
 * badge-- y el campo se queda libre para decir que hay que hacer con ello.
 *
 * Por lineas y por tamano, porque las dos cosas delatan lo mismo por caminos
 * distintos: una hoja de estilos son muchas lineas cortas, y un HTML minificado
 * es una sola linea larguisima.
 */
export const PASTE_AS_FILE_CHARS = 2_000;
export const PASTE_AS_FILE_LINES = 20;

/** De que clase parece ser un texto pegado, que no trae nombre ni extension. */
function pastedShape(text: string): [string, string] {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith("<")) return [".html", "text/html"];
  if (head.startsWith("{") || head.startsWith("[")) {
    try {
      JSON.parse(text);
      return [".json", "application/json"];
    } catch {
      // No era JSON: se queda en texto.
    }
  }
  return [".txt", "text/plain"];
}

let pastes = 0;

/**
 * Con que extension entra lo que se pega sin nombre. Una captura llega como
 * un archivo sin nombre util, y sin extension no se sabria leer.
 */
const CLIPBOARD_EXTENSION: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "text/html": ".html",
  "text/csv": ".csv",
  "text/plain": ".txt",
  "application/json": ".json",
};

/**
 * Los archivos que trae un pegado: la captura del portapapeles, o lo que se
 * copio en el escritorio.
 *
 * El que ya trae nombre entra con el suyo --es lo que se lee en el badge-- y
 * la captura, que no lo trae, entra con uno puesto aqui. Lo que no se sepa
 * leer se queda fuera, y entonces el pegado sigue su camino normal.
 */
export function pastedFiles(data: DataTransfer | null): File[] {
  const out: File[] = [];
  for (const file of Array.from(data?.files ?? [])) {
    if (byExtension(file.name)) {
      if (canAttachToAi(file)) out.push(file);
      continue;
    }
    const ext = CLIPBOARD_EXTENSION[file.type];
    if (!ext) continue;
    out.push(new File([file], `pegado-${++pastes}${ext}`, { type: file.type }));
  }
  return out;
}

/**
 * El archivo con el que entra un pegado que es material, o nada si lo pegado
 * es corto y va donde se escribio.
 */
export function pastedAsFile(text: string): File | null {
  const long = text.length >= PASTE_AS_FILE_CHARS;
  const tall = text.split("\n").length >= PASTE_AS_FILE_LINES;
  if (!long && !tall) return null;
  const [ext, mime] = pastedShape(text);
  return new File([text], `pegado-${++pastes}${ext}`, { type: mime });
}

/** Las imagenes que los modelos con vista saben leer. */
const IMAGE_TYPES = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

/** Por extension, de que clase es. Lo que no este aqui no se puede adjuntar. */
const BY_EXTENSION: [string[], AiFileKind][] = [
  [[".html", ".htm"], "html"],
  [[".css"], "css"],
  [[".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx"], "js"],
  [[".json"], "json"],
  [[".csv", ".tsv"], "csv"],
  [[".xlsx", ".xlsm"], "sheet"],
  [[".txt", ".md", ".markdown", ".sql", ".xml", ".yml", ".yaml", ".svg"], "text"],
  [IMAGE_TYPES, "image"],
];

/** Las extensiones que se saben leer, para el selector nativo de archivos. */
export const AI_FILE_ACCEPT = BY_EXTENSION.flatMap(([extensions]) => extensions).join(",");

/**
 * De que clase es, por el nombre. Nada si la extension no dice nada.
 *
 * Acepta que no haya nombre: lo que llega del portapapeles no tiene por que
 * traerlo, y esa es justo la senal de que hay que ponerle uno.
 */
function byExtension(name: string | undefined): AiFileKind | null {
  const lower = (name ?? "").toLowerCase();
  for (const [extensions, kind] of BY_EXTENSION) {
    if (extensions.some((ext) => lower.endsWith(ext))) return kind;
  }
  return null;
}

/** De que clase es este archivo, o nada si no es de ninguna que se sepa leer. */
export function aiFileKind(file: File): AiFileKind | null {
  const kind = byExtension(file.name);
  if (kind) return kind;
  // Sin extension reconocible, el navegador puede saberlo igual.
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("text/")) return "text";
  return null;
}

/** Si se puede adjuntar a una peticion. */
export const canAttachToAi = (file: File) => aiFileKind(file) !== null;

/** El icono con el que se dibuja su badge. Son nombres de Hugeicons. */
export const AI_FILE_ICON: Record<AiFileKind, string> = {
  html: "source-code",
  css: "paint-brush-02",
  js: "source-code",
  json: "source-code",
  csv: "table-01",
  sheet: "table-01",
  text: "file-01",
  image: "image-01",
};

let counter = 0;
const nextId = () => `f${++counter}`;

/**
 * Un adjunto mientras se escribe la peticion.
 *
 * Es un `AiFile` con una marca mas: si todavia va en camino. Sin referencia no
 * se puede mandar --el servidor no sabria que archivo es-- pero si se puede
 * dibujar y se puede quitar, que es lo que hace que adjuntar algo grande no
 * bloquee el campo de texto.
 */
export interface DraftFile extends AiFile {
  /** La subida sigue en marcha: todavia no hay referencia. */
  uploading: boolean;
}

/*
 * Las subidas en marcha, por badge. Viven fuera del almacen de la conversacion
 * porque un `AbortController` no es estado que se dibuje: es lo que hace falta
 * para poder cortar una subida cuando su badge se quita.
 */
const uploads = new Map<string, AbortController>();

/** Cortar la subida de un badge, si todavia iba en camino. */
export function cancelUpload(id: string): void {
  uploads.get(id)?.abort();
  uploads.delete(id);
}

/**
 * El badge con el que un archivo entra en la conversacion, antes de subirlo.
 *
 * Falla con un mensaje en espanol cuando el archivo no se puede adjuntar: no
 * es de una clase que se sepa leer, o la imagen es mas grande de lo que ningun
 * modelo acepta. Se comprueba antes de subir nada: rechazarlo despues de la
 * espera seria hacer esperar para nada.
 */
export function draftAiFile(file: File): DraftFile {
  const kind = aiFileKind(file);
  if (!kind) {
    throw new Error(`No se sabe leer "${file.name}" como contexto de la inteligencia artificial.`);
  }
  if (kind === "image" && file.size > MAX_AI_IMAGE_BYTES) {
    throw new Error(`La imagen "${file.name}" pesa demasiado: el máximo son 5 MB.`);
  }

  return {
    id: nextId(),
    ref: "",
    name: file.name,
    kind,
    mime: file.type,
    size: file.size,
    uploading: true,
  };
}

/**
 * Sube el archivo y devuelve el badge ya con su referencia.
 *
 * Lanza `AbortError` si se quito el badge mientras subia; quien llama lo
 * distingue de un fallo de verdad para no contar como error lo que se pidio.
 */
export async function uploadAiFile(
  appId: string,
  draft: DraftFile,
  file: File,
): Promise<DraftFile> {
  const stop = new AbortController();
  uploads.set(draft.id, stop);

  try {
    // La hoja de calculo se sube en CSV: es lo que un modelo lee bien, lo que
    // el servidor sabe trocear en filas, y de paso deja de importar en que
    // formato venia. Su nombre no cambia: es con el que se la nombra.
    let body = file;
    if (draft.kind === "sheet") {
      const { readSheet } = await import("./sheet");
      const { csv, sheet, sheets } = await readSheet(file);
      const note =
        sheets.length > 1
          ? `# Hoja "${sheet}" de ${sheets.length}: ${sheets.join(", ")}\n`
          : `# Hoja "${sheet}"\n`;
      body = new File([note + csv], file.name, { type: "text/csv" });
    }

    const form = new FormData();
    form.set("archivo", body);
    form.set("nombre", draft.name);
    form.set("clase", draft.kind);
    form.set("tipo", draft.mime || body.type);

    const saved = await api<Omit<AiFile, "id">>(`/api/apps/${appId}/ia/archivos`, {
      method: "POST",
      body: form,
      signal: stop.signal,
    });

    return { ...draft, ...saved, id: draft.id, uploading: false };
  } finally {
    uploads.delete(draft.id);
  }
}

/** Quien pidio cortar la subida, y no un fallo que contar. */
export const wasCancelled = (err: unknown): boolean =>
  err instanceof DOMException && err.name === "AbortError";

/* ------------------------------------------------------------------ */
/* El camino hasta la conversacion                                      */
/* ------------------------------------------------------------------ */

/*
 * Quien suelta el archivo --el constructor entero, que es donde se escuchan
 * los arrastres-- y quien pinta los badges --el panel de la IA, que vive en
 * otra rama del arbol-- no se conocen. Se avisan por aqui, igual que el cursor
 * de seleccion se avisa por `pagePicker`.
 *
 * Con una diferencia: el panel puede no estar montado todavia. Soltar un
 * archivo con el dock escondido lo trae, y traerlo monta el panel un instante
 * despues del aviso. Por eso lo que se manda espera en una cola en vez de
 * gritarse al vacio: el panel la vacia al montarse.
 */

let queue: File[] = [];
const takers = new Set<(files: File[]) => void>();

/** Mandar archivos a la conversacion. Los lee el panel, que sabe de cual es. */
export function sendFilesToAi(files: File[]): void {
  if (!files.length) return;
  if (takers.size === 0) {
    queue = [...queue, ...files];
    return;
  }
  for (const fn of takers) fn(files);
}

/**
 * Quedarse con lo que se mande. Al suscribirse se lleva lo que estuviera
 * esperando, que es lo que hace que abrir el dock recoja lo ya soltado.
 */
export function onFilesForAi(fn: (files: File[]) => void): () => void {
  takers.add(fn);
  if (queue.length) {
    const pending = queue;
    queue = [];
    fn(pending);
  }
  return () => {
    takers.delete(fn);
  };
}
