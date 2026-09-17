/**
 * Que columnas ensena la grilla: las del sistema (id, created, updated) y las
 * que el constructor decidio ocultar.
 */
import type { FieldDef, TableRecord } from "@shared/types";

import { patch } from "./pb";

/**
 * Columnas que PocketBase crea solas en cada tabla. Son de solo lectura: el
 * constructor solo decide si las muestra o las oculta en la grilla.
 */
export const SYSTEM_COLUMNS = ["id", "created", "updated"] as const;

export const SYSTEM_COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  created: "Creado",
  updated: "Actualizado",
};

/** Vista de columna que usa la grilla para una columna del sistema. */
export function systemFieldDef(name: string): FieldDef {
  return {
    name,
    label: SYSTEM_COLUMN_LABELS[name] ?? name,
    type: name === "id" ? "text" : "date",
  };
}

export const isSystem = (name: string) =>
  SYSTEM_COLUMNS.includes(name as (typeof SYSTEM_COLUMNS)[number]);

/** Esconde o vuelve a mostrar una columna de negocio en la grilla. */
export async function toggleHidden(
  table: TableRecord,
  name: string,
  onSchemaChange: () => Promise<void>,
): Promise<void> {
  const hidden = table.meta?.hidden ?? [];
  const next = hidden.includes(name) ? hidden.filter((h) => h !== name) : [...hidden, name];
  await patch(`/api/tables/${table.id}`, { meta: { ...table.meta, hidden: next } });
  await onSchemaChange();
}

/** Muestra u oculta una columna del sistema (id, created, updated). */
export async function toggleSystemVisible(
  table: TableRecord,
  name: string,
  onSchemaChange: () => Promise<void>,
): Promise<void> {
  const current = table.meta?.systemVisible ?? [];
  const next = current.includes(name) ? current.filter((c) => c !== name) : [...current, name];
  await patch(`/api/tables/${table.id}`, { meta: { ...table.meta, systemVisible: next } });
  await onSchemaChange();
}
