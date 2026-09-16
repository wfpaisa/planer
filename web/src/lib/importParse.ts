import {
  keyCandidates,
  type Lookup,
  type Match,
  matchValues,
  relationTarget,
} from "@shared/relations";
import { type FieldDef, isRelationField, type TableRecord } from "@shared/types";

/**
 * Lectura e interpretacion de un archivo o texto pegado para importar a una
 * tabla. El CSV se parsea a mano (sin dependencias) respetando el separador
 * elegido, los campos entre comillas, las comillas escapadas y los saltos de
 * linea dentro de un campo. El JSON puede venir como lista de objetos o de
 * listas.
 */

/** Cuantas filas de datos se pueden importar de una vez. */
export const MAX_IMPORT_ROWS = 5000;

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
function tokenizeCsv(text: string, separator: string): string[][] {
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

/* ------------------------------------------------------------------ */
/* Conversion de valores                                               */
/* ------------------------------------------------------------------ */

export type ConvertResult = { ok: true; value: unknown } | { ok: false; error: string };

/** Normaliza una fecha a lo que entiende PocketBase (ISO 8601 con zona). */
function normalizeDate(value: string): string | null {
  // ISO: 2025-01-02, 2025-01-02T12:30, 2025-01-02 12:30:00.000Z (lo que devuelve la base)
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?(?:Z)?)?)?$/.exec(value);
  if (iso) {
    const [, y, m, d, hh = "0", mm = "0", ss = "0"] = iso;
    return `${y}-${m}-${d}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.000Z`;
  }
  // Dia primero (dia/mes/ano), como se escribe en espanol.
  const diaMes = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (diaMes) {
    const [, d, m, y] = diaMes;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00.000Z`;
  }
  return null;
}

/**
 * Convierte una celda de texto al valor que guarda la tabla. Las columnas de
 * archivo no se convierten (no se pueden subir archivos importando): quedan
 * vacias.
 *
 * Las de persona y relacion salen de aqui como el texto que traia el archivo:
 * emparejarlo con un registro hace falta consultar la tabla destino, y eso se
 * hace despues y de golpe para todo el archivo. Ver `matchRelationColumns`.
 */
/**
 * Lo que en un archivo quiere decir que si, y lo que quiere decir que no.
 *
 * Cada sistema lo escribe a su manera --una exportacion trae "Activo", otra
 * "TRUE", otra "on"-- y todas significan lo mismo. La lista se lee normalizada
 * (sin tildes, sin mayusculas), asi que "Sí" y "si" son la misma palabra.
 *
 * Es tambien de donde `guessType` (en `importPlan.ts`) saca si una columna
 * nueva nace como casilla: adivinar y convertir tienen que entender las mismas
 * palabras, o la columna nace de un tipo que despues rechaza sus propias filas.
 */
export const BOOL_TRUE = ["si", "s", "yes", "y", "1", "true", "verdadero", "activo", "on"];
export const BOOL_FALSE = ["no", "n", "0", "false", "falso", "inactivo", "off"];

/** Una celda de si/no, sin tildes ni mayusculas que estorben. */
export const boolWord = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function convertValue(field: FieldDef, raw: string): ConvertResult {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };

  switch (field.type) {
    case "number": {
      if (!/^[+-]?\d+([.,]\d+)?$/.test(value)) return { ok: false, error: "No es un número" };
      return { ok: true, value: Number(value.replace(",", ".")) };
    }
    case "bool": {
      const low = boolWord(value);
      if (BOOL_TRUE.includes(low)) return { ok: true, value: true };
      if (BOOL_FALSE.includes(low)) return { ok: true, value: false };
      return { ok: false, error: 'Usa "si" o "no"' };
    }
    case "date": {
      const normalized = normalizeDate(value);
      if (!normalized) return { ok: false, error: "Formato de fecha no reconocido" };
      return { ok: true, value: normalized };
    }
    case "select":
      if (field.multiple) {
        return {
          ok: true,
          value: value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
      }
      return { ok: true, value };
    case "file":
      return { ok: true, value: null };
    case "relation":
      // El texto de la llave, sin tocar. Se empareja despues.
      return { ok: true, value };
    default:
      return { ok: true, value };
  }
}

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
