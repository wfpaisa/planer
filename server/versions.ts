/**
 * Historial del diseno de una aplicacion.
 *
 * Una version es una fotografia completa de la presentacion: colores,
 * paginas con su HTML y sus tablas declaradas, roles y como se ven las
 * tablas. Nunca guarda columnas, tipos ni filas: la estructura real vive en
 * la base y se resuelve al servir. Asi restaurar una version no puede perder
 * datos.
 *
 * El HTML tampoco se copia: la version nombra el documento por la huella de
 * su contenido, la misma que guarda el borrador. Treinta versiones sin tocar
 * una pagina comparten un solo documento guardado.
 */
import type {
  AppRecord,
  AppVersion,
  DesignSnapshot,
  FieldDef,
  PageRecord,
  SnapshotTable,
  TableRecord,
  VersionKind,
} from "../shared/types.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { createRecord, deleteRecord, listRecords, updateRecord } from "./pb.ts";

/** Cuantas versiones se conservan por aplicacion sin fijar. */
const MAX_VERSIONS = 30;

/* ------------------------------------------------------------------ */
/* Fotografia                                                           */
/* ------------------------------------------------------------------ */

export function buildSnapshot(
  app: AppRecord,
  pages: PageRecord[],
  tables: TableRecord[],
): DesignSnapshot {
  return {
    name: app.name,
    icon: app.icon,
    theme: app.theme ?? null,
    roles: Array.isArray(app.roles) ? app.roles : [],
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      icon: page.icon,
      order: page.order,
      isHome: page.isHome,
      separator: page.separator ?? false,
      // La huella, no el contenido: el documento se guarda una sola vez y
      // sobrevive mientras alguna version o el borrador lo nombren.
      doc: page.doc ?? "",
      sources: Array.isArray(page.sources) ? page.sources : [],
      // Quien abre la pagina viaja con la version: lo que se sirve al publico
      // es lo que se publico, no lo que se esta editando.
      roles: Array.isArray(page.roles) ? page.roles : [],
    })),
    tables: tables.map((table): SnapshotTable => ({
      id: table.id,
      label: table.label,
      order: table.order,
      meta: table.meta ?? {},
      // Por id, no por nombre: asi una columna renombrada conserva su
      // etiqueta al restaurar.
      //
      // Una columna de relacion tiene un solo id --el de la relacion-- y su
      // valor sin dueno no aparece aqui. Es lo correcto: una fotografia
      // guarda presentacion, no estructura, y restaurar nunca toca columnas.
      // La pareja se repone entera porque nunca se deshizo.
      fieldLabels: Object.fromEntries(
        (table.fields ?? [])
          .filter((f: FieldDef) => f.id)
          .map((f: FieldDef) => [f.id as string, f.label]),
      ),
    })),
  };
}

/** Serializacion con las claves ordenadas, para que la huella sea estable. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

export function hashSnapshot(snapshot: DesignSnapshot): string {
  return new Bun.CryptoHasher("sha256").update(stable(snapshot)).digest("hex");
}

/* ------------------------------------------------------------------ */
/* Versiones de antes del cambio                                        */
/* ------------------------------------------------------------------ */

/**
 * Una version guarda paginas de bloques si nacio antes de que una pagina
 * fuera un documento HTML. Se puede mirar, pero no restaurar: el borrador ya
 * no sabe dibujar eso, y volcarlo dejaria paginas en blanco.
 *
 * Una version antigua cuyas paginas estaban todas vacias no se distingue de
 * una nueva, y tampoco hace falta: restaurarla no trae ningun bloque.
 */
export function isLegacySnapshot(snapshot: DesignSnapshot): boolean {
  return (snapshot.pages ?? []).some((page) => (page.blocks?.length ?? 0) > 0);
}

/**
 * Lo que la version espera y ya no existe: tablas y columnas que su HTML
 * declara y que se borraron despues. Restaurar no las devuelve --una version
 * nunca crea ni revive columnas-- asi que hay que avisar antes, no despues.
 */
export function structureDrift(snapshot: DesignSnapshot, liveTables: TableRecord[]): string[] {
  const byId = new Map(liveTables.map((t) => [t.id, t]));
  const missing = new Set<string>();

  for (const page of snapshot.pages ?? []) {
    for (const source of page.sources ?? []) {
      const table = byId.get(source.tableId);
      if (!table) {
        missing.add(`la tabla que usa "${page.name}"`);
        continue;
      }
      for (const [logical, id] of Object.entries(source.fields ?? {})) {
        if (!(table.fields ?? []).some((f: FieldDef) => f.id === id)) {
          missing.add(`la columna "${logical}" de "${table.label}"`);
        }
      }
    }
  }
  return [...missing];
}

/* ------------------------------------------------------------------ */
/* Servir una version                                                   */
/* ------------------------------------------------------------------ */

/**
 * Combina la fotografia con las tablas que existen ahora mismo.
 * Las tablas nacidas despues de la version entran tal cual: no estaban en esta
 * version, pero incluirlas es mas barato que arriesgarse a que una pagina no
 * encuentre la suya.
 */
export function designFromSnapshot(
  appId: string,
  snapshot: DesignSnapshot,
  liveTables: TableRecord[],
): { pages: PageRecord[]; tables: TableRecord[] } {
  const bySnapshot = new Map(snapshot.tables.map((t) => [t.id, t]));

  const tables = liveTables.map((table) => {
    const saved = bySnapshot.get(table.id);
    if (!saved) return table;
    return {
      ...table,
      label: saved.label,
      order: saved.order,
      meta: saved.meta ?? {},
      fields: (table.fields ?? []).map((field: FieldDef) =>
        field.id && saved.fieldLabels[field.id]
          ? { ...field, label: saved.fieldLabels[field.id] }
          : field,
      ),
    };
  });

  const pages = snapshot.pages
    .map((page) => ({ ...page, app: appId }) as PageRecord)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return { pages, tables };
}

/* ------------------------------------------------------------------ */
/* Guardar, listar y podar                                              */
/* ------------------------------------------------------------------ */

export async function listVersions(appId: string): Promise<AppVersion[]> {
  const res = await listRecords<AppVersion>(INTERNAL.versions, {
    filter: `app = "${quote(appId)}"`,
    sort: "-number",
    perPage: 200,
    skipTotal: 1,
  });
  return res.items;
}

export async function getVersion(appId: string, versionId: string): Promise<AppVersion> {
  const version = await listRecords<AppVersion>(INTERNAL.versions, {
    filter: `app = "${quote(appId)}" && id = "${quote(versionId)}"`,
    perPage: 1,
    skipTotal: 1,
  });
  const found = version.items[0];
  if (!found) throw new HttpError(404, "Esa versión no existe");
  return found;
}

/**
 * Guarda una version nueva. Si el contenido es identico al de la ultima
 * publicacion en vivo, devuelve esa misma en vez de repetirla.
 */
export async function saveVersion(opts: {
  app: AppRecord;
  pages: PageRecord[];
  tables: TableRecord[];
  kind: VersionKind;
  label?: string;
  authorId: string;
  /** Version en vivo, para no repetirla al publicar sin cambios. */
  liveHash?: string;
}): Promise<{ version: AppVersion; created: boolean }> {
  const snapshot = buildSnapshot(opts.app, opts.pages, opts.tables);
  const hash = hashSnapshot(snapshot);

  if (opts.kind === "publish" && opts.liveHash && opts.liveHash === hash && opts.app.liveVersion) {
    return { version: await getVersion(opts.app.id, opts.app.liveVersion), created: false };
  }

  const existing = await listVersions(opts.app.id);
  const number = (existing[0]?.number ?? 0) + 1;

  const version = await createRecord<AppVersion>(INTERNAL.versions, {
    app: opts.app.id,
    number,
    label: (opts.label ?? "").trim().slice(0, 120),
    kind: opts.kind,
    hash,
    pinned: false,
    author: opts.authorId,
    snapshot,
  });

  return { version, created: true };
}

/** Deja el historial en el tope, sin tocar las fijadas ni la que esta en vivo. */
export async function pruneVersions(appId: string, keepId: string) {
  const all = await listVersions(appId);
  const removable = all.filter((v) => !v.pinned && v.id !== keepId);
  const excess = removable.slice(MAX_VERSIONS);
  for (const version of excess) {
    await deleteRecord(INTERNAL.versions, version.id).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Restaurar                                                            */
/* ------------------------------------------------------------------ */

/**
 * Copia una fotografia al borrador.
 *
 * Reproduce las paginas tal cual estaban: las que faltan se vuelven a crear
 * con su mismo id, y las que sobran se borran. De las tablas solo se toca la
 * presentacion; ni las columnas ni los datos se rozan.
 */
export async function restoreSnapshot(
  app: AppRecord,
  snapshot: DesignSnapshot,
  liveTables: TableRecord[],
  livePages: PageRecord[],
): Promise<void> {
  await updateRecord(INTERNAL.apps, app.id, {
    name: snapshot.name,
    icon: snapshot.icon,
    theme: snapshot.theme,
    roles: snapshot.roles,
  });

  const byId = new Map(livePages.map((p) => [p.id, p]));

  for (const page of snapshot.pages) {
    // `blocks` no se toca: es de las paginas de antes y solo se lee, para
    // poder convertirlas. Escribirlo aqui se llevaria por delante lo unico
    // que permite recuperar una pagina que nunca se convirtio.
    const payload = {
      app: app.id,
      name: page.name,
      slug: page.slug,
      icon: page.icon,
      order: page.order,
      isHome: page.isHome,
      separator: page.separator ?? false,
      doc: page.doc ?? "",
      sources: page.sources ?? [],
      roles: page.roles ?? [],
    };
    if (byId.has(page.id)) {
      await updateRecord(INTERNAL.pages, page.id, payload);
      byId.delete(page.id);
    } else {
      // El id de PocketBase se puede reusar al crear, asi que una pagina
      // borrada vuelve con el mismo id y los enlaces siguen valiendo.
      await createRecord(INTERNAL.pages, { id: page.id, ...payload });
    }
  }

  for (const leftover of byId.values()) {
    await deleteRecord(INTERNAL.pages, leftover.id).catch(() => {});
  }

  const bySnapshot = new Map(snapshot.tables.map((t) => [t.id, t]));
  for (const table of liveTables) {
    const saved = bySnapshot.get(table.id);
    if (!saved) continue;
    const fields = (table.fields ?? []).map((field: FieldDef) =>
      field.id && saved.fieldLabels[field.id]
        ? { ...field, label: saved.fieldLabels[field.id] }
        : field,
    );
    await updateRecord(INTERNAL.tables, table.id, {
      label: saved.label,
      order: saved.order,
      meta: saved.meta ?? {},
      fields,
    });
  }
}
