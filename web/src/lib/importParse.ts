/**
 * Lectura e interpretacion de un archivo o texto pegado para importar a una
 * tabla.
 *
 * El parseo y la conversion de celdas ya no viven aqui: se mudaron a `shared/`
 * para que el servidor los use tambien --la muestra que la IA recibe de un
 * adjunto y `llenar_tabla` leen el archivo con este mismo codigo--. Se
 * reexportan desde aqui para que la importacion manual y `dropFiles.ts` sigan
 * escribiendo un solo import.
 *
 * Lo que si es de este lado es emparejar las columnas de relacion: consulta la
 * tabla destino con la sesion de quien importa, y eso solo existe en el
 * navegador.
 */
import { MAX_IMPORT_ROWS } from "@shared/importBatch";
import {
  detectSeparator,
  type ParsedTable,
  parseImport,
  type ParseResult,
} from "@shared/importParse";
import {
  BOOL_FALSE,
  BOOL_TRUE,
  boolWord,
  type ConvertResult,
  convertValue,
} from "@shared/importValues";
import {
  keyCandidates,
  type Lookup,
  type Match,
  matchValues,
  relationTarget,
} from "@shared/relations";
import { type FieldDef, isRelationField, type TableRecord } from "@shared/types";

export {
  BOOL_FALSE,
  BOOL_TRUE,
  boolWord,
  convertValue,
  detectSeparator,
  MAX_IMPORT_ROWS,
  parseImport,
};
export type { ConvertResult, ParsedTable, ParseResult };

/* ------------------------------------------------------------------ */
/* Emparejar las columnas de relacion                                   */
/* ------------------------------------------------------------------ */

/** Como le fue a una columna de relacion en el archivo que se va a importar. */
export interface ColumnMatchReport {
  field: FieldDef;
  /** Columna del destino con la que se emparejo este archivo. */
  key: string;
  /** Cuantos valores distintos encontraron registro. */
  matched: number;
  /** Los valores distintos que no lo encontraron, con cuantas filas los llevan. */
  missing: { value: string; rows: number }[];
}

/** Cuantos valores distintos encontraron registro. */
function countMatched(found: Map<string, Match>): number {
  let n = 0;
  for (const match of found.values()) if (match.id) n++;
  return n;
}

/** Cuantas filas dependen de valores que no encontraron registro. */
export function missingRowCount(report: ColumnMatchReport): number {
  return report.missing.reduce((sum, m) => sum + m.rows, 0);
}

/**
 * Empareja de golpe todas las columnas de relacion de un archivo.
 *
 * De golpe y no fila a fila: un archivo de mil filas con tres columnas de
 * relacion serian tres mil consultas, y casi todas repetidas --veinte filas
 * suelen ser tres cedulas--.
 *
 * Un valor que no encuentra registro no es un error de la fila: la fila entra
 * completa y el valor se conserva a la vista. El exceso de velocidad ocurrio
 * aunque esa cedula no este en la lista.
 */
export async function matchRelationColumns(opts: {
  /** Columna de la tabla destino por cada columna del archivo, o nada. */
  targets: (FieldDef | null)[];
  rows: string[][];
  tables: TableRecord[];
  /** Llave elegida para esta importacion, por nombre de columna. */
  keys: Record<string, string>;
  lookup: Lookup;
}): Promise<{
  /** Valores ya resueltos, por nombre de columna y por el texto que traia. */
  matches: Map<string, Map<string, Match>>;
  reports: ColumnMatchReport[];
}> {
  const matches = new Map<string, Map<string, Match>>();
  const reports: ColumnMatchReport[] = [];

  for (const [index, field] of opts.targets.entries()) {
    if (!field || !isRelationField(field) || field.multiple === true) continue;
    const chosen = opts.keys[field.name];
    const target = relationTarget(field, opts.tables, chosen);
    if (!target) continue;

    /** Cuantas filas traen cada valor: lo que hace falta para agrupar por valor. */
    const counts = new Map<string, number>();
    for (const row of opts.rows) {
      const raw = String(row[index] ?? "").trim();
      if (raw) counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    const values = [...counts.keys()];

    let found = await matchValues(target, values, opts.lookup);

    /*
     * Si la llave propuesta --la que ensena la columna-- no casa con nada, se
     * prueban las otras columnas unicas del destino y gana la que mas encuentre.
     *
     * Es el caso corriente: la columna ensena el nombre y el archivo trae
     * cedulas. Sin esto habria que adivinar cual elegir a mano, sabiendo de
     * antemano que hay dentro del archivo.
     */
    if (!chosen && countMatched(found) === 0 && values.length > 0) {
      const candidates = keyCandidates(target.table);
      for (const candidate of candidates) {
        if (candidate.name === target.key) continue;
        const other = relationTarget(field, opts.tables, candidate.name);
        if (!other) continue;
        const tried = await matchValues(other, values, opts.lookup);
        if (countMatched(tried) > countMatched(found)) {
          found = tried;
          target.key = candidate.name;
        }
      }
    }

    matches.set(field.name, found);

    const missing: { value: string; rows: number }[] = [];
    let matched = 0;
    for (const [value, rows] of counts) {
      if (found.get(value)?.id) matched++;
      else missing.push({ value, rows });
    }
    missing.sort((a, b) => b.rows - a.rows);

    reports.push({ field, key: target.key, matched, missing });
  }

  return { matches, reports };
}
