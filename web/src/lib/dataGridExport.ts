/**
 * Exportar la grilla: descargar o copiar las filas, elegidas, todas o solo lo
 * seleccionado, en el formato pedido.
 */
import type { AppPerson, TableRecord } from "@shared/types";

import type { Row } from "./cellValues";
import { ROW_ORDER } from "./dropFiles";
import { errorMessage, pb } from "./pb";
import { mergeOverlay, type PersonOverlay } from "./peopleGrid";
import {
  brokenLinkWarning,
  copyText,
  downloadBlob,
  downloadFile,
  exportName,
  rowsToCsv,
  rowsToJson,
  rowsToMatrix,
} from "./tableExport";

/**
 * En que formato sale la tabla.
 *
 * `csv` y `json` se descargan y se copian; `excel` solo se descarga, porque
 * un `.xlsx` es un archivo binario y no hay nada que pegar en otro sitio.
 */
export type ExportFormat = "csv" | "json" | "excel";

export interface ExportOutcome {
  /** Falta cuando la exportacion fallo antes de poder calcularlo. */
  warning?: string;
  error: string;
}

/** Descarga o copia las filas pasadas en el formato elegido. */
export async function exportTable(opts: {
  table: TableRecord;
  items: Row[];
  people: AppPerson[];
  csvSeparator: string;
  kind: "download" | "copy";
  format: ExportFormat;
}): Promise<ExportOutcome> {
  const { table, items, people, csvSeparator, kind, format } = opts;
  // Un enlace que ya no resuelve sale como celda vacía. Se dice antes, no
  // después de que alguien abra el archivo y eche en falta una columna.
  const warning = brokenLinkWarning(table.fields, items, people);
  try {
    // Una hoja de cálculo no se copia al portapapeles: es un archivo binario,
    // así que solo se ofrece descargarla y aquí solo llega ese camino.
    if (format === "excel") {
      const { header, body } = rowsToMatrix(table.fields, items, people);
      const { sheetBlob } = await import("./sheet");
      downloadBlob(exportName(table, "xlsx"), await sheetBlob(header, body, table.label));
    } else if (format === "csv") {
      const csv = rowsToCsv(table.fields, items, csvSeparator, people);
      if (kind === "download")
        downloadFile(exportName(table, "csv"), csv, "text/csv;charset=utf-8");
      else await copyText(csv);
    } else {
      const json = rowsToJson(table.fields, items, people);
      if (kind === "download") downloadFile(exportName(table, "json"), json, "application/json");
      else await copyText(json);
    }
    return { warning, error: "" };
  } catch (err) {
    return { warning, error: errorMessage(err) };
  }
}

/** Descarga o copia toda la tabla (las filas se piden en el momento). */
export async function exportAll(opts: {
  table: TableRecord;
  relationFields: string[];
  isPeople: boolean;
  overlay: Map<string, PersonOverlay>;
  people: AppPerson[];
  csvSeparator: string;
  kind: "download" | "copy";
  format: ExportFormat;
}): Promise<ExportOutcome> {
  const { table, relationFields, isPeople, overlay, people, csvSeparator, kind, format } = opts;
  try {
    // Por antiguedad: el archivo que sale de aquí puede volver a entrar
    // arrastrandolo, y alli cada fila cae sobre la que ocupa su mismo sitio.
    //
    // Con las relaciones resueltas: una columna de relación se exporta por el
    // valor que enseña, y ese valor vive en el registro enlazado.
    const all = await pb
      .collection(table.dataCollection)
      .getFullList<Row>({ sort: ROW_ORDER, expand: relationFields.join(",") });
    // Las filas recien pedidas vienen sin las columnas del sistema, que no
    // estan en la colección. Sin esto el archivo saldria con la cuenta, el
    // nivel y los roles en blanco.
    return await exportTable({
      table,
      items: isPeople ? mergeOverlay(all, overlay) : all,
      people,
      csvSeparator,
      kind,
      format,
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/** Descarga o copia solo las filas marcadas con la casilla. */
export function exportSelected(opts: {
  table: TableRecord;
  rows: Row[];
  selected: Set<string>;
  people: AppPerson[];
  csvSeparator: string;
  kind: "download" | "copy";
  format: ExportFormat;
}): Promise<ExportOutcome> {
  const { rows, selected, ...rest } = opts;
  return exportTable({ ...rest, items: rows.filter((r) => selected.has(r.id)) });
}
