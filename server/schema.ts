/**
 * Traduce las tablas que arma el usuario a colecciones reales de PocketBase
 * y escribe sus reglas de acceso.
 */
import { MEMBER_FIELD, storedFields } from "../shared/people.ts";
import {
  type FieldDef,
  identifier,
  isRelationField,
  onDeleteOf,
  ORPHAN_SUFFIX,
  orphanFieldName,
  slugify,
  type TableRecord,
} from "../shared/types.ts";
import { config, INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import {
  createCollection,
  deleteCollection,
  firstRecord,
  getCollection,
  listRecords,
  type PbCollection,
  type PbField,
  updateCollection,
} from "./pb.ts";

export class SchemaError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const RESERVED = new Set([
  "id",
  "created",
  "updated",
  "collectionId",
  "dataCollection",
  "expand",
  // El enlace de una fila de personas con su cuenta. No es una columna del
  // constructor: es la identidad de la fila. Ver `shared/people.ts`.
  MEMBER_FIELD,
]);

// Los dos viven en `shared/types.ts`: la tarjeta de columna necesita el mismo
// nombre tecnico que se va a guardar, antes de mandarlo.
export { identifier, slugify };

export function dataCollectionName(appSlug: string, tableName: string): string {
  return `${config.dataPrefix}${identifier(appSlug, "app")}_${identifier(tableName, "tabla")}`;
}

/**
 * Un nombre tecnico que no lo tenga ya otra tabla de la aplicacion.
 *
 * El nombre es con lo que el HTML de una pagina y la IA nombran una tabla
 * (`findTable`, `sourcesFor`), asi que dos tablas llamadas igual son una tabla
 * inalcanzable: siempre contesta la primera. Vive aqui, y no en la ruta que
 * crea tablas, porque tambien crea tablas la IA.
 */
export async function uniqueTableName(appId: string, base: string): Promise<string> {
  const root = identifier(base, "tabla");
  for (let i = 0; i < 200; i++) {
    const candidate = i === 0 ? root : `${root}_${i + 1}`;
    const hit = await firstRecord(
      INTERNAL.tables,
      `app = "${quote(appId)}" && name = "${quote(candidate)}"`,
    );
    if (!hit) return candidate;
  }
  return `${root}_${Date.now()}`;
}

/* ------------------------------------------------------------------ */
/* Campos                                                               */
/* ------------------------------------------------------------------ */

async function relationTarget(tableId: string): Promise<string> {
  const res = await listRecords<{ dataCollection: string }>(INTERNAL.tables, {
    filter: `id = "${quote(tableId)}"`,
    perPage: 1,
    skipTotal: 1,
  });
  const target = res.items[0];
  if (!target) throw new SchemaError("La tabla relacionada no existe");
  const collection = await getCollection(target.dataCollection);
  if (!collection) throw new SchemaError("La tabla relacionada no existe");
  return collection.id;
}

/**
 * Las columnas reales que ocupa una columna definida.
 *
 * Casi siempre es una. Una columna de relacion son dos: la relacion (el id, o
 * vacio) y el valor sin dueno (texto, o vacio), que nunca estan llenas a la vez.
 * Ver `ORPHAN_SUFFIX` en `shared/types.ts` para el porque.
 *
 * `orphanIds` trae el id que ya tenia la columna del valor sin dueno, para que
 * renombrar la columna definida no la borre y la vuelva a crear vacia.
 */
async function toPbFields(def: FieldDef, orphanIds?: Map<string, string>): Promise<PbField[]> {
  const main = await toPbField(def);
  if (!isRelationField(def) || def.multiple === true) return [main];

  const name = orphanFieldName(main.name);
  return [
    /*
     * La mitad del id nunca es obligatoria en la base, aunque la columna lo
     * sea. Lo obligatorio es la celda, y la celda son las dos columnas: un
     * valor que todavia no corresponde a nadie llena la otra, y con la relacion
     * marcada como obligatoria ese guardado lo rechaza la base. Eso dejaba una
     * columna obligatoria sin poder importar una cedula nueva, y sin poder
     * conservar la cedula de quien deja de estar invitado. Quien exige que la
     * celda tenga algo es el panel, antes de guardar. Ver `missing` en
     * `web/src/components/database/RowDrawer.svelte`.
     */
    { ...main, required: false },
    {
      id: orphanIds?.get(def.id ?? ""),
      name,
      type: "text",
      max: 500,
      required: false,
      // No es del usuario: no se ofrece como columna, no se ordena por ella y
      // no aparece en la grilla. Se lee junto a la relacion que la nombra.
      hidden: false,
      presentable: false,
    },
  ];
}

async function toPbField(def: FieldDef): Promise<PbField> {
  const name = identifier(def.name);
  if (RESERVED.has(name)) throw new SchemaError(`El nombre "${name}" esta reservado`);

  const common = { id: def.id, name, required: def.required === true };

  switch (def.type) {
    case "text":
      return { ...common, type: "text", max: 500 };
    case "longtext":
      return { ...common, type: "text" };
    case "number":
      return { ...common, type: "number" };
    case "bool":
      return { ...common, type: "bool", required: false };
    case "email":
      return { ...common, type: "email" };
    case "url":
      return { ...common, type: "url" };
    case "date":
      return { ...common, type: "date" };
    case "select": {
      const values = (def.options ?? []).map((o) => o.trim()).filter(Boolean);
      // PocketBase rechaza `maxSelect` mayor que la cantidad de valores del
      // campo select, asi que el maximo multiple queda acotado a las opciones
      // disponibles. Si la lista esta vacia se cae a 1 para no enviar un
      // `select` sin valores.
      const max = def.multiple ? Math.max(values.length, 1) : 1;
      return {
        ...common,
        type: "select",
        values,
        maxSelect: max,
      };
    }
    case "file":
      return {
        ...common,
        type: "file",
        maxSelect: def.multiple ? 10 : 1,
        maxSize: 10_000_000,
      };
    case "relation": {
      // Toda relacion apunta a la coleccion de datos de su tabla destino, la de
      // personas incluida: el enlace es el id de la fila y nunca el de la
      // cuenta. Ver `design.md` D1.
      if (!def.relationTableId) throw new SchemaError("Falta la tabla relacionada");
      return {
        ...common,
        type: "relation",
        collectionId: await relationTarget(def.relationTableId),
        maxSelect: def.multiple ? 50 : 1,
        // La cascada es lo unico que PocketBase puede hacer solo. Conservar el
        // valor corre antes del borrado, en `server/rowDelete.ts`, porque la
        // base solo sabe anular o arrastrar.
        cascadeDelete: onDeleteOf(def) === "cascade",
      };
    }
    default:
      throw new SchemaError(`Tipo de columna desconocido: ${(def as FieldDef).type}`);
  }
}

/**
 * Deja los nombres tecnicos unicos dentro de la tabla.
 *
 * Una columna de relacion se lleva ademas el nombre acabado en `ORPHAN_SUFFIX`,
 * porque ahi vive su valor sin dueno: si el usuario creara una columna con ese
 * nombre, las dos escribirian en la misma columna real.
 */
export function normalizeFields(fields: FieldDef[]): FieldDef[] {
  const used = new Set<string>();
  return fields.map((f) => {
    let name = identifier(f.name || f.label || "campo");
    if (RESERVED.has(name)) name = `${name}_1`;
    if (!isRelationField(f) && name.endsWith(ORPHAN_SUFFIX)) name = `${name}_1`;
    let candidate = name;
    let i = 2;
    while (used.has(candidate) || used.has(orphanFieldName(candidate))) {
      candidate = `${name}_${i++}`;
    }
    used.add(candidate);
    if (isRelationField(f)) used.add(orphanFieldName(candidate));
    return { ...f, name: candidate, label: f.label || f.name };
  });
}

/* ------------------------------------------------------------------ */
/* Columnas unicas                                                      */
/* ------------------------------------------------------------------ */

/** Prefijo de los indices que gestiona el panel. Los demas no se tocan. */
const UNIQUE_PREFIX = "idx_unico_";

/**
 * El indice de una columna unica, que no cuenta las celdas vacias.
 *
 * El `WHERE` no es un detalle: sin el, "no se repite" pasaria a significar
 * tambien "no puede estar vacia en mas de una fila", que no es lo que dice la
 * casilla ni lo que nadie espera. Y con eso una columna nueva no se podria
 * marcar nunca sobre una tabla con filas --nacen todas vacias, y veintidos
 * vacios son veintidos repetidos--, que es justo cuando hace falta: la cedula
 * se marca como llave sobre las personas que ya estan.
 *
 * Vacio y sin dato son la misma cosa aqui, y dos filas sin dato no se
 * contradicen entre si.
 */
function uniqueIndexSql(collectionName: string, fieldName: string): string {
  return `CREATE UNIQUE INDEX \`${UNIQUE_PREFIX}${collectionName}_${fieldName}\` ON \`${collectionName}\` (\`${fieldName}\`) WHERE \`${fieldName}\` != ''`;
}

/**
 * Traduce las marcas de columna unica a indices unicos de PocketBase.
 *
 * Solo gobierna los indices con nuestro prefijo: desmarcar una columna quita el
 * suyo, y un indice creado por fuera sigue donde estaba.
 */
export function uniqueIndexes(
  collectionName: string,
  fields: FieldDef[],
  existing: string[] = [],
): string[] {
  const mine = storedFields(fields)
    .filter((f) => f.unique === true && !isRelationField(f))
    .map((f) => uniqueIndexSql(collectionName, identifier(f.name)));
  const others = existing.filter((sql) => !sql.includes(UNIQUE_PREFIX));
  return [...others, ...mine];
}

/**
 * Una persona, una fila: el indice unico del enlace con la cuenta.
 *
 * Es el mismo que crea `ensurePeopleTable` con la coleccion, letra por letra,
 * para que reponerlo no sea crear otro distinto.
 *
 * Hay que reponerlo porque `member` no es una columna del constructor: no viene
 * en la lista de columnas, asi que `uniqueIndexes` --que se lleva por delante
 * todos los indices con nuestro prefijo para poder desmarcar una columna-- lo
 * borraba en la primera edicion de columnas de la tabla de personas. Sin el, dos
 * filas pueden nombrar a la misma persona y cada una decir cosas distintas de
 * ella, que es justo lo que el indice existia para impedir.
 */
function memberIndex(collectionName: string): string {
  return `CREATE UNIQUE INDEX \`${UNIQUE_PREFIX}${collectionName}_${MEMBER_FIELD}\` ON \`${collectionName}\` (\`${MEMBER_FIELD}\`)`;
}

/** Una fila que repite el valor de una columna unica, con quien mas lo tiene. */
export interface UniqueConflict {
  field: string;
  fieldLabel: string;
  value: string;
  /** Ids de las filas que comparten ese valor. */
  rows: string[];
}

/**
 * Busca valores repetidos antes de aplicar la marca de unica.
 *
 * PocketBase rechaza el indice sin decir cual es el choque, y sin saber cual es
 * el usuario no tiene como arreglarlo. Se mira aqui para poder nombrarlo.
 */
export async function uniqueConflicts(
  dataCollection: string,
  fields: FieldDef[],
): Promise<UniqueConflict[]> {
  const wanted = storedFields(fields).filter((f) => f.unique === true && !isRelationField(f));
  if (wanted.length === 0) return [];

  /*
   * La tabla entera, por paginas. Antes se miraban las primeras 2000 filas y
   * ya: con una tabla mas grande, dos repetidos mas abajo no se veian aqui,
   * se decia que la marca se podia aplicar y era PocketBase quien la rechazaba
   * despues, sin decir cual era el choque --que es justo lo que esta funcion
   * existe para nombrar--.
   */
  const items: Record<string, unknown>[] = [];
  for (let page = 1; ; page++) {
    const res = await listRecords<Record<string, unknown>>(dataCollection, {
      perPage: 500,
      page,
    });
    items.push(...res.items);
    if (page >= res.totalPages || res.items.length === 0) break;
  }

  const out: UniqueConflict[] = [];
  for (const field of wanted) {
    const seen = new Map<string, string[]>();
    for (const row of items) {
      const raw = row[field.name];
      if (raw === null || raw === undefined || raw === "") continue;
      const key = String(raw);
      const ids = seen.get(key);
      if (ids) ids.push(String(row.id));
      else seen.set(key, [String(row.id)]);
    }
    for (const [value, ids] of seen) {
      if (ids.length > 1) {
        out.push({ field: field.name, fieldLabel: field.label || field.name, value, rows: ids });
      }
    }
  }
  return out;
}

/** El aviso que se le da al constructor cuando la marca no se puede aplicar. */
export function uniqueConflictMessage(conflicts: UniqueConflict[]): string {
  const rows = conflicts.reduce((sum, c) => sum + c.rows.length, 0);
  const detail = conflicts
    .slice(0, 5)
    .map((c) => `"${c.value}" en ${c.rows.length} filas`)
    .join(", ");
  const more = conflicts.length > 5 ? ` y ${conflicts.length - 5} valores más` : "";
  const label = conflicts[0]?.fieldLabel ?? "";
  return `La columna "${label}" no puede quedar sin repetidos: ${rows} filas comparten valor (${detail}${more}). Corrígelos y vuelve a marcarla.`;
}

/* ------------------------------------------------------------------ */
/* Reglas de acceso                                                     */
/* ------------------------------------------------------------------ */

/**
 * Las reglas de una tabla de datos: solo su constructor la alcanza por aqui.
 *
 * Las reglas dejaron de expresar la logica de roles. Con cuatro roles que
 * alcanzan cosas distintas, una regla es una sola cadena por tabla y por
 * operacion, y expresar eso obliga a encadenar condiciones sobre `app_access`
 * que se contaminan entre si de forma dificil de ver e imposible de probar. Con
 * datos como llamados de atencion o nomina, una regla floja no es un fallo
 * tecnico: es un incidente de la empresa.
 *
 * Asi que quien decide es el servidor, en `server/page/pageData.ts`, y estas reglas
 * pasan a ser una sola cosa: cerrar la coleccion a los invitados. Un invitado
 * que consulte la base por su cuenta no recibe nada, tenga la sesion que tenga.
 *
 * El constructor si sigue entrando: el panel --la grilla, el panel lateral, la
 * importacion, la exportacion-- habla directo con la base con su sesion, y esa
 * puerta no da acceso a nada que el dueno de la aplicacion no alcance ya.
 *
 * Por eso no toma nada mas que la aplicacion: ni si es publica ni que columna
 * decide quien ve cada fila --esa columna se retiro-- cambian una sola letra de
 * lo que se escribe aqui.
 */
export function accessRules(appId: string) {
  const builder = `(@collection.apps.id ?= "${appId}" && @collection.apps.owner ?= @request.auth.id)`;
  return {
    listRule: builder,
    viewRule: builder,
    createRule: builder,
    updateRule: builder,
    deleteRule: builder,
  };
}

/** Reescribe las reglas de una sola tabla. */
export async function applyTableRules(opts: { dataCollection: string; appId: string }) {
  await updateCollection(opts.dataCollection, accessRules(opts.appId));
}

/**
 * Reescribe las reglas de todas las tablas de una aplicacion.
 *
 * Las reglas ya no dependen de nada que cambie --solo de quien es el dueno-- asi
 * que esto es una reparacion, no una consecuencia de un ajuste: repone la regla
 * en una tabla que se hubiera quedado con la de antes.
 */
export async function syncAppRules(appId: string) {
  const tables = await listRecords<TableRecord>(INTERNAL.tables, {
    filter: `app = "${quote(appId)}"`,
    perPage: 200,
    skipTotal: 1,
  });
  const rules = accessRules(appId);
  for (const table of tables.items) {
    await updateCollection(table.dataCollection, rules).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Crear y modificar tablas                                             */
/* ------------------------------------------------------------------ */

export async function createDataCollection(opts: {
  dataCollection: string;
  appId: string;
  fields: FieldDef[];
}): Promise<{ collection: PbCollection; fields: FieldDef[] }> {
  const normalized = normalizeFields(opts.fields);
  const pbFields: PbField[] = [];
  // Las columnas del sistema no se traducen: su valor vive en otra coleccion y
  // se superpone al pintar. Ver `shared/people.ts`.
  for (const def of storedFields(normalized)) {
    pbFields.push(...(await toPbFields({ ...def, id: undefined })));
  }

  const collection = await createCollection({
    name: opts.dataCollection,
    type: "base",
    fields: [
      ...pbFields,
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: uniqueIndexes(opts.dataCollection, normalized),
    ...accessRules(opts.appId),
  });

  return { collection, fields: withIds(normalized, collection) };
}

export async function updateDataCollection(opts: {
  dataCollection: string;
  fields: FieldDef[];
}): Promise<{ collection: PbCollection; fields: FieldDef[] }> {
  const current = await getCollection(opts.dataCollection);
  if (!current) throw new SchemaError("La tabla no existe", 404);

  const normalized = normalizeFields(opts.fields);

  const pbFields: PbField[] = [];
  const orphanIds = orphanIdsOf(current, normalized);
  for (const def of storedFields(normalized)) pbFields.push(...(await toPbFields(def, orphanIds)));

  // Los campos del sistema y las fechas automaticas siempre se conservan. El
  // enlace con la cuenta tambien: no viene en la lista de columnas --no es del
  // constructor-- y sin el la fila de una persona perderia a quien nombra.
  const preserved = current.fields.filter(
    (f) => f.system || f.type === "autodate" || f.name === MEMBER_FIELD,
  );

  const indexes = uniqueIndexes(opts.dataCollection, normalized, current.indexes ?? []);
  // Solo la tabla de personas tiene esta columna: `member` es un nombre
  // reservado, asi que ninguna otra puede llamar asi a una suya.
  if (current.fields.some((f) => f.name === MEMBER_FIELD)) {
    indexes.push(memberIndex(opts.dataCollection));
  }

  const collection = await updateCollection(opts.dataCollection, {
    // Lo que no viene en la lista desaparece: borrar una columna de relacion se
    // lleva por delante su valor sin dueno, que es lo que se quiere.
    fields: [...preserved, ...recreateChanged(current, pbFields)],
    indexes,
  });

  return { collection, fields: withIds(normalized, collection) };
}

/**
 * Suelta el id de las columnas que PocketBase no deja modificar en sitio.
 *
 * Hay dos cambios que PocketBase rechaza sobre una columna que ya existe: el
 * tipo ("Field type cannot be changed") y la coleccion a la que apunta una
 * relacion ("The relation collection cannot be changed"). Con el id puesto no
 * falla esa columna sola: se cae la peticion entera, y el constructor ve un
 * "Failed to update collection" que no le dice nada.
 *
 * Sin id, PocketBase borra la columna y crea otra con el mismo nombre. Eso
 * vacia sus celdas, que es lo que pasa siempre que una columna cambia de tipo
 * --una cedula escrita a mano no es el id de una fila de personas, ni un numero
 * es una fecha-- y por eso `cambiar_tipo` es un cambio con riesgo en
 * `dataImpact.ts`, con su aviso antes de llegar aqui.
 *
 * El id se suelta solo en ese caso. Renombrar sigue conservandolo, que es lo
 * que hace que un cambio de nombre no pierda datos.
 */
function recreateChanged(current: PbCollection, fields: PbField[]): PbField[] {
  return fields.map((field) => {
    if (!field.id) return field;
    const before = current.fields.find((f) => f.id === field.id);
    if (!before) return field;
    // `collectionId` es undefined en todo lo que no es relacion, asi que la
    // comparacion vale igual para las demas columnas.
    if (before.type === field.type && before.collectionId === field.collectionId) return field;
    return { ...field, id: undefined };
  });
}

/**
 * El id que ya tiene en la base la columna del valor sin dueno de cada relacion.
 *
 * Se busca por el nombre que la columna tenia antes, no por el que trae ahora:
 * al renombrar "conductor" a "chofer" hay que reconocer `conductor_sin_enlace`
 * como la misma columna, o PocketBase la borraria y crearia otra vacia.
 *
 * Una columna de texto que pasa a ser relacion no tiene corralito todavia, y le
 * cede el suyo: el corralito se queda con su id --y con sus celdas-- y la
 * relacion nace al lado, vacia y sin id. Es lo que hace util la conversion. Una
 * cedula escrita a mano no es el id de una fila de personas, asi que la relacion
 * no puede heredarla; pero es exactamente un valor que todavia no encontro
 * dueno, que es lo que el corralito guarda. De ahi salen enlazadas o aceptadas
 * una por una desde el panel de valores sin dueno, en vez de perderse.
 *
 * Solo se cede desde una columna que PocketBase guarda como texto. Un numero o
 * una fecha no se pueden renombrar a un corralito de texto --seria cambiarle el
 * tipo, que es justo lo que no se puede-- y sus celdas se pierden.
 */
function orphanIdsOf(current: PbCollection, fields: FieldDef[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const def of fields) {
    if (!def.id || !isRelationField(def)) continue;
    const before = current.fields.find((f) => f.id === def.id);
    if (!before) continue;
    if (before.type === "text" && before.id) {
      out.set(def.id, before.id);
      continue;
    }
    const orphan = current.fields.find((f) => f.name === orphanFieldName(before.name));
    if (orphan?.id) out.set(def.id, orphan.id);
  }
  return out;
}

export async function dropDataCollection(dataCollection: string) {
  await deleteCollection(dataCollection).catch(() => {});
}

/**
 * Retira un grupo de colecciones de datos de una vez.
 *
 * En pasadas y no de un tiron a proposito: PocketBase se niega a borrar una
 * coleccion mientras otra la nombre en una relacion --"existing reference in
 * ..."--, asi que el orden importa. Al borrar una aplicacion entera las dos
 * puntas de la relacion se van juntas, pero si la apuntada sale primero su
 * borrado falla; con `dropDataCollection` a secas ese fallo se traga en
 * silencio y la coleccion se queda para siempre, con sus filas dentro y sin
 * ninguna tabla que la nombre.
 *
 * Cada vuelta intenta las que quedan. Mientras alguna caiga, se vuelve a
 * probar: la que resistia por una relacion ya tiene libre a quien la sujetaba.
 * Se para cuando una vuelta entera no consigue nada, que es cuando lo que
 * queda lo retiene algo de fuera del grupo.
 *
 * Devuelve cuantas se fueron y cuales resistieron.
 */
export async function dropDataCollections(
  names: string[],
): Promise<{ dropped: number; stuck: string[] }> {
  let pending = [...new Set(names)];
  let dropped = 0;

  while (pending.length > 0) {
    const stuck: string[] = [];
    for (const name of pending) {
      try {
        await deleteCollection(name);
        dropped++;
      } catch {
        stuck.push(name);
      }
    }
    // Ninguna cayo en toda la vuelta: seguir es repetir el mismo fallo.
    if (stuck.length === pending.length) return { dropped, stuck };
    pending = stuck;
  }

  return { dropped, stuck: [] };
}

/** Copia los ids que asigno PocketBase a cada columna. */
function withIds(fields: FieldDef[], collection: PbCollection): FieldDef[] {
  return fields.map((f) => {
    const match = collection.fields.find((pf) => pf.name === f.name);
    return { ...f, id: match?.id ?? f.id };
  });
}
