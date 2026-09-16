import {
  type AppPerson,
  type FieldDef,
  isRelationField,
  slugify,
  type TableRecord,
} from "@shared/types";

import { relationCell, type Row } from "./cellValues";

/**
 * Exportar una tabla a CSV, Excel o JSON. La exportacion incluye siempre la columna
 * `id` y usa los nombres tecnicos como cabecera, de modo que un archivo
 * exportado reimporta emparejandose limpio.
 *
 * **La contrasena no sale, y no porque se filtre.** Lo que se escribe aqui son
 * las columnas de la tabla, una por una, y la contrasena no es una columna: no
 * esta en `fields` ni en la fila. No hay una lista de la que excluirla, asi que
 * tampoco hay una lista que alguien pueda olvidarse de mantener. Si algun dia
 * se anade un tipo de columna que guarde secretos, esta es la funcion que hay
 * que volver a mirar. Ver `web/src/components/PersonPassword.tsx`.
 */

/**
 * Valor plano de una celda, tal como viaja en el archivo exportado.
 *
 * Una relacion sale con el valor de la columna que ensena, nunca con el id: es
 * lo que hace que el archivo se vuelva a emparejar al reimportarlo, y lo que
 * evita que un id aparezca en un archivo que alguien va a abrir.
 */
export function cellExportValue(field: FieldDef, row: Row, people: AppPerson[] = []): string {
  if (isRelationField(field) && field.multiple !== true) {
    // Con enlace, la llave del registro; sin el, el valor que se quedo sin
    // dueno. Un enlace roto no tiene nada que ensenar y sale vacio.
    return relationCell(row, field, people).label;
  }
  const value = row[field.name];
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "bool") return value ? "si" : "no";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** Cuantas filas saldran con una celda de relacion vacia por tener el enlace roto. */
export function brokenLinkCount(fields: FieldDef[], rows: Row[], people: AppPerson[] = []): number {
  const relations = fields.filter((f) => isRelationField(f) && f.multiple !== true);
  if (!relations.length) return 0;
  return rows.filter((row) =>
    relations.some((f) => relationCell(row, f, people).state === "broken"),
  ).length;
}

/** El aviso que se da antes de descargar, o vacio si no hay nada que avisar. */
export function brokenLinkWarning(
  fields: FieldDef[],
  rows: Row[],
  people: AppPerson[] = [],
): string {
  const count = brokenLinkCount(fields, rows, people);
  if (!count) return "";
  return count === 1
    ? "1 fila apunta a un registro que ya no existe: esa columna saldrá vacía."
    : `${count} filas apuntan a registros que ya no existen: esa columna saldrá vacía en ellas.`;
}

/** Escapa un valor para que viva dentro de un campo CSV. */
function csvCell(value: string, separator: string): string {
  if (/["\n\r]/.test(value) || value.includes(separator)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(
  fields: FieldDef[],
  rows: Row[],
  separator: string,
  people: AppPerson[] = [],
): string {
  const lines = [["id", ...fields.map((f) => f.name)].join(separator)];
  for (const row of rows) {
    const cells = [row.id ?? "", ...fields.map((f) => cellExportValue(f, row, people))];
    lines.push(cells.map((v) => csvCell(v, separator)).join(separator));
  }
  return lines.join("\n");
}

export function rowsToJson(fields: FieldDef[], rows: Row[], people: AppPerson[] = []): string {
  return JSON.stringify(
    rows.map((row) => {
      const out: Record<string, unknown> = { id: row.id ?? "" };
      for (const f of fields) {
        // La relacion sale por su llave tambien aqui: los dos formatos tienen
        // que reimportarse igual.
        out[f.name] =
          isRelationField(f) && f.multiple !== true
            ? cellExportValue(f, row, people)
            : (row[f.name] ?? "");
      }
      return out;
    }),
    null,
    2,
  );
}

/**
 * Las filas como matriz de texto, con la cabecera delante.
 *
 * Es lo mismo que sale al CSV --los nombres tecnicos arriba, la columna `id`
 * primero, las relaciones por el valor que ensenan-- pero sin escaparlo ni
 * unirlo con comas: una hoja de calculo guarda celdas, no una linea de texto.
 */
export function rowsToMatrix(
  fields: FieldDef[],
  rows: Row[],
  people: AppPerson[] = [],
): { header: string[]; body: string[][] } {
  return {
    header: ["id", ...fields.map((f) => f.name)],
    body: rows.map((row) => [row.id ?? "", ...fields.map((f) => cellExportValue(f, row, people))]),
  };
}

/**
 * Como se llama el archivo que sale de una tabla.
 *
 * Con la etiqueta y no con el nombre tecnico: la etiqueta es la que el
 * constructor ve, y un archivo llamado `personas.csv` cuando en pantalla dice
 * "Personas y roles" no se reconoce como suyo al volver a soltarlo.
 *
 * Pasa por el mismo saneado que cualquier nombre tecnico, asi que la etiqueta
 * con mayusculas, tildes y espacios sale como `personas-y-roles`. La capa que
 * reconoce el archivo al soltarlo compara con ese mismo saneado, y ademas
 * contra el nombre tecnico, para que los archivos de antes de este cambio
 * sigan volviendo a su tabla. Ver `tableGuess.ts`.
 */
export function exportName(
  table: Pick<TableRecord, "label" | "name">,
  ext: string,
  /** Lo que distingue dos archivos de la misma tabla, como `-columnas`. */
  suffix = "",
): string {
  return `${slugify(table.label || table.name, table.name || "tabla")}${suffix}.${ext}`;
}

/** Descarga lo que sea, con el nombre pedido. */
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  /*
   * La direccion se suelta despues, no en la misma vuelta: el navegador
   * empieza la descarga en la siguiente, y retirarsela antes le deja una
   * descarga cancelada --o un archivo vacio-- sin decir nada.
   */
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Descarga un archivo de texto con el nombre pedido. */
export function downloadFile(name: string, content: string, mime: string) {
  downloadBlob(name, new Blob([content], { type: mime }));
}

/**
 * Copia texto al portapapeles. Si el navegador bloquea la API moderna,
 * cae a un area oculta con `document.execCommand`.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
