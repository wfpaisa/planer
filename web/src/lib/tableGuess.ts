/**
 * A que tabla pertenece un archivo de datos que se solto en el constructor.
 *
 * Tres capas, de la mas segura a la menos: los identificadores que trae, sus
 * columnas, y su nombre. Se para en la primera que decida. Ver `design.md` D3
 * de `relacion-automatica-con-personas`.
 *
 * Vive aparte de `dropFiles.ts` porque aquí no hay ni archivo ni base: entra lo
 * que el archivo ya dijo --su nombre, sus columnas, sus filas-- y sale una
 * tabla o nada. Preguntarle a la base si unos identificadores existen se recibe
 * como función, que es lo que deja comprobar las tres capas sin navegador.
 */
import { slugify, type TableRecord } from "@shared/types";

/**
 * Donde empieza la cola de un nombre de archivo.
 *
 * El mismo informe sale una y otra vez y cada vuelta trae su marca detras:
 * `chequeo_preoperacional-2026-08-12-v2.csv`, `ventas_20260825.csv`, o el
 * `ventas (2).csv` que pone el navegador al bajarlo dos veces. Desde la marca
 * hasta el final no hay nombre, solo cuando y cual: se corta ahi.
 *
 * Se reconoce solo lo que no puede ser otra cosa: seis digitos o mas de fecha
 * seguidos, una versión con su `v` delante, o una copia entre parentesis. Un
 * `presupuesto-2026` es el nombre de la tabla, no una fecha, y se respeta.
 */
const NAME_TAIL =
  /[\s._-]+(\d{4}[-_/.]?\d{2}[-_/.]?\d{2}|\d{2}[-_/.]\d{2}[-_/.]\d{4}|\d{4}[-_.]?\d{2}|v\d+)\b.*$|\s*\(\d+\)\s*$/i;

/** El nombre del archivo sin su extension. */
const withoutExtension = (name: string) => name.replace(/\.[^.]+$/, "").trim();

/** El nombre del archivo sin extension y sin la cola de fecha o de versión. */
export function fileTitle(name: string): string {
  const base = withoutExtension(name);
  return base.replace(NAME_TAIL, "").trim() || base;
}

/** Dos nombres son el mismo si solo se diferencian en tildes, guiones o mayusculas. */
export const sameName = (a: string, b: string) => {
  const left = slugify(a, "");
  return left !== "" && left === slugify(b, "");
};

/** La columna que el exportado pone delante y que no es un dato de la tabla. */
const isIdColumn = (column: string) => column.trim().toLowerCase() === "id";

/** Lo que el archivo trae, ya leido. */
export interface FileShape {
  /** El nombre del archivo tal cual, con su extension. */
  name: string;
  columns: string[];
  rows: string[][];
}

/** Si alguna de esas filas existe ya en esa tabla. Lo contesta la base. */
export type IdsExist = (table: TableRecord, ids: string[]) => Promise<boolean>;

/**
 * Cuantos identificadores del archivo se le preguntan a cada tabla.
 *
 * Una muestra basta: los identificadores solo pueden venir de la tabla que los
 * emitio, así que uno que exista ya la senala. Se piden varios y no uno para
 * que una fila anadida a mano al principio del archivo no despiste.
 */
const ID_SAMPLE = 5;

/**
 * Capa 1: las tablas donde ya existe alguno de los identificadores del archivo.
 *
 * Es la única capa que no se rompe al cambiar el nombre del archivo ni sus
 * columnas. Solo corre cuando el archivo trae columna `id`, que es lo que
 * pone el exportado.
 */
export async function tablesByIds(
  tables: TableRecord[],
  shape: FileShape,
  idsExist: IdsExist,
): Promise<TableRecord[]> {
  const at = shape.columns.findIndex(isIdColumn);
  if (at < 0) return [];

  const sample = [
    ...new Set(shape.rows.map((row) => String(row[at] ?? "").trim()).filter(Boolean)),
  ].slice(0, ID_SAMPLE);
  if (sample.length === 0) return [];

  const out: TableRecord[] = [];
  for (const table of tables) {
    if (await idsExist(table, sample).catch(() => false)) out.push(table);
  }
  return out;
}

/**
 * Capa 2: las tablas cuyas columnas son exactamente las del archivo.
 *
 * Exactamente: una de mas o una de menos y esta capa no decide. Un archivo al
 * que le falta una columna puede ser de esa tabla o de otra parecida, y elegir
 * por parecido es lo que llena una tabla de datos ajenos.
 *
 * Se compara contra el nombre tecnico y contra la etiqueta, ignorando
 * mayusculas, tildes y separadores, que es la misma regla con la que
 * `importIntoTable` lleva cada columna a su sitio.
 */
export function tablesByColumns(tables: TableRecord[], shape: FileShape): TableRecord[] {
  const columns = shape.columns.filter((column) => column.trim() && !isIdColumn(column));
  if (columns.length === 0) return [];

  return tables.filter((table) => {
    const left = [...(table.fields ?? [])];
    if (left.length !== columns.length) return false;
    for (const column of columns) {
      const at = left.findIndex((f) => sameName(f.name, column) || sameName(f.label, column));
      if (at < 0) return false;
      left.splice(at, 1);
    }
    return true;
  });
}

/**
 * Capa 3: las tablas que se llaman como el archivo.
 *
 * Contra el nombre tecnico y contra la etiqueta: el exportado se nombra hoy con
 * la etiqueta, y los archivos que salieron antes de este cambio llevan el
 * nombre tecnico. Los dos tienen que volver a su tabla.
 *
 * Y solo eso: que el archivo empiece por el nombre de una tabla no basta. Un
 * `chequeo_otro.csv` no es el `chequeo` de nadie, es otra cosa con un nombre
 * parecido, y termina --como debe-- en una tabla nueva.
 */
export function tablesByName(tables: TableRecord[], fileName: string): TableRecord[] {
  const nombre = fileTitle(fileName);
  return tables.filter((table) => sameName(table.label, nombre) || sameName(table.name, nombre));
}

/**
 * La tabla a la que pertenece el archivo, o nada.
 *
 * Una capa que encuentra mas de una tabla no elige: pasa a la siguiente. La
 * etiqueta de una tabla no tiene por que ser única --solo lo es el nombre
 * tecnico-- y escribir en una tabla elegida entre varias candidatas es meter
 * datos donde nadie dijo.
 */
export async function guessTable(
  tables: TableRecord[],
  shape: FileShape,
  idsExist: IdsExist,
): Promise<TableRecord | null> {
  if (tables.length === 0) return null;
  const decide = (found: TableRecord[]) => (found.length === 1 ? found[0] : null);

  return (
    decide(await tablesByIds(tables, shape, idsExist)) ??
    decide(tablesByColumns(tables, shape)) ??
    decide(tablesByName(tables, shape.name))
  );
}
