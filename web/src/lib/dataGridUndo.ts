/**
 * Deshacer la ultima escritura hecha desde la cuadricula.
 *
 * Lo que se guarda no es un estado anterior de la tabla, sino el inverso de lo
 * que se acaba de mandar: por cada fila tocada, los mismos campos que viajaron
 * en el PATCH con el valor que tenian antes, y los ids de las filas que
 * nacieron. Deshacer es escribir eso; no hay transaccion que revertir.
 *
 * Se guardan los campos crudos y no el texto de la celda porque la celda no es
 * lo guardado: una fecha se ve en espanol y se guarda en ISO, y una relación se
 * ve como su llave pero ocupa dos campos --el enlace y el valor que queda a la
 * vista cuando no encontro dueno--. Cuales son esos dos solo lo sabe el cuerpo
 * del pedido, y por eso el inverso se arma alli, en `dataGridEdit.ts`, y no
 * aquí.
 *
 * Cada fila va por su id y nunca por su sitio en la pantalla. Es lo contrario
 * de la seleccion, que es posicional a propósito (ver `gridSelection.svelte.ts`):
 * una vuelta atras posicional escribiria sobre otras filas en cuanto se ordena
 * o se filtra. Ademas de eso, ordenar o filtrar tira lo recordado; el id es la
 * segunda barrera, no la única.
 *
 * Solo un nivel: lo recordado se reemplaza con cada escritura y se tira después
 * de usarlo. Una pila de varios pasos cabe aquí sin tocar nada mas.
 */
import type { TableRecord } from "@shared/types";

import type { RangeReport } from "./dataGridEdit";
import { type ImportRequest, writeBatches } from "./importSave";
import { post } from "./pb";

/** Una fila tal como estaba, con los campos que la escritura iba a cambiar. */
export interface UndoRow {
  id: string;
  /** Los mismos campos que mando el PATCH, con el valor anterior. */
  body: Record<string, unknown>;
  /** Cuantas celdas cubren esos campos. Una relación son dos campos y una celda. */
  cells: number;
}

/** El inverso de una escritura, listo para mandarse. */
export interface GridUndo {
  /** La tabla donde se escribio. */
  tableId: string;
  /** La colección de datos de esa tabla, para armar los pedidos. */
  collection: string;
  /** Las columnas que tenia la tabla al escribir. Si cambian, no se repone. */
  columns: string;
  /** Que fue lo que se hizo, para decirlo al deshacerlo. */
  done: "pegar" | "vaciar" | "escribir";
  rows: UndoRow[];
  /** Las filas que nacieron con la escritura: deshacerla es borrarlas. */
  born: string[];
}

/** Como le fue a un deshacer. */
export interface UndoReport extends RangeReport {
  /** Filas que se borraron por haber nacido con lo que se deshizo. */
  removed: number;
}

/**
 * La firma de las columnas de una tabla.
 *
 * Con el nombre y el tipo basta: reponer un campo que ya no existe falla la
 * fila entera, y reponer un texto en una columna que ahora es fecha la
 * rechazaria la base.
 */
export function columnSignature(table: TableRecord): string {
  return table.fields.map((f) => `${f.name}:${f.type}`).join("|");
}

/** Si lo recordado todavía se puede escribir sobre la tabla que se esta viendo. */
export function undoFits(table: TableRecord, undo: GridUndo | null): undo is GridUndo {
  if (!undo) return false;
  if (undo.tableId !== table.id) return false;
  if (undo.columns !== columnSignature(table)) return false;
  return undo.rows.length > 0 || undo.born.length > 0;
}

/** Si hay algo que deshacer de verdad. */
export function hasUndo(undo: GridUndo): boolean {
  return undo.rows.length > 0 || undo.born.length > 0;
}

/**
 * Escribe el inverso.
 *
 * Las filas que nacieron se borran por el servidor y no por la colección: es
 * donde vive la conducta declarada por cada columna al borrar una fila, la
 * misma que aplica el botón Borrar. Un DELETE directo se la saltaria.
 */
export async function revertGrid(undo: GridUndo): Promise<UndoReport> {
  const notes: string[] = [];
  let cells = 0;
  let failed = 0;

  if (undo.rows.length > 0) {
    const requests: ImportRequest[] = undo.rows.map((r, i) => ({
      method: "PATCH",
      url: `/api/collections/${undo.collection}/records/${r.id}`,
      body: r.body,
      row: i,
    }));
    const leftover = await writeBatches(requests, { continueOnError: true, leftover: new Set() });
    failed = leftover.size;
    undo.rows.forEach((r, i) => {
      if (!leftover.has(i)) cells += r.cells;
    });
  }

  let removed = 0;
  if (undo.born.length > 0) {
    const res = await post<{ borradas: number; fallidas: number }>(
      `/api/tables/${undo.tableId}/filas/borrar`,
      { ids: undo.born },
    ).catch(() => null);
    removed = res ? res.borradas : 0;
    const left = res ? res.fallidas : undo.born.length;
    if (left > 0) {
      notes.push(
        `${left === 1 ? "1 fila creada no se pudo borrar" : `${left} filas creadas no se pudieron borrar`}.`,
      );
    }
  }

  return { cells, created: 0, failed, removed, notes };
}

/**
 * Lo que se dice después de deshacer.
 *
 * Se cuenta en celdas repuestas y filas borradas, que es lo que se acaba de
 * hacer; lo que no entro va detras con su motivo, igual que en el parte de
 * cualquier escritura en bloque.
 */
export function undoSummary(report: UndoReport): { ok: boolean; text: string } {
  const parts: string[] = [];
  if (report.cells > 0) {
    parts.push(`Se repusieron ${report.cells} ${report.cells === 1 ? "celda" : "celdas"}.`);
  }
  if (report.removed > 0) {
    parts.push(
      `Se ${report.removed === 1 ? "borró 1 fila creada" : `borraron ${report.removed} filas creadas`}.`,
    );
  }
  if (report.failed > 0) {
    parts.push(
      `${report.failed === 1 ? "1 fila no entró" : `${report.failed} filas no entraron`}.`,
    );
  }
  parts.push(...report.notes);
  return {
    ok: report.failed === 0 && report.notes.length === 0,
    text: parts.join(" ") || "No había nada que deshacer.",
  };
}
