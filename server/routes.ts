/**
 * API propia de la plataforma.
 * Solo vive aqui lo que el navegador no puede hacer directo contra PocketBase:
 * crear o modificar tablas, y servir las apps publicadas.
 */

import { aiHasCatalog, aiProviderName } from "../shared/aiCatalog.ts";
import { normalizePalette } from "../shared/brand.ts";
import { buildHtmlContract } from "../shared/htmlContract.ts";
import { canOpenPage, pageDenial } from "../shared/pages.ts";
import {
  ADMIN_ROLE,
  isPeopleTable,
  loginFor,
  MAX_ROLES,
  MIN_PASSWORD,
  newPassword,
  normalizeRole,
} from "../shared/people.ts";
import type {
  AccessChange,
  AiActiveRun,
  AiChat,
  AiChatFile,
  AiChatSummary,
  AiChoice,
  AiConfigView,
  AiDebugRead,
  AiFile,
  AiFileKind,
  AiModel,
  AiOpenChat,
  AiProgress,
  AiRunInfo,
  AiStep,
  AppBundle,
  AppPerson,
  AppRecord,
  AppTheme,
  AppVersion,
  AppVersionSummary,
  FieldDef,
  HtmlSource,
  ImpactResult,
  PageIssue,
  PageRecord,
  PickedBlock,
  TableRecord,
  VersionsView,
} from "../shared/types.ts";
import { peopleOf, personOf, setPersonAccess } from "./access.ts";
import {
  loadAiConfig,
  providerFromInput,
  saveAiConfig,
  type StoredConfig,
  type StoredProvider,
  testAiConfig,
} from "./ai.ts";
import { appendToChat, getChat, listChats, readOpenChat, setOpenChat } from "./aiChats.ts";
import { clearAiDebug, readAiDebug } from "./aiDebug.ts";
import { findAiFile, readAiFileBytes, saveAiFile } from "./aiFiles.ts";
import { findCatalogModel, listCatalog, llamaCppCatalog, llamaCppModel } from "./aiModels.ts";
import {
  appPages,
  appTables,
  explainPageUse,
  fixPage,
  runPageRequest,
  writePageDoc,
} from "./aiPage.ts";
import {
  activeRuns,
  type AiRun,
  pageRun,
  pushRun,
  replayRun,
  runInfo,
  startRun,
  watchRun,
} from "./aiRuns.ts";
import { HttpError, type Identity, optionalMember, requireBuilder } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { applyChange, pagesForChanges, readChanges, readChoice } from "./dataImpact.ts";
import { quote } from "./filter.ts";
import { BRIDGE_TAG, wrapDocument } from "./htmlBridge.ts";
import { pruneDocs, requireDoc } from "./htmlDocs.ts";
import { closeProbe } from "./htmlProbe.ts";
import { ASSETS_TAG, REF_NAMES, wrapPage } from "./pageAssets.ts";
import { convertPageToHtml } from "./pageConvert.ts";
import { isSourceError, runPageData } from "./pageData.ts";
import {
  createRecord,
  deleteRecord,
  firstRecord,
  listRecords,
  PbError,
  updateRecord,
} from "./pb.ts";
import { importPeople, type PeopleImportRow } from "./peopleImport.ts";
import {
  dropPersonData,
  ensurePeopleTable,
  ensurePersonRow,
  guardSystemFields,
  guardSystemTable,
  parkPersonReferences,
} from "./peopleTable.ts";
import { deleteImpact, deleteRows as removeRows } from "./rowDelete.ts";
import {
  createDataCollection,
  dataCollectionName,
  dropDataCollection,
  dropDataCollections,
  SchemaError,
  slugify,
  uniqueConflictMessage,
  uniqueConflicts,
  uniqueTableName,
  updateDataCollection,
} from "./schema.ts";
import {
  buildSnapshot,
  designFromSnapshot,
  getVersion,
  hashSnapshot,
  isLegacySnapshot,
  listVersions,
  pruneVersions,
  restoreSnapshot,
  saveVersion,
  structureDrift,
} from "./versions.ts";

const json = <T = unknown>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "El cuerpo de la petición no es JSON válido");
  }
}

/* ------------------------------------------------------------------ */
/* Ayudas                                                               */
/* ------------------------------------------------------------------ */

async function ownedApp(appId: string, me: Identity): Promise<AppRecord> {
  const app = await firstRecord<AppRecord>(INTERNAL.apps, `id = "${quote(appId)}"`);
  if (!app) throw new HttpError(404, "La aplicación no existe");
  if (app.owner !== me.id) throw new HttpError(403, "Esta aplicación no es tuya");
  return app;
}

async function ownedTable(
  tableId: string,
  me: Identity,
): Promise<{ table: TableRecord; app: AppRecord }> {
  const table = await firstRecord<TableRecord>(INTERNAL.tables, `id = "${quote(tableId)}"`);
  if (!table) throw new HttpError(404, "La tabla no existe");
  const app = await ownedApp(table.app, me);
  return { table, app };
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base, "app");
  for (let i = 0; i < 200; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await firstRecord(INTERNAL.apps, `slug = "${quote(candidate)}"`);
    if (!hit) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/* ------------------------------------------------------------------ */
/* Aplicaciones                                                         */
/* ------------------------------------------------------------------ */

/**
 * Solo se admite un id del catalogo de paletas (o `custom` con su
 * hexadecimal) y un tamano de letra dentro del rango. La validacion entera
 * vive en `normalizePalette`, que tambien sabe leer lo guardado con los
 * formatos de antes.
 */
function sanitizeTheme(input: unknown): AppTheme | null {
  if (!input || typeof input !== "object") return null;
  return normalizePalette(input);
}

/**
 * Deja una lista de roles limpia: normalizada, sin vacios, sin repetidos y con
 * tope. Con `allowed`, ademas descarta los que la aplicacion ya no define.
 *
 * La normalizacion se aplica aqui y no solo en la pantalla: el campo la aplica
 * en cada pulsacion para que se vea el nombre tal como va a quedar, pero quien
 * llama a la ruta no tiene por que ser la pantalla. Dos nombres que se
 * normalicen al mismo son el mismo rol y se funden en uno. Ver `design.md` D6.
 */
function sanitizeRoles(input: unknown, allowed?: string[]): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const name = normalizeRole(raw);
    if (!name) continue;
    if (allowed && !allowed.includes(name)) continue;
    out.add(name);
    if (out.size >= MAX_ROLES) break;
  }
  return [...out];
}

/**
 * Los roles de una aplicacion, con `admin` siempre dentro.
 *
 * Va primero para que se lea antes que los que puso el constructor, y no se
 * puede quitar: la vista previa arranca en el, y quitarlo dejaria a
 * `pruneRoles` borrandolo de las paginas que lo tuvieran marcado. Ver
 * `design.md` D7.
 */
function withAdminRole(roles: string[]): string[] {
  return roles.includes(ADMIN_ROLE) ? roles : [ADMIN_ROLE, ...roles].slice(0, MAX_ROLES);
}

/**
 * Al quitar un rol de la aplicacion deja de nombrarse en ningun lado: ni en
 * las personas ni en las paginas. Una pagina que se queda sin roles vuelve a
 * verla cualquiera.
 */
async function pruneRoles(appId: string, roles: string[]) {
  const access = await listRecords<{ id: string; roles?: string[] }>(INTERNAL.access, {
    filter: `app = "${quote(appId)}"`,
    perPage: 200,
    skipTotal: 1,
  });
  for (const row of access.items) {
    const next = sanitizeRoles(row.roles, roles);
    if (next.length !== (row.roles ?? []).length) {
      await updateRecord(INTERNAL.access, row.id, { roles: next });
    }
  }

  const pages = await listRecords<PageRecord>(INTERNAL.pages, {
    filter: `app = "${quote(appId)}"`,
    perPage: 200,
    skipTotal: 1,
  });
  for (const page of pages.items) {
    const next = sanitizeRoles(page.roles, roles);
    if (next.length !== (page.roles ?? []).length) {
      await updateRecord(INTERNAL.pages, page.id, { roles: next });
    }
  }
}

export async function createApp(req: Request) {
  const me = await requireBuilder(req);
  const input = await body<{
    name?: string;
    icon?: string;
    theme?: unknown;
    visibility?: string;
  }>(req);

  const name = (input.name ?? "").trim() || "Aplicación sin título";
  const app = await createRecord<AppRecord>(INTERNAL.apps, {
    name,
    slug: await uniqueSlug(name),
    icon: input.icon || "DashboardCircleIcon",
    // La paleta se elige al crearla: de ella sale tambien el color del icono.
    theme: sanitizeTheme(input.theme),
    visibility: input.visibility === "public" ? "public" : "private",
    published: false,
    owner: me.id,
    // Toda aplicacion define `admin` desde que nace, sin que nadie lo escriba.
    roles: [ADMIN_ROLE],
  });

  // La navegacion nace ya agrupada: un separador arriba y la pagina de inicio
  // debajo, para que anadir la segunda pagina no obligue a inventar el grupo.
  await createRecord(INTERNAL.pages, {
    app: app.id,
    name: "GENERAL",
    slug: "separador-general",
    order: 0,
    isHome: false,
    separator: true,
  });

  await createRecord(INTERNAL.pages, {
    app: app.id,
    name: "Inicio",
    slug: "inicio",
    icon: "File01Icon",
    order: 1,
    isHome: true,
  });

  // Una aplicacion siempre tiene su tabla de personas, desde el primer momento.
  await ensurePeopleTable(app);

  return json(app, 201);
}

export async function updateApp(req: Request, id: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(id, me);
  const input = await body<Partial<AppRecord>>(req);

  const patch: Record<string, unknown> = {};
  if (typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim();
  if (typeof input.icon === "string") patch.icon = input.icon;
  if (input.visibility === "public" || input.visibility === "private")
    patch.visibility = input.visibility;
  if (typeof input.published === "boolean") patch.published = input.published;
  if (input.theme !== undefined) patch.theme = sanitizeTheme(input.theme);
  if (input.roles !== undefined) patch.roles = withAdminRole(sanitizeRoles(input.roles));
  if (typeof input.slug === "string" && input.slug.trim()) {
    const next = slugify(input.slug);
    if (next !== app.slug) patch.slug = await uniqueSlug(next);
  }

  let updated = await updateRecord<AppRecord>(INTERNAL.apps, id, patch);

  if (patch.roles) await pruneRoles(app.id, updated.roles ?? []);

  // Encender el interruptor de publicada sin haber publicado nunca deja la
  // app sin version que servir. Se crea la primera aqui, para que el enlace
  // publico funcione igual que antes de que existiera el historial.
  if (patch.published === true && !app.liveVersion) {
    const { pages, tables } = await draftOf(app.id);
    const { version } = await saveVersion({
      app: updated,
      pages,
      tables,
      kind: "publish",
      authorId: me.id,
    });
    updated = await updateRecord<AppRecord>(INTERNAL.apps, id, { liveVersion: version.id });
  }

  return json(updated);
}

export async function deleteApp(req: Request, id: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(id, me);

  const tables = await listRecords<TableRecord>(INTERNAL.tables, {
    filter: `app = "${quote(app.id)}"`,
    perPage: 200,
    skipTotal: 1,
  });
  // Juntas y no una a una: entre ellas hay relaciones, y una coleccion no se
  // deja borrar mientras otra la nombre. Ver `dropDataCollections`.
  await dropDataCollections(tables.items.map((t) => t.dataCollection));

  await deleteRecord(INTERNAL.apps, app.id);
  return json({ ok: true });
}

/**
 * Limpieza: se van las aplicaciones que se pidan --con sus tablas, paginas,
 * accesos, versiones, documentos y conversaciones-- y los datos que guardaban.
 *
 * Lo que NO se toca son los ajustes: el servidor de IA con sus claves y la
 * cuenta de quien construye siguen igual. La idea es vaciar el trabajo sin
 * tener que volver a configurar nada.
 */
export async function wipeApps(req: Request) {
  const me = await requireBuilder(req);
  const input = await body<{ apps?: string[] }>(req);

  const wanted = [...new Set((input.apps ?? []).filter((id) => typeof id === "string" && id))];
  if (wanted.length === 0) throw new HttpError(400, "No elegiste ninguna aplicación");

  // Solo se borra lo propio: `ownedApp` corta en seco si alguna no lo es.
  const apps: AppRecord[] = [];
  for (const id of wanted) apps.push(await ownedApp(id, me));

  let dropped = 0;
  for (const app of apps) {
    // Los datos no cuelgan de la aplicacion: cada tabla es una coleccion de
    // PocketBase y hay que tirarla a mano antes de perderle la pista.
    const tables = await listRecords<TableRecord>(INTERNAL.tables, {
      filter: `app = "${quote(app.id)}"`,
      perPage: 500,
      skipTotal: 1,
    });
    // Se cuenta lo que de verdad se fue, no lo que se intento: una coleccion
    // que otra sujeta por una relacion no cae, y decir que si seria mentir.
    const { dropped: gone } = await dropDataCollections(tables.items.map((t) => t.dataCollection));
    dropped += gone;

    // Las cuentas de quienes usan la app publicada son de la aplicacion
    // (`<appId>:<correo>`): al irse la app no les queda nada que abrir. La
    // cascada solo se lleva el acceso, asi que la cuenta se borra aparte.
    const access = await listRecords<{ member: string }>(INTERNAL.access, {
      filter: `app = "${quote(app.id)}"`,
      perPage: 500,
      skipTotal: 1,
    });

    await deleteRecord(INTERNAL.apps, app.id);
    for (const row of access.items) {
      await deleteRecord(INTERNAL.members, row.member).catch(() => {});
    }
  }

  return json({ apps: apps.length, tables: dropped });
}

/* ------------------------------------------------------------------ */
/* Tablas                                                               */
/* ------------------------------------------------------------------ */

/*
 * Una tabla nueva nace sin ninguna columna.
 *
 * Antes nacia con "Nombre" --obligatoria-- y "Notas", que casi nunca eran las
 * columnas que se querian: se borraban las dos y se escribian las de verdad, o
 * se quedaban ahi de adorno. Y la obligatoria hacia dano: importar un archivo
 * que no traia nombres dejaba cada fila sin ese dato y la base rechazaba la
 * importacion entera (ver `findRequiredGaps` en `web/src/lib/importPlan.ts`).
 *
 * Sin columnas no hay callejon sin salida: "Añadir columna" vive en la barra de
 * la cuadricula, la tabla vacia manda ahi, e importar un archivo crea las
 * columnas que el archivo traiga. Quien si necesita columnas el primer dia es
 * la tabla de personas, y las suyas las pone `PEOPLE_DEFAULT_FIELDS`.
 */

export async function createTable(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{ label?: string; fields?: FieldDef[] }>(req);

  const label = (input.label ?? "").trim() || "Tabla";
  const name = await uniqueTableName(app.id, label);
  const dataCollection = dataCollectionName(app.slug, name);

  const { fields } = await createDataCollection({
    dataCollection,
    appId: app.id,
    fields: input.fields ?? [],
  });

  const count = await listRecords(INTERNAL.tables, {
    filter: `app = "${quote(app.id)}"`,
    perPage: 1,
  });

  try {
    // Una tabla nueva no pregunta nada: quien puede abrir una pagina alcanza
    // todas las filas de las tablas que esa pagina declara.
    const table = await createRecord<TableRecord>(INTERNAL.tables, {
      app: app.id,
      name,
      label,
      dataCollection,
      order: count.totalItems,
      fields,
      meta: { columnOrder: fields.map((f) => f.name), hidden: [], widths: {} },
    });
    await rebindOrphanSources(app.id, table);
    return json(table, 201);
  } catch (err) {
    await dropDataCollection(dataCollection);
    throw err;
  }
}

/**
 * Vuelve a enganchar las paginas que se quedaron colgando de una tabla
 * borrada, cuando la que acaba de nacer se llama igual.
 *
 * Una pagina declara sus fuentes por id interno, no por nombre: eso deja
 * renombrar una tabla sin romper nada, pero no sobrevive a un borrar y volver
 * a crear, porque la tabla nueva es otra coleccion con otro id. Aqui se cubre
 * ese hueco, y solo ese: se toca una fuente unicamente si su tabla ya no
 * existe. Una fuente que apunta a una tabla viva no se roba nunca.
 *
 * Las columnas se rehacen por nombre --que es como las nombra el HTML--; la
 * que no aparezca en la tabla nueva se queda sin declarar, y el bloque que la
 * pida lo dira por su nombre en vez de fallar entero.
 */
async function rebindOrphanSources(appId: string, table: TableRecord): Promise<void> {
  try {
    const tables = await listRecords<TableRecord>(INTERNAL.tables, {
      filter: `app = "${quote(appId)}"`,
      perPage: 200,
      skipTotal: 1,
    });
    const live = new Set(tables.items.map((t) => t.id));

    const fields: Record<string, string> = {};
    for (const field of table.fields ?? []) {
      if (field.id) fields[field.name] = field.id;
    }

    const pages = await listRecords<PageRecord>(INTERNAL.pages, {
      filter: `app = "${quote(appId)}"`,
      perPage: 200,
      skipTotal: 1,
    });

    for (const page of pages.items) {
      const sources = page.sources ?? [];
      let touched = false;
      const next = sources.map((source) => {
        if (source.name !== table.name || live.has(source.tableId)) return source;
        touched = true;
        const kept: Record<string, string> = {};
        for (const logical of Object.keys(source.fields ?? {})) {
          const id = fields[logical];
          if (id) kept[logical] = id;
        }
        return { name: source.name, tableId: table.id, fields: kept };
      });
      if (touched) await updateRecord(INTERNAL.pages, page.id, { sources: next });
    }
  } catch {
    // El reenganche es una cortesia: si falla, la tabla queda creada igual y
    // la pagina sigue avisando que su fuente no existe.
  }
}

export async function updateTable(req: Request, id: string) {
  const me = await requireBuilder(req);
  const { table } = await ownedTable(id, me);
  const input = await body<Partial<TableRecord>>(req);

  // Las columnas del sistema van por delante y tal como son: lo que llegue de
  // ellas se compara y se rechaza si difiere, aqui y no solo en la pantalla.
  if (Array.isArray(input.fields)) input.fields = guardSystemFields(table, input.fields);

  const patch: Record<string, unknown> = {};
  if (typeof input.label === "string" && input.label.trim()) patch.label = input.label.trim();
  if (typeof input.order === "number") patch.order = input.order;
  if (input.meta) patch.meta = input.meta;
  // Los valores sin dueno que el constructor dio por buenos. Dejan de contar en
  // el recuento de filas sin enlace y siguen viendose en su celda.
  if (input.acceptedOrphans) patch.acceptedOrphans = input.acceptedOrphans;

  // Marcar una columna como unica sobre datos que ya se repiten no se puede
  // aplicar. PocketBase rechaza el indice sin decir cual es el choque, y sin
  // saberlo el constructor no tiene como arreglarlo: se mira antes y se nombra.
  if (Array.isArray(input.fields)) {
    const before = new Set(table.fields.filter((f) => f.unique === true).map((f) => f.name));
    const added = input.fields.filter((f) => f.unique === true && !before.has(f.name));
    if (added.length) {
      const conflicts = await uniqueConflicts(table.dataCollection, added);
      if (conflicts.length) throw new SchemaError(uniqueConflictMessage(conflicts));
    }
  }

  /*
   * Las columnas se cambian sin soltar las reglas antes. Antes hacia falta:
   * la regla nombraba la columna dueno de la fila, y PocketBase rechaza tocar
   * una columna que una regla todavia nombra. La regla de hoy no nombra
   * ninguna columna --solo dice quien es el dueno de la aplicacion-- asi que
   * no hay nada que soltar. Ver `accessRules`.
   */
  if (Array.isArray(input.fields)) {
    const { fields } = await updateDataCollection({
      dataCollection: table.dataCollection,
      fields: input.fields,
    });
    patch.fields = fields;
  }

  // Renombrar una columna no obliga a tocar ninguna pagina: las paginas
  // declaran sus columnas por su id interno, que no cambia al renombrar.
  return json(await updateRecord<TableRecord>(INTERNAL.tables, id, patch));
}

/**
 * Los identificadores que llegan en el cuerpo, sin colarse nada mas.
 *
 * El cuerpo lo escribe el navegador, asi que se filtra a mano: lo que no sea
 * una cadena no llega a componer ningun filtro.
 */
function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "")).filter(Boolean);
}

/**
 * Solo la tabla de personas no borra filas por el camino comun: quitarle el
 * acceso a alguien es borrarle la cuenta de esta aplicacion, y eso pasa por
 * `removeMember`, que ademas conserva lo que sus filas ensenaban.
 */
function guardPeopleRows(table: TableRecord) {
  if (!isPeopleTable(table)) return;
  throw new SchemaError(
    "Una fila de la tabla de personas no se borra desde aquí: se le quita el acceso a esa persona.",
  );
}

/**
 * Cuantas filas de otras tablas se conservan y cuantas se borran con estas.
 *
 * Se pregunta antes de borrar, para poder decirlo con numeros de verdad en vez
 * de solo "esta accion no se puede deshacer". Ver `design.md` D7.
 */
export async function rowsDeleteImpact(req: Request, id: string) {
  const me = await requireBuilder(req);
  const { table } = await ownedTable(id, me);
  const input = await body<{ ids?: unknown }>(req);
  return json(await deleteImpact(table.app, table, readIds(input.ids)));
}

/**
 * Borra filas de una tabla, conservando lo que decian de ellas las de otras.
 *
 * La cuadricula llamaba directa a la base y se saltaba cualquier regla: lo que
 * las filas de otras tablas ensenaban de la que se iba se perdia sin que nada
 * lo dijera. Por eso da esta vuelta. Los identificadores van juntos: un borrado
 * en bloque es una peticion y no cuarenta.
 */
export async function deleteRows(req: Request, id: string) {
  const me = await requireBuilder(req);
  const { table } = await ownedTable(id, me);
  guardPeopleRows(table);
  const input = await body<{ ids?: unknown }>(req);
  return json(await removeRows(table.app, table, readIds(input.ids)));
}

export async function deleteTable(req: Request, id: string) {
  const me = await requireBuilder(req);
  const { table } = await ownedTable(id, me);
  guardSystemTable(table, "borrar");
  await dropDataCollection(table.dataCollection);
  await deleteRecord(INTERNAL.tables, id);
  return json({ ok: true });
}

/**
 * Hace una copia de la tabla: nuevas columnas (con ids frescos) y todas las
 * filas con sus valores. Las celdas de archivo no se copian porque los
 * archivos viven en el almacenamiento de la coleccion de origen, no en el de
 * la copia. Las relaciones conservan los ids de siempre, asi no se rompen.
 */
export async function duplicateTable(req: Request, id: string) {
  const me = await requireBuilder(req);
  const { table, app } = await ownedTable(id, me);
  guardSystemTable(table, "duplicar");

  const label = `${table.label} (copia)`;
  const name = await uniqueTableName(app.id, label);
  const dataCollection = dataCollectionName(app.slug, name);

  const { fields } = await createDataCollection({
    dataCollection,
    appId: app.id,
    fields: table.fields,
  });

  try {
    const fileNames = new Set(fields.filter((f) => f.type === "file").map((f) => f.name));
    const first = await listRecords<Record<string, unknown>>(table.dataCollection, {
      perPage: 500,
    });
    for (let page = 1; page <= first.totalPages; page++) {
      const res =
        page === 1
          ? first
          : await listRecords<Record<string, unknown>>(table.dataCollection, {
              perPage: 500,
              page,
            });
      for (const record of res.items) {
        const body: Record<string, unknown> = {};
        for (const field of fields) {
          const value = record[field.name];
          if (value === undefined || value === null) continue;
          if (fileNames.has(field.name)) continue;
          body[field.name] = value;
        }
        await createRecord(dataCollection, body);
      }
    }

    const count = await listRecords(INTERNAL.tables, {
      filter: `app = "${quote(app.id)}"`,
      perPage: 1,
    });

    const copy = await createRecord<TableRecord>(INTERNAL.tables, {
      app: app.id,
      name,
      label,
      dataCollection,
      order: count.totalItems,
      fields,
      meta: table.meta ?? { columnOrder: fields.map((f) => f.name), hidden: [], widths: {} },
    });
    return json(copy, 201);
  } catch (err) {
    await dropDataCollection(dataCollection);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Personas con acceso a una app publicada                              */
/* ------------------------------------------------------------------ */

export async function listMembers(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const res = await listRecords(INTERNAL.access, {
    filter: `app = "${quote(app.id)}"`,
    expand: "member",
    perPage: 200,
    sort: "-created",
  });
  return json(res.items);
}

/** Las personas invitadas a una app, en la forma corta que usa el navegador. */

/** Para el panel: sirve a quien apuntan las columnas de personas mientras se construye. */
export async function listPeople(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  return json(await peopleOf(app.id));
}

export async function addMember(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{
    email?: string;
    password?: string;
    name?: string;
    roles?: string[];
  }>(req);

  const email = (input.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new HttpError(400, "Correo no valido");
  const roles = sanitizeRoles(input.roles, app.roles ?? []);

  // La cuenta se busca dentro de esta aplicacion y en ninguna otra: el mismo
  // correo puede tener cuenta en otra, y no es esta. Ver `ensureScopedAccounts`
  // en `server/bootstrap.ts`.
  let member = await firstRecord<{ id: string }>(
    INTERNAL.members,
    `app = "${quote(app.id)}" && cuenta = "${quote(email)}"`,
  );
  let generatedPassword: string | undefined;

  if (!member) {
    generatedPassword = input.password?.trim() || newPassword();
    member = await createRecord<{ id: string }>(INTERNAL.members, {
      app: app.id,
      cuenta: email,
      login: loginFor(app.id, email),
      password: generatedPassword,
      passwordConfirm: generatedPassword,
      name: input.name ?? email.split("@")[0],
      verified: true,
    });
  }

  const existing = await firstRecord(
    INTERNAL.access,
    `app = "${quote(app.id)}" && member = "${quote(member.id)}"`,
  );
  const access = existing
    ? await updateRecord(INTERNAL.access, (existing as { id: string }).id, { roles })
    : await createRecord(INTERNAL.access, { app: app.id, member: member.id, roles });

  // Su fila en la tabla de personas de esta aplicacion, donde iran sus columnas
  // propias. Nace vacia: de momento solo dice que es ella.
  await ensurePersonRow(app.id, member.id);

  return json({ access, email, password: generatedPassword }, 201);
}

/**
 * Importa la tabla de personas, o dice antes lo que pasaria.
 *
 * Con `soloContar` no se escribe nada: responde cuantas personas ya estan y
 * cuantas cuentas se crearian, que es lo que hay que saber antes de decidir.
 * Crear cuentas exige `crearCuentas` en cada peticion; no hay forma de que se
 * quede encendido de una importacion para la siguiente.
 */
export async function importPeopleRows(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{
    rows?: PeopleImportRow[];
    crearCuentas?: boolean;
    soloContar?: boolean;
  }>(req);

  if (!Array.isArray(input.rows)) throw new HttpError(400, "Faltan las filas");

  return json(
    await importPeople({
      appId: app.id,
      roles: app.roles ?? [],
      rows: input.rows,
      crearCuentas: input.crearCuentas === true,
      soloContar: input.soloContar === true,
    }),
  );
}

/**
 * Cambia una de las dos columnas del sistema de una persona.
 *
 * Cada una escribe donde vive: el correo y el nombre en la cuenta --que es de
 * esta aplicacion-- y los roles en el enlace con ella. El reparto se hace aqui
 * y no en la pantalla: es lo unico que hace cierto que cada dato tenga un solo
 * dueno. Las columnas propias no pasan por esta ruta; esas se escriben en la
 * coleccion de la aplicacion como en cualquier tabla.
 */
export async function updateMember(req: Request, accessId: string) {
  const me = await requireBuilder(req);
  const access = await firstRecord<{ id: string; app: string; member: string }>(
    INTERNAL.access,
    `id = "${quote(accessId)}"`,
  );
  if (!access) throw new HttpError(404, "El acceso no existe");
  const app = await ownedApp(access.app, me);

  const input = await body<{ roles?: string[]; email?: string; name?: string }>(req);

  // --- La cuenta de esta aplicacion ---
  const account: Record<string, unknown> = {};
  if (typeof input.email === "string") {
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) throw new HttpError(400, "Correo no valido");
    // Repetido solo cuenta dentro de esta aplicacion: que el correo tenga
    // cuenta en otra no dice nada de esta.
    const taken = await firstRecord<{ id: string }>(
      INTERNAL.members,
      `app = "${quote(access.app)}" && cuenta = "${quote(email)}" && id != "${quote(access.member)}"`,
    );
    if (taken) throw new HttpError(400, "Ya hay una cuenta con ese correo en esta aplicación");
    account.cuenta = email;
    // Lo que se compara al entrar lleva el correo dentro, asi que cambia con el.
    account.login = loginFor(access.app, email);
  }
  if (typeof input.name === "string") account.name = input.name.trim();
  if (Object.keys(account).length) await updateRecord(INTERNAL.members, access.member, account);

  // --- El enlace con esta aplicacion ---
  // Los roles se escriben donde se leen (`server/access.ts`), que es el mismo
  // sitio por el que pasa la IA: un solo dueno para el mismo dato.
  if (input.roles !== undefined) {
    await setPersonAccess({
      appId: app.id,
      memberId: access.member,
      roles: sanitizeRoles(input.roles, app.roles ?? []),
      appRoles: app.roles ?? [],
    });
  }

  return json(await firstRecord(INTERNAL.access, `id = "${quote(accessId)}"`));
}

/**
 * Le pone otra clave a una persona invitada.
 *
 * Es para lo de siempre: alguien la perdio y quien construye la app tiene que
 * darle uno nuevo a mano. La clave se devuelve una sola vez --aqui no se
 * guarda en ninguna parte de donde se pueda volver a leer-- y al cambiarla
 * PocketBase invalida las sesiones que hubiera abiertas con la anterior.
 */
export async function resetMemberPassword(req: Request, accessId: string) {
  const me = await requireBuilder(req);
  const access = await firstRecord<{
    id: string;
    app: string;
    member: string;
    expand?: { member?: { cuenta?: string } };
  }>(INTERNAL.access, `id = "${quote(accessId)}"`, { expand: "member" });
  if (!access) throw new HttpError(404, "El acceso no existe");
  await ownedApp(access.app, me);

  const input = await body<{ password?: string }>(req).catch(() => ({}) as { password?: string });
  const chosen = (input.password ?? "").trim();
  if (chosen && chosen.length < MIN_PASSWORD) {
    throw new HttpError(400, `La clave necesita ${MIN_PASSWORD} caracteres o más`);
  }
  const password = chosen || newPassword();

  await updateRecord(INTERNAL.members, access.member, {
    password,
    passwordConfirm: password,
  });

  return json({ email: access.expand?.member?.cuenta ?? "", password });
}

export async function removeMember(req: Request, accessId: string) {
  const me = await requireBuilder(req);
  const access = await firstRecord<{ id: string; app: string; member: string }>(
    INTERNAL.access,
    `id = "${quote(accessId)}"`,
  );
  if (!access) throw new HttpError(404, "El acceso no existe");
  await ownedApp(access.app, me);
  // La cuenta es de esta aplicacion, asi que se va con el acceso: dejarla viva
  // seria dejar una entrada que ya no abre nada, que es lo que llenaba la lista
  // de cuentas sin dueno antes de que las cuentas fueran por aplicacion. Si
  // esta persona esta invitada en otra, alli tiene la suya y no se toca.
  // Antes de borrar nada: lo que sus filas de otras tablas ensenaban --su
  // cedula-- pasa al corralito de esas columnas. Si no, quedan cuarenta filas
  // diciendo "enlace roto" y el dato que traian no se ve en ninguna parte.
  await parkPersonReferences(access.app, access.member);
  await dropPersonData(access.app, access.member);
  await deleteRecord(INTERNAL.access, accessId);
  await deleteRecord(INTERNAL.members, access.member).catch(() => {});
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Servidor de inteligencia artificial                                  */
/* ------------------------------------------------------------------ */

/** Lo guardado sin ninguna clave: es lo unico que puede salir hacia el panel. */
const aiView = (cfg: StoredConfig): AiConfigView => ({
  ...cfg,
  providers: cfg.providers.map(({ apiKey, ...rest }) => ({ ...rest, hasKey: !!apiKey })),
});

export async function getAiConfig(req: Request) {
  await requireBuilder(req);
  return json<AiConfigView>(aiView(await loadAiConfig()));
}

export async function putAiConfig(req: Request) {
  await requireBuilder(req);
  const input = await body<Partial<StoredConfig>>(req);
  return json<AiConfigView>(aiView(await saveAiConfig(input)));
}

export async function checkAiConfig(req: Request) {
  await requireBuilder(req);
  // Se prueba lo que hay en el formulario, aunque todavia no se haya guardado.
  const input = await body<{ provider?: Partial<StoredProvider>; model?: string }>(req).catch(
    () => ({}),
  );
  return json(await testAiConfig(input));
}

/**
 * El catalogo de un servidor que sabe contar lo que ofrece.
 *
 * Va contra el servidor que se esta escribiendo, no contra el guardado: sirve
 * para elegir modelos mientras se conecta uno nuevo. Sin `id` devuelve la lista
 * entera para buscar dentro; con `id`, solo ese, ya listo para anadirlo.
 */
export async function aiCatalog(req: Request) {
  await requireBuilder(req);
  const input = await body<{ provider?: Partial<StoredProvider>; id?: string }>(req);
  // El catalogo es publico: se puede mirar antes de tener la clave, que es
  // justo cuando hace falta --mientras se conecta el servidor--.
  const { provider, base } = await providerFromInput(input.provider, false);

  if (!aiHasCatalog(provider.provider)) {
    throw new HttpError(
      400,
      `${aiProviderName(provider)} no publica una lista de sus modelos: escríbelos a mano.`,
    );
  }

  // llama.cpp no busca por nombre: solo sirve el modelo que tiene cargado, asi
  // que el nombre escrito no cambia nada de lo que se le pregunta.
  if (provider.provider === "llamacpp") {
    const wanted = (input.id ?? "").trim();
    return wanted
      ? json<AiModel>(await llamaCppModel(base, provider.apiKey))
      : json<AiModel[]>(await llamaCppCatalog(base, provider.apiKey));
  }

  const wanted = (input.id ?? "").trim();
  return wanted
    ? json<AiModel>(await findCatalogModel(base, provider.apiKey, wanted))
    : json<AiModel[]>(await listCatalog(base, provider.apiKey));
}

/* ------------------------------------------------------------------ */
/* Pedirle algo a la IA sobre una pagina                                */
/* ------------------------------------------------------------------ */

/** Elementos senalados que se aceptan en una peticion. */
const MAX_PICKED = 8;

/** Lo que se acepta del HTML de un elemento senalado. */
const MAX_PICKED_HTML = 12_000;

/**
 * Lo senalado con el cursor, tal como puede usarse.
 *
 * Llega del navegador, asi que llega sin garantias: se recorta a lo que cabe
 * en un contexto y se queda solo con lo que tiene forma. Lo que venga mal se
 * descarta en silencio --señalar mal no puede tumbar una peticion-- y si no
 * queda nada, la peticion sigue sin elementos senalados.
 */
function pickedBlocks(raw: unknown): PickedBlock[] {
  if (!Array.isArray(raw)) return [];

  const out: PickedBlock[] = [];
  for (const item of raw.slice(0, MAX_PICKED)) {
    if (!item || typeof item !== "object") continue;
    const pick = item as Record<string, unknown>;

    const path = String(pick.path ?? "").trim();
    const html = String(pick.html ?? "");
    if (!path || !html.trim()) continue;

    const long = html.length > MAX_PICKED_HTML;
    out.push({
      id: String(pick.id ?? ""),
      name: String(pick.name ?? "").trim(),
      label:
        String(pick.label ?? "")
          .trim()
          .slice(0, 120) || "un elemento",
      path: path.slice(0, 300),
      html: long ? html.slice(0, MAX_PICKED_HTML) : html,
      // Recortado aqui, o ya recortado por el puente antes de mandarlo.
      truncated: long || pick.truncated === true,
    });
  }
  return out;
}

/** Cuantos archivos se aceptan adjuntos a una peticion. */
const MAX_AI_FILES = 8;

const AI_FILE_KINDS: AiFileKind[] = ["html", "css", "js", "json", "csv", "sheet", "text", "image"];

const isAiFileKind = (value: unknown): value is AiFileKind =>
  AI_FILE_KINDS.includes(String(value) as AiFileKind);

/**
 * Los adjuntos que nombra una peticion.
 *
 * Ya no llegan con el contenido dentro: llegan como referencias a lo que el
 * navegador subio al soltarlo. Aqui solo se comprueba que tengan forma y que la
 * referencia sea de esta aplicacion; lo que se le ensena al modelo de cada uno
 * lo decide el contexto (`server/aiPage.ts`).
 *
 * Una referencia que no existe se descarta en silencio: adjuntar mal no puede
 * tumbar una peticion, y la peticion sigue sin ese adjunto.
 */
async function aiFiles(appId: string, raw: unknown): Promise<AiChatFile[]> {
  if (!Array.isArray(raw)) return [];

  const out: AiChatFile[] = [];
  for (const item of raw.slice(0, MAX_AI_FILES)) {
    if (!item || typeof item !== "object") continue;
    const file = item as Record<string, unknown>;

    const ref = String(file.ref ?? "").trim();
    if (!ref || out.some((f) => f.ref === ref)) continue;

    const saved = await findAiFile(appId, ref);
    if (!saved) continue;

    out.push({
      ref: saved.id,
      // El nombre lo pone lo guardado, no lo que mande el navegador: es el
      // mismo que la conversacion recuerda y el que la IA va a nombrar.
      name: saved.name,
      kind: isAiFileKind(saved.kind) ? saved.kind : "text",
      size: saved.bytes,
    });
  }
  return out;
}

/**
 * Guarda un archivo adjunto y devuelve su referencia.
 *
 * La subida arranca al soltar el archivo, no al enviar la peticion: para cuando
 * se termina de escribir que hacer con el, el archivo ya esta guardado. Llega
 * como formulario porque puede ser binario --una imagen, una hoja de calculo--
 * y la clase la dice el navegador: una hoja de calculo sube ya convertida a
 * filas y columnas, asi que su nombre sigue diciendo `.xlsx` y su contenido ya
 * no lo es.
 */
export async function uploadAiFile(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);

  const form = await req.formData().catch(() => null);
  const file = form?.get("archivo");
  if (!form || !(file instanceof File)) {
    throw new HttpError(400, "No llegó ningún archivo.");
  }

  const kind = form.get("clase");
  if (!isAiFileKind(kind)) throw new HttpError(400, "No se sabe leer esa clase de archivo.");

  const name =
    String(form.get("nombre") ?? file.name)
      .trim()
      .slice(0, 200) || "adjunto";

  const saved = await saveAiFile(app.id, {
    name,
    kind,
    mime: String(form.get("tipo") ?? file.type ?? "").slice(0, 100),
    content: new Uint8Array(await file.arrayBuffer()),
  });

  return json<Omit<AiFile, "id">>({
    ref: saved.id,
    name: saved.name,
    kind,
    mime: saved.mime,
    size: saved.bytes,
  });
}

/**
 * El contenido de un adjunto, para poder abrir desde una burbuja lo que se
 * adjunto. Se sirve tal cual se guardo, sin recortar.
 */
export async function getAiFile(req: Request, appId: string, fileId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);

  const saved = await findAiFile(app.id, fileId);
  if (!saved) throw new HttpError(404, "Ese archivo ya no está guardado");

  const bytes = await readAiFileBytes(saved);
  return new Response(new Blob([bytes], { type: saved.mime || "application/octet-stream" }), {
    headers: {
      "content-type": saved.mime || "application/octet-stream",
      // Se abre, no se descarga: lo que se quiere es ver lo que se adjunto.
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(saved.name)}`,
      "cache-control": "private, max-age=300",
    },
  });
}

/**
 * Lo que ve una conexion enganchada a una peticion.
 *
 * Empieza contando a que peticion se engancho y repitiendo de golpe todo lo que
 * ya habia pasado --que es lo que hace util volver tras recargar-- y a partir de
 * ahi va soltando lo que llegue. Cerrar esta conexion no toca la peticion: la
 * peticion vive en el registro, no aqui.
 */
function runStream(run: AiRun): Response {
  const enc = new TextEncoder();
  let alive = true;
  let unwatch = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        unwatch();
        if (!alive) return;
        alive = false;
        try {
          controller.close();
        } catch {
          /* ya estaba cerrada */
        }
      };

      const send = (event: AiProgress) => {
        if (!alive) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // El navegador se fue. Se deja de escribir y la peticion sigue sola
          // hasta terminar: cortarla a mitad dejaria la pagina peor. Quien
          // vuelva se engancha otra vez y recibe lo que se perdio.
          alive = false;
          unwatch();
        }
      };

      send({ tipo: "inicio", runId: run.id });
      for (const event of replayRun(run)) send(event);

      if (run.done || !alive) {
        close();
        return;
      }

      unwatch = watchRun(run, (event) => {
        send(event);
        if (event.tipo === "fin" || event.tipo === "error") close();
      });
    },
    cancel() {
      // Se fue quien miraba, no la peticion.
      alive = false;
      unwatch();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

/**
 * Hace la peticion de verdad y la va contando al registro.
 *
 * No se espera a que termine para responder: quien la pidio recibe el hilo de
 * avisos, y esto sigue por su cuenta aunque ese hilo se corte.
 */
async function executeRun(
  run: AiRun,
  opts: {
    app: AppRecord;
    page: PageRecord;
    authorId: string;
    picked: PickedBlock[];
    files: AiChatFile[];
    chatId?: string;
    choice?: Partial<AiChoice>;
    debug?: boolean;
  },
): Promise<void> {
  try {
    /*
     * Lo que ya se hablo en esta conversacion. De aqui salen dos cosas: los
     * ultimos turnos que se le ponen delante al modelo, y los adjuntos de esos
     * turnos, que siguen estando mientras la conversacion siga abierta. Sin
     * conversacion todavia --la primera peticion-- no hay nada que traer.
     */
    const before = opts.chatId ? await getChat(opts.app.id, opts.chatId).catch(() => null) : null;

    const result = await runPageRequest({
      app: opts.app,
      page: opts.page,
      prompt: run.prompt,
      authorId: opts.authorId,
      picked: opts.picked,
      files: opts.files,
      history: before?.messages ?? [],
      choice: opts.choice,
      signal: run.stop.signal,
      debug: opts.debug,
      onProgress: (event) => pushRun(run, event),
    });

    // Se guarda tambien lo que se detuvo a medias: es lo que paso, y quien
    // vuelva a la conversacion tiene que poder leerlo.
    const chat = await appendToChat({
      appId: opts.app.id,
      chatId: opts.chatId,
      page: opts.page,
      authorId: opts.authorId,
      messages: [
        {
          from: "yo",
          text: run.prompt,
          // Con que se pidio. De los archivos, su referencia guardada: es lo
          // que hace que la IA los siga teniendo delante en los turnos
          // siguientes, y lo que decide cuanto viven. De lo senalado solo el
          // nombre: su HTML ya viajo, y para depurar esta el registro.
          ...(opts.files.length ? { files: opts.files } : {}),
          ...(opts.picked.length ? { picked: opts.picked.map((p) => p.label) } : {}),
        },
        {
          from: "ia",
          text: result.message,
          steps: result.steps,
          // La pregunta se guarda con el mensaje: al volver a la conversacion
          // se lee que se pregunto, no solo lo que se construyo despues.
          ...(result.question ? { question: result.question } : {}),
          ...(result.reasoning ? { reasoning: result.reasoning } : {}),
        },
      ],
    });

    pushRun(run, { tipo: "fin", resultado: { ...result, chatId: chat.id } });
  } catch (err) {
    pushRun(run, {
      tipo: "error",
      mensaje: err instanceof HttpError ? err.message : "No se pudo completar la petición.",
    });
  }
}

/**
 * Una peticion sobre la pagina abierta.
 *
 * Es la unica entrada a la IA: lo que se escribe en la barra llega aqui. La
 * peticion y la respuesta quedan en una conversacion de la aplicacion, que
 * recuerda desde que pagina se hizo.
 *
 * Se entrega a medida que se produce, en vez de esperar a tenerlo todo. Lo que
 * llega antes del final es para mirar: el texto segun se escribe y los pasos
 * segun se dan. El resultado de verdad llega una sola vez, en `fin`.
 */
export async function askPage(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const page = await pageOf(app.id, pageId);
  const input = await body<{
    prompt?: string;
    chatId?: string;
    picked?: unknown;
    /** Los archivos que se adjuntaron, como referencias a lo ya guardado. */
    files?: unknown;
    /** Con que quiere que se atienda. Lo que no exista se cae en lo de por defecto. */
    choice?: Partial<AiChoice>;
    /** Quiere ver el contexto que se le manda al modelo en cada ronda. */
    debug?: boolean;
  }>(req);

  const prompt = (input.prompt ?? "").trim();
  if (prompt.length < 3) throw new HttpError(400, "Escribe qué necesitas.");
  if (prompt.length > 4000) throw new HttpError(400, "La petición es demasiado larga.");

  // Dos peticiones a la vez escribirian sobre el mismo documento. Quien tenga
  // otra pestana abierta se engancha a la que ya esta en marcha, no abre otra.
  const current = pageRun(app.id, page.id);
  if (current && !current.done) {
    throw new HttpError(409, "Ya hay una petición en marcha en esta página.");
  }

  const picked = pickedBlocks(input.picked);
  const files = await aiFiles(app.id, input.files);
  const chatId = typeof input.chatId === "string" ? input.chatId : undefined;

  const run = startRun({ appId: app.id, pageId: page.id, prompt });
  void executeRun(run, {
    app,
    page,
    authorId: me.id,
    picked,
    files,
    chatId,
    choice: input.choice,
    debug: input.debug === true,
  });

  return runStream(run);
}

/**
 * Si esta pagina tiene una peticion esperando. Es lo primero que pregunta el
 * panel al abrirse: asi recargar no pierde lo que la IA estaba haciendo.
 */
export async function getPageRun(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const run = pageRun(app.id, pageId);
  return json<AiRunInfo | null>(run ? runInfo(run) : null);
}

/**
 * En que paginas de la aplicacion esta trabajando la IA ahora mismo.
 *
 * Es la fuente de verdad de la senal: se pregunta al entrar en la aplicacion,
 * y de ahi en adelante la mantiene al dia el hilo de avisos de cada peticion.
 * Tambien es lo que apaga la senal cuando el servidor se reinicia: si no hay
 * peticiones, no hay nada que decir.
 */
export async function listAppRuns(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  return json<AiActiveRun[]>(activeRuns(app.id));
}

/** Volver a engancharse a la peticion de esta pagina, con todo lo que ya paso. */
export async function followPageRun(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const run = pageRun(app.id, pageId);
  if (!run) throw new HttpError(404, "Esa petición ya no está en marcha.");
  return runStream(run);
}

/**
 * Detener la peticion de esta pagina.
 *
 * No responde con el resultado: la peticion corta por el primer sitio seguro y
 * el final llega por donde llegan todos, el hilo de avisos.
 */
export async function stopPageRun(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const run = pageRun(app.id, pageId);
  if (!run || run.done) throw new HttpError(404, "Esa petición ya no está en marcha.");
  run.stop.abort();
  return json({ ok: true });
}

/**
 * El panel termino de probar una pagina y trae lo que solto la consola.
 *
 * Es la respuesta al aviso `probar`, y el unico sitio donde algo entra desde el
 * navegador a mitad de una peticion de la IA. Se comprueba que quien contesta
 * sea el dueno de la aplicacion: los fallos de una pagina cuentan por dentro
 * como esta escrita.
 *
 * Una respuesta que llega tarde --la espera ya vencio-- se acepta sin hacer
 * nada. No es un error de quien la manda: es que la IA ya siguio sin ella.
 */
export async function reportPageProbe(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  await pageOf(app.id, pageId);
  const input = await body<{ probeId?: string; issues?: unknown; warnings?: unknown }>(req);

  const probeId = String(input.probeId ?? "");
  if (!probeId) throw new HttpError(400, "Falta decir que prueba se contesta.");

  const taken = closeProbe({
    probeId,
    issues: pageIssues(input.issues),
    warnings: Array.isArray(input.warnings)
      ? input.warnings.slice(0, 20).map((w) => String(w).slice(0, 500))
      : [],
  });
  return json({ ok: true, recogido: taken });
}

/** Lo que llega del navegador, recortado a lo que la IA puede leer. */
function pageIssues(raw: unknown): PageIssue[] {
  if (!Array.isArray(raw)) return [];
  const types = new Set(["js", "promesa", "recurso", "consola"]);
  const out: PageIssue[] = [];
  for (const item of raw.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const one = item as Record<string, unknown>;
    const tipo = String(one.tipo ?? "");
    if (!types.has(tipo)) continue;
    const mensaje = String(one.mensaje ?? "").slice(0, 1000);
    if (!mensaje) continue;
    out.push({
      tipo: tipo as PageIssue["tipo"],
      mensaje,
      ...(Number.isFinite(one.linea) ? { linea: Number(one.linea) } : {}),
      ...(Number.isFinite(one.columna) ? { columna: Number(one.columna) } : {}),
      ...(one.pila ? { pila: String(one.pila).slice(0, 2000) } : {}),
    });
  }
  return out;
}

/**
 * Las conversaciones de una pagina. La pagina no es opcional: una conversacion
 * es de la pagina donde se hizo, asi que no hay lista "de la aplicacion".
 */
/**
 * La constancia de la ultima peticion de una pagina.
 *
 * Se lee donde ya se leia el contexto --el despliegue de la conversacion-- asi
 * que recargar deja de perderlo. Solo la ve quien construye la aplicacion.
 */
export async function getAiDebug(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  // No se comprueba que la pagina siga existiendo: la constancia se busca por
  // aplicacion y pagina a la vez, asi que una pagina de otra aplicacion no
  // devuelve nada, y una que ya se borro tampoco --se fue con ella--. Poder
  // preguntar por una pagina borrada es lo que deja comprobar esa cascada.
  return json<AiDebugRead>(await readAiDebug(app.id, pageId));
}

/**
 * Borra todas las constancias de la instalacion.
 *
 * Es de instalacion y no de una aplicacion, por eso vive en los ajustes
 * generales. No toca conversaciones ni paginas.
 */
export async function clearAiDebugAll(req: Request) {
  await requireBuilder(req);
  const removed = await clearAiDebug();
  return json({ ok: true, removed });
}

export async function listAiChats(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const pageId = new URL(req.url).searchParams.get("pagina") ?? "";
  if (!pageId) throw new HttpError(400, "Falta decir de qué página.");
  return json<AiChatSummary[]>(await listChats(app.id, pageId));
}

export async function getAiChat(req: Request, appId: string, chatId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  return json<AiChat>(await getChat(app.id, chatId));
}

/**
 * La conversacion que quedo abierta en la aplicacion, sea de la pagina que sea.
 *
 * Hay una sola: es lo que el panel repone al llegar a su pagina, y lo que hace
 * que las demas paginas empiecen en blanco en vez de desenterrar cada una la
 * suya. Nada si ya no hay ninguna.
 */
export async function getOpenAiChat(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  return json<AiOpenChat | null>(await readOpenChat(app));
}

/**
 * Decir cual queda abierta. Sin `chatId`, ninguna.
 *
 * Lo escribe el panel cuando quien construye lo decide --empezar una
 * conversacion nueva, abrir una de la lista--. Pedirle algo a la IA no pasa por
 * aqui: eso lo apunta el servidor al guardar la conversacion.
 */
export async function putOpenAiChat(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const { chatId = "" } = await body<{ chatId?: string }>(req);
  // Solo una conversacion de esta aplicacion puede quedar abierta en ella.
  if (chatId) await getChat(app.id, chatId);
  await setOpenChat(app.id, chatId);
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* El dialogo de impacto                                                */
/* ------------------------------------------------------------------ */

/**
 * Lo que se decidio en el dialogo.
 *
 * Todos los cambios de una peticion se aplican aqui, juntos, despues de una
 * sola decision. Antes de tocar nada se deja un punto en los cambios: la
 * tabla y las paginas que se toquen vuelven a la vez.
 */
export async function resolveImpact(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{ choice?: string; changes?: unknown }>(req);

  const before = await draftOf(app.id);
  const changes = readChanges(input.changes, before.tables);
  if (!changes.length) throw new HttpError(400, "No quedó ningún cambio que aplicar");
  const choice = readChoice(input.choice);

  if (choice === "no_tocar") {
    return json<ImpactResult>({
      message: "La base de datos se quedó como estaba.",
      steps: [],
      fixed: [],
    });
  }

  const affected = pagesForChanges(before.pages, changes);

  // Un solo paso para todo lo que se acepto en este dialogo.
  await saveVersion({
    app,
    pages: before.pages,
    tables: before.tables,
    kind: "manual",
    label: `Antes de: ${changes.map((c) => c.what).join("; ")}`.slice(0, 120),
    authorId: me.id,
  })
    .then(() => pruneVersions(app.id, app.liveVersion ?? ""))
    .catch(() => null);

  const steps: AiStep[] = [];
  for (const change of changes) {
    // Cada cambio lee la tabla como quedo tras el anterior: dos cambios
    // seguidos sobre la misma tabla no se pisan.
    const table = await firstRecord<TableRecord>(
      INTERNAL.tables,
      `id = "${quote(change.tableId)}"`,
    );
    if (!table) continue;
    const summary = await applyChange({ table, change, harmless: choice === "conservar" });
    steps.push({ tool: change.kind, summary, ok: true });
  }

  const fixed: string[] = [];
  if (choice === "aplicar_y_arreglar") {
    const tables = await appTables(app.id);
    const pages = await appPages(app.id);
    for (const target of affected) {
      const page = pages.find((p) => p.id === target.id);
      if (!page) continue;
      const ok = await fixPage({ app, page, tables, changes }).catch(() => false);
      if (ok) fixed.push(page.name);
      steps.push({
        tool: "arreglar_pagina",
        summary: ok
          ? `Se reescribio "${page.name}" con las tablas tal como quedaron.`
          : `No se pudo reescribir "${page.name}".`,
        ok,
      });
    }
  }

  // Solo se anade lo que los pasos no cuentan ya: que las paginas afectadas se
  // quedaron sin tocar, que es justo lo que esa salida decidio.
  const tail =
    choice === "aplicar" && affected.length
      ? ` ${affected.length === 1 ? "La página" : "Las páginas"} ${affected
          .map((p) => `"${p.name}"`)
          .join(", ")} ${affected.length === 1 ? "quedó" : "quedaron"} como estaba${
          affected.length === 1 ? "" : "n"
        }.`
      : "";

  return json<ImpactResult>({
    message: `${steps.map((s) => s.summary).join(" ")}${tail}`.trim(),
    steps,
    fixed,
  });
}

/**
 * Aplica un cambio de acceso que la IA dejo apuntado y quien construye
 * autorizo.
 *
 * Va por su lado y no por `resolveImpact`: no hay tabla que tocar, ni paginas
 * que arreglar, ni cuatro salidas entre las que elegir. Lo unico que se
 * comparte es el punto al que volver, que se deja antes de escribir nada.
 *
 * Solo llegan aqui los que dan acceso: los que lo quitan ya se aplicaron
 * cuando se pidieron. Se comprueba igual, porque lo que decide es el servidor
 * y no lo que venga en la peticion.
 */
export async function resolveAccess(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{ change?: unknown }>(req);

  const raw = (input.change ?? {}) as Partial<AccessChange>;
  const personId = String(raw.personId ?? "").trim();
  const roles = raw.roles !== undefined ? sanitizeRoles(raw.roles, app.roles ?? []) : undefined;
  // Mismo cuidado que en la herramienta: nombrar roles y que no quede ninguno
  // es que esos roles no existen, no que haya que dejarla sin ninguno.
  if (Array.isArray(raw.roles) && raw.roles.length && !roles?.length) {
    throw new HttpError(400, "Esos roles ya no existen en esta aplicación");
  }
  if (!personId || !roles) throw new HttpError(400, "No llegó ningún cambio que aplicar");

  const person = await personOf(app.id, personId);
  if (!person) throw new HttpError(404, "Esa persona no está invitada a esta aplicación");

  // Un punto al que volver antes de tocar el enlace, como en cualquier otro
  // cambio autorizado. Lo que se guarda son las paginas y las tablas: el
  // acceso se restaura desde la pantalla de personas.
  const before = await draftOf(app.id);
  await saveVersion({
    app,
    pages: before.pages,
    tables: before.tables,
    kind: "manual",
    label: `Antes de dar acceso a ${person.name || person.email}`.slice(0, 120),
    authorId: me.id,
  })
    .then(() => pruneVersions(app.id, app.liveVersion ?? ""))
    .catch(() => null);

  const after = await setPersonAccess({
    appId: app.id,
    memberId: personId,
    roles,
    appRoles: app.roles ?? [],
  });

  const said = String(raw.consequence ?? "").trim();
  return json<ImpactResult>({
    message: said || `Se cambió el acceso de ${after.name || after.email}.`,
    steps: [{ tool: "cambiar_acceso", summary: said, ok: true }],
    fixed: [],
  });
}

/**
 * Para que usa una pagina lo que se va a cambiar. Se consulta solo cuando
 * quien construye lo pide: el dialogo tiene que abrirse sin espera.
 */
export async function impactDetail(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{ pageId?: string; what?: string }>(req);

  const page = await pageOf(app.id, String(input.pageId ?? ""));
  const text = await explainPageUse({ app, page, what: String(input.what ?? "") });
  return json({ text });
}

/* ------------------------------------------------------------------ */
/* Historial de versiones                                               */
/* ------------------------------------------------------------------ */

/** El diseno tal como esta ahora mismo en el editor. */
async function draftOf(appId: string): Promise<{ pages: PageRecord[]; tables: TableRecord[] }> {
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

/** Nombres de los constructores que firman las versiones. */
async function authorNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const filter = unique.map((id) => `id = "${quote(id)}"`).join(" || ");
  const res = await listRecords<{ id: string; name?: string; email?: string }>(INTERNAL.builders, {
    filter,
    perPage: 200,
    skipTotal: 1,
  });
  return new Map(
    res.items.map((b) => [b.id, b.name || (b.email ?? "").split("@")[0] || "Alguien"]),
  );
}

function toSummary(
  version: AppVersion,
  names: Map<string, string>,
  liveVersion: string,
): AppVersionSummary {
  const { snapshot, ...rest } = version;
  return {
    ...rest,
    authorName: names.get(version.author) ?? "Alguien",
    live: version.id === liveVersion,
    legacy: isLegacySnapshot(snapshot),
  };
}

export async function listAppVersions(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);

  const [versions, { pages, tables }] = await Promise.all([listVersions(app.id), draftOf(app.id)]);
  const names = await authorNames(versions.map((v) => v.author));
  const draftHash = hashSnapshot(buildSnapshot(app, pages, tables));
  const live = versions.find((v) => v.id === app.liveVersion);

  return json<VersionsView>({
    versions: versions.map((v) => toSummary(v, names, app.liveVersion ?? "")),
    draftHash,
    hasChanges: !live || live.hash !== draftHash,
    liveVersion: app.liveVersion ?? "",
  });
}

/** Publica: guarda la fotografia del borrador y la pone en vivo. */
export async function publishApp(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{ label?: string }>(req).catch(() => ({}) as { label?: string });

  const { pages, tables } = await draftOf(app.id);
  const live = app.liveVersion ? await getVersion(app.id, app.liveVersion).catch(() => null) : null;

  const { version } = await saveVersion({
    app,
    pages,
    tables,
    kind: "publish",
    label: input.label,
    authorId: me.id,
    liveHash: live?.hash,
  });

  const updated = await updateRecord<AppRecord>(INTERNAL.apps, app.id, {
    published: true,
    liveVersion: version.id,
  });
  await pruneVersions(app.id, version.id);
  await pruneDocs(app.id, pages);

  const names = await authorNames([version.author]);
  return json({ app: updated, version: toSummary(version, names, version.id) });
}

/** Punto de guardado manual: entra al historial pero no sale al publico. */
export async function createAppVersion(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{ label?: string }>(req).catch(() => ({}) as { label?: string });

  const { pages, tables } = await draftOf(app.id);
  const { version } = await saveVersion({
    app,
    pages,
    tables,
    kind: "manual",
    label: input.label || "Punto de guardado",
    authorId: me.id,
  });
  await pruneVersions(app.id, app.liveVersion ?? version.id);
  // Aqui no se recortan documentos a proposito. Un punto de guardado se crea
  // en mitad del trabajo (la varita magica crea uno antes de empezar), y en
  // ese momento el documento recien importado todavia no lo nombra nadie:
  // recortarlo se llevaria por delante justo lo que se esta editando.

  const names = await authorNames([version.author]);
  return json(toSummary(version, names, app.liveVersion ?? ""), 201);
}

export async function updateAppVersion(req: Request, appId: string, versionId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const version = await getVersion(app.id, versionId);
  const input = await body<{ label?: string; pinned?: boolean }>(req);

  const patch: Record<string, unknown> = {};
  if (typeof input.label === "string") patch.label = input.label.trim().slice(0, 120);
  if (typeof input.pinned === "boolean") patch.pinned = input.pinned;

  const updated = await updateRecord<AppVersion>(INTERNAL.versions, version.id, patch);
  const names = await authorNames([updated.author]);
  return json(toSummary(updated, names, app.liveVersion ?? ""));
}

export async function deleteAppVersion(req: Request, appId: string, versionId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  if (app.liveVersion === versionId) {
    throw new HttpError(400, "No se puede borrar la versión que está publicada");
  }
  await getVersion(app.id, versionId);
  await deleteRecord(INTERNAL.versions, versionId);

  // Esa version podia ser la ultima que nombraba algun documento HTML.
  const { pages } = await draftOf(app.id);
  await pruneDocs(app.id, pages);
  return json({ ok: true });
}

/**
 * Restaura al borrador. No publica nada: antes de tocar el borrador guarda
 * un punto con lo que habia, para que la vuelta atras tambien sea reversible.
 */
export async function restoreAppVersion(req: Request, appId: string, versionId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const version = await getVersion(app.id, versionId);
  const input = await body<{ confirmado?: boolean }>(req).catch(
    () => ({}) as { confirmado?: boolean },
  );

  const before = await draftOf(app.id);

  // Guarda paginas de bloques: se puede mirar, no volcar sobre el borrador.
  if (isLegacySnapshot(version.snapshot)) {
    throw new HttpError(
      400,
      `La versión ${version.number} guarda páginas de antes de que una página fuera un documento HTML. Se puede mirar, pero no volver a ella.`,
    );
  }

  // La estructura pudo cambiar desde entonces, y restaurar no devuelve
  // columnas: se avisa antes, con la lista de lo que ya no existe.
  const drift = structureDrift(version.snapshot, before.tables);
  if (drift.length && input.confirmado !== true) {
    return json({
      needsConfirm: true,
      aviso: `Desde la versión ${version.number} cambió la estructura de tablas: ya no existe ${drift.join(
        ", ",
      )}. Volver a esa versión no la devuelve, así que las páginas que la usaban van a fallar al pedirla.`,
    });
  }

  await saveVersion({
    app,
    pages: before.pages,
    tables: before.tables,
    kind: "manual",
    label: `Antes de volver a la versión ${version.number}`,
    authorId: me.id,
  });

  await restoreSnapshot(app, version.snapshot, before.tables, before.pages);
  await pruneVersions(app.id, app.liveVersion ?? versionId);

  const after = await draftOf(app.id);
  await pruneDocs(app.id, after.pages);
  return json({ ok: true });
}

/** Vista previa: `borrador` o el id de una version. Solo para el dueno. */
export async function previewBundle(req: Request, appId: string, source: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const live = await draftOf(app.id);

  const snapshot = source === "borrador" ? null : (await getVersion(app.id, source)).snapshot;
  const design = snapshot ? designFromSnapshot(app.id, snapshot, live.tables) : live;

  const bundle: AppBundle = {
    app: {
      id: app.id,
      name: snapshot?.name ?? app.name,
      slug: app.slug,
      icon: snapshot?.icon ?? app.icon,
      visibility: app.visibility,
      published: app.published,
      theme: snapshot ? snapshot.theme : (app.theme ?? null),
    },
    pages: design.pages,
    tables: design.tables,
    // El constructor lo ve todo, asi que en la vista previa el HTML de una
    // pagina recibe todos los roles de la app.
    roles: app.roles ?? [],
  };
  return json(bundle);
}

/* ------------------------------------------------------------------ */
/* Documentos HTML sueltos                                              */
/* ------------------------------------------------------------------ */

/**
 * Sirve un documento envuelto con el puente.
 *
 * Lo que se guarda no cambia nunca, pero lo que se sirve tambien lleva el
 * puente, y ese si cambia. Por eso la marca junta las dos huellas y se
 * revalida en vez de guardarse para siempre: asi una correccion del puente
 * llega a todos los documentos, y el cuerpo solo viaja cuando de verdad cambio.
 */
function htmlResponse(req: Request, content: string, hash: string): Response {
  const tag = `"${hash}-${BRIDGE_TAG}"`;
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-cache",
    etag: tag,
  };
  if (req.headers.get("if-none-match") === tag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(wrapDocument(content, new URL(req.url).origin), { headers });
}

export async function getHtmlDoc(req: Request, appId: string, hash: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const content = await requireDoc(app.id, hash);
  return htmlResponse(req, content, hash);
}

/** El texto que se copia para pegarlo en un chat de inteligencia artificial. */
export async function htmlContract(req: Request, appId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const input = await body<{ tableIds?: string[]; request?: string }>(req).catch(
    () => ({}) as { tableIds?: string[]; request?: string },
  );

  const { tables } = await draftOf(app.id);
  const wanted = Array.isArray(input.tableIds) ? input.tableIds : [];
  const chosen = tables.filter((t) => wanted.includes(t.id));

  return json({
    text: buildHtmlContract({
      appName: app.name,
      tables: chosen,
      appRoles: app.roles,
      request: typeof input.request === "string" ? input.request : undefined,
    }),
  });
}

/* ------------------------------------------------------------------ */
/* El HTML de una pagina                                                */
/* ------------------------------------------------------------------ */

/** Una pagina de una aplicacion, comprobando que sea de esa aplicacion. */
async function pageOf(appId: string, pageId: string): Promise<PageRecord> {
  const page = await firstRecord<PageRecord>(
    INTERNAL.pages,
    `id = "${quote(pageId)}" && app = "${quote(appId)}"`,
  );
  if (!page) throw new HttpError(404, "Esa página no existe");
  return page;
}

/** Se queda con la forma buena de cada fuente y descarta lo demas. */
function sanitizeSources(value: unknown): HtmlSource[] {
  if (!Array.isArray(value)) return [];
  const out: HtmlSource[] = [];
  for (const item of value) {
    const source = item as Partial<HtmlSource>;
    if (typeof source?.name !== "string" || !source.name) continue;
    if (typeof source.tableId !== "string" || !source.tableId) continue;
    const fields: Record<string, string> = {};
    for (const [name, id] of Object.entries(source.fields ?? {})) {
      if (typeof id === "string" && id) fields[name] = id;
    }
    out.push({ name: source.name, tableId: source.tableId, fields });
  }
  return out;
}

/** El documento de una pagina que todavia no tiene HTML. */
const NO_DOC = () => new HttpError(404, "Esta página todavía no tiene HTML");

/** Una pagina servida tal como se dibuja, con sus dos referencias dentro. */
function pageResponse(req: Request, content: string, hash: string): Response {
  const tag = `"${hash}-${ASSETS_TAG}"`;
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-cache",
    etag: tag,
  };
  if (req.headers.get("if-none-match") === tag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(wrapPage(content, new URL(req.url).origin), { headers });
}

/** El HTML de una pagina, listo para dibujarse. */
export async function getPageHtml(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const page = await pageOf(app.id, pageId);
  if (!page.doc) throw NO_DOC();
  const content = await requireDoc(app.id, page.doc);
  return pageResponse(req, content, page.doc);
}

/**
 * El HTML que una pagina tenia cuando se guardo esa huella.
 *
 * La vista previa de una version no puede pedir por pagina: lo que la pagina
 * tiene ahora es el borrador, y mirar una version es mirar lo de entonces. La
 * fotografia guarda la huella, asi que se pide por ella y se sirve igual que
 * la pagina --con las dos referencias dentro--, no como un documento suelto.
 */
export async function getPageHtmlAt(req: Request, appId: string, pageId: string, hash: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  await pageOf(app.id, pageId);
  const content = await requireDoc(app.id, hash);
  return pageResponse(req, content, hash);
}

/**
 * El HTML tal como se guardo, sin el puente ni la hoja base: es lo que edita
 * el constructor. Si se le sirviera lo envuelto, la inyeccion entraria en el
 * documento al guardar y se duplicaria en cada vuelta.
 */
export async function getRawPageHtml(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const page = await pageOf(app.id, pageId);
  if (!page.doc) throw NO_DOC();
  const content = await requireDoc(app.id, page.doc);
  return new Response(content, { headers: { "content-type": "text/html; charset=utf-8" } });
}

/**
 * Guarda el HTML de una pagina y, si vienen, las tablas que declara.
 *
 * Lo que llega pasa antes por la reposicion de las dos referencias: si al
 * documento le falta alguna se le pone, y se devuelve constancia de cuales
 * para que el panel lo avise en vez de cambiarlo a escondidas. El tope de
 * tamano es el mismo que el de cualquier otro documento.
 */
export async function savePageHtml(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const page = await pageOf(app.id, pageId);
  const input = await body<{ content?: string; sources?: unknown }>(req);

  const raw = typeof input.content === "string" ? input.content : "";
  if (!raw.trim()) throw new HttpError(400, "No llego ningun contenido");

  const { doc, restored, sources } = await writePageDoc({
    app,
    page,
    html: raw,
    sources: input.sources === undefined ? undefined : sanitizeSources(input.sources),
  });

  return json({
    doc,
    sources,
    repuesto: restored,
    aviso: restored.length
      ? `Le faltaba ${restored.map((r) => REF_NAMES[r]).join(" y ")}; se ${
          restored.length > 1 ? "volvieron" : "volvio"
        } a anadir.`
      : "",
  });
}

/**
 * El HTML equivalente a los bloques de una pagina, propuesto por la IA.
 *
 * No guarda nada: devuelve el documento y las tablas que declararia, mas una
 * version envuelta para poder verla dibujada. Reemplazar la pagina es guardar
 * ese HTML por la ruta de siempre, y eso lo decide quien construye.
 */
export async function convertPage(req: Request, appId: string, pageId: string) {
  const me = await requireBuilder(req);
  const app = await ownedApp(appId, me);
  const page = await pageOf(app.id, pageId);
  const { tables } = await draftOf(app.id);

  const result = await convertPageToHtml({ app, page, tables });
  return json({ ...result, vista: wrapPage(result.html, new URL(req.url).origin) });
}

/**
 * El HTML de una pagina de una app publicada, con el nivel de acceso de la
 * pagina aplicado aqui: a quien no le corresponde no le llega el contenido,
 * aunque pida la ruta a mano.
 */
export async function getPublicPageHtml(req: Request, slug: string, pageId: string) {
  const app = await publishedApp(slug);
  const access = await publicAccess(req, app);
  if (access.requiresAuth) throw new HttpError(401, "Identifícate para continuar");

  const design = await publishedDesign(app);
  const page = design.pages.find((p) => p.id === pageId);
  if (!page) throw new HttpError(404, "Esa página no existe");

  const viewer = access.signed ? { roles: access.mine } : null;
  if (!canOpenPage(page, viewer)) {
    throw pageDenial(page, viewer) === "auth"
      ? new HttpError(401, "Identifícate para continuar")
      : new HttpError(403, "Tu cuenta no puede abrir esta página");
  }

  if (!page.doc) throw NO_DOC();
  const content = await requireDoc(app.id, page.doc);
  return pageResponse(req, content, page.doc);
}

/* ------------------------------------------------------------------ */
/* App publicada                                                        */
/* ------------------------------------------------------------------ */

/** La app de un enlace publico, comprobando que este publicada. */
async function publishedApp(slug: string): Promise<AppRecord> {
  const app = await firstRecord<AppRecord>(INTERNAL.apps, `slug = "${quote(slug)}"`);
  if (!app) throw new HttpError(404, "Esta aplicación no existe");
  if (!app.published) throw new HttpError(404, "Esta aplicación todavía no está publicada");
  return app;
}

/**
 * Quien esta pidiendo una app publicada y que roles trae.
 * En una app privada sin sesion no lanza: devuelve `requiresAuth` para que
 * cada ruta decida como contarlo.
 */
async function publicAccess(
  req: Request,
  app: AppRecord,
): Promise<{ requiresAuth: true } | { requiresAuth: false; mine: string[]; signed: boolean }> {
  const member = await optionalMember(req);
  const access = member
    ? await firstRecord<{ roles?: string[] }>(
        INTERNAL.access,
        `app = "${quote(app.id)}" && member = "${quote(member.id)}"`,
      )
    : null;

  if (app.visibility === "private") {
    if (!member) return { requiresAuth: true };
    if (!access) throw new HttpError(403, "Tu cuenta no tiene acceso a esta aplicación");
  }

  return {
    requiresAuth: false,
    mine: Array.isArray(access?.roles) ? access.roles : [],
    signed: !!member,
  };
}

/**
 * El diseno que sale al publico: la version publicada, no lo que se esta
 * editando. Una app publicada antes de que existiera el historial no tiene
 * ninguna, y hasta su primera publicacion sigue sirviendo el estado vivo.
 *
 * Las tablas siempre son las de verdad: la version solo manda sobre como se
 * presentan, nunca sobre que columnas existen.
 */
async function publishedDesign(
  app: AppRecord,
): Promise<{ pages: PageRecord[]; tables: TableRecord[] }> {
  const version = app.liveVersion
    ? await getVersion(app.id, app.liveVersion).catch(() => null)
    : null;
  const snapshot = version?.snapshot ?? null;
  const live = await draftOf(app.id);
  return snapshot ? designFromSnapshot(app.id, snapshot, live.tables) : live;
}

export async function publicBundle(req: Request, slug: string) {
  const app = await publishedApp(slug);

  const version = app.liveVersion
    ? await getVersion(app.id, app.liveVersion).catch(() => null)
    : null;
  const snapshot = version?.snapshot ?? null;

  const brand = {
    id: app.id,
    name: snapshot?.name ?? app.name,
    slug: app.slug,
    icon: snapshot?.icon ?? app.icon,
    visibility: app.visibility,
    published: app.published,
    theme: snapshot ? snapshot.theme : (app.theme ?? null),
  };

  const access = await publicAccess(req, app);
  if (access.requiresAuth) return json({ requiresAuth: true, app: brand });
  const mine = access.mine;
  const viewer = access.signed ? { roles: mine } : null;

  const design = await publishedDesign(app);

  // El filtro se hace aqui: al navegador nunca le llega una pagina que esa
  // persona no pueda abrir. El contenido tampoco: el HTML se pide por su
  // pagina, y esa ruta vuelve a comprobar el permiso.
  const visiblePages = design.pages.filter((page) => canOpenPage(page, viewer));

  const bundle: AppBundle = {
    app: brand,
    pages: visiblePages,
    tables: design.tables,
    roles: mine,
  };
  return json(bundle);
}

/**
 * Para la app publicada: nombres de las personas invitadas, para poder
 * mostrar las columnas de tipo persona. De los demas no sale nada mas que
 * nombre, correo, nivel y roles: sus columnas propias de la tabla de personas
 * no viajan por aqui aunque `peopleOf` las traiga, porque este punto no sabe
 * que pagina pregunta y por tanto no sabe que declaro. Solo las ordenes de una
 * pagina --que si lo saben-- las entregan. Ver `shared/htmlSources.ts` y el
 * "open question" resuelto en `openspec/changes/personas-como-tabla/design.md`.
 *
 * La excepcion es la fila de quien pregunta, que se entrega entera: no es dato
 * de nadie mas, y es de donde sale su nombre.
 */
export async function publicPeople(req: Request, slug: string) {
  const app = await firstRecord<AppRecord>(INTERNAL.apps, `slug = "${quote(slug)}"`);
  if (!app) throw new HttpError(404, "Esta aplicación no existe");
  if (!app.published) throw new HttpError(404, "Esta aplicación todavía no está publicada");

  const member = await optionalMember(req);
  if (!member) {
    if (app.visibility === "private") throw new HttpError(401, "Identifícate para continuar");
    return json<AppPerson[]>([]);
  }

  const access = await firstRecord(
    INTERNAL.access,
    `app = "${quote(app.id)}" && member = "${quote(member.id)}"`,
  );
  // En una app abierta, traer una sesion de otra aplicacion no puede dejar a
  // nadie peor que entrar sin ninguna: si sin sesion se responde la lista
  // vacia, con una sesion ajena tambien. Solo la app privada exige invitacion.
  if (!access) {
    if (app.visibility === "private")
      throw new HttpError(403, "Tu cuenta no tiene acceso a esta aplicación");
    return json<AppPerson[]>([]);
  }

  /*
   * Las columnas propias de los demas no viajan. Las de quien pregunta si: son
   * suyas, y son las que dicen como se llama --la cuenta solo guarda el correo
   * sin el dominio--. Sin ellas una pagina publicada no puede saludar a nadie
   * por su nombre. Ver `personDisplayName` y `viewer` en `HtmlFrame.svelte`.
   */
  const people = await peopleOf(app.id);
  return json(
    people.map(({ campos, ...rest }) => (rest.id === member.id ? { ...rest, campos } : rest)),
  );
}

/**
 * Las cinco ordenes de datos de una pagina. Vale igual para la pagina publicada
 * y para la vista previa del constructor: el mismo camino, para que lo que se
 * prueba sea lo que ocurre.
 */
export function pageData(req: Request, appId: string, pageId: string) {
  return runPageData(req, appId, pageId);
}

/* ------------------------------------------------------------------ */
/* Errores                                                              */
/* ------------------------------------------------------------------ */

export function toResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json(
      err.code ? { error: err.message, codigo: err.code } : { error: err.message },
      err.status,
    );
  }
  // Una fuente que el documento no declaro, o una orden mal formada: es culpa
  // del documento, no del servidor, y el mensaje va tal cual al puente.
  if (isSourceError(err)) return json({ error: err.message }, 400);
  if (err instanceof SchemaError) return json({ error: err.message }, err.status);
  if (err instanceof PbError) return json({ error: err.message, data: err.data }, err.status);
  console.error(err);
  return json({ error: "Error inesperado en el servidor" }, 500);
}
