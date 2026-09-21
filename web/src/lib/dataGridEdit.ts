/**
 * Escribir desde la propia grilla: una celda, un rango vaciado, un rango pegado.
 *
 * La grilla dejo de ser solo de lectura, pero el cajon lateral no sobra: aqui
 * se escribe lo que cabe en una celda --un texto, un numero, una fecha, una
 * llave-- y alli lo que no --un archivo, varias relaciones, una fila entera que
 * todavia no existe--. `inlineEditable` es la frontera, y esta escrita una sola
 * vez para que la celda, el teclado y el pegado no puedan discrepar.
 *
 * Lo que se pega no se guarda como texto: pasa por la misma conversion que la
 * importacion (`convertValue`) y por el mismo emparejado de llaves
 * (`matchRelationColumns`), asi que una columna de fecha recibe una fecha y una
 * de relacion queda enlazada al registro que le toca --o con su valor a la
 * vista, sin enlace, que tambien es un estado valido--. Sin eso, pegar una
 * columna desde Excel llenaria la tabla de texto en columnas que no lo son.
 *
 * Cada escritura devuelve ademas su inverso: los mismos campos que mando, con
 * el valor que la fila tenia antes. Se arma aqui y no en la cuadricula porque
 * solo aqui se sabe que campos viajan --una relacion son dos-- y se tiene la
 * fila de antes a mano, sin volver a pedirla. Ver `dataGridUndo.ts`.
 */
import { isOverlayField, isPeopleTable, MEMBER_FIELD } from "@shared/people";
import { type Match, relationCellValues } from "@shared/relations";
import { type AppPerson, type FieldDef, isRelationField, type TableRecord } from "@shared/types";

import type { Row } from "./cellValues";
import { isSystem } from "./dataGridColumns";
import { columnSignature, type GridUndo, type UndoRow } from "./dataGridUndo";
import type { CellRange, CellRef } from "./gridSelection.svelte";
import { convertValue, matchRelationColumns } from "./importParse";
import { type ImportRequest, writeBatches } from "./importSave";
import { pb } from "./pb";
import { type PersonOverlay, savePersonRow } from "./peopleGrid";
import { panelLookup, resolveRowValues } from "./relations";

/**
 * Si esta columna se puede escribir desde la celda.
 *
 * Quedan fuera tres cosas, cada una por su motivo: las del sistema (id y las dos
 * fechas) las pone la base; los archivos necesitan un selector y una subida; y
 * una relacion multiple no cabe en una linea. La columna que enlaza con la
 * cuenta tampoco: no es un dato, es de quien es la fila.
 */
export function inlineEditable(table: TableRecord, field: FieldDef): boolean {
  if (isSystem(field.name)) return false;
  if (field.type === "file") return false;
  if (isPeopleTable(table) && field.name === MEMBER_FIELD) return false;
  if (isRelationField(field) && field.multiple === true) return false;
  return true;
}

/**
 * Si esta columna entra en una escritura en bloque --pegar, vaciar--.
 *
 * El correo y los roles de la tabla de personas se escriben desde su celda,
 * pero de una en una: no estan en la coleccion, sino en la cuenta y en el
 * enlace con la aplicacion, y eso se cambia por la API de miembros, que no
 * tiene lote. Pegar una columna de roles sobre doscientas personas serian
 * doscientas peticiones encadenadas, asi que aqui se dice que no y se explica.
 */
export function bulkEditable(table: TableRecord, field: FieldDef): boolean {
  return inlineEditable(table, field) && !isOverlayField(table, field.name);
}

/** Las columnas de un rango, ya emparejadas con su sitio. */
function columnsOf(fields: FieldDef[], range: CellRange): { index: number; field: FieldDef }[] {
  const out: { index: number; field: FieldDef }[] = [];
  for (let c = range.left; c <= range.right; c++) {
    const field = fields[c];
    if (field) out.push({ index: c, field });
  }
  return out;
}

/**
 * Lo que la fila tenia en los campos que se van a escribir.
 *
 * Se recorre el cuerpo del pedido y no las columnas del rango: una relacion
 * escribe dos campos por una sola celda, y solo el cuerpo sabe cuales. Un campo
 * que la fila no trae vuelve como vacio, que es lo que era.
 */
function previousValues(row: Row, body: Record<string, unknown>): Record<string, unknown> {
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(body)) before[key] = row[key] ?? null;
  return before;
}

/* ------------------------------------------------------------------ */
/* Una celda                                                            */
/* ------------------------------------------------------------------ */

/**
 * Guarda lo que se escribio en una celda y devuelve la fila como quedo, con el
 * inverso de lo que acaba de escribir.
 *
 * Por el mismo camino que el cajon lateral: lo que se escribe en una relacion
 * es la llave, y `resolveRowValues` decide cual de sus dos columnas reales se
 * llena. La fila vuelve con los enlaces expandidos porque la celda ensena la
 * llave del registro, no su id.
 *
 * El correo, el nivel y los roles de una persona vuelven sin inverso: no se
 * escriben en la coleccion sino por la API de miembros, y esa puerta no tiene
 * vuelta atras en bloque.
 */
export async function writeCell(opts: {
  table: TableRecord;
  tables: TableRecord[];
  people: AppPerson[];
  row: Row;
  field: FieldDef;
  value: unknown;
  /** Lo que se sabe de cada persona fuera de su coleccion. Solo en personas. */
  overlay?: Map<string, PersonOverlay>;
}): Promise<{ row: Row; undo: GridUndo | null }> {
  const { table, tables, people, row, field, value } = opts;

  /*
   * El correo y los roles no viven en la coleccion de la tabla: viven en la
   * cuenta y en el enlace con la aplicacion. Se escriben por la API de
   * miembros, que es la misma puerta que usa el cajon lateral.
   */
  if (isOverlayField(table, field.name)) {
    // Sin clave: por aqui se corrige el correo o los roles de alguien que ya
    // esta, nunca se da de alta. La clave solo se elige al crear la fila.
    const saved = await savePersonRow({
      appId: table.app,
      table,
      overlay: opts.overlay ?? new Map(),
      row,
      values: { [field.name]: value },
    });
    return { row: saved.row, undo: null };
  }

  const resolved = await resolveRowValues({
    table,
    tables,
    values: { [field.name]: value },
    touched: new Set([field.name]),
    people,
  });
  // `resolveRowValues` recorre la tabla entera y trae las demas columnas como
  // `undefined`; solo viaja la que se toco.
  const body: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(resolved)) {
    if (v !== undefined) body[key] = v;
  }

  const before = previousValues(row, body);

  const expand = table.fields
    .filter((f) => isRelationField(f) && f.multiple !== true)
    .map((f) => f.name)
    .join(",");
  const saved = await pb.collection(table.dataCollection).update<Row>(row.id, body, { expand });
  return {
    row: saved,
    undo: {
      tableId: table.id,
      collection: table.dataCollection,
      columns: columnSignature(table),
      done: "escribir",
      rows: [{ id: row.id, body: before, cells: 1 }],
      born: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Un rango                                                             */
/* ------------------------------------------------------------------ */

/** Como le fue a una escritura en bloque. */
export interface RangeReport {
  /** Celdas que llegaron a la tabla. */
  cells: number;
  /** Filas que nacieron con lo pegado, si se pidio crearlas. */
  created: number;
  /** Filas que no entraron enteras. */
  failed: number;
  /**
   * Lo que quedo fuera y hay que decir: columnas que no se escriben, valores
   * que no son de su tipo, filas que no cabian.
   */
  notes: string[];
  /**
   * El inverso de lo que se escribio, listo para deshacerlo. Falta cuando no
   * se escribio nada. Ver `dataGridUndo.ts`.
   */
  undo?: GridUndo;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Manda los pedidos ya armados y cuenta como fue.
 *
 * `bornIds` entra vacio y sale con el id de cada fila que nacio, por el sitio
 * que ocupaba en el pedido: sin el no se puede deshacer un pegado que creo
 * filas, porque ese id no esta en ningun otro sitio.
 */
async function send(
  requests: ImportRequest[],
  cells: number,
  notes: string[],
  created = 0,
  bornIds?: Map<number, string>,
): Promise<RangeReport> {
  if (requests.length === 0) return { cells: 0, created: 0, failed: 0, notes };
  const leftover = await writeBatches(requests, {
    continueOnError: true,
    leftover: new Set(),
    created: bornIds,
  });
  return { cells, created, failed: leftover.size, notes };
}

/**
 * Vacia las celdas del rango.
 *
 * Una columna obligatoria no se vacia: la base rechazaria la fila entera y lo
 * que se perderia es el resto del rango, no esa celda. Se dice cual fue.
 */
export async function clearRange(opts: {
  table: TableRecord;
  rows: Row[];
  fields: FieldDef[];
  range: CellRange;
}): Promise<RangeReport> {
  const { table, rows, fields, range } = opts;
  const notes: string[] = [];

  const columns = columnsOf(fields, range).filter(({ field }) => {
    if (!bulkEditable(table, field)) return false;
    if (field.required) {
      notes.push(`"${field.label}" es obligatoria y se dejó como estaba.`);
      return false;
    }
    return true;
  });
  if (columns.length === 0) {
    if (notes.length === 0) notes.push("Ninguna de esas columnas se escribe desde la celda.");
    return { cells: 0, created: 0, failed: 0, notes };
  }

  const requests: ImportRequest[] = [];
  const undoRows: UndoRow[] = [];
  let cells = 0;
  for (let r = range.top; r <= range.bottom; r++) {
    const row = rows[r];
    if (!row) continue;
    const body: Record<string, unknown> = {};
    for (const { field } of columns) {
      // Una relacion se vacia por partida doble: el enlace y el valor que
      // quedo a la vista cuando no encontro dueno.
      if (isRelationField(field))
        Object.assign(body, relationCellValues(field, { id: "", value: "" }));
      else body[field.name] = field.type === "select" && field.multiple ? [] : null;
      cells++;
    }
    undoRows.push({ id: row.id, body: previousValues(row, body), cells: columns.length });
    requests.push({
      method: "PATCH",
      url: `/api/collections/${table.dataCollection}/records/${row.id}`,
      body,
      row: r,
    });
  }

  const report = await send(requests, cells, notes);
  return {
    ...report,
    undo: {
      tableId: table.id,
      collection: table.dataCollection,
      columns: columnSignature(table),
      done: "vaciar",
      rows: undoRows,
      born: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Pegar                                                                */
/* ------------------------------------------------------------------ */

/** Cuanto de lo pegado cabe donde se solto, y que hacer con lo que no. */
export interface PasteFit {
  /** Filas de lo pegado que caen sobre filas que ya existen. */
  fits: number;
  /** Filas que sobran por abajo. */
  extra: number;
  /** Columnas que sobran por la derecha: esas se pierden siempre. */
  extraColumns: number;
  /**
   * Si las filas que sobran pueden nacer.
   *
   * En la tabla de personas no: una fila de ahi es una cuenta invitada a la
   * aplicacion, y eso lo hace el servidor al invitar, no un POST a la
   * coleccion. Ver `savePersonRow`.
   */
  canCreate: boolean;
}

/** Mide lo pegado contra lo que hay, sin escribir nada. */
export function pasteFit(opts: {
  table: TableRecord;
  rows: Row[];
  fields: FieldDef[];
  start: CellRef;
  matrix: string[][];
}): PasteFit {
  const { table, rows, fields, start, matrix } = opts;
  const room = Math.max(0, rows.length - start.row);
  const width = matrix[0]?.length ?? 0;
  return {
    fits: Math.min(matrix.length, room),
    extra: Math.max(0, matrix.length - room),
    extraColumns: Math.max(0, width - (fields.length - start.col)),
    canCreate: !isPeopleTable(table),
  };
}

/**
 * Escribe una rejilla de texto a partir de una celda.
 *
 * Lo que sobra por abajo nace como filas nuevas o se queda fuera, segun lo que
 * se haya elegido al pegarlo; lo que sobra por la derecha se queda fuera
 * siempre --no hay donde ponerlo sin inventar columnas, y para eso esta la
 * importacion, que ademas sabe adivinar su tipo--.
 */
export async function pasteRange(opts: {
  table: TableRecord;
  tables: TableRecord[];
  people: AppPerson[];
  rows: Row[];
  fields: FieldDef[];
  start: CellRef;
  matrix: string[][];
  /** Las filas que sobran nacen en vez de quedarse fuera. */
  createMissing: boolean;
}): Promise<RangeReport> {
  const { table, tables, people, rows, fields, start, matrix, createMissing } = opts;
  const notes: string[] = [];
  const fit = pasteFit({ table, rows, fields, start, matrix });

  const create = createMissing && fit.canCreate ? fit.extra : 0;
  const height = fit.fits + create;
  const width = Math.min(matrix[0]?.length ?? 0, fields.length - start.col);
  if (height <= 0 || width <= 0) return { cells: 0, created: 0, failed: 0, notes };

  if (fit.extra > create) {
    notes.push(
      `${plural(fit.extra - create, "fila no cabía", "filas no cabían")} y quedaron fuera.`,
    );
  }
  if (fit.extraColumns > 0) {
    notes.push(
      `${plural(fit.extraColumns, "columna no cabía", "columnas no cabían")} y quedó fuera.`,
    );
  }

  const cut = matrix.slice(0, height).map((line) => line.slice(0, width));

  /*
   * Que columna recibe cada columna de lo pegado. Una que no se escribe desde
   * la celda entra como hueco --se dice y se salta-- en vez de correr las
   * demas: lo pegado tiene que caer bajo la columna donde se solto.
   */
  const targets: (FieldDef | null)[] = [];
  for (let c = 0; c < width; c++) {
    const field = fields[start.col + c];
    if (!field) {
      targets.push(null);
      continue;
    }
    if (!bulkEditable(table, field)) {
      notes.push(`"${field.label}" no se escribe en bloque; hay que hacerlo celda a celda.`);
      targets.push(null);
      continue;
    }
    targets.push(field);
  }
  if (targets.every((f) => f === null)) return { cells: 0, created: 0, failed: 0, notes };

  /*
   * Las llaves de las columnas de relacion se emparejan de una vez para toda el
   * area, no celda por celda: cincuenta filas con la misma cedula son una
   * consulta y no cincuenta. Es el mismo emparejado de la importacion, con su
   * respaldo de llave incluido.
   */
  let matches = new Map<string, Map<string, Match>>();
  if (targets.some((f) => f && isRelationField(f))) {
    const found = await matchRelationColumns({
      targets,
      rows: cut,
      tables,
      keys: {},
      lookup: panelLookup(people),
    }).catch(() => null);
    if (found) matches = found.matches;
  }

  /** Lo que no era de su tipo, agrupado por columna para no repetir el aviso. */
  const bad = new Map<string, number>();
  const records = (id: string) =>
    `/api/collections/${table.dataCollection}/records${id ? `/${id}` : ""}`;

  const requests: ImportRequest[] = [];
  const undoRows: UndoRow[] = [];
  let cells = 0;
  for (let r = 0; r < height; r++) {
    const row = rows[start.row + r];
    const body: Record<string, unknown> = {};
    // Cuantas celdas de esta fila llegan a escribirse: no es el ancho del area
    // --una columna que no se escribe o un valor que no era de su tipo se
    // saltan-- y es lo que hay que contar al reponerla.
    let rowCells = 0;
    for (let c = 0; c < width; c++) {
      const field = targets[c];
      if (!field) continue;
      const raw = cut[r][c] ?? "";

      if (isRelationField(field)) {
        const value = raw.trim();
        const match = matches.get(field.name)?.get(value) ?? { id: "", value };
        Object.assign(body, relationCellValues(field, match));
        cells++;
        rowCells++;
        continue;
      }

      // Sobre una fila que ya existe, una celda vacia no vacia una columna
      // obligatoria: se deja como estaba y el resto de lo pegado entra igual.
      if (row && field.required && raw.trim() === "") continue;

      const converted = convertValue(field, raw);
      if (!converted.ok) {
        bad.set(field.label, (bad.get(field.label) ?? 0) + 1);
        continue;
      }
      // Una opcion que la columna no tiene la rechazaria la base con la fila
      // entera: se cuenta como celda que no era de su tipo.
      if (field.type === "select" && field.options?.length) {
        const values = Array.isArray(converted.value)
          ? converted.value.map(String)
          : converted.value == null
            ? []
            : [String(converted.value)];
        if (values.some((v) => !field.options?.includes(v))) {
          bad.set(field.label, (bad.get(field.label) ?? 0) + 1);
          continue;
        }
      }
      body[field.name] = converted.value;
      cells++;
      rowCells++;
    }
    if (Object.keys(body).length === 0) continue;
    // Una fila que todavia no existe no tiene nada que reponer: deshacerla es
    // borrarla, y su id solo se sabe cuando la base se lo pone.
    if (row) undoRows.push({ id: row.id, body: previousValues(row, body), cells: rowCells });
    requests.push(
      row
        ? { method: "PATCH", url: records(row.id), body, row: start.row + r }
        : { method: "POST", url: records(""), body, row: start.row + r },
    );
  }

  for (const [label, n] of bad) {
    notes.push(
      `${plural(n, "celda no era", "celdas no eran")} de "${label}" y se dejó como estaba.`,
    );
  }

  const bornIds = new Map<number, string>();
  const report = await send(requests, cells, notes, create, bornIds);
  /*
   * Una fila nueva a la que le falta una columna obligatoria la rechaza la
   * base, y eso ya viene contado en las fallidas: lo que se dice es cuantas
   * nacieron de verdad.
   */
  return {
    ...report,
    created: Math.max(0, create - report.failed),
    undo: {
      tableId: table.id,
      collection: table.dataCollection,
      columns: columnSignature(table),
      done: "pegar",
      rows: undoRows,
      born: [...bornIds.values()],
    },
  };
}

/* ------------------------------------------------------------------ */
/* El parte                                                             */
/* ------------------------------------------------------------------ */

/**
 * Lo que se dice despues de escribir un bloque.
 *
 * Se cuenta en celdas y no en filas porque es lo que se acaba de hacer: pegar
 * una columna sobre veinte filas son veinte celdas, y decir "20 filas" haria
 * pensar que se toco la fila entera. Lo que no entro va detras, con su motivo.
 */
export function rangeSummary(
  report: RangeReport,
  done: "pegaron" | "vaciaron",
): { ok: boolean; text: string } {
  const parts: string[] = [];
  if (report.cells > 0) parts.push(`Se ${done} ${plural(report.cells, "celda", "celdas")}.`);
  if (report.created > 0) parts.push(`Nacieron ${plural(report.created, "fila", "filas")}.`);
  if (report.failed > 0)
    parts.push(`${plural(report.failed, "fila no entró", "filas no entraron")}.`);
  parts.push(...report.notes);
  return {
    ok: report.failed === 0 && report.notes.length === 0,
    text: parts.join(" ") || "No había nada que escribir.",
  };
}

/**
 * Por que una columna no se escribe desde su celda.
 *
 * Una celda que no reacciona al pulsarla parece rota. Esto es lo que dice el
 * globo al pasar por encima, para que se vea que no es un fallo sino un sitio
 * distinto donde escribirlo.
 */
export function notEditableReason(table: TableRecord, field: FieldDef): string {
  if (isSystem(field.name)) return "Lo escribe la base de datos";
  if (isPeopleTable(table) && field.name === MEMBER_FIELD) return "Dice de quién es la fila";
  if (field.type === "file") return "Los archivos se suben desde la fila";
  if (isRelationField(field) && field.multiple === true) {
    return "Varias relaciones se escriben desde la fila";
  }
  return "";
}
