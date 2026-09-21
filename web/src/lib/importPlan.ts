/**
 * El plan de una importacion: a donde va cada columna del archivo.
 *
 * Aparte del dialogo porque no es marcado. Leer el archivo ya vivia en
 * `importParse.ts`; esto es el paso siguiente --emparejar sus columnas con las
 * de la tabla y convertir cada celda-- y no necesita ver una sola etiqueta.
 */
import { type FieldDef, type FieldType, isRelationField, type TableRecord } from "@shared/types";

import { BOOL_FALSE, BOOL_TRUE, boolWord, convertValue, type ParsedTable } from "./importParse";

/**
 * El resumen de una importacion que ya cerro su dialogo.
 *
 * Lo cuenta quien abrio el dialogo, no el dialogo: un aviso dibujado ahi se va
 * con el modal en el mismo instante en que habria que leerlo.
 */
export interface ImportNote {
  text: string;
  /** Si entro todo. Falso: algo se quedo fuera y hay que decirlo mas alto. */
  ok: boolean;
}

/**
 * El parte de una importacion de personas, una frase por cifra.
 *
 * Tres cosas distintas pasan en la misma operacion --entran personas, se
 * enlazan filas de otras tablas, y unas cuantas se quedan sin enlazar-- y cada
 * una cuenta sujetos distintos: personas la primera, filas las otras dos. En
 * una sola frase con tres numeros no se sabe cual cuenta que, asi que va una
 * frase por cifra, y la que sea cero no dice nada.
 */
export function peopleImportNote(opts: {
  /** Lo que dijo la importacion misma: cuantas personas y cuantas nuevas. */
  saved: string;
  /** Filas que quedaron enlazadas, por tabla. */
  linked: { table: string; rows: number }[];
  /** Filas que siguen sin enlace, por tabla. */
  pending: { table: string; rows: number }[];
}): string {
  const filas = (n: number) => `${n} fila${n === 1 ? "" : "s"}`;
  const listar = (entries: { table: string; rows: number }[]) =>
    entries.map((e) => `${filas(e.rows)} de "${e.table}"`).join(", ");

  const partes = [opts.saved.trim()].filter(Boolean);
  if (opts.linked.length) partes.push(`Quedaron enlazadas ${listar(opts.linked)}.`);
  if (opts.pending.length) {
    partes.push(`Siguen sin enlace ${listar(opts.pending)}, señaladas en esa tabla.`);
  }
  return partes.join(" ");
}

/** A donde va cada columna del archivo. */
export type ColumnTarget =
  | { kind: "skip" }
  | { kind: "id" }
  | { kind: "field"; field: FieldDef }
  | { kind: "create"; draft: FieldDef };

export interface ColumnPlan {
  column: string;
  index: number;
  target: ColumnTarget;
}

export interface ImportError {
  row: number;
  column: string;
  message: string;
}

/**
 * Lo que se le pide a una columna aparte de a donde va.
 *
 * Sobre una columna que ya existe son condiciones de ESTA importacion y no un
 * cambio de la tabla: el archivo de nomina trae la cedula repetida en dos filas
 * y eso hay que verlo antes de escribirlo, no despues.
 *
 * Sobre una columna que nace del archivo son las dos cosas: se exigen al
 * importar y ademas la columna nace con ellas, igual que nace con el tipo que
 * se le eligio. Marcarlas mientras se declara la columna y encontrarla despues
 * sin ninguna era el camino raro. Ver `createColumns` en `importSave.ts`.
 */
export interface ColumnRule {
  /** No se repite: dos filas con el mismo valor no entran. */
  unique?: boolean;
  /** Obligatoria: una fila sin nada escrito no entra. */
  required?: boolean;
}

/** Una condicion incumplida, en su fila y su columna. */
export interface RuleIssue {
  /** La fila del archivo, contada desde 1 como en `ImportError`. */
  row: number;
  column: string;
  kind: "duplicate" | "missing";
}

/** Lo que dice una condicion incumplida, para el globo de la celda. */
export const ruleMessage = (kind: RuleIssue["kind"]): string =>
  kind === "duplicate"
    ? "Este valor se repite en otra fila"
    : "Esta columna es obligatoria y la celda esta vacia";

export interface ConvertedRow {
  id: string | null;
  values: Record<string, unknown>;
  errors: ImportError[];
}

export type SaveMode = "add" | "overwrite" | "replace";
export type RowStatus = "add" | "update" | "new" | "replace";

/** Tipos que se pueden pedir para una columna nueva nacida del archivo. */
export const CREATE_TYPES: FieldType[] = [
  "text",
  "longtext",
  "number",
  "bool",
  "date",
  "email",
  "url",
];

/** Columnas reservadas de PocketBase que el archivo no deberia crear como campos. */
const SYSTEM_COLUMNS = new Set(["id", "created", "updated"]);
/** Las de sistema que no se muestran ni se dejan elegir en la previsualizacion. */
export const IGNORED_SYSTEM_COLUMNS = new Set(["created", "updated"]);

/** Los separadores que se ofrecen, dichos con palabras y no con el simbolo. */
export const SEPARATORS: { value: string; label: string }[] = [
  { value: ";", label: "Punto y coma" },
  { value: ",", label: "Coma" },
];

/** Si lo pegado es JSON, donde el separador no pinta nada. */
export const looksJson = (text: string) => /^[[{]/.test(text.trim());

/**
 * Como suele venir el correo en un archivo de gente.
 *
 * En la tabla la columna se llama `cuenta` y se lee "Correo", pero lo que
 * exporta cualquier otro sistema dice `email`. Sin esta lista esa columna no
 * emparejaba con nada, se ofrecia crearla como columna de texto nueva, y la
 * importacion entera se iba al limbo: cada persona se reconoce por su correo,
 * asi que sin el no se actualiza a quien ya esta ni se crea a quien falta.
 */
const ACCOUNT_COLUMNS = ["email", "e-mail", "mail", "correo", "correo electronico", "cuenta"];

/**
 * Como se llama lo que nace de un archivo: una columna suya o la tabla entera.
 *
 * Mayuscula en la primera letra y nada mas: "full name" se lee "Full name" y no
 * "Full Name", que es como se escribe en ingles y no en espanol. Un encabezado
 * escrito a gritos ("NOMBRE COMPLETO") se baja entero antes de levantar la
 * primera; uno con una sigla dentro ("cedula NIT") se deja como venia, que la
 * sigla es suya.
 *
 * Lo que viene escrito como nombre tecnico --sin espacios, todo en minusculas y
 * con guiones o guiones bajos donde van las palabras-- se traduce de vuelta:
 * `codigo_empleado` se lee "Codigo empleado". Es lo contrario de exportar, que
 * nombra el archivo por la etiqueta de la tabla, y sin esto un archivo que sale
 * y vuelve crea una tabla llamada `chequeo-preoperacional`.
 *
 * Ver `design.md` D1 y D3 de `nombre-visible-desde-archivo`: una sigla escrita
 * en minusculas se pierde --`nit-empleado` se lee "Nit empleado"-- y una
 * palabra con guion de verdad se separa. Las dos se renombran en un clic desde
 * el panel, que es donde vive el nombre visible de todas formas.
 */
export function readableLabel(text: string): string {
  const clean = text.trim();
  if (!clean) return clean;
  // Con separadores no hay grito que bajar: "IVA_2026" no esta escrito a
  // gritos, es la sigla de alguien con su ano detras.
  const separado = /[-_]/.test(clean);
  const body = !separado && clean === clean.toUpperCase() ? clean.toLowerCase() : clean;
  // Y solo se traduce lo que de verdad viene escrito como nombre tecnico: con
  // un espacio o una mayuscula, el texto ya estaba escrito para leerse.
  const words =
    separado && !/\s/.test(body) && body === body.toLowerCase()
      ? body.replace(/[-_]+/g, " ")
      : body;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Las palabras de si/no que entiende la conversion, menos "1" y "0".
 *
 * La lista es la de `convertValue`: lo que se adivina y lo que se convierte
 * tienen que ser lo mismo. Los unos y ceros se quedan fuera solo para adivinar:
 * una columna de unos y ceros es casi siempre una cantidad, y nacer como
 * casilla le borraria el numero. Escritos en una columna que ya es de si/no,
 * siguen valiendo.
 */
const BOOL_WORDS = new Set([...BOOL_TRUE, ...BOOL_FALSE].filter((w) => w !== "1" && w !== "0"));

/**
 * De que tipo nace una columna nueva, mirando lo que trae dentro.
 *
 * Lo justo para no crear de texto lo que salta a la vista que no lo es: si
 * TODAS las celdas con algo escrito son correos, es de correo; si todas dicen
 * si o no, es de casilla. A la primera duda, texto --una columna de texto se
 * cambia despues sin perder nada, y una de numero mal adivinada deja fuera las
 * filas que no cuadren--.
 *
 * "1" y "0" no cuentan como si/no aunque `convertValue` los acepte: una columna
 * de unos y ceros es casi siempre una cantidad, y convertirla en casilla
 * borraria el numero.
 */
export function guessType(values: string[]): FieldType {
  // Con cincuenta celdas basta para saber de que va la columna.
  const sample = values
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (sample.length === 0) return "text";
  const todas = (fn: (v: string) => boolean) => sample.every(fn);

  if (todas((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return "email";
  if (todas((v) => BOOL_WORDS.has(boolWord(v)))) return "bool";
  if (todas((v) => /^[+-]?\d+([.,]\d+)?$/.test(v))) return "number";
  if (todas((v) => /^https?:\/\/\S+$/i.test(v))) return "url";
  // Las dos formas que lee `convertValue`: la ISO y la de dia primero.
  if (
    todas(
      (v) =>
        /^\d{4}-\d{2}-\d{2}([ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?Z?)?)?$/.test(v) ||
        /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(v),
    )
  ) {
    return "date";
  }
  if (sample.some((v) => v.length > 120)) return "longtext";
  return "text";
}

/** Para emparejar nombres sin que estorben mayusculas, tildes ni espacios. */
function loose(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function defaultMapping(
  parsed: ParsedTable,
  table: TableRecord,
): Record<string, ColumnTarget> {
  const out: Record<string, ColumnTarget> = {};
  const account = table.fields.find((f) => f.system === "cuenta");
  for (const column of parsed.columns) {
    const key = column.trim().toLowerCase();
    if (SYSTEM_COLUMNS.has(key)) {
      // id empareja por registro; created/updated son de la base y se ignoran.
      out[column] = key === "id" ? { kind: "id" } : { kind: "skip" };
      continue;
    }
    // El correo va a la cuenta antes que a nada. Va primero incluso si hay otra
    // columna que se llama igual: en la tabla de usuarios el correo es la
    // identidad de la fila, y mandarlo a una columna de texto cualquiera deja
    // la importacion sin poder reconocer a nadie.
    if (account && ACCOUNT_COLUMNS.includes(loose(column))) {
      out[column] = { kind: "field", field: account };
      continue;
    }
    // Primero tal cual y despues sin tildes ni mayusculas: un archivo escrito a
    // mano trae "correo" donde la tabla dice "Correo", y son la misma columna.
    const match =
      table.fields.find((f) => f.name === column || f.label === column) ??
      table.fields.find((f) => loose(f.name) === loose(column) || loose(f.label) === loose(column));
    if (match) out[column] = { kind: "field", field: match };
    else out[column] = { kind: "create", draft: newDraft(column, parsed) };
  }
  return out;
}

/**
 * La columna nueva que propone una columna del archivo: como se va a llamar y
 * de que tipo nace. El nombre lo pone el servidor al crearla.
 */
export function newDraft(column: string, parsed?: ParsedTable): FieldDef {
  const index = parsed?.columns.indexOf(column) ?? -1;
  const values = index >= 0 && parsed ? parsed.rows.map((r) => r[index] ?? "") : [];
  return { name: "", label: readableLabel(column), type: guessType(values) };
}

/** El destino que representa un valor de la lista de destinos. */
export function readTarget(value: string, column: string, table: TableRecord): ColumnTarget {
  if (value === "id") return { kind: "id" };
  if (value === "create") {
    return { kind: "create", draft: newDraft(column) };
  }
  const field = table.fields.find((f) => f.name === value.replace(/^field:/, ""));
  return field ? { kind: "field", field } : { kind: "skip" };
}

export function buildPlans(
  parsed: ParsedTable,
  mapping: Record<string, ColumnTarget>,
): ColumnPlan[] {
  return parsed.columns.map((column, index) => ({
    column,
    index,
    target: mapping[column] ?? { kind: "skip" },
  }));
}

export function convertRows(
  parsed: ParsedTable,
  plans: ColumnPlan[],
): { converted: ConvertedRow[]; errors: ImportError[] } {
  const converted: ConvertedRow[] = [];
  const errors: ImportError[] = [];
  for (let r = 0; r < parsed.rows.length; r++) {
    const raw = parsed.rows[r];
    const values: Record<string, unknown> = {};
    const rowErrors: ImportError[] = [];
    let id: string | null = null;
    for (const plan of plans) {
      const cell = (raw[plan.index] ?? "").trim();
      const target = plan.target;
      if (target.kind === "skip") continue;
      if (target.kind === "id") {
        if (cell) id = cell;
        continue;
      }
      const field = target.kind === "create" ? target.draft : target.field;
      const result = convertValue(field, cell);
      if (!result.ok) {
        rowErrors.push({ row: r + 1, column: plan.column, message: result.error });
        continue;
      }
      if (result.value !== null) values[field.name] = result.value;
    }
    converted.push({ id, values, errors: rowErrors });
    errors.push(...rowErrors);
  }
  return { converted, errors };
}

/**
 * Las filas que incumplen lo que se pidio de cada columna.
 *
 * Se mira el valor del archivo y no el convertido: lo que se compara es lo que
 * se lee en la grilla, y una celda que no se pudo convertir ya tiene su propio
 * error. Los repetidos se buscan sin distinguir mayusculas ni tildes --"Ana" y
 * "ana" son la misma persona-- y entre las filas del archivo: lo que ya esta en
 * la tabla no se consulta.
 *
 * Una celda vacia nunca cuenta como repetida; de eso se encarga "obligatoria".
 */
export function findRuleIssues(
  parsed: ParsedTable,
  plans: ColumnPlan[],
  rules: Record<string, ColumnRule>,
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  for (const plan of plans) {
    // Una columna apagada no se guarda: no hay nada que exigirle.
    if (plan.target.kind === "skip") continue;
    const rule = rules[plan.column];
    if (!rule?.unique && !rule?.required) continue;

    const seen = new Map<string, number[]>();
    parsed.rows.forEach((raw, r) => {
      const cell = (raw[plan.index] ?? "").trim();
      if (!cell) {
        if (rule.required) issues.push({ row: r + 1, column: plan.column, kind: "missing" });
        return;
      }
      if (!rule.unique) return;
      const key = loose(cell);
      const rows = seen.get(key);
      if (rows) rows.push(r + 1);
      else seen.set(key, [r + 1]);
    });

    // Se marcan todas las filas del grupo, no solo la segunda: cual sobra lo
    // decide quien importa, y para eso tiene que ver las dos.
    for (const rows of seen.values()) {
      if (rows.length < 2) continue;
      for (const row of rows) issues.push({ row, column: plan.column, kind: "duplicate" });
    }
  }
  return issues;
}

/**
 * Las columnas obligatorias de la tabla que la base rechaza vacias.
 *
 * No son todas las que el panel marca obligatorias. Una casilla y la mitad del
 * id de una relacion nacen sin obligar --ver `toPbField` y `toPbFields` en
 * `server/schema.ts`--, asi que exigirlas aqui detendria una importacion que la
 * base acepta sin queja. Las de sistema tampoco cuentan: su valor no vive en la
 * coleccion de la tabla y no se escribe por este camino.
 */
export function enforcedRequired(fields: FieldDef[]): FieldDef[] {
  return fields.filter(
    (f) =>
      f.required === true &&
      !f.system &&
      f.type !== "bool" &&
      !(isRelationField(f) && f.multiple !== true),
  );
}

/**
 * Lo que le falta a la importacion para que la base la acepte.
 *
 * Una columna obligatoria de la tabla a la que no llega ninguna columna del
 * archivo deja cada fila nueva sin ese dato, y PocketBase rechaza el lote
 * entero: la importacion se caia con "Batch transaction failed", que no dice ni
 * que columna falta ni que hacer con ella. Se mira antes, en la
 * previsualizacion, y se dice con el nombre de la columna.
 *
 * `blank` son las celdas vacias de una columna obligatoria que SI esta
 * emparejada: se devuelven como condicion incumplida --`missing`, la misma que
 * pone quien importa-- para que se pinten y detengan el boton por el camino que
 * ya existe. Pasa tambien al sobrescribir: el guardado manda la columna con
 * `null` dentro, asi que vaciarla se rechaza igual que no traerla nunca.
 */
export function findRequiredGaps(
  parsed: ParsedTable,
  plans: ColumnPlan[],
  fields: FieldDef[],
): { unmapped: FieldDef[]; blank: RuleIssue[] } {
  /*
   * Quien escribe cada columna de la tabla. Si dos columnas del archivo van a
   * la misma, se queda la ultima: es la que gana al guardar (ver `buildBody`).
   */
  const written = new Map<string, ColumnPlan>();
  for (const plan of plans) {
    if (plan.target.kind === "field") written.set(plan.target.field.name, plan);
  }

  const unmapped: FieldDef[] = [];
  const blank: RuleIssue[] = [];
  for (const field of enforcedRequired(fields)) {
    const plan = written.get(field.name);
    if (!plan) {
      unmapped.push(field);
      continue;
    }
    parsed.rows.forEach((raw, r) => {
      if ((raw[plan.index] ?? "").trim()) return;
      blank.push({ row: r + 1, column: plan.column, kind: "missing" });
    });
  }
  return { unmapped, blank };
}

export function targetKey(target: ColumnTarget): string {
  if (target.kind === "skip") return "skip";
  if (target.kind === "id") return "id";
  if (target.kind === "field") return `field:${target.field.name}`;
  return "create";
}
