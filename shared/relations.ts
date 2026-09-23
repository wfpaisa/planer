/**
 * Emparejar un valor con el registro al que pertenece.
 *
 * Una columna de relación guarda el id del registro, pero el id no se escribe
 * nunca a mano: lo que se escribe, se importa y se ve es la llave --una cédula,
 * una placa, un correo--. Aquí es donde una cosa se convierte en la otra.
 *
 * Vive en `shared/` y no en `server/` porque la escritura de filas no pasa por
 * el servidor: la grilla, el panel lateral, la importacion y el puente hablan
 * directo con la base. Resolver en el punto de escritura tiene ademas una
 * ventaja que una ruta comun no daria: la búsqueda va con la sesión de quien
 * escribe, así que nadie puede emparejar contra un registro que no alcanza.
 */
import { isOverlayField, isPeopleTable, personKeyFields, personKeyValue } from "./people.ts";
import {
  type AppPerson,
  type DeleteImpact,
  displayFieldOf,
  type FieldDef,
  isRelationField,
  orphanFieldName,
  type TableRecord,
} from "./types.ts";

/** Lo justo que hace falta de la base para emparejar. */
export interface Lookup {
  /**
   * Busca en una colección las filas que casan con un filtro.
   * Lo implementa quien llama, con su cliente y su sesión.
   */
  find(collection: string, filter: string): Promise<Record<string, unknown>[]>;
  /**
   * Las personas invitadas a esta aplicación, con sus columnas propias.
   *
   * Es una lista aparte a propósito: la de cuentas la guarda la base con su
   * propia regla, y solo el enlace dice quien esta invitado aquí.
   */
  people(): Promise<AppPerson[]>;
}

/** A que apunta una columna de relación y por que llave se empareja. */
export interface RelationTarget {
  field: FieldDef;
  /** La tabla destino. Vacía si ya no existe. */
  table: TableRecord | null;
  /** Columna del destino con la que se empareja. */
  key: string;
}

/**
 * Donde apunta una columna y con que llave se empareja.
 *
 * `key` deja elegir una llave distinta de la que se enseña: el archivo de
 * transito trae cedulas y el de nómina, correos. Es del momento de importar y
 * no cambia lo que ve la grilla.
 */
export function relationTarget(
  field: FieldDef,
  tables: TableRecord[],
  key?: string,
): RelationTarget | null {
  if (!isRelationField(field)) return null;
  const table = tables.find((t) => t.id === field.relationTableId) ?? null;
  if (!table) return null;
  const display = displayFieldOf(field) || firstUnique(table) || "";
  return { field, table, key: key || display };
}

/** La primera columna única de una tabla, que es la única que sirve de llave. */
export function firstUnique(table: TableRecord): string {
  return (table.fields ?? []).find((f) => f.unique === true && !isRelationField(f))?.name ?? "";
}

/**
 * Las columnas de una tabla que pueden servir de llave.
 *
 * La de personas es la excepcion, y no por ser especial: sus columnas llegan
 * importando la nómina --"cédula", "documento", "código"-- y nacen como texto
 * corriente, sin la marca de "sin repetidos" que nadie vuelve a poner. Exigir
 * la marca dejaba fuera justo la columna con la que se reconoce a la gente.
 * Que un valor identifique o no lo decide el dato: el que senala a dos no
 * enlaza a ninguna. Ver `personKeyFields` en `shared/people.ts`.
 */
export function keyCandidates(table: TableRecord | null): { name: string; label: string }[] {
  if (!table) return [];
  if (isPeopleTable(table)) return personKeyFields([table]);
  return (table.fields ?? [])
    .filter((f) => f.unique === true && !isRelationField(f))
    .map((f) => ({ name: f.name, label: f.label || f.name }));
}

/** Un valor emparejado, o la constancia de que no encontro dueno. */
export interface Match {
  /** Id del registro que casa. Vacío: ninguno casa. */
  id: string;
  /** El valor tal como llego, para poder conservarlo si no casa. */
  value: string;
}

const literal = (value: string) => JSON.stringify(value);

/**
 * Empareja varios valores de una vez contra la tabla destino.
 *
 * De golpe y no uno a uno: una importacion de mil filas con tres columnas de
 * relación serian tres mil consultas.
 *
 * Un valor que ya es el id de un registro del destino se toma como el enlace
 * sin buscar por llave. Es lo que hace que exportar y volver a importar deje
 * cada fila donde estaba.
 *
 * Un valor que senala a dos registros no enlaza a ninguno. Antes ganaba el
 * primero que apareciera, que es lo mismo que elegir al azar: dos personas con
 * la misma cédula en la nómina dejaban todas sus filas colgando de una sola, y
 * la otra no volvia a aparecer. Sin enlace el valor se ve en la celda y se
 * puede arreglar; enlazado al que no es, no se nota nunca.
 */
export async function matchValues(
  target: RelationTarget,
  values: string[],
  lookup: Lookup,
): Promise<Map<string, Match>> {
  const out = new Map<string, Match>();
  const wanted = [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))];
  if (wanted.length === 0) return out;

  for (const value of wanted) out.set(value, { id: "", value });

  const table = target.table;
  if (!table || !target.key) return out;

  // El correo y los roles no estan en la colección de la tabla de personas
  // --viven en la cuenta y en el enlace-- así que por esa llave no hay filtro
  // que valga: quien los tiene es la lista de invitados. El resultado es el
  // mismo, el id de la fila, y por eso sale por aquí y no por otra puerta.
  // Ver `isOverlayField` en `shared/people.ts`.
  if (isOverlayField(table, target.key)) {
    const people = await lookup.people();
    for (const value of wanted) {
      const byId = people.find((p) => p.fila === value || p.id === value);
      if (byId?.fila) {
        out.set(value, { id: byId.fila, value });
        continue;
      }
      const lower = value.toLowerCase();
      const found = people.filter(
        (p) => p.fila && personKeyValue(p, target.key).toLowerCase() === lower,
      );
      if (found.length === 1) out.set(value, { id: found[0].fila ?? "", value });
    }
    return out;
  }

  // Quien reclama cada valor por su llave. Se juntan todos antes de decidir:
  // hasta no haber mirado el ultimo lote no se sabe si un valor lo reclama una
  // sola fila o dos.
  const porId = new Set<string>();
  const reclaman = new Map<string, Set<string>>();

  // Por lotes: un filtro con mil clausulas no lo aguanta ninguna base.
  const BATCH = 50;
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const filter = batch
      .map((v) => `${target.key} = ${literal(v)} || id = ${literal(v)}`)
      .join(" || ");
    const rows = await lookup.find(table.dataCollection, filter);
    for (const row of rows) {
      const id = String(row.id ?? "");
      if (batch.includes(id)) porId.add(id);
      const key = row[target.key];
      if (key == null) continue;
      const text = String(key);
      if (!batch.includes(text)) continue;
      const duenos = reclaman.get(text) ?? new Set<string>();
      duenos.add(id);
      reclaman.set(text, duenos);
    }
  }

  // El id gana sobre la llave: si un valor es el id de una fila, ese es el
  // enlace aunque otra fila lleve ese texto en su llave.
  for (const id of porId) out.set(id, { id, value: id });
  for (const [text, duenos] of reclaman) {
    if (porId.has(text) || duenos.size !== 1) continue;
    out.set(text, { id: [...duenos][0], value: text });
  }

  return out;
}

/**
 * Las dos columnas reales de una celda de relación, ya decididas.
 *
 * Si el valor encontro registro se guarda el id y el corralito se vacía; si no,
 * al reves. Nunca las dos llenas a la vez.
 */
export function relationCellValues(field: FieldDef, match: Match): Record<string, unknown> {
  const orphan = orphanFieldName(field.name);
  if (match.id) return { [field.name]: match.id, [orphan]: "" };
  return { [field.name]: "", [orphan]: match.value };
}

/** Un valor sin dueno que el constructor ya dio por bueno. */
export function isAccepted(table: TableRecord, fieldName: string, value: string): boolean {
  return (table.acceptedOrphans?.[fieldName] ?? []).includes(value);
}

/**
 * Lo que se dice antes de borrar unas filas, con numeros de verdad.
 *
 * "Esta accion no se puede deshacer" no dice nada de lo que va a pasar con las
 * filas de otras tablas que senalan a estas. Aquí se nombra cada tabla y se
 * cuentan las suyas, separando lo que se va de lo que se queda: son dos cosas
 * distintas y solo una tiene vuelta atras.
 */
export function deleteRowsWarning(rows: number, impact: DeleteImpact): string {
  const filas = (n: number) => `${n} fila${n === 1 ? "" : "s"}`;
  const listar = (entries: { table: string; rows: number }[]) =>
    entries.map((e) => `${filas(e.rows)} de "${e.table}"`).join(", ");

  const partes = [`Se van a borrar ${filas(rows)}.`];
  if (impact.cascade.length) {
    partes.push(`Se borran también ${listar(impact.cascade)}, porque así está declarado.`);
  }
  if (impact.keep.length) {
    partes.push(`${listar(impact.keep)} conservan el valor a la vista, sin enlace.`);
  }
  partes.push("Esta acción no se puede deshacer.");
  return partes.join(" ");
}
