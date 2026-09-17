/**
 * Los archivos que se adjuntan a una peticion a la IA.
 *
 * El contenido no viaja dentro de la peticion ni se guarda en la conversacion:
 * se guarda aqui una sola vez, identificado por la huella de lo que trae
 * dentro, igual que los documentos HTML de las paginas (`htmlDocs.ts`). La
 * conversacion guarda la referencia, y con ella el adjunto sigue estando en los
 * turnos siguientes y despues de recargar.
 *
 * Un adjunto pertenece a la aplicacion donde se adjunto y no se alcanza desde
 * otra: cada lectura pide la aplicacion, no solo el identificador.
 *
 * Vive mientras alguna conversacion lo nombre. Cuando ninguna lo nombra,
 * `pruneAiFiles` lo recoge, a imagen de `pruneDocs`.
 */
import { detectSeparator, tokenizeCsv } from "../shared/importParse.ts";
import type { AiChatFile, AiFileKind } from "../shared/types.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { createRecordForm, deleteRecord, firstRecord, listRecords, readFileField } from "./pb.ts";

/**
 * Lo mas grande que se guarda de un adjunto.
 *
 * Es el tope del campo de archivo de la coleccion y el de la ruta que los
 * recibe: los dos numeros son el mismo a proposito, o la subida se aceptaria
 * para caerse despues al escribirla.
 */
export const MAX_AI_FILE_BYTES = 10_000_000;

/** Un adjunto tal y como esta guardado. */
export interface AiFileRecord {
  id: string;
  app: string;
  hash: string;
  name: string;
  kind: AiFileKind;
  mime: string;
  bytes: number;
  /** El nombre con el que PocketBase guardo el contenido. */
  content: string;
}

const FIELDS = "id,app,hash,name,kind,mime,bytes,content";

const hashOf = (content: Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(content).digest("hex");

/** Mensaje con los dos tamanos, para que se entienda de un vistazo. */
const tooBig = (bytes: number) =>
  new HttpError(
    400,
    `El archivo pesa ${Math.round(bytes / 1024)} KB y el máximo son ${Math.round(
      MAX_AI_FILE_BYTES / 1024,
    )} KB.`,
  );

/**
 * Guarda un adjunto y devuelve su referencia.
 *
 * Por huella: si esa aplicacion ya tenia guardado ese mismo contenido, se
 * devuelve el que estaba en vez de repetirlo. El nombre que se conserva es el
 * del primero --lo que cambia entre dos subidas del mismo archivo es como se
 * llamaba en el escritorio de quien lo subio, no lo que trae dentro--.
 */
export async function saveAiFile(
  appId: string,
  file: { name: string; kind: AiFileKind; mime: string; content: Uint8Array },
): Promise<AiFileRecord> {
  const bytes = file.content.byteLength;
  if (bytes > MAX_AI_FILE_BYTES) throw tooBig(bytes);

  const hash = hashOf(file.content);
  const existing = await firstRecord<AiFileRecord>(
    INTERNAL.aiFiles,
    `app = "${quote(appId)}" && hash = "${quote(hash)}"`,
    { fields: FIELDS },
  ).catch(() => null);
  if (existing) return existing;

  const form = new FormData();
  form.set("app", appId);
  form.set("hash", hash);
  form.set("name", file.name);
  form.set("kind", file.kind);
  form.set("mime", file.mime);
  form.set("bytes", String(bytes));
  form.set(
    "content",
    new Blob([new Uint8Array(file.content)], { type: file.mime || "application/octet-stream" }),
    // El nombre del archivo guardado no es el que se lee en ningun sitio --eso
    // es `name`-- pero PocketBase necesita uno, y con la huella dentro dos
    // adjuntos distintos nunca comparten direccion.
    `${hash.slice(0, 16)}-${safeName(file.name)}`,
  );

  return createRecordForm<AiFileRecord>(INTERNAL.aiFiles, form);
}

/** Un nombre que PocketBase acepta como nombre de archivo guardado. */
function safeName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || "adjunto";
}

/** El adjunto guardado, o nada si esa referencia no es de esta aplicacion. */
export async function findAiFile(appId: string, id: string): Promise<AiFileRecord | null> {
  if (!id) return null;
  return firstRecord<AiFileRecord>(
    INTERNAL.aiFiles,
    `app = "${quote(appId)}" && id = "${quote(id)}"`,
    { fields: FIELDS },
  ).catch(() => null);
}

/** El contenido guardado, en bytes. */
export function readAiFileBytes(file: AiFileRecord): Promise<Uint8Array<ArrayBuffer>> {
  return readFileField(INTERNAL.aiFiles, file.id, file.content);
}

/** El contenido guardado, leido como texto. */
export async function readAiFileText(file: AiFileRecord): Promise<string> {
  return new TextDecoder().decode(await readAiFileBytes(file));
}

/** El contenido guardado en base64, que es como viaja una imagen al modelo. */
export async function readAiFileBase64(file: AiFileRecord): Promise<string> {
  const bytes = await readAiFileBytes(file);
  // De golpe reventaria la pila con una imagen grande: `apply` recibe un
  // argumento por byte.
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/* ------------------------------------------------------------------ */
/* Como se llama cada adjunto dentro de una conversacion                */
/* ------------------------------------------------------------------ */

/**
 * Con que nombre se nombra cada adjunto de una conversacion.
 *
 * Lo que la IA escribe en una orden es `chequeo-preoperacional.csv`, no una
 * huella: el nombre del archivo es la referencia que quien construye tambien
 * lee. Dos adjuntos distintos con el mismo nombre dentro de una conversacion se
 * desempatan --el segundo se ofrece como `chequeo-preoperacional (2).csv`-- y
 * el mismo adjunto nombrado dos veces se queda con un solo nombre.
 *
 * El orden manda: el primero en aparecer es el que conserva su nombre tal cual.
 */
export function nameAiFiles(files: AiChatFile[]): (AiChatFile & { label: string })[] {
  const byRef = new Map<string, AiChatFile & { label: string }>();
  const used = new Set<string>();

  for (const file of files) {
    if (!file.ref || byRef.has(file.ref)) continue;
    let label = file.name;
    if (used.has(label.toLowerCase())) {
      const dot = file.name.lastIndexOf(".");
      const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
      const ext = dot > 0 ? file.name.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem} (${n})${ext}`.toLowerCase())) n++;
      label = `${stem} (${n})${ext}`;
    }
    used.add(label.toLowerCase());
    byRef.set(file.ref, { ...file, label });
  }

  return [...byRef.values()];
}

/**
 * El adjunto que la IA nombro, buscandolo entre los de la conversacion.
 *
 * Se busca por el nombre con el que se le ofrecio --el desempatado-- y, como
 * cortesia, por el nombre a secas: un modelo que escribe el nombre sin el "(2)"
 * esta nombrando el primero, que es lo que ese nombre significa.
 */
export function findByName(
  files: (AiChatFile & { label: string })[],
  wanted: string,
): (AiChatFile & { label: string }) | undefined {
  const name = wanted.trim().toLowerCase();
  if (!name) return undefined;
  return (
    files.find((f) => f.label.toLowerCase() === name) ??
    files.find((f) => f.name.toLowerCase() === name) ??
    files.find((f) => f.ref === wanted.trim())
  );
}

/* ------------------------------------------------------------------ */
/* Recorte                                                             */
/* ------------------------------------------------------------------ */

/** Las referencias que nombra una conversacion guardada. */
function refsInMessages(messages: unknown): string[] {
  if (!Array.isArray(messages)) return [];
  const out: string[] = [];
  for (const message of messages) {
    const files = (message as { files?: unknown })?.files;
    if (!Array.isArray(files)) continue;
    for (const file of files) {
      const ref = (file as { ref?: unknown })?.ref;
      if (typeof ref === "string" && ref) out.push(ref);
    }
  }
  return out;
}

/**
 * Borra los adjuntos que ya no nombra ninguna conversacion.
 *
 * Un adjunto se conserva mientras cualquier conversacion guardada de la
 * aplicacion lo nombre, asi que borrar una conversacion no se lleva un adjunto
 * que otra siga nombrando. Se llama despues de guardar una peticion, que es
 * cuando el tope de conversaciones puede haberse llevado la ultima que lo
 * nombraba.
 */
export async function pruneAiFiles(appId: string): Promise<number> {
  const chats = await listRecords<{ messages: unknown }>(INTERNAL.chats, {
    filter: `app = "${quote(appId)}"`,
    perPage: 200,
    skipTotal: 1,
    fields: "id,messages",
  });

  const alive = new Set<string>();
  for (const chat of chats.items) {
    for (const ref of refsInMessages(chat.messages)) alive.add(ref);
  }

  const files = await listRecords<{ id: string }>(INTERNAL.aiFiles, {
    filter: `app = "${quote(appId)}"`,
    perPage: 500,
    skipTotal: 1,
    fields: "id",
  });

  let removed = 0;
  for (const file of files.items) {
    if (alive.has(file.id)) continue;
    await deleteRecord(INTERNAL.aiFiles, file.id).catch(() => {});
    removed++;
  }
  return removed;
}

/* ------------------------------------------------------------------ */
/* La muestra que recibe el modelo                                      */
/* ------------------------------------------------------------------ */

/**
 * Cuanto texto de un archivo cabe en la muestra.
 *
 * Una hoja de estilos o un HTML de referencia de tamano normal entran enteros,
 * que es lo que los hace utiles de adjuntar. Lo que se pase se recorta y se
 * dice: con la orden de leerlo por tramos, recortar la muestra no esconde nada.
 */
export const MAX_SAMPLE_CHARS = 20_000;

/** Filas de un archivo de filas y columnas que se ensenan. */
export const SAMPLE_ROWS = 20;

/** Elementos de una lista JSON que se ensenan. */
export const SAMPLE_ITEMS = 3;

/** Con que lenguaje se escribe el bloque de codigo de cada clase de archivo. */
const FILE_LANGUAGE: Record<AiFileKind, string> = {
  html: "html",
  css: "css",
  js: "javascript",
  json: "json",
  csv: "csv",
  sheet: "csv",
  text: "",
  image: "",
};

/** Lo que se le ensena de un archivo, y que parte de el es. */
export interface AiFileSample {
  /** El bloque que se le pone delante. Vacio para una imagen. */
  body: string;
  /** El lenguaje del bloque de codigo. */
  language: string;
  /** Lo que se ensena no es todo lo que trae. */
  truncated: boolean;
  /** Que trae, contado en una linea: filas, columnas, elementos. */
  detail: string;
}

/** Recorta un texto al tope y dice si lo recorto. */
function cut(text: string): { body: string; truncated: boolean } {
  if (text.length <= MAX_SAMPLE_CHARS) return { body: text, truncated: false };
  return { body: text.slice(0, MAX_SAMPLE_CHARS), truncated: true };
}

/** Una linea de CSV, con las comillas que haga falta. */
const csvLine = (cells: string[]): string =>
  cells.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",");

/**
 * Lo que se le ensena de un archivo, segun lo que traiga dentro.
 *
 * De un archivo de filas y columnas, sus columnas y unas pocas filas --nunca
 * las cinco mil--; de un JSON que es una lista, sus claves y sus primeros
 * elementos; de lo demas, el archivo entero mientras quepa. Una imagen no se
 * cuenta con palabras: viaja dentro de la peticion.
 *
 * El contenido guardado no se toca: lo que se recorta es lo que se ensena.
 */
export async function sampleAiFile(file: AiFileRecord): Promise<AiFileSample> {
  const language = FILE_LANGUAGE[file.kind] ?? "";
  if (file.kind === "image") {
    return { body: "", language, truncated: false, detail: "" };
  }

  const text = await readAiFileText(file);

  if (file.kind === "csv" || file.kind === "sheet") {
    const rows = tokenizeCsv(text, detectSeparator(text));
    const [header, ...data] = rows;
    if (header?.length) {
      const shown = data.slice(0, SAMPLE_ROWS);
      return {
        body: [csvLine(header), ...shown.map(csvLine)].join("\n"),
        language: "csv",
        truncated: data.length > shown.length,
        detail: `${data.length} ${data.length === 1 ? "row" : "rows"} and ${header.length} ${
          header.length === 1 ? "column" : "columns"
        }; ${shown.length} ${shown.length === 1 ? "row is" : "rows are"} shown`,
      };
    }
    // Sin encabezado no es una tabla: se cuenta como texto.
    const plain = cut(text);
    return { ...plain, language: "", detail: "" };
  }

  if (file.kind === "json") {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = undefined;
    }
    if (Array.isArray(value)) {
      const keys: string[] = [];
      for (const item of value.slice(0, 50)) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        for (const key of Object.keys(item)) if (!keys.includes(key)) keys.push(key);
      }
      const shown = value.slice(0, SAMPLE_ITEMS);
      const body = cut(JSON.stringify(shown, null, 2));
      return {
        body: body.body,
        language: "json",
        truncated: body.truncated || value.length > shown.length,
        detail: `a list of ${value.length} ${value.length === 1 ? "item" : "items"}${
          keys.length ? `, with the keys ${keys.join(", ")}` : ""
        }; ${shown.length} shown`,
      };
    }
  }

  const plain = cut(text);
  return { ...plain, language, detail: "" };
}

/* ------------------------------------------------------------------ */
/* Leer un adjunto por tramos                                           */
/* ------------------------------------------------------------------ */

/** Lineas que devuelve un tramo cuando no se pide otra cosa. */
export const READ_LINES = 200;

/** Y lo mas que se puede pedir de una vez, en lineas y en caracteres. */
export const MAX_READ_LINES = 600;
export const MAX_READ_CHARS = 40_000;

/** Un tramo del archivo, leido por lineas. */
export async function readAiFileChunk(
  file: AiFileRecord,
  opts: { from?: number; lines?: number },
): Promise<{ from: number; lines: number; total: number; text: string; more: boolean }> {
  const all = (await readAiFileText(file)).split("\n");
  const from = Math.min(Math.max(Math.floor(opts.from ?? 1), 1), Math.max(all.length, 1));
  const want = Math.min(Math.max(Math.floor(opts.lines ?? READ_LINES), 1), MAX_READ_LINES);

  const slice = all.slice(from - 1, from - 1 + want);
  let text = slice.join("\n");
  let lines = slice.length;
  if (text.length > MAX_READ_CHARS) {
    // Un archivo de una sola linea larguisima --un HTML minificado-- no se
    // corta por lineas: se corta por caracteres y se dice que hay mas.
    text = text.slice(0, MAX_READ_CHARS);
    lines = text.split("\n").length;
  }

  return { from, lines, total: all.length, text, more: from - 1 + lines < all.length };
}
