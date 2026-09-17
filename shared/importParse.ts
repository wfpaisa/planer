/**
 * Leer un archivo de datos: CSV, texto separado o JSON.
 *
 * Vive en `shared/` y no en el navegador porque hay dos lados que leen el mismo
 * archivo. El navegador lo lee para la importacion manual --la previsualizacion
 * de `ImportModal`-- y el servidor lo lee para contarle a la IA lo que trae un
 * adjunto y para llenar una tabla desde el (`server/aiFiles.ts`). Que las dos
 * lecturas sean la misma es lo que hace que lo que se ve antes de importar sea
 * lo que despues entra.
 *
 * El CSV se parsea a mano (sin dependencias) respetando el separador elegido,
 * los campos entre comillas, las comillas escapadas y los saltos de linea
 * dentro de un campo. El JSON puede venir como lista de objetos o de listas.
 *
 * La lectura de hojas de calculo (`.xlsx`) no esta aqui: depende de una
 * libreria de navegador y el archivo llega ya convertido a filas y columnas.
 */

/** Una tabla recien leida: nombres de columna y celdas como texto. */
export interface ParsedTable {
  columns: string[];
  rows: string[][];
}

export type ParseResult = { ok: true; data: ParsedTable } | { ok: false; error: string };

/** Convierte una celda a texto plano para el parseo. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Deja los nombres de columna unicos y con algo escrito. */
function normalizeColumns(header: string[]): string[] {
  const seen = new Map<string, number>();
  return header.map((name, i) => {
    const base = name.trim() || `columna_${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

/** Trocea el texto en filas y celdas sin preocuparse aun por los encabezados. */
export function tokenizeCsv(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === separator) {
      pushField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) pushRow();

  // Quita las lineas vacias del final.
  while (rows.length && rows[rows.length - 1].every((c) => !c.trim())) rows.pop();
  return rows;
}

/** Separadores que se prueban cuando nadie dijo cual usar. */
const SEPARATORS = [",", ";", "\t", "|"];

/**
 * Adivina el separador de un CSV mirando el encabezado y las primeras filas.
 * Gana el que parte en mas columnas manteniendo el mismo ancho fila a fila: un
 * separador equivocado casi siempre deja una sola columna o anchos dispares.
 */
export function detectSeparator(text: string): string {
  let best = ",";
  let bestWidth = 0;
  for (const sep of SEPARATORS) {
    const rows = tokenizeCsv(text, sep).slice(0, 10);
    if (!rows.length) continue;
    const width = rows[0].length;
    if (width < 2) continue;
    if (!rows.every((r) => r.length === width)) continue;
    if (width > bestWidth) {
      bestWidth = width;
      best = sep;
    }
  }
  return best;
}

function parseCsv(text: string, separator: string): ParseResult {
  const table = tokenizeCsv(text, separator);
  const nonEmpty = table.filter((r) => r.some((c) => c.trim()));
  if (nonEmpty.length === 0) return { ok: false, error: "No hay datos para importar" };
  const [header, ...data] = nonEmpty;
  const columns = normalizeColumns(header);
  const rows = data.map((r) => columns.map((_, i) => r[i] ?? ""));
  return { ok: true, data: { columns, rows } };
}

function parseJson(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "No se pudo leer el JSON" };
  }
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "El JSON tiene que ser una lista con datos" };
  }

  // Lista de listas: la primera fila de texto puede ser el encabezado.
  if (Array.isArray(value[0])) {
    const raw = value as unknown[][];
    let header: string[] | null;
    let data: unknown[][];
    const first = raw[0];
    if (raw.length > 1 && first.every((c) => typeof c === "string")) {
      header = first.map((c) => String(c));
      data = raw.slice(1);
    } else {
      const width = Math.max(...raw.map((r) => r.length), 0);
      header = Array.from({ length: width }, (_, i) => `columna_${i + 1}`);
      data = raw;
    }
    const columns = normalizeColumns(header);
    const rows = data.map((r) => columns.map((_, i) => cellToString(r[i])));
    return { ok: true, data: { columns, rows } };
  }

  // Lista de objetos: las columnas son la union de sus claves.
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  if (columns.length === 0) return { ok: false, error: "El JSON no tiene columnas" };
  const rows = value.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return columns.map(() => "");
    }
    return columns.map((col) => cellToString((item as Record<string, unknown>)[col]));
  });
  return { ok: true, data: { columns, rows } };
}

/** Adivina el formato y parsea el contenido. */
export function parseImport(text: string, separator: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Pega un texto o arrastra un archivo" };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed);
  }
  return parseCsv(text, separator);
}
