/**
 * Traduccion entre los nombres que usa el HTML de un bloque y las tablas
 * de verdad.
 *
 * Vive aparte del componente que dibuja el bloque porque es donde se decide
 * que puede pedir un HTML y que no: sin fuente declarada no hay consulta.
 * Aqui no se toca la base, solo se arma lo que despues se le pedira.
 */
import { isOverlayField, isPeopleTable, MEMBER_FIELD, PEOPLE_ACCOUNT_FIELD } from "./people.ts";
import {
  type AppPerson,
  displayFieldOf,
  type FieldDef,
  type HtmlSource,
  isRelationField,
  orphanFieldName,
  type TableRecord,
} from "./types.ts";

/** Un fallo por culpa de lo que pidio el HTML, no de la base. */
export class SourceError extends Error {}

/**
 * Lo que se sabe de una columna de relacion al servir una fila.
 *
 * `display` es la columna del destino que se ensena; `declared` son las columnas
 * de ese destino que alguna fuente de la pagina declaro, que son las unicas que
 * pueden salir del registro enlazado.
 */
export interface ResolvedRelation {
  field: FieldDef;
  /** La tabla a la que apunta. Vacia si ya no existe. */
  target: TableRecord | null;
  /** Columna del destino que se ensena en lugar del id. */
  display: string;
  /** Nombre real de la columna del destino -> nombre con el que lo pide la pagina. */
  declared: Map<string, string>;
}

export interface Resolved {
  table: TableRecord;
  /** Nombre logico -> columna de verdad. */
  byLogical: Map<string, FieldDef>;
  /** Nombre logico -> lo que hace falta para resolver esa relacion. */
  relations: Map<string, ResolvedRelation>;
}

/** Sufijo con el que una fila entrega el enlace de una celda de relacion. */
export const LINK_SUFFIX = "_enlace";

/**
 * La forma vieja de una celda de relacion, mientras dure la transicion.
 *
 * Antes de este cambio una pagina recibia el id crudo en el nombre a secas.
 * Ahora ahi llega el valor que se ve, asi que el id sale ademas por aqui para
 * que una pagina ya escrita que lo necesitara siga teniendolo.
 *
 * **Como se sabe que ya no la pide nadie.** El id de un registro no se escribe
 * a mano en ninguna parte, asi que una pagina solo puede nombrarlo por este
 * sufijo. Se retira cuando ningun documento de ninguna aplicacion lo mencione:
 *
 *     grep -o '[a-zA-Z_][a-zA-Z0-9_]*_id' <documentos de las paginas>
 *
 * Hasta entonces se entrega siempre. Cuesta un campo por celda y es la unica
 * pieza de este cambio que puede romper una pagina que ya funcionaba.
 */
export const OLD_ID_SUFFIX = "_id";

/**
 * Busca la fuente en el manifiesto del bloque.
 * Una fuente que no este declarada se rechaza aqui, antes de mirar nada.
 */
export function resolveSource(
  sources: HtmlSource[],
  tables: TableRecord[],
  name: unknown,
): Resolved {
  const wanted = String(name ?? "");
  const source = sources.find((s) => s.name === wanted);
  if (!source) throw new SourceError(`El bloque no declara la fuente "${wanted}".`);

  const table = tables.find((t) => t.id === source.tableId);
  if (!table) throw new SourceError(`La tabla de "${wanted}" ya no existe.`);

  const byLogical = new Map<string, FieldDef>();
  for (const [logical, id] of Object.entries(source.fields ?? {})) {
    const field = (table.fields ?? []).find((f) => f.id === id);
    if (field) byLogical.set(logical, field);
  }

  const relations = new Map<string, ResolvedRelation>();
  for (const [logical, field] of byLogical) {
    if (!isRelationField(field)) continue;
    const target = tables.find((t) => t.id === field.relationTableId) ?? null;
    relations.set(logical, {
      field,
      target,
      display: displayFieldOf(field) || firstTextField(target),
      declared: declaredOf(sources, field, target),
    });
  }

  return { table, byLogical, relations };
}

/**
 * Lo que la pagina declaro de la tabla a la que apunta una relacion.
 *
 * De un registro enlazado solo puede salir lo que este declarado, igual que
 * ocurre con las columnas de la tabla que se pide. Si no, la relacion seria un
 * agujero por el que salen columnas que nadie declaro.
 *
 * Se mira en todas las fuentes de la pagina que apunten a esa tabla: declararla
 * una vez basta. La columna que ensena entra siempre, porque es lo que la propia
 * definicion de la columna dice que se ve.
 */
function declaredOf(
  sources: HtmlSource[],
  field: FieldDef,
  target: TableRecord | null,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!target) return out;

  // Las dos columnas del sistema de la tabla de personas no estan en ninguna
  // fuente --no se piden, se tienen-- y son las que dicen quien es alguien.
  // Entran siempre, como entra la columna que se ensena.
  if (isPeopleTable(target)) {
    out.set(PEOPLE_ACCOUNT_FIELD, PEOPLE_ACCOUNT_FIELD);
    out.set("email", "email");
    out.set("name", "name");
  }

  for (const source of sources) {
    if (source.tableId !== target.id) continue;
    for (const [logical, id] of Object.entries(source.fields ?? {})) {
      const column = (target.fields ?? []).find((f) => f.id === id);
      if (column) out.set(column.name, logical);
    }
  }

  const display = displayFieldOf(field) || firstTextField(target);
  if (display && !out.has(display)) out.set(display, display);
  return out;
}

/**
 * El respaldo de las columnas de relacion de antes de este cambio, que no
 * declaran que ensenan: la primera columna de texto del destino, que es lo que
 * la grilla venia adivinando. La migracion lo deja escrito y esto deja de usarse.
 */
export function firstTextField(target: TableRecord | null): string {
  if (!target) return "";
  const found = (target.fields ?? []).find((f) => f.type === "text" || f.type === "email");
  return found?.name ?? "";
}

/** Las relaciones que hay que traerse resueltas al pedir filas. */
export function expandOf(resolved: Resolved): string {
  const names = [...resolved.relations.values()]
    .filter((rel) => rel.declared.size > 0)
    .map((rel) => rel.field.name);
  return names.join(",");
}

/**
 * Las columnas de una persona que no estan en su fila.
 *
 * El correo vive en la cuenta y los roles en el enlace con la aplicacion, asi
 * que el expand de la base trae la fila sin ellos. Se superponen aqui, encima
 * de lo que la fila si trae. Ver `isOverlayField` en `shared/people.ts`.
 */
function personOverlay(person: AppPerson): Record<string, unknown> {
  return {
    [PEOPLE_ACCOUNT_FIELD]: person.email,
    email: person.email,
    name: person.name,
    roles: person.roles,
  };
}

/**
 * Una celda de relacion tal como llega al documento.
 *
 * `valor` esta siempre: con enlace es lo que ensena el registro, y sin enlace es
 * lo que se escribio y no encontro dueno. Por eso agrupar y contar se hace por
 * `valor` y nunca por `id`: agrupando por id las filas sin enlace se caerian de
 * las graficas en silencio y el total no cuadraria con la tabla.
 */
export interface LinkCell {
  /** Id del registro enlazado. Vacio: no hay enlace. */
  id: string;
  /** Hay id guardado pero el registro ya no existe o no esta al alcance. */
  roto: boolean;
  /** Las columnas declaradas del registro enlazado. Vacio si no hay enlace. */
  registro: Record<string, unknown> | null;
}

/** La celda de relacion resuelta: el valor que se ve y el enlace que hay detras. */
function relationCell(
  rel: ResolvedRelation,
  record: Record<string, unknown>,
  people: AppPerson[],
): { valor: string; enlace: LinkCell } {
  const id = record[rel.field.name];

  if (!id) {
    // Sin enlace: el valor que se escribio sigue a la vista.
    const orphan = record[orphanFieldName(rel.field.name)];
    return {
      valor: orphan == null ? "" : String(orphan),
      enlace: { id: "", roto: false, registro: null },
    };
  }

  const expanded = (record.expand as Record<string, unknown> | undefined)?.[rel.field.name] as
    Record<string, unknown> | undefined;

  // La fila de una persona llega sin su correo ni sus roles: no estan en su
  // coleccion. Se le superponen los de la lista de invitados, que el llamador
  // ya resolvio. Sin fila --porque quien mira no la alcanza-- la lista sola
  // basta para saber de quien se trata.
  const person = isPeopleTable(rel.target)
    ? people.find((p) => p.fila === String(id) || p.id === String(expanded?.[MEMBER_FIELD] ?? ""))
    : undefined;
  const linked =
    expanded || person
      ? { ...(expanded ?? {}), ...(person ? personOverlay(person) : {}) }
      : undefined;

  if (!linked) {
    // Hay id pero el registro no vino: se borro, ya no esta invitada o quedo
    // fuera del alcance de quien mira. No se vacia en silencio; se dice que
    // esta roto.
    return { valor: "", enlace: { id: String(id), roto: true, registro: null } };
  }

  const registro: Record<string, unknown> = {};
  for (const [real, logical] of rel.declared) registro[logical] = linked[real];
  const shown = linked[rel.display];

  return {
    valor: shown == null ? "" : String(shown),
    enlace: { id: String(id), roto: false, registro },
  };
}

export function columnOf(resolved: Resolved, logical: string): FieldDef {
  const field = resolved.byLogical.get(logical);
  if (!field) throw new SourceError(`El bloque no declara la columna "${logical}".`);
  return field;
}

/**
 * Una fila con los nombres que espera el HTML, no con los de la tabla.
 *
 * Una columna de relacion llega como dos cosas: el nombre a secas es el valor
 * que se ve --texto, siempre presente, con enlace o sin el-- y el nombre con
 * `LINK_SUFFIX` es el enlace que hay detras. Que debajo viva un id no aparece
 * en ninguna pantalla.
 */
export function toLogicalRow(
  resolved: Resolved,
  record: Record<string, unknown>,
  people: AppPerson[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = { id: record.id };
  for (const [logical, field] of resolved.byLogical) {
    const rel = resolved.relations.get(logical);
    if (!rel || field.multiple === true) {
      out[logical] = record[field.name];
      continue;
    }
    const cell = relationCell(rel, record, people);
    out[logical] = cell.valor;
    out[`${logical}${LINK_SUFFIX}`] = cell.enlace;
    // La forma vieja, mientras dure la transicion. Ver `OLD_ID_SUFFIX`.
    out[`${logical}${OLD_ID_SUFFIX}`] = cell.enlace.id;
  }
  return out;
}

/**
 * Los valores que llegan del HTML, pasados a las columnas de verdad.
 *
 * En una relacion lo que llega es la llave, no el id: el id nunca se escribe a
 * mano. Aqui solo se deja en el corralito del valor sin dueno; quien guarda la
 * fila lo resuelve contra la tabla destino y decide cual de las dos columnas
 * reales se llena.
 */
export function toRealValues(resolved: Resolved, values: unknown): Record<string, unknown> {
  if (!values || typeof values !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [logical, value] of Object.entries(values as Record<string, unknown>)) {
    if (logical === "id") continue;
    // El enlace es de lectura: se escribe la llave, no el id que hay detras.
    if (
      logical.endsWith(LINK_SUFFIX) &&
      resolved.relations.has(logical.slice(0, -LINK_SUFFIX.length))
    ) {
      continue;
    }
    const field = columnOf(resolved, logical);
    const rel = resolved.relations.get(logical);
    if (rel && field.multiple !== true) {
      out[orphanFieldName(field.name)] = value == null ? "" : String(value);
      continue;
    }
    out[field.name] = value;
  }
  return out;
}

/** Columnas donde tiene sentido buscar texto. */
const SEARCHABLE = ["text", "longtext", "email", "url", "select"];

/**
 * Por donde se alcanza, desde la fila que apunta, la columna que se ensena.
 *
 * Casi siempre es un salto: la relacion y la columna del destino. El correo de
 * una persona son dos --la fila de personas no lo guarda, lo guarda su cuenta--
 * y los roles no son ninguno: viven en el enlace con la aplicacion, que no
 * cuelga de la fila. Por esa ultima solo queda comparar contra el valor sin
 * dueno. Ver `isOverlayField` en `shared/people.ts`.
 */
const ACCOUNT_PATH: Record<string, string> = {
  [PEOPLE_ACCOUNT_FIELD]: PEOPLE_ACCOUNT_FIELD,
  // La forma vieja de nombrar el correo, que columnas de antes de este cambio
  // todavia guardan como lo que ensenan.
  email: PEOPLE_ACCOUNT_FIELD,
  name: "name",
};

function displayPath(rel: ResolvedRelation): string {
  const plain = `${rel.field.name}.${rel.display}`;
  // En cualquier otra tabla "nombre" o "correo" son columnas suyas y viven en
  // su coleccion: el salto de siempre.
  if (!isPeopleTable(rel.target)) return plain;
  if (!isOverlayField(rel.target, rel.display) && !(rel.display in ACCOUNT_PATH)) return plain;
  const column = ACCOUNT_PATH[rel.display];
  return column ? `${rel.field.name}.${MEMBER_FIELD}.${column}` : "";
}

/**
 * Comparar una relacion por el valor que ensena, en sus dos columnas reales.
 *
 * Mirar solo la relacion dejaria fuera las filas sin enlace, que son filas
 * validas con un valor a la vista: buscar "CC123" tiene que encontrarlas.
 */
function relationMatch(rel: ResolvedRelation, op: string, literal: string): string {
  const orphan = `${orphanFieldName(rel.field.name)} ${op} ${literal}`;
  if (!rel.display) return `(${orphan})`;
  const path = displayPath(rel);
  if (!path) return `(${orphan})`;
  return `(${path} ${op} ${literal} || ${orphan})`;
}

/**
 * El filtro, armado a partir de lo que pidio el HTML.
 * El HTML nunca escribe el filtro: da columnas y valores, y se compone aqui.
 */
export function buildFilter(resolved: Resolved, opts: Record<string, unknown>): string {
  const clauses: string[] = [];

  const filtro = opts.filtro;
  if (filtro && typeof filtro === "object") {
    for (const [logical, value] of Object.entries(filtro as Record<string, unknown>)) {
      const field = columnOf(resolved, logical);
      const rel = resolved.relations.get(logical);
      if (rel && field.multiple !== true) {
        // Se filtra por el valor que se ve, en las dos columnas reales: si no,
        // las filas sin enlace nunca casarian con nada.
        clauses.push(relationMatch(rel, "=", JSON.stringify(String(value ?? ""))));
        continue;
      }
      clauses.push(`${field.name} = ${JSON.stringify(value ?? "")}`);
    }
  }

  const buscar = typeof opts.buscar === "string" ? opts.buscar.trim() : "";
  if (buscar) {
    const term = JSON.stringify(buscar);
    const parts = [...resolved.byLogical]
      .map(([logical, field]) => {
        const rel = resolved.relations.get(logical);
        if (rel && field.multiple !== true) return relationMatch(rel, "~", term);
        return SEARCHABLE.includes(field.type) ? `${field.name} ~ ${term}` : "";
      })
      .filter(Boolean);
    if (parts.length) clauses.push(`(${parts.join(" || ")})`);
  }

  return clauses.join(" && ");
}

/** Columnas que pone PocketBase sola y que un orden puede nombrar. */
const AUTO = new Set(["id", "created", "updated"]);

/**
 * El orden con el que se piden las filas de una tabla.
 *
 * Sin orden dicho se ensena por antiguedad: la primera fila creada es la
 * primera que se ve, igual que en el editor de datos y en lo que se exporta.
 * La id desempata a las que nacieron en el mismo lote y comparten el instante.
 */
export function buildSort(resolved: Resolved, orden: unknown): string {
  if (typeof orden !== "string" || !orden.trim()) return "created,id";
  return orden
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const sign = trimmed.startsWith("-") || trimmed.startsWith("+") ? trimmed[0] : "";
      const logical = sign ? trimmed.slice(1) : trimmed;
      if (AUTO.has(logical)) return `${sign}${logical}`;
      const field = columnOf(resolved, logical);
      const rel = resolved.relations.get(logical);
      // Ordenar por una relacion ordena por el id, que no significa nada para
      // quien mira. Se ordena por el valor sin dueno, que es lo unico que la
      // base sabe comparar aqui; el orden fino se hace en la pagina, que ya
      // tiene el valor de cada fila.
      if (rel && field.multiple !== true) return `${sign}${orphanFieldName(field.name)}`;
      return `${sign}${field.name}`;
    })
    .join(",");
}
