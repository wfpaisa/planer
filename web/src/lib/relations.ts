/**
 * El emparejado por llave, con la sesion de quien esta en el panel.
 *
 * La logica vive en `shared/relations.ts`; aqui solo se le da de donde leer.
 */
import {
  type Lookup,
  type Match,
  matchValues,
  relationCellValues,
  relationTarget,
} from "@shared/relations";
import {
  type AppPerson,
  type FieldDef,
  isRelationField,
  orphanFieldName,
  type TableRecord,
} from "@shared/types";

import { pb } from "./pb";

/** De donde lee el emparejado en el panel. */
export function panelLookup(people: AppPerson[]): Lookup {
  return {
    find: async (collection, filter) =>
      await pb.collection(collection).getFullList<Record<string, unknown>>({ filter, batch: 200 }),
    // Solo las invitadas a esta aplicacion, nunca la lista comun de cuentas.
    people: async () => people,
  };
}

/**
 * Enlaza los valores que estaban esperando en el corralito de una columna.
 *
 * Convertir una columna de texto en relacion deja sus valores en el corralito y
 * la relacion vacia. En el momento del cambio no se puede hacer otra cosa: una
 * cedula escrita a mano no es el id de ninguna fila, y el servidor que cambia el
 * tipo no sabe contra que emparejarla. Pero en cuanto la columna ya dice a donde
 * apunta y por que llave, esos valores se resuelven de una vez.
 *
 * Sin esto, convertir una columna de trece filas dejaba trece "sin enlace" que
 * habia que resolver una por una, aunque todas nombraran a alguien que ya estaba
 * invitado. Ese trabajo a mano era el precio de una conversion, y no tenia por
 * que serlo.
 *
 * Solo enlaza lo que identifica a un registro y a uno solo: lo que no
 * corresponde a nadie --y lo que corresponde a dos-- se queda en el corralito, a
 * la vista, para resolverlo desde el panel de valores sin dueno.
 */
export async function linkParkedValues(opts: {
  table: TableRecord;
  tables: TableRecord[];
  field: FieldDef;
  people: AppPerson[];
}): Promise<number> {
  const { field, table } = opts;
  if (!isRelationField(field) || field.multiple === true) return 0;

  const target = relationTarget(field, opts.tables);
  if (!target?.key) return 0;

  const orphan = orphanFieldName(field.name);
  const rows = await pb
    .collection(table.dataCollection)
    .getFullList<Record<string, unknown>>({ filter: `${orphan} != ""`, batch: 500 })
    .catch(() => []);

  // Las dos columnas nunca estan llenas a la vez, pero una fila recien enlazada
  // puede traer todavia el texto: esa ya no se toca.
  const parked = rows.filter((row) => !row[field.name] && String(row[orphan] ?? ""));
  if (parked.length === 0) return 0;

  const matches = await matchValues(
    target,
    parked.map((row) => String(row[orphan] ?? "")),
    panelLookup(opts.people),
  );

  let linked = 0;
  for (const row of parked) {
    const id = matches.get(String(row[orphan] ?? ""))?.id;
    if (!id) continue;
    try {
      await pb
        .collection(table.dataCollection)
        .update(String(row.id ?? ""), { [field.name]: id, [orphan]: "" });
      linked++;
    } catch {
      // Una fila que la base rechaza no para a las demas: la suya se queda en
      // el corralito, que es de donde venia.
    }
  }
  return linked;
}

/**
 * Pasa los valores escritos a lo que se guarda de verdad.
 *
 * Solo se tocan las columnas de relacion que se hayan escrito: una fila cuyo
 * enlace ya venia roto y no se ha tocado se guarda igual. Si no, cada persona
 * que sale de la aplicacion convertiria sus filas en intocables.
 *
 * Un valor que no encuentra dueno no impide guardar: se queda en el corralito
 * de su columna, a la vista y arreglable. No hay ninguna columna que obligue a
 * lo contrario --la de dueno de fila se retiro-- asi que aqui no se rechaza
 * nada.
 */
export async function resolveRowValues(opts: {
  table: TableRecord;
  tables: TableRecord[];
  values: Record<string, unknown>;
  /** Nombres de las columnas que se han escrito en esta edicion. */
  touched: Set<string>;
  people: AppPerson[];
}): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const lookup = panelLookup(opts.people);

  for (const field of opts.table.fields) {
    if (!isRelationField(field) || field.multiple === true) {
      out[field.name] = opts.values[field.name];
      continue;
    }
    if (!opts.touched.has(field.name)) continue;

    const raw = String(opts.values[field.name] ?? "").trim();
    const match = await matchOne(field, opts.tables, raw, lookup);
    Object.assign(out, relationCellValues(field, match));
  }

  return out;
}

/** Empareja un solo valor. Vacio no busca nada: es una celda que se deja sin poner. */
export async function matchOne(
  field: FieldDef,
  tables: TableRecord[],
  raw: string,
  lookup: Lookup,
): Promise<Match> {
  if (!raw) return { id: "", value: "" };
  const target = relationTarget(field, tables);
  if (!target) return { id: "", value: raw };
  const matches = await matchValues(target, [raw], lookup);
  return matches.get(raw) ?? { id: "", value: raw };
}

/**
 * El aviso de un valor repetido en una columna que no admite repetidos.
 *
 * PocketBase dice "debe ser unico" y ahi se acaba: no dice con quien choca, que
 * es justo lo unico que le sirve a quien esta escribiendo. Aqui se busca la
 * fila que ya lo tiene y se nombra.
 *
 * Devuelve vacio si el error no es de unicidad o si no se encuentra la otra
 * fila; en ese caso vale el mensaje de siempre.
 */
export async function uniqueClashMessage(
  table: TableRecord,
  values: Record<string, unknown>,
  err: unknown,
  /** La fila que se esta editando, para no senalarse a si misma. */
  selfId?: string,
): Promise<string> {
  const data = (err as { response?: { data?: Record<string, { code?: string }> } })?.response?.data;
  if (!data) return "";

  const clashed = Object.entries(data).find(([, v]) => v?.code === "validation_not_unique");
  if (!clashed) return "";

  const [name] = clashed;
  const field = table.fields.find((f) => f.name === name);
  const value = String(values[name] ?? "");
  if (!field || !value) return "";

  const other = await pb
    .collection(table.dataCollection)
    .getFirstListItem<Record<string, unknown>>(`${name} = ${JSON.stringify(value)}`)
    .catch(() => null);

  if (!other || other.id === selfId) return "";

  // Se nombra la otra fila por algo que se lea, no por su id.
  const readable = table.fields.find((f) => f.type === "text" && f.name !== name);
  const who = readable && other[readable.name] ? ` ("${String(other[readable.name])}")` : "";

  return `Ya hay una fila con "${value}" en ${field.label || name}${who}. Esa columna no admite valores repetidos.`;
}
