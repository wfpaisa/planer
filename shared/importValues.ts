/**
 * Convertir una celda de texto al valor que guarda su columna.
 *
 * Es el paso siguiente a leer el archivo (`importParse.ts`) y vive aquí por lo
 * mismo: lo hacen los dos lados. El navegador convierte al importar a mano; el
 * servidor convierte al llenar una tabla desde un adjunto (`llenar_tabla`, en
 * `server/ai/aiPage/toolRuntime.ts`). Una sola lectura de lo que es una fecha, un número o un
 * "si" es lo que hace que las dos importaciones acepten los mismos archivos.
 */
import type { FieldDef } from "./types.ts";

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
 * Lo que en un archivo quiere decir que si, y lo que quiere decir que no.
 *
 * Cada sistema lo escribe a su manera --una exportacion trae "Activo", otra
 * "TRUE", otra "on"-- y todas significan lo mismo. La lista se lee normalizada
 * (sin tildes, sin mayusculas), así que "Sí" y "si" son la misma palabra.
 *
 * Es también de donde `guessType` (en `web/src/lib/importPlan.ts`) saca si una
 * columna nueva nace como casilla: adivinar y convertir tienen que entender las
 * mismas palabras, o la columna nace de un tipo que después rechaza sus propias
 * filas.
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

/**
 * Convierte una celda de texto al valor que guarda la tabla. Las columnas de
 * archivo no se convierten (no se pueden subir archivos importando): quedan
 * vacias.
 *
 * Las de persona y relación salen de aquí como el texto que traia el archivo:
 * emparejarlo con un registro hace falta consultar la tabla destino, y eso se
 * hace después y de golpe para todo el archivo. Ver `matchRelationColumns`.
 */
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
      // El texto de la llave, sin tocar. Se empareja después.
      return { ok: true, value };
    default:
      return { ok: true, value };
  }
}
