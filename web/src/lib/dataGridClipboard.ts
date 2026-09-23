/**
 * El portapapeles de la grilla: de las celdas al texto y del texto a las celdas.
 *
 * El formato es el de cualquier hoja de cálculo --tabulador entre columnas,
 * salto de línea entre filas, comillas alrededor de lo que lleve alguno de los
 * dos--, y por eso lo copiado aquí se pega en Excel y lo copiado en Excel se
 * pega aquí sin conversion de por medio.
 *
 * Lo que se copia es lo que se lee, no lo que hay guardado: una relación sale
 * como su llave y no como el id, igual que se ve en la celda. Volver a pegarla
 * la resuelve contra la tabla destino, así que la vuelta entera --copiar,
 * pegar-- deja la misma fila enlazada aunque el id no haya viajado nunca.
 */
import { tokenizeCsv } from "@shared/importParse";
import type { AppPerson, FieldDef } from "@shared/types";

import { cellText, type Row, toInputValue } from "./cellValues";
import type { CellRange } from "./gridSelection.svelte";

/**
 * El texto de una celda para el portapapeles.
 *
 * Igual que `cellText` salvo en las fechas, que van en ISO corta: la lectura
 * en espanol ("12 sept 2025") no se vuelve a entender al pegarla, y ese viaje
 * de ida y vuelta es justo lo que tiene que funcionar.
 */
export function clipboardText(field: FieldDef, row: Row, people: AppPerson[]): string {
  if (field.type === "date") return toInputValue(field, row[field.name]);
  return cellText(field, row, people);
}

/** Envuelve en comillas lo que llevaria a leer mal la tabla. */
function quote(value: string): string {
  if (!/["\t\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** El rango elegido, como lo espera una hoja de cálculo. */
export function rangeToText(opts: {
  rows: Row[];
  fields: FieldDef[];
  range: CellRange;
  people: AppPerson[];
}): string {
  const lines: string[] = [];
  for (let r = opts.range.top; r <= opts.range.bottom; r++) {
    const row = opts.rows[r];
    if (!row) continue;
    const cells: string[] = [];
    for (let c = opts.range.left; c <= opts.range.right; c++) {
      const field = opts.fields[c];
      cells.push(field ? quote(clipboardText(field, row, opts.people)) : "");
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

/**
 * Lo pegado, como rejilla de texto.
 *
 * Siempre por tabulador: es lo que manda cualquier hoja de cálculo. Adivinar el
 * separador aquí haria que pegar una sola celda con un punto y coma dentro
 * --una dirección, una lista-- se partiera en dos columnas.
 *
 * Las filas cortas se rellenan hasta el ancho de la primera, para que el area
 * pegada sea un rectangulo y no una escalera.
 */
export function textToRange(text: string): string[][] {
  const rows = tokenizeCsv(text.replace(/\r\n?/g, "\n"), "\t");
  if (rows.length === 0) return [];
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => (r.length === width ? r : [...r, ...Array(width - r.length).fill("")]));
}
