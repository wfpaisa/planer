/**
 * Llevarse una aplicación entera y volver a levantarla.
 *
 * De aquí salen las tres cosas que el panel ofrece --exportar a un archivo
 * `.planer`, importar uno y duplicar una aplicación-- y las tres son el mismo
 * camino: se arma un paquete con todo lo que la aplicación es, y después se
 * vuelca en una aplicación nueva. Duplicar no pasa por el disco --el paquete
 * se queda en memoria-- pero recorre exactamente el mismo código, así que una
 * copia y un archivo importado no pueden salir distintos.
 *
 * El formato esta descrito en `shared/transfer.ts`, incluido por que las
 * personas invitadas no viajan.
 *
 * ### Lo que hay que deshacer para que el paquete viaje
 *
 * Una aplicación esta llena de ids de PocketBase que solo significan algo en
 * esta instalacion: la tabla a la que apunta una relación, las columnas que
 * declara una página, el documento de cada página. Ninguno de los tres
 * sobrevive a un cambio de servidor, así que al exportar se sustituyen por
 * nombres --el nombre tecnico de la tabla, el de la columna, la ruta del
 * documento dentro del comprimido-- y al importar se vuelven a resolver contra
 * lo que se acaba de crear.
 *
 * El id que si se conserva es el de cada fila. No hace falta traducirlo: una
 * colección recien creada esta vacía, así que no hay con quien chocar, y
 * conservarlo es lo que deja que las relaciones entre filas sigan en pie sin
 * tener que emparejar nada por llaves.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import {
  isPeopleTable,
  peopleInitialFields,
  personKeyValue,
  storedFields,
} from "../shared/people.ts";
import { firstUnique } from "../shared/relations.ts";
import {
  DOCS_DIR,
  FILES_DIR,
  MANIFEST_NAME,
  PLANER_FORMAT,
  type PlanerManifest,
  ROWS_DIR,
  type TransferField,
  type TransferPage,
  type TransferResult,
  type TransferSource,
  type TransferTable,
} from "../shared/transfer.ts";
import {
  type AppPerson,
  type AppRecord,
  displayFieldOf,
  type FieldDef,
  isRelationField,
  orphanFieldName,
  type PageRecord,
  type TableMeta,
  type TableRecord,
} from "../shared/types.ts";
import { peopleOf } from "./access.ts";
import { sanitizeRoles, sanitizeTheme, uniqueSlug, withAdminRole } from "./appSetup.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { readDoc, saveDoc } from "./html/htmlDocs.ts";
import {
  createRecord,
  deleteRecord,
  listRecords,
  readFileField,
  updateRecord,
  updateRecordForm,
} from "./pb.ts";
import { ensurePeopleTable, guardSystemFields } from "./peopleTable.ts";
import {
  createDataCollection,
  dataCollectionName,
  dropDataCollections,
  updateDataCollection,
} from "./schema.ts";

/* ------------------------------------------------------------------ */
/* El paquete                                                           */
/* ------------------------------------------------------------------ */

/** Un archivo adjunto de una celda, con sus bytes. */
interface BundleFile {
  /** Nombre tecnico de la tabla. */
  tabla: string;
  /** Id de la fila en el origen. Se conserva al importar. */
  fila: string;
  /** Nombre tecnico de la columna de archivo. */
  campo: string;
  /** Nombre del archivo tal como lo guardo PocketBase. */
  nombre: string;
  bytes: Uint8Array;
}

/**
 * Una aplicación entera, en memoria.
 *
 * Es lo que va y viene del comprimido, y es también lo que duplicar pasa de
 * una aplicación a la otra sin escribir nada en disco.
 */
export interface TransferBundle {
  manifest: PlanerManifest;
  /** El HTML de cada página, por su ruta dentro del comprimido. */
  docs: Map<string, string>;
  /** Las filas de cada tabla, por nombre tecnico. */
  rows: Map<string, Record<string, unknown>[]>;
  files: BundleFile[];
}

/* ------------------------------------------------------------------ */
/* Leer la aplicación                                                   */
/* ------------------------------------------------------------------ */

/** Las páginas y las tablas de una aplicación, en su orden. */
async function designOf(appId: string): Promise<{ pages: PageRecord[]; tables: TableRecord[] }> {
  const [pages, tables] = await Promise.all([
    listRecords<PageRecord>(INTERNAL.pages, {
      filter: `app = "${quote(appId)}"`,
      sort: "order,created",
      perPage: 200,
      skipTotal: 1,
    }),
    listRecords<TableRecord>(INTERNAL.tables, {
      filter: `app = "${quote(appId)}"`,
      sort: "order,created",
      perPage: 200,
      skipTotal: 1,
    }),
  ]);
  return { pages: pages.items, tables: tables.items };
}

/** Todas las filas de una colección, por páginas. */
async function allRows(collection: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let page = 1; ; page++) {
    const res = await listRecords<Record<string, unknown>>(collection, { perPage: 500, page });
    out.push(...res.items);
    if (page >= res.totalPages || res.items.length === 0) break;
  }
  return out;
}

/** Los valores de una celda de archivo, siempre como lista. */
function fileNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "")).filter(Boolean);
  const one = String(value ?? "");
  return one ? [one] : [];
}

/**
 * Lo que se enseñaria de una persona en la celda que la nombra.
 *
 * Una columna que apunta a la tabla de personas guarda el id de su fila, y esa
 * fila no viaja: las cuentas se quedan donde estan. Para que la celda no salga
 * vacía se guarda lo que enseñaba --el correo, la cédula, lo que declare la
 * columna-- y al importar entra como valor sin dueno, que es el hueco que el
 * panel ya sabe rellenar. Ver `relationCellValues` en `shared/relations.ts`.
 */
function personLabel(people: AppPerson[], rowId: string, key: string): string {
  const person = people.find((p) => p.fila === rowId);
  if (!person) return "";
  return personKeyValue(person, key) || person.email || person.name || "";
}

/**
 * Arma el paquete de una aplicación.
 *
 * `datos` decide si viajan las filas y sus adjuntos. Sin ellas el archivo es
 * una plantilla: la misma base de datos y las mismas pantallas, vacías.
 */
export async function exportApp(app: AppRecord, opts: { datos: boolean }): Promise<TransferBundle> {
  const { pages, tables } = await designOf(app.id);
  const nameById = new Map(tables.map((t) => [t.id, t.name]));
  const byId = new Map(tables.map((t) => [t.id, t]));
  const peopleTable = tables.find((t) => isPeopleTable(t)) ?? null;
  // Solo se piden si alguna columna apunta a personas: en una aplicación sin
  // esa clase de columna, la lista de invitados no pinta nada aquí.
  const needsPeople = tables.some((t) =>
    (t.fields ?? []).some((f) => isRelationField(f) && f.relationTableId === peopleTable?.id),
  );
  const people = needsPeople ? await peopleOf(app.id) : [];

  const docs = new Map<string, string>();
  const rows = new Map<string, Record<string, unknown>[]>();
  const files: BundleFile[] = [];

  /* --- Tablas ------------------------------------------------------- */
  const tablas: TransferTable[] = [];
  for (const table of tables) {
    const fields: TransferField[] = [];
    for (const field of table.fields ?? []) {
      const { id: _id, relationTableId, ...rest } = field;
      if (!isRelationField(field)) {
        fields.push(rest);
        continue;
      }
      const target = nameById.get(relationTableId ?? "");
      // Una relación cuya tabla ya no existe no se puede recrear: la columna
      // se queda fuera, y lo que decia sale igual como valor sin dueno.
      if (!target) continue;
      fields.push({ ...rest, relationTable: target });
    }

    const exportRows = opts.datos && !isPeopleTable(table);
    const items = exportRows ? await allRows(table.dataCollection) : [];
    if (exportRows) {
      rows.set(table.name, await portableRows(table, items, { byId, peopleTable, people, files }));
    }

    tablas.push({
      name: table.name,
      label: table.label,
      order: table.order ?? 0,
      fields,
      meta: table.meta ?? {},
      acceptedOrphans: table.acceptedOrphans,
      system: table.system === true,
      filas: items.length,
    });
  }

  /* --- Páginas ------------------------------------------------------ */
  const paginas: TransferPage[] = [];
  for (const page of pages) {
    let doc = "";
    if (page.doc) {
      const content = await readDoc(app.id, page.doc);
      if (content !== null) {
        doc = `${DOCS_DIR}/${page.slug}.html`;
        docs.set(doc, content);
      }
    }

    const sources: TransferSource[] = [];
    for (const source of page.sources ?? []) {
      const table = byId.get(source.tableId);
      if (!table) continue;
      // Las columnas se nombran por su nombre tecnico, no por su id: es el
      // mismo criterio con el que las nombra el HTML de la página.
      const fields: Record<string, string> = {};
      for (const [logical, fieldId] of Object.entries(source.fields ?? {})) {
        const field = (table.fields ?? []).find((f) => f.id === fieldId);
        if (field) fields[logical] = field.name;
      }
      sources.push({ name: source.name, tabla: table.name, fields });
    }

    paginas.push({
      name: page.name,
      slug: page.slug,
      icon: page.icon ?? "",
      order: page.order ?? 0,
      isHome: page.isHome === true,
      separator: page.separator === true,
      roles: page.roles ?? [],
      memory: page.memory ?? "",
      doc,
      sources,
    });
  }

  const manifest: PlanerManifest = {
    formato: PLANER_FORMAT,
    creado: new Date().toISOString(),
    aplicacion: {
      name: app.name,
      icon: app.icon ?? "",
      visibility: app.visibility === "public" ? "public" : "private",
      theme: app.theme ?? null,
      roles: Array.isArray(app.roles) ? app.roles : [],
    },
    tablas,
    paginas,
    datos: opts.datos,
    archivos: files.length,
  };

  return { manifest, docs, rows, files };
}

/**
 * Las filas de una tabla, dejadas como viajan.
 *
 * Se van tres cosas de cada fila: lo que PocketBase añade al leerla
 * (`collectionId`, `expand`), las fechas automaticas --las pone la base al
 * crear, no se escriben-- y los adjuntos, que se apartan como bytes. El id se
 * queda, que es lo que sostiene las relaciones.
 */
async function portableRows(
  table: TableRecord,
  items: Record<string, unknown>[],
  ctx: {
    byId: Map<string, TableRecord>;
    peopleTable: TableRecord | null;
    people: AppPerson[];
    files: BundleFile[];
  },
): Promise<Record<string, unknown>[]> {
  const stored = storedFields(table.fields ?? []);
  const out: Record<string, unknown>[] = [];

  for (const item of items) {
    const id = String(item.id ?? "");
    const row: Record<string, unknown> = { id };

    for (const field of stored) {
      const value = item[field.name];

      if (field.type === "file") {
        const names = fileNames(value);
        for (const nombre of names) {
          const bytes = await readFileField(table.dataCollection, id, nombre).catch(() => null);
          if (bytes)
            ctx.files.push({ tabla: table.name, fila: id, campo: field.name, nombre, bytes });
        }
        continue;
      }

      if (isRelationField(field)) {
        const orphan = orphanFieldName(field.name);
        // El valor sin dueno viaja tal cual: es texto y no nombra a nadie.
        if (typeof item[orphan] === "string" && item[orphan]) row[orphan] = item[orphan];

        const target = ctx.byId.get(field.relationTableId ?? "");
        if (!target) continue;

        /*
         * Las personas no viajan. Lo que la celda enseñaba, si: entra en la
         * otra mitad de la celda, la que guarda un valor todavía sin dueno.
         *
         * Una columna de personas de varios valores se va entera, y no hay
         * donde ponerla: el corralito es de la relación de un solo valor --son
         * las dos mitades de una misma celda, ver `toPbFields` en
         * `server/schema.ts`-- y una lista de nombres no cabe en el.
         */
        if (ctx.peopleTable && target.id === ctx.peopleTable.id) {
          if (field.multiple === true) continue;
          const key = displayFieldOf(field) || firstUnique(ctx.peopleTable) || "cuenta";
          const label = personLabel(ctx.people, String(value ?? ""), key);
          if (label) row[orphan] = label;
          continue;
        }

        if (value !== null && value !== undefined && value !== "") row[field.name] = value;
        continue;
      }

      if (value === null || value === undefined) continue;
      row[field.name] = value;
    }

    out.push(row);
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* El comprimido                                                        */
/* ------------------------------------------------------------------ */

/*
 * Comprimir y descomprimir van de un tirón, y no con las versiones de fflate
 * que avisan al terminar.
 *
 * Las asincronas reparten el trabajo en workers y le pasan los bytes por
 * mensaje; bajo Bun ese paso deja el array en nada y revienta dentro de la
 * libreria con un "undefined is not an object". Solo se nota con archivos
 * grandes: fflate comprime los pequenos en el sitio y ahi nunca llega a abrir
 * un worker, que es por lo que una aplicación de prueba pasaba y una de verdad
 * no. Ver la exportacion de una aplicación con unos cientos de filas.
 *
 * De un tirón, una aplicación de unos megas se comprime en decimas de segundo.
 */
const packZip = (entries: Record<string, Uint8Array>): Uint8Array => zipSync(entries, { level: 6 });

const unpackZip = (bytes: Uint8Array): Record<string, Uint8Array> => unzipSync(bytes);

/**
 * El nombre de un adjunto dentro del comprimido.
 *
 * El nombre del archivo va codificado porque es lo único de la ruta que no
 * controla la plataforma: una barra o un `..` dentro de el apuntarian a otro
 * sitio del comprimido. Al leerlo se descodifica y se comprueba otra vez.
 */
const filePath = (file: Pick<BundleFile, "tabla" | "fila" | "campo" | "nombre">) =>
  `${FILES_DIR}/${file.tabla}/${file.fila}/${file.campo}/${encodeURIComponent(file.nombre)}`;

/** El nombre de un adjunto, descodificado. Vacío si no se puede leer. */
function decoded(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "";
  }
}

/** Empaqueta el bundle en los bytes de un archivo `.planer`. */
export function bundleToFile(bundle: TransferBundle): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    [MANIFEST_NAME]: strToU8(JSON.stringify(bundle.manifest, null, 2)),
  };
  for (const [path, html] of bundle.docs) entries[path] = strToU8(html);
  for (const [tabla, rows] of bundle.rows) {
    entries[`${ROWS_DIR}/${tabla}.json`] = strToU8(JSON.stringify(rows));
  }
  for (const file of bundle.files) entries[filePath(file)] = file.bytes;
  return packZip(entries);
}

/** Un archivo `.planer` leido: lo mismo que salio, sin nada de fuera. */
export function fileToBundle(bytes: Uint8Array): TransferBundle {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unpackZip(bytes);
  } catch {
    throw new HttpError(400, "Ese archivo no se puede abrir: no es un archivo de Planer.");
  }

  const raw = entries[MANIFEST_NAME];
  if (!raw) throw new HttpError(400, "El archivo no trae la estructura de ninguna aplicación.");

  let manifest: PlanerManifest;
  try {
    manifest = JSON.parse(strFromU8(raw)) as PlanerManifest;
  } catch {
    throw new HttpError(400, "La estructura del archivo está dañada y no se puede leer.");
  }
  if (!manifest?.aplicacion || !Array.isArray(manifest.tablas)) {
    throw new HttpError(400, "El archivo no trae la estructura de ninguna aplicación.");
  }
  if (Number(manifest.formato) > PLANER_FORMAT) {
    throw new HttpError(
      400,
      "Ese archivo lo escribió una versión más nueva de Planer. Actualiza para poder abrirlo.",
    );
  }

  const docs = new Map<string, string>();
  for (const page of manifest.paginas ?? []) {
    const entry = page.doc ? entries[page.doc] : undefined;
    if (entry) docs.set(page.doc as string, strFromU8(entry));
  }

  const rows = new Map<string, Record<string, unknown>[]>();
  for (const table of manifest.tablas) {
    const entry = entries[`${ROWS_DIR}/${table.name}.json`];
    if (!entry) continue;
    try {
      const parsed = JSON.parse(strFromU8(entry));
      if (Array.isArray(parsed)) rows.set(table.name, parsed as Record<string, unknown>[]);
    } catch {
      // Una tabla cuyo archivo de datos no se entiende entra vacía: perder sus
      // filas es peor que perder la aplicación entera.
    }
  }

  const files: BundleFile[] = [];
  for (const [path, bytesOf] of Object.entries(entries)) {
    if (!path.startsWith(`${FILES_DIR}/`)) continue;
    const parts = path.split("/");
    if (parts.length !== 5) continue;
    const [, tabla, fila, campo, encoded] = parts;
    // Un nombre que no se puede descodificar no es un nombre que nosotros
    // escribieramos, así que ese archivo no entra.
    const nombre = decoded(encoded);
    // Un nombre que se sale de su carpeta no es un nombre de archivo.
    if (!nombre || nombre.includes("/") || nombre.includes("\\") || nombre.includes("..")) continue;
    files.push({ tabla, fila, campo, nombre, bytes: bytesOf });
  }

  return { manifest, docs, rows, files };
}

/* ------------------------------------------------------------------ */
/* Levantar la aplicación                                               */
/* ------------------------------------------------------------------ */

/** Lo que va contando la importacion mientras avanza. */
interface Tally {
  filas: number;
  archivos: number;
  avisos: string[];
}

/**
 * Crea una aplicación a partir de un paquete.
 *
 * Lo que se crea es siempre un borrador: `published` en falso y sin versión en
 * vivo, aunque el original estuviera publicado. Publicar es una decision de
 * quien recibe la aplicación, no algo que se herede de un archivo.
 *
 * Si algo falla a mitad, la aplicación recien creada se retira con sus
 * colecciones: media aplicación importada no se distingue a simple vista de
 * una entera, y es peor que ninguna.
 */
export async function importBundle(
  bundle: TransferBundle,
  opts: { ownerId: string; name?: string },
): Promise<{ app: AppRecord; result: TransferResult }> {
  const manifest = bundle.manifest;
  const name = (opts.name ?? "").trim() || manifest.aplicacion.name.trim() || "Aplicación";

  const app = await createRecord<AppRecord>(INTERNAL.apps, {
    name,
    slug: await uniqueSlug(name),
    icon: manifest.aplicacion.icon || "DashboardCircleIcon",
    theme: sanitizeTheme(manifest.aplicacion.theme),
    visibility: manifest.aplicacion.visibility === "public" ? "public" : "private",
    published: false,
    owner: opts.ownerId,
    roles: withAdminRole(sanitizeRoles(manifest.aplicacion.roles)),
  });

  const tally: Tally = { filas: 0, archivos: 0, avisos: [] };

  try {
    // Las relaciones obligatorias que haya que apretar al final, cuando las
    // filas ya esten dentro. Ver `tightenRelations`.
    const strict = new Map<string, FieldDef[]>();

    const tables = await createTables(app, manifest.tablas, tally, strict);
    await createPages(bundle, app, tables, tally);
    if (manifest.datos) await fillTables(bundle, tables, tally);
    await tightenRelations(tables, strict);

    return {
      app,
      result: {
        appId: app.id,
        name: app.name,
        slug: app.slug,
        tablas: tables.size,
        paginas: (manifest.paginas ?? []).length,
        filas: tally.filas,
        archivos: tally.archivos,
        avisos: tally.avisos,
      },
    };
  } catch (err) {
    await rollback(app.id);
    throw err;
  }
}

/** Retira una aplicación a medio importar, con sus colecciones de datos. */
async function rollback(appId: string) {
  try {
    const tables = await listRecords<TableRecord>(INTERNAL.tables, {
      filter: `app = "${quote(appId)}"`,
      perPage: 500,
      skipTotal: 1,
    });
    // Juntas y no una a una: entre ellas hay relaciones, y una colección no se
    // deja borrar mientras otra la nombre. Ver `dropDataCollections`.
    await dropDataCollections(tables.items.map((t) => t.dataCollection));
    await deleteRecord(INTERNAL.apps, appId);
  } catch {
    // La limpieza es un remedio, no una segunda oportunidad de fallar: lo que
    // se le enseña a quien importa es el error de verdad, no este.
  }
}

/**
 * Crea las tablas del paquete, en dos vueltas.
 *
 * La primera las crea sin sus columnas de relación y la segunda se las pone.
 * Hacen falta dos porque una relación necesita que la colección destino ya
 * exista, y entre dos tablas que se apuntan --o una que se apunta a si misma--
 * no hay ningún orden en el que la primera pueda nacer completa.
 *
 * La tabla de personas no se crea: la aplicación nace con ella. Lo que se le
 * hace es ponerle las columnas propias que traiga el paquete, con las dos del
 * sistema intactas.
 */
async function createTables(
  app: AppRecord,
  tablas: TransferTable[],
  tally: Tally,
  strict: Map<string, FieldDef[]>,
): Promise<Map<string, TableRecord>> {
  const out = new Map<string, TableRecord>();
  const people = await ensurePeopleTable(app);

  // --- Primera vuelta: todo menos las relaciones ---------------------
  for (const [index, tabla] of tablas.entries()) {
    const plain = tabla.fields.filter((f) => !isRelationField(f)) as FieldDef[];

    if (tabla.system && people) {
      // Las dos del sistema se reponen tal como las define la plataforma; lo
      // demás es lo que traiga el paquete. Ver `guardSystemFields`.
      const wanted = guardSystemFields(people, [
        ...peopleInitialFields().filter((f) => f.system !== undefined),
        ...plain.filter((f) => f.system === undefined),
      ]);
      const { fields } = await updateDataCollection({
        dataCollection: people.dataCollection,
        fields: wanted,
      });
      // Su sitio en la lista de tablas si viaja: la de personas no siempre es
      // la primera. El nombre no, que lo repone la plataforma en cada arranque.
      out.set(
        tabla.name,
        await savedTable(people.id, {
          fields,
          meta: tabla.meta,
          order: typeof tabla.order === "number" ? tabla.order : index,
          acceptedOrphans: tabla.acceptedOrphans,
        }),
      );
      continue;
    }

    const dataCollection = dataCollectionName(app.slug, tabla.name);
    const { fields } = await createDataCollection({ dataCollection, appId: app.id, fields: plain });
    const record = await createRecord<TableRecord>(INTERNAL.tables, {
      app: app.id,
      name: tabla.name,
      label: tabla.label || tabla.name,
      dataCollection,
      order: typeof tabla.order === "number" ? tabla.order : index,
      fields,
      meta: tabla.meta ?? { columnOrder: fields.map((f) => f.name), hidden: [], widths: {} },
      acceptedOrphans: tabla.acceptedOrphans ?? {},
    });
    out.set(tabla.name, record);
  }

  // --- Segunda vuelta: ahora si, las relaciones ----------------------
  for (const tabla of tablas) {
    if (!tabla.fields.some((f) => isRelationField(f))) continue;
    const record = out.get(tabla.name);
    if (!record) continue;

    const fields: FieldDef[] = [];
    for (const field of tabla.fields) {
      if (!isRelationField(field)) {
        fields.push(field as FieldDef);
        continue;
      }
      const target = out.get(field.relationTable ?? "");
      if (!target) {
        warn(
          tally,
          `La columna "${field.label || field.name}" de "${tabla.label}" apuntaba a una tabla que el archivo no trae, así que no se creó.`,
        );
        continue;
      }
      const { relationTable: _t, ...rest } = field;
      fields.push({ ...rest, relationTableId: target.id } as FieldDef);
    }

    const guarded = tabla.system ? guardSystemFields(record, fields) : fields;
    /*
     * Una relación obligatoria nace suelta y se aprieta al final.
     *
     * Las filas se vuelcan en dos vueltas --primero la fila, después lo que
     * apunta a otras-- así que entre una vuelta y la otra toda fila pasa por un
     * momento en el que su relación esta vacía. Con la columna ya obligatoria,
     * la base rechaza ese momento y la fila no llega a existir. Solo le pasa a
     * las relaciones de varios valores: la de un solo valor ya nace suelta en
     * la base por su otra mitad (ver `toPbFields` en `server/schema.ts`).
     */
    const relaxed = guarded.map((f) =>
      isRelationField(f) && f.required === true ? { ...f, required: false } : f,
    );
    if (relaxed.some((f, i) => f !== guarded[i])) strict.set(tabla.name, guarded);

    const { fields: saved } = await updateDataCollection({
      dataCollection: record.dataCollection,
      fields: relaxed,
    });
    out.set(tabla.name, await savedTable(record.id, { fields: saved, meta: tabla.meta }));
  }

  return out;
}

/**
 * Vuelve a poner como obligatorias las relaciones que se aflojaron para poder
 * volcar las filas. Se llama con las filas ya dentro.
 */
async function tightenRelations(tables: Map<string, TableRecord>, strict: Map<string, FieldDef[]>) {
  for (const [name, fields] of strict) {
    const record = tables.get(name);
    if (!record) continue;
    const { fields: saved } = await updateDataCollection({
      dataCollection: record.dataCollection,
      fields,
    });
    tables.set(name, await savedTable(record.id, { fields: saved }));
  }
}

/** Guarda columnas y presentacion de una tabla y devuelve como quedo. */
function savedTable(
  id: string,
  patch: { fields: FieldDef[]; meta?: TableMeta; order?: number; acceptedOrphans?: unknown },
): Promise<TableRecord> {
  return updateRecord<TableRecord>(INTERNAL.tables, id, {
    fields: patch.fields,
    ...(patch.meta ? { meta: patch.meta } : {}),
    ...(typeof patch.order === "number" ? { order: patch.order } : {}),
    ...(patch.acceptedOrphans ? { acceptedOrphans: patch.acceptedOrphans } : {}),
  });
}

/**
 * Crea las páginas y vuelve a enganchar lo que cada una declara.
 *
 * El documento se guarda como uno nuevo de esta aplicación --los documentos
 * son por aplicación, ver `server/html/htmlDocs.ts`-- y la página se queda con
 * su huella. Las fuentes se resuelven contra las tablas que se acaban de
 * crear: una columna que ya no exista se cae de la fuente, y el bloque que la
 * pida lo dira por su nombre en vez de fallar entero.
 */
async function createPages(
  bundle: TransferBundle,
  app: AppRecord,
  tables: Map<string, TableRecord>,
  tally: Tally,
) {
  for (const [index, page] of (bundle.manifest.paginas ?? []).entries()) {
    // El documento se vuelve a guardar como uno de esta aplicación y la página
    // se queda con su huella, que es lo que guarda una página. Ver `saveDoc`.
    const html = page.doc ? bundle.docs.get(page.doc) : undefined;
    const doc = html === undefined ? "" : (await saveDoc(app.id, html)).hash;

    const sources: { name: string; tableId: string; fields: Record<string, string> }[] = [];
    for (const source of page.sources ?? []) {
      const table = tables.get(source.tabla);
      if (!table) {
        warn(
          tally,
          `La página "${page.name}" usaba la tabla "${source.tabla}", que el archivo no trae.`,
        );
        continue;
      }
      const fields: Record<string, string> = {};
      for (const [logical, fieldName] of Object.entries(source.fields ?? {})) {
        const field = (table.fields ?? []).find((f) => f.name === fieldName);
        if (field?.id) fields[logical] = field.id;
      }
      sources.push({ name: source.name, tableId: table.id, fields });
    }

    await createRecord(INTERNAL.pages, {
      app: app.id,
      name: page.name,
      slug: page.slug,
      icon: page.icon ?? "",
      order: typeof page.order === "number" ? page.order : index,
      isHome: page.isHome === true,
      separator: page.separator === true,
      doc,
      sources,
      roles: sanitizeRoles(page.roles, app.roles ?? []),
      memory: page.memory ?? "",
    });
  }
}

/**
 * Vuelca las filas, en dos vueltas sobre **todas** las tablas.
 *
 * La primera crea cada fila con lo que no depende de nadie; la segunda le pone
 * las relaciones y los adjuntos, cuando ya no falta ninguna fila por crear.
 *
 * Las dos vueltas recorren el paquete entero antes de pasar a la siguiente, y
 * no cada tabla de principio a fin: si la primera tabla completara sus
 * relaciones antes de que la segunda tuviera filas, una fila que nombra a otra
 * de la segunda se quedaria sin enlace. Y no hay orden de tablas que arregle
 * eso, porque dos tablas pueden nombrarse entre si.
 */
async function fillTables(bundle: TransferBundle, tables: Map<string, TableRecord>, tally: Tally) {
  const filesByRow = new Map<string, BundleFile[]>();
  for (const file of bundle.files) {
    const key = `${file.tabla}/${file.fila}`;
    const list = filesByRow.get(key);
    if (list) list.push(file);
    else filesByRow.set(key, [file]);
  }

  /** Las columnas de relación de cada tabla, por su nombre tecnico. */
  const relationsOf = (table: TableRecord) =>
    new Set((table.fields ?? []).filter((f) => isRelationField(f)).map((f) => f.name));

  // --- Primera vuelta: la fila sin lo que apunta a otras -------------
  for (const [tabla, rows] of bundle.rows) {
    const table = tables.get(tabla);
    if (!table) continue;
    const relations = relationsOf(table);

    for (const row of rows) {
      const id = String(row.id ?? "");
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key === "id" || relations.has(key)) continue;
        body[key] = value;
      }
      try {
        await createRecord(table.dataCollection, id ? { id, ...body } : body);
        tally.filas++;
      } catch {
        warn(tally, `Alguna fila de "${table.label}" no se pudo crear y se quedó fuera.`);
      }
    }
  }

  // --- Segunda vuelta: relaciones y adjuntos -------------------------
  for (const [tabla, rows] of bundle.rows) {
    const table = tables.get(tabla);
    if (!table) continue;
    const relations = relationsOf(table);

    for (const row of rows) {
      const id = String(row.id ?? "");
      if (!id) continue;

      const links: Record<string, unknown> = {};
      for (const name of relations) {
        if (row[name] !== undefined) links[name] = row[name];
      }
      const attachments = filesByRow.get(`${tabla}/${id}`) ?? [];
      if (!Object.keys(links).length && !attachments.length) continue;

      try {
        if (attachments.length) {
          const form = new FormData();
          for (const [key, value] of Object.entries(links)) {
            // Una relación con varios valores se manda repitiendo la clave: un
            // formulario no sabe de listas, y PocketBase las junta por nombre.
            if (Array.isArray(value)) for (const one of value) form.append(key, String(one ?? ""));
            else form.append(key, String(value ?? ""));
          }
          for (const file of attachments) {
            form.append(file.campo, new Blob([new Uint8Array(file.bytes)]), file.nombre);
          }
          await updateRecordForm(table.dataCollection, id, form);
          tally.archivos += attachments.length;
        } else {
          await updateRecord(table.dataCollection, id, links);
        }
      } catch {
        warn(
          tally,
          `Alguna fila de "${table.label}" entró, pero se quedó sin lo que apuntaba a otras tablas.`,
        );
      }
    }
  }
}

/**
 * Anota un aviso, sin repetirlo y con tope.
 *
 * Los avisos se producen fila a fila, así que una tabla con mil filas malas
 * daria mil renglones iguales. Lo que hay que saber es que paso, no cuantas
 * veces.
 */
function warn(tally: Tally, text: string) {
  if (tally.avisos.length >= 20 || tally.avisos.includes(text)) return;
  tally.avisos.push(text);
}
