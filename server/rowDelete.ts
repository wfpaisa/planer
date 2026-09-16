/**
 * Que pasa con las filas que senalaban a un registro que se va a borrar.
 *
 * Vive en `server/` y no en `shared/` porque es lo unico que hace que la regla
 * sea una y no tres: hay tres caminos que borran una fila --la cuadricula del
 * constructor, la orden `borrar` de una pagina publicada y quitarle el acceso
 * a una persona-- y los tres pasan por aqui. Ver `design.md` D7 de
 * `relacion-automatica-con-personas`.
 *
 * PocketBase solo sabe hacer dos cosas al borrar lo apuntado: anular el enlace
 * o arrastrar la fila. La cascada se le deja a el (`cascadeDelete`); conservar
 * el valor no puede, asi que corre aqui, antes del borrado, leyendo lo que la
 * celda ensenaba mientras el registro todavia existe.
 */
import { isPeopleTable, MEMBER_FIELD, personKeyValue, storedFields } from "../shared/people.ts";
import { firstUnique } from "../shared/relations.ts";
import {
  type AppPerson,
  type DeleteImpact,
  displayFieldOf,
  type FieldDef,
  isRelationField,
  onDeleteOf,
  orphanFieldName,
  type TableRecord,
} from "../shared/types.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { deleteRecord, firstRecord, listRecords, updateRecord } from "./pb.ts";

/** Una columna de otra tabla que apunta a lo que se va a borrar. */
interface Referrer {
  table: TableRecord;
  field: FieldDef;
  /** Filas suyas que senalan a alguno de los registros que se van. */
  rows: string[];
}

/* ------------------------------------------------------------------ */
/* Quien senala a lo que se va                                          */
/* ------------------------------------------------------------------ */

/**
 * Las columnas de la aplicacion que apuntan a esta tabla, con las filas suyas
 * que senalan a alguno de esos registros.
 *
 * Se busca por el identificador de la fila y no por el tipo de la columna: con
 * un solo tipo de relacion, lo que hace que una columna hable de un registro es
 * a que tabla apunta. La tabla de origen se salta a si misma solo cuando la
 * fila que apunta es una de las que se van.
 */
async function referrersTo(
  tables: TableRecord[],
  target: TableRecord,
  ids: string[],
): Promise<Referrer[]> {
  if (!ids.length) return [];
  const wanted = ids.map((id) => `"${quote(id)}"`);
  const out: Referrer[] = [];

  for (const table of tables) {
    for (const field of table.fields ?? []) {
      if (!isRelationField(field) || field.multiple === true) continue;
      if (field.relationTableId !== target.id) continue;

      const filter = wanted.map((id) => `${field.name} = ${id}`).join(" || ");
      const rows = await listRecords<{ id: string }>(table.dataCollection, {
        filter,
        perPage: 500,
        skipTotal: 1,
      }).catch(() => null);
      if (!rows?.items.length) continue;

      // Una fila que se borra igual no cuenta: no se conserva su propio valor.
      const left = rows.items
        .map((r) => r.id)
        .filter((id) => !(table.id === target.id && ids.includes(id)));
      if (left.length) out.push({ table, field, rows: left });
    }
  }

  return out;
}

/** Las tablas de una aplicacion, o vacio si no se pueden leer. */
async function tablesOf(appId: string): Promise<TableRecord[]> {
  const res = await listRecords<TableRecord>(INTERNAL.tables, {
    filter: `app = "${quote(appId)}"`,
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  return res?.items ?? [];
}

/* ------------------------------------------------------------------ */
/* Lo que la celda ensenaba                                             */
/* ------------------------------------------------------------------ */

/**
 * Lo que cada registro que se va ensenaba, por su identificador.
 *
 * Sale de la propia fila salvo en la tabla de personas, donde la llave puede
 * ser el correo, que no esta en su coleccion: lo guarda la cuenta. Ver
 * `design.md` D10.
 */
async function shownBy(
  target: TableRecord,
  ids: string[],
  key: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!key || !ids.length) return out;

  const filter = ids.map((id) => `id = "${quote(id)}"`).join(" || ");
  const rows = await listRecords<Record<string, unknown>>(target.dataCollection, {
    filter,
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!rows) return out;

  for (const row of rows.items) {
    const id = String(row.id ?? "");
    if (isPeopleTable(target)) {
      const person = await personOfRow(target, row);
      // Sin valor en esa columna queda el correo, que es lo unico que toda
      // cuenta tiene. Una fila sin ningun valor es una fila que perdio el dato.
      const value = personKeyValue(person, key) || person.email;
      if (value) out.set(id, value);
      continue;
    }
    const value = row[key];
    if (value != null && String(value) !== "") out.set(id, String(value));
  }

  return out;
}

/** Una fila de la tabla de personas, con lo que su cuenta anade. */
async function personOfRow(table: TableRecord, row: Record<string, unknown>): Promise<AppPerson> {
  const memberId = String(row[MEMBER_FIELD] ?? "");
  const account = memberId
    ? await firstRecord<{ cuenta?: string; name?: string }>(
        INTERNAL.members,
        `id = "${quote(memberId)}"`,
      ).catch(() => null)
    : null;

  const campos: Record<string, unknown> = {};
  for (const f of storedFields(table.fields)) campos[f.name] = row[f.name];

  return {
    id: memberId,
    fila: String(row.id ?? ""),
    name: account?.name ?? "",
    email: account?.cuenta ?? "",
    roles: [],
    campos,
  };
}

/* ------------------------------------------------------------------ */
/* Lo que se dice antes, y lo que se hace                               */
/* ------------------------------------------------------------------ */

/**
 * Cuantas filas se conservan y cuantas se borran si se van estos registros.
 *
 * No se reusa el recuento de `server/dataImpact.ts`: aquel cuenta **paginas**
 * que declaran una tabla o una columna que va a cambiar de forma, y aqui se
 * cuentan **filas** de otras tablas que senalan a unos registros concretos. No
 * comparten ni la unidad ni la pregunta.
 */
export async function deleteImpact(
  appId: string,
  target: TableRecord,
  ids: string[],
): Promise<DeleteImpact> {
  const refs = await referrersTo(await tablesOf(appId), target, ids);
  const impact: DeleteImpact = { cascade: [], keep: [] };

  for (const ref of refs) {
    const into = onDeleteOf(ref.field) === "cascade" ? impact.cascade : impact.keep;
    const seen = into.find((e) => e.table === ref.table.label);
    if (seen) seen.rows += ref.rows.length;
    else into.push({ table: ref.table.label, rows: ref.rows.length });
  }

  return impact;
}

/**
 * Deja a la vista lo que las filas de otras tablas decian de unos registros,
 * antes de que dejen de existir.
 *
 * Sin esto, borrar una fila convertia en "enlace roto" todas las que la
 * senalaban: la celda se quedaba con un id que ya no resuelve y el dato que la
 * fila estaba diciendo --la cedula del conductor de cuarenta multas-- no se
 * veia en ninguna parte. El exceso de velocidad ocurrio igual, y quien lo mira
 * necesita saber de quien era.
 *
 * Solo toca las columnas que conservan el valor: las declaradas en cascada se
 * llevan la fila entera, asi que no hay nada que conservar en ella.
 */
export async function parkReferences(
  appId: string,
  target: TableRecord,
  ids: string[],
): Promise<void> {
  const refs = await referrersTo(await tablesOf(appId), target, ids);
  if (!refs.length) return;

  // Lo que ensenaba cada registro se lee una vez por llave y no una por fila:
  // dos columnas que ensenan la misma cosa preguntan lo mismo.
  const cache = new Map<string, Map<string, string>>();

  for (const ref of refs) {
    if (onDeleteOf(ref.field) === "cascade") continue;

    const key = displayFieldOf(ref.field) || firstUnique(target);
    if (!key) continue;
    let shown = cache.get(key);
    if (!shown) {
      shown = await shownBy(target, ids, key);
      cache.set(key, shown);
    }
    if (!shown.size) continue;

    const orphan = orphanFieldName(ref.field.name);
    for (const rowId of ref.rows) {
      const row = await firstRecord<Record<string, unknown>>(
        ref.table.dataCollection,
        `id = "${quote(rowId)}"`,
      ).catch(() => null);
      const value = shown.get(String(row?.[ref.field.name] ?? ""));
      if (!value) continue;
      await updateRecord(ref.table.dataCollection, rowId, {
        [ref.field.name]: "",
        [orphan]: value,
      }).catch(() => {});
    }
  }
}

/**
 * Borra unas filas conservando lo que decian de ellas las de otras tablas.
 *
 * Es la unica puerta: los tres caminos que borran llaman aqui, para que la
 * conducta declarada en la columna sea una regla y no una costumbre de cada
 * pantalla. Devuelve cuantas se fueron.
 */
export async function deleteRows(
  appId: string,
  table: TableRecord,
  ids: string[],
): Promise<{ borradas: number; fallidas: number }> {
  if (!ids.length) return { borradas: 0, fallidas: 0 };

  await parkReferences(appId, table, ids);

  let borradas = 0;
  let fallidas = 0;
  for (const id of ids) {
    try {
      await deleteRecord(table.dataCollection, id);
      borradas += 1;
    } catch {
      fallidas += 1;
    }
  }
  return { borradas, fallidas };
}
