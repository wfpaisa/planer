import type { FieldType, TableRecord } from "@shared/types";

/**
 * Exportar e importar la estructura (las columnas) de una tabla como JSON.
 * El archivo no lleva ids: al importar en otra tabla las columnas se crean
 * nuevas con sus propios ids.
 */

export const STRUCTURE_FORMAT = "plane-columnas";

export interface StructureColumn {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  multiple?: boolean;
  relationTableId?: string;
  /** Que columna del destino ensena la relacion. */
  displayField?: string;
  /** Que columna del destino va entre parentesis detras. */
  detailField?: string;
  unique?: boolean;
}

export type StructureResult =
  | { ok: true; columns: StructureColumn[]; invalid: { index: number; message: string }[] }
  | { ok: false; error: string };

/**
 * Serializa las columnas de una tabla para descargarlas.
 *
 * Sale lo que el constructor definio y nada mas. Una columna de relacion ocupa
 * dos columnas reales en la base --la relacion y su valor sin dueno-- pero eso
 * es cosa de como se guarda: aqui es una sola columna, que es como se penso.
 */
export function structureToJson(table: TableRecord): string {
  const columnas = table.fields.map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type,
    ...(f.required ? { required: true } : {}),
    ...(f.options?.length ? { options: f.options } : {}),
    ...(f.multiple ? { multiple: true } : {}),
    ...(f.relationTableId ? { relationTableId: f.relationTableId } : {}),
    ...(f.displayField ? { displayField: f.displayField } : {}),
    ...(f.detailField ? { detailField: f.detailField } : {}),
    ...(f.unique ? { unique: true } : {}),
  }));
  return JSON.stringify({ formato: STRUCTURE_FORMAT, version: 1, columnas }, null, 2);
}

const FIELD_TYPES = new Set<FieldType>([
  "text",
  "longtext",
  "number",
  "bool",
  "email",
  "url",
  "date",
  "select",
  "file",
  "relation",
]);

/** Valida una columna y la deja lista para crearse. */
function sanitizeColumn(
  raw: unknown,
  tables: TableRecord[],
): { column?: StructureColumn; message?: string } {
  if (!raw || typeof raw !== "object") return { message: "No es un objeto" };
  const source = raw as Record<string, unknown>;

  const label =
    (typeof source.label === "string" && source.label.trim()) ||
    (typeof source.name === "string" && source.name.trim()) ||
    "";
  const name =
    (typeof source.name === "string" && source.name.trim()) ||
    (typeof source.label === "string" && source.label.trim()) ||
    "";
  if (!label) return { message: "Falta el nombre de la columna" };

  const type = source.type;
  if (typeof type !== "string" || !FIELD_TYPES.has(type as FieldType)) {
    return { message: `Tipo desconocido: ${String(type)}` };
  }
  if (type === "relation") {
    const target = tables.find((t) => t.id === source.relationTableId);
    if (!target) {
      return {
        message: "La columna de relación apunta a una tabla que no existe en esta aplicación",
      };
    }
  }

  const column: StructureColumn = { name, label, type: type as FieldType };
  if (source.required === true) column.required = true;
  if (source.multiple === true) column.multiple = true;
  if (Array.isArray(source.options)) {
    column.options = source.options
      .filter((o): o is string => typeof o === "string")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  if (type === "relation" && typeof source.relationTableId === "string") {
    column.relationTableId = source.relationTableId;
  }
  if (typeof source.displayField === "string" && source.displayField.trim()) {
    column.displayField = source.displayField.trim();
  }
  if (typeof source.detailField === "string" && source.detailField.trim()) {
    column.detailField = source.detailField.trim();
  }
  if (source.unique === true) column.unique = true;
  return { column };
}

/**
 * Lee un texto y lo interpreta como estructura de columnas. Acepta el
 * formato propio (envuelto en `plane-columnas`) o una lista plana de
 * columnas. Las columnas que no se pueden crear (tipo desconocido, relacion
 * sin destino) se separan en `invalid` en vez de romper el resto.
 */
export function parseStructure(text: string, tables: TableRecord[]): StructureResult {
  let data: unknown;
  try {
    data = JSON.parse(text.trim());
  } catch {
    return { ok: false, error: "No se pudo leer el JSON" };
  }

  let list: unknown;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const raw = data as Record<string, unknown>;
    if (raw.formato === STRUCTURE_FORMAT && Array.isArray(raw.columnas)) list = raw.columnas;
    else return { ok: false, error: "No parece una estructura de columnas" };
  } else {
    return { ok: false, error: "No parece una estructura de columnas" };
  }

  const items = list as unknown[];
  if (items.length === 0) return { ok: false, error: "La estructura no tiene columnas" };

  const columns: StructureColumn[] = [];
  const invalid: { index: number; message: string }[] = [];
  items.forEach((item, index) => {
    const { column, message } = sanitizeColumn(item, tables);
    if (column) columns.push(column);
    else invalid.push({ index, message: message ?? "Columna no valida" });
  });
  return { ok: true, columns, invalid };
}
