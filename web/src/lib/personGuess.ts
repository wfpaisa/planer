/**
 * Que columna de un archivo esta nombrando a un usuario de la aplicacion.
 *
 * Un archivo que sale de otro sistema no trae relaciones: trae la cedula, el
 * correo o el codigo pegado en cada fila. Ese texto ya identifica a alguien
 * --a alguien que suele estar invitado a la aplicacion-- y dejarlo suelto es
 * perder la unica pista que hay para enlazarlo.
 *
 * No se adivina por el nombre de la columna. Un archivo de verdad la llama
 * "cedula", "CC", "documento", "id_empleado" o "N° identificacion", y ninguna
 * lista de nombres cubre eso. Se mira el contenido: si los valores de una
 * columna son los que ya tienen los usuarios en alguna de las suyas, esa
 * columna los esta nombrando. La prueba es el dato, no la palabra.
 *
 * "Sin repetidos" tampoco se pregunta a la columna, se cuenta. Un valor que dos
 * usuarios comparten no nombra a ninguno, asi que no suma; los demas de esa
 * misma columna siguen valiendo. Descartar la columna entera por un valor
 * repetido dejaba fuera la cedula de toda una nomina por dos empleados mal
 * cargados.
 *
 * Aqui solo se cuenta. Quien decide es quien construye, en el dialogo que sale
 * al soltar el archivo: esto le pone delante lo que coincide y con cuanto.
 */
import { personKeyFields, personKeyValue } from "@shared/people";
import type { AppPerson, FieldDef, TableRecord } from "@shared/types";

/** Una columna de usuarios que reconoce lo que trae una columna del archivo. */
export interface PersonKeyMatch {
  /** Nombre tecnico de la columna de usuarios. */
  key: string;
  keyLabel: string;
  /** Cuantos valores distintos del archivo corresponden a un solo usuario. */
  matched: number;
  /**
   * Cuantos corresponden a mas de uno.
   *
   * No se enlazan --no se puede saber a cual-- y se guardan a la vista, igual
   * que los que no corresponden a nadie. Se cuentan aparte para poder decirlo
   * antes de crear la tabla: es un dato repetido en los usuarios, y quien
   * construye es el unico que puede arreglarlo.
   */
  ambiguous: number;
}

/** Una columna del archivo que parece nombrar usuarios, con lo que la respalda. */
export interface PersonColumnGuess {
  column: string;
  /** Su sitio en el archivo, para volver a su celda. */
  index: number;
  /** Cuantos valores distintos no vacios trae la columna. */
  values: number;
  /** Las columnas de usuarios que reconocen algo, la que mas primero. */
  keys: PersonKeyMatch[];
}

/** La relacion que se acepto en el dialogo. */
export interface PersonLink {
  /** Columna del archivo que pasa a ser de tipo persona. */
  column: string;
  /** Columna de usuarios que esa columna ensena y por la que empareja. */
  key: string;
}

/**
 * Un valor sirve de pista si es corto y no esta vacio.
 *
 * El tope no es capricho: una celda de trescientos caracteres es una nota, no
 * la cedula de nadie, y compararla contra la lista entera de usuarios cuesta
 * sin poder acertar nunca.
 */
const MAX_VALUE = 120;

/** Cuantos valores distintos se miran por columna. */
const MAX_VALUES = 500;

/** Los valores distintos de una columna, normalizados para comparar. */
function distinctValues(rows: string[][], index: number): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    const raw = String(row[index] ?? "").trim();
    if (!raw || raw.length > MAX_VALUE) continue;
    out.add(raw.toLowerCase());
    if (out.size >= MAX_VALUES) break;
  }
  return out;
}

/**
 * Lo que tienen los usuarios en cada una de sus columnas, y cuantos lo tienen.
 *
 * Se arma una vez y se consulta por columna: comparar cada valor contra cada
 * usuario seria recorrer la lista entera por cada celda distinta del archivo.
 *
 * Se guarda el recuento y no solo el valor porque de eso depende que un valor
 * sirva: uno que tienen dos usuarios no nombra a ninguno.
 */
function peopleIndex(
  people: AppPerson[],
  keys: { name: string; label: string }[],
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const key of keys) {
    const values = new Map<string, number>();
    for (const person of people) {
      const value = personKeyValue(person, key.name).trim().toLowerCase();
      if (value) values.set(value, (values.get(value) ?? 0) + 1);
    }
    out.set(key.name, values);
  }
  return out;
}

/**
 * Las columnas de usuarios que reconocen estos valores, la que mas primero.
 *
 * Es la comparacion sola, sin de donde vengan los valores: de un archivo que se
 * acaba de soltar o de una columna que la tabla ya tiene guardada. Las dos
 * preguntas son la misma --a quien nombra este texto-- y por eso la respuesta
 * se calcula en un solo sitio.
 */
function matchKeys(
  values: Set<string>,
  index: Map<string, Map<string, number>>,
  keys: { name: string; label: string }[],
): PersonKeyMatch[] {
  const out: PersonKeyMatch[] = [];
  for (const key of keys) {
    const known = index.get(key.name);
    if (!known || known.size === 0) continue;
    let matched = 0;
    let ambiguous = 0;
    for (const value of values) {
      const duenos = known.get(value) ?? 0;
      if (duenos === 1) matched++;
      else if (duenos > 1) ambiguous++;
    }
    // Sin un solo valor que nombre a alguien la columna no se propone: una
    // columna donde todo se repite --el nivel, el turno-- casaria con muchas
    // filas y no nombraria a nadie.
    if (matched > 0) out.push({ key: key.name, keyLabel: key.label, matched, ambiguous });
  }
  return out.sort((a, b) => b.matched - a.matched);
}

/**
 * Las columnas del archivo que estan nombrando usuarios, la mas clara primero.
 *
 * Se ordenan por proporcion y no por cantidad: veinte aciertos de veinte
 * valores es una cedula, y veinte de mil es una casualidad con muchas filas
 * detras. La proporcion distingue las dos; la cantidad, no.
 *
 * Una columna sin ningun acierto no se propone. Sin un solo valor que case, la
 * pregunta no tendria nada que la respalde y seria adivinar en voz alta.
 */
export function guessPersonColumns(opts: {
  columns: string[];
  rows: string[][];
  /** Solo estas columnas del archivo, con su sitio original. */
  kept: { column: string; index: number }[];
  tables: TableRecord[];
  people: AppPerson[];
}): PersonColumnGuess[] {
  if (opts.people.length === 0) return [];

  const keys = personKeyFields(opts.tables);
  if (keys.length === 0) return [];
  const index = peopleIndex(opts.people, keys);

  const out: PersonColumnGuess[] = [];
  for (const { column, index: at } of opts.kept) {
    const values = distinctValues(opts.rows, at);
    if (values.size === 0) continue;

    const matches = matchKeys(values, index, keys);
    if (matches.length === 0) continue;

    out.push({ column, index: at, values: values.size, keys: matches });
  }

  return out.sort((a, b) => b.keys[0].matched / b.values - a.keys[0].matched / a.values);
}

/** Una columna de texto ya guardada que resulta estar nombrando personas. */
export interface PersonTextColumn {
  table: TableRecord;
  field: FieldDef;
  /** Cuantos valores distintos no vacios tiene la columna. */
  values: number;
  /** Las columnas de personas que reconocen algo, la que mas primero. */
  keys: PersonKeyMatch[];
}

/**
 * Las columnas de texto que ya estan en una tabla y resultan nombrar personas.
 *
 * Es la misma comparacion que al soltar un archivo, mirada desde el otro lado
 * del tiempo: alli las filas llegan antes que la columna, y aqui la columna
 * llevaba meses guardada cuando por fin se invita a la gente que nombra. En los
 * dos casos lo que decide es el contenido, nunca el nombre de la columna.
 *
 * No convierte nada: devuelve lo que respalda la pregunta, y quien contesta es
 * quien construye. Ver `design.md` D9.
 */
export function guessPersonFields(opts: {
  /** Las tablas donde buscar, sin la de personas. */
  tables: TableRecord[];
  /** Todas las tablas de la aplicacion: de ahi salen las llaves de persona. */
  all: TableRecord[];
  /** Las filas leidas de cada tabla, por su identificador. */
  rows: Map<string, Record<string, unknown>[]>;
  people: AppPerson[];
}): PersonTextColumn[] {
  if (opts.people.length === 0) return [];

  const keys = personKeyFields(opts.all);
  if (keys.length === 0) return [];
  const index = peopleIndex(opts.people, keys);

  const out: PersonTextColumn[] = [];
  for (const table of opts.tables) {
    const rows = opts.rows.get(table.id) ?? [];
    if (rows.length === 0) continue;

    for (const field of table.fields ?? []) {
      // Solo texto suelto: una columna que ya apunta a algun sitio no hay que
      // convertirla, y una fecha o un numero no nombran a nadie.
      if (field.type !== "text" || field.multiple === true || field.system !== undefined) continue;

      const values = new Set<string>();
      for (const row of rows) {
        const raw = String(row[field.name] ?? "").trim();
        if (!raw || raw.length > MAX_VALUE) continue;
        values.add(raw.toLowerCase());
        if (values.size >= MAX_VALUES) break;
      }
      if (values.size === 0) continue;

      const matches = matchKeys(values, index, keys);
      if (matches.length === 0) continue;
      out.push({ table, field, values: values.size, keys: matches });
    }
  }

  // La mas clara primero, por proporcion y no por cantidad: es lo mismo que
  // ordena las columnas de un archivo, y por la misma razon.
  return out.sort((a, b) => b.keys[0].matched / b.values - a.keys[0].matched / a.values);
}
