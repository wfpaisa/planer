/**
 * Documentos HTML de las paginas.
 *
 * El contenido no vive dentro de la pagina: se guarda aqui una sola vez,
 * identificado por la huella de su texto. La pagina y cada fotografia del
 * historial guardan esa huella, nunca el contenido.
 *
 * Como la huella depende solo del texto, dos documentos iguales comparten el
 * mismo guardado y treinta versiones sin cambios no ocupan treinta veces.
 */
import type { AppVersion, LegacyBlock, PageRecord } from "../shared/types.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { createRecord, deleteRecord, firstRecord, listRecords } from "./pb.ts";

/** Tope de un documento. Por encima no se guarda. */
export const MAX_DOC_BYTES = 2_000_000;

interface HtmlDoc {
  id: string;
  app: string;
  hash: string;
  content: string;
  bytes: number;
}

export const hashHtml = (content: string): string =>
  new Bun.CryptoHasher("sha256").update(content).digest("hex");

const sizeOf = (content: string) => Buffer.byteLength(content, "utf8");

/** Mensaje con los dos tamanos, para que se entienda de un vistazo. */
const tooBig = (bytes: number) =>
  new HttpError(
    400,
    `El archivo pesa ${Math.round(bytes / 1024)} KB y el maximo son ${Math.round(
      MAX_DOC_BYTES / 1024,
    )} KB.`,
  );

/**
 * Guarda un documento --el de una pagina o el de un bloque-- y devuelve su
 * huella. Si ese contenido ya estaba guardado para esta aplicacion, no lo
 * repite. Por encima del tope no se guarda nada.
 */
export async function saveDoc(
  appId: string,
  content: string,
): Promise<{ hash: string; bytes: number; created: boolean }> {
  const bytes = sizeOf(content);
  if (bytes > MAX_DOC_BYTES) throw tooBig(bytes);

  const hash = hashHtml(content);
  const existing = await firstRecord<HtmlDoc>(
    INTERNAL.htmlDocs,
    `app = "${quote(appId)}" && hash = "${quote(hash)}"`,
  ).catch(() => null);
  if (existing) return { hash, bytes, created: false };

  await createRecord(INTERNAL.htmlDocs, { app: appId, hash, content, bytes });
  return { hash, bytes, created: true };
}

/** El contenido de un documento, o `null` si esa huella ya no existe. */
export async function readDoc(appId: string, hash: string): Promise<string | null> {
  if (!hash) return null;
  const doc = await firstRecord<HtmlDoc>(
    INTERNAL.htmlDocs,
    `app = "${quote(appId)}" && hash = "${quote(hash)}"`,
  ).catch(() => null);
  return doc?.content ?? null;
}

/** El contenido de un documento; falla con un mensaje claro si no esta. */
export async function requireDoc(appId: string, hash: string): Promise<string> {
  const content = await readDoc(appId, hash);
  if (content === null) throw new HttpError(404, "Ese contenido ya no existe");
  return content;
}

/* ------------------------------------------------------------------ */
/* Recorte                                                              */
/* ------------------------------------------------------------------ */

/**
 * Las huellas que nombra una lista de paginas.
 *
 * Tambien las de los bloques de HTML de las paginas de antes: esas paginas ya
 * no se dibujan, pero su documento tiene que seguir ahi para poder
 * convertirlas y para que una version antigua se pueda mirar.
 */
function hashesInPages(pages: { doc?: unknown; blocks?: unknown }[]): string[] {
  const out: string[] = [];
  for (const page of pages) {
    if (typeof page.doc === "string" && page.doc) out.push(page.doc);
    const blocks = Array.isArray(page.blocks) ? (page.blocks as LegacyBlock[]) : [];
    for (const block of blocks) if (block.type === "html" && block.doc) out.push(block.doc);
  }
  return out;
}

/**
 * Borra los documentos que ya no nombra nadie.
 *
 * Un documento se conserva mientras lo nombre el borrador o cualquier version
 * que siga en el historial. Se llama justo despues de recortar versiones, que
 * es el unico momento en que un documento puede quedarse sin duenos.
 */
export async function pruneDocs(appId: string, draftPages: PageRecord[]): Promise<number> {
  const alive = new Set(hashesInPages(draftPages));

  const versions = await listRecords<AppVersion>(INTERNAL.versions, {
    filter: `app = "${quote(appId)}"`,
    perPage: 200,
    skipTotal: 1,
  });
  for (const version of versions.items) {
    for (const hash of hashesInPages(version.snapshot?.pages ?? [])) alive.add(hash);
  }

  const docs = await listRecords<HtmlDoc>(INTERNAL.htmlDocs, {
    filter: `app = "${quote(appId)}"`,
    perPage: 500,
    skipTotal: 1,
    fields: "id,hash",
  });

  let removed = 0;
  for (const doc of docs.items) {
    if (alive.has(doc.hash)) continue;
    await deleteRecord(INTERNAL.htmlDocs, doc.id).catch(() => {});
    removed++;
  }
  return removed;
}
