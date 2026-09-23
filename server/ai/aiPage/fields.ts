/**
 * Validacion de las columnas de tabla que propone la IA, y del emparejamiento
 * con el que llena una tabla desde un archivo.
 */
import type { ParsedTable } from "../../../shared/importParse.ts";
import { keyCandidates } from "../../../shared/relations.ts";
import type {
  AccessDirection,
  AppPerson,
  FieldDef,
  FieldType,
  TableRecord,
} from "../../../shared/types.ts";
import { identifier } from "../../schema.ts";

/**
 * Los tipos de columna que la IA puede crear.
 *
 * `relation` esta aquí y no en el cambio de tipo: crear una columna que apunta
 * a otra tabla es cosa suya, convertir una que ya existe no. Ver `design.md`
 * D6 de `ia-crea-columnas-de-relacion`.
 */
export const FIELD_TYPES = [
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
];

/**
 * Los tipos a los que la IA puede pedir que cambie una columna que ya existe.
 *
 * Convertir a relación conserva los valores guardados, y eso lo resuelve el
 * camino del constructor. Aquí no aparece, y el ejecutor lo rechaza aparte:
 * el listado es una restriccion del modelo, no una comprobacion.
 */
export const RETYPE_TYPES = FIELD_TYPES.filter((type) => type !== "relation");

/**
 * Las columnas que propone la IA, o por que no se puede crear ninguna.
 *
 * Devuelve un texto cuando algo no cuadra, y ese texto es la respuesta que
 * recibe la IA: lo lee y corrige en la vuelta siguiente, dentro de la misma
 * petición. Por eso dice el paso que falta y no solo que fallo.
 *
 * Un rechazo para la orden entera, no solo para la columna: crear la tabla sin
 * la columna que se rechazo deja una tabla equivocada y la IA sigue
 * construyendo la pantalla encima. Ver `design.md` D4.
 *
 * Necesita las tablas de la aplicación porque la IA nombra el destino de una
 * relación por su nombre tecnico --el mismo con el que nombra tablas en las
 * demás ordenes-- y lo que se guarda es su identificador.
 */
export function normalizeFieldDefs(raw: unknown, tables: TableRecord[]): FieldDef[] | string {
  if (!Array.isArray(raw)) return [];
  const types = new Set(FIELD_TYPES);
  const out: FieldDef[] = [];

  for (const item of raw) {
    const f = item as Record<string, unknown>;
    const label = String(f.label ?? "").trim();
    if (!label) continue;

    const type = (types.has(String(f.type)) ? String(f.type) : "text") as FieldType;
    const field: FieldDef = {
      name: identifier(label),
      label,
      type,
      required: f.required === true,
      // Lo que marca la IA se guarda marcado: es la llave con la que se
      // empareja al importar y por la que otras tablas la apuntan.
      unique: f.unique === true ? true : undefined,
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    };

    if (type === "relation") {
      const wanted = String(f.relationTable ?? "").trim();
      const target = tables.find((table) => table.name === wanted);
      if (!target) {
        return `Error: there is no table called "${wanted}" in this app. Create it first, then point at it.`;
      }

      /*
       * Sin una columna que sirva de llave, la celda no tiene que ensenar ni
       * con que emparejar. Se pregunta por las que pueden serlo y no por la
       * marca de única: las de la tabla de personas llegan importando la
       * nómina y nadie vuelve a marcarlas.
       */
      const keys = keyCandidates(target);
      if (keys.length === 0) {
        return `Error: the table "${target.name}" has no column that can be its key, so nothing can point at it yet. Add one to it with "agregar_columnas", marked unique, and then point at it.`;
      }

      const wantedKey = String(f.displayColumn ?? "").trim();
      const key = wantedKey ? keys.find((k) => k.name === wantedKey) : keys[0];
      if (!key) {
        const names = keys.map((k) => k.name).join(", ");
        return `Error: "${wantedKey}" is not a column of "${target.name}" that can be its key. These are: ${names}.`;
      }

      field.relationTableId = target.id;
      field.displayField = key.name;
    }

    out.push(field);
  }

  return out;
}

/** A que columna de la tabla va cada columna del archivo. */
export interface FillPlan {
  /** Columna del archivo --por su posicion-- y columna de la tabla. */
  pairs: { index: number; column: string; field: FieldDef }[];
  /** Las columnas del archivo que no se emparejaron con ninguna. */
  unmapped: string[];
}

/**
 * Lee el emparejamiento que mando la IA y lo comprueba contra la tabla.
 *
 * Devuelve un texto cuando algo no cuadra, y ese texto es lo que la IA lee: lo
 * corrige en la vuelta siguiente, dentro de la misma petición. Un rechazo para
 * el emparejamiento entero, no columna a columna: llenar la tabla a medias deja
 * filas que hay que buscar después.
 */
export function planFill(parsed: ParsedTable, table: TableRecord, raw: unknown): FillPlan | string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return `"columnas" is missing: say which column of the file goes into which column of "${table.name}". The file's columns are: ${parsed.columns.join(", ")}.`;
  }

  const fields = table.fields ?? [];
  const pairs: FillPlan["pairs"] = [];
  const taken = new Set<string>();

  for (const item of raw) {
    const entry = item as Record<string, unknown>;
    const column = String(entry.columna ?? "").trim();
    const target = String(entry.destino ?? "").trim();
    if (!column || !target) continue;

    const index = parsed.columns.findIndex(
      (c) => c === column || c.toLowerCase() === column.toLowerCase(),
    );
    if (index === -1) {
      return `the file has no column called "${column}". Its columns are: ${parsed.columns.join(", ")}.`;
    }

    const field =
      fields.find((f) => f.name === target) ??
      fields.find((f) => f.label.toLowerCase() === target.toLowerCase());
    if (!field) {
      const names = fields.filter((f) => !f.system).map((f) => f.name);
      return `"${table.name}" has no column called "${target}". Its columns are: ${names.join(", ")}. Add the one you need with "agregar_columnas" before filling.`;
    }
    if (field.system !== undefined) {
      return `"${field.name}" holds the app's access (the account or the roles) and is not written from a file.`;
    }
    if (field.type === "file") {
      return `"${field.name}" is a file column and cannot be filled from a data file.`;
    }
    // Dos columnas del archivo a la misma columna de la tabla: la segunda
    // pisaria a la primera sin que se vea. Se dice antes de escribir nada.
    if (taken.has(field.name)) {
      return `two columns of the file are pointed at "${field.name}". Each column of the table takes one.`;
    }
    taken.add(field.name);
    pairs.push({ index, column: parsed.columns[index], field });
  }

  if (!pairs.length) {
    return `no column of the file was paired with a column of "${table.name}". The file's columns are: ${parsed.columns.join(", ")}.`;
  }

  return {
    pairs,
    unmapped: parsed.columns.filter((_, i) => !pairs.some((p) => p.index === i)),
  };
}

/**
 * Si un cambio de acceso da o quita.
 *
 * Da en cuanto quede con un rol que no tenia. Un mismo cambio que anada uno y
 * quite otro cuenta como que da: lo que se abre es lo que no se deshace.
 */
export function accessDirection(person: AppPerson, roles: string[]): AccessDirection {
  return roles.some((role) => !person.roles.includes(role)) ? "dar" : "quitar";
}
