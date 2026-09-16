/**
 * Lo que pasa cuando se suelta un archivo encima de una pagina.
 *
 * No hay zona a la que apuntar: vale cualquier parte de la pantalla. Por la
 * pinta del archivo se sabe que se le puede hacer --un HTML es una pagina, un
 * archivo de datos es una tabla-- y quien construye elige cual de esas cosas
 * quiere, incluida la de no hacer ninguna y darselo a la IA como material.
 *
 * Aqui vive lo que hay que saber hacer con el archivo. Quien pregunta es el
 * constructor; esto solo lee, crea e importa.
 */
import { peopleTableOf } from "@shared/people";
import { type Match, relationCellValues } from "@shared/relations";
import {
  type AppPerson,
  type FieldDef,
  isRelationField,
  type PageRecord,
  type TableRecord,
} from "@shared/types";

import { canAttachToAi } from "./aiFiles";
import {
  convertValue,
  detectSeparator,
  matchRelationColumns,
  MAX_IMPORT_ROWS,
  parseImport,
} from "./importParse";
import { readableLabel } from "./importPlan";
import { errorMessage, patch, pb, post, put } from "./pb";
import type { PersonLink } from "./personGuess";
import { panelLookup } from "./relations";
import { isSheetFile, readSheet } from "./sheet";
import { type FileShape, fileTitle, guessTable, type IdsExist, sameName } from "./tableGuess";

/**
 * Que es lo que se solto.
 *
 * `html` y `data` son los que la aplicacion sabe volver algo suyo --una pagina,
 * una tabla--. `ia` es todo lo demas que se puede leer: una hoja de estilos, un
 * script, una imagen. Con eso no se crea nada, se le da a la IA como material.
 */
export type DropKind = "html" | "data" | "ia" | "unknown";

/** Los archivos de datos que se saben leer, hoja de calculo incluida. */
const DATA_EXTENSIONS = [".csv", ".tsv", ".json", ".xlsx", ".xlsm"];

/** Si el archivo trae filas y columnas, sea CSV, JSON u hoja de calculo. */
const isDataFile = (file: File) =>
  DATA_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

/** Que es lo que se solto, por su nombre y su tipo. */
export function dropKind(file: File): DropKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".html") || name.endsWith(".htm") || file.type === "text/html") return "html";
  if (isDataFile(file)) return "data";
  return canAttachToAi(file) ? "ia" : "unknown";
}

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `pagina-${Date.now()}`;

/** El nombre del archivo, sin su extension, como nombre de lo que se crea. */
const baseName = (file: File) => file.name.replace(/\.[^.]+$/, "").trim() || "Sin título";

/**
 * Como se llamaria la tabla de este archivo: su nombre, ya sin la cola.
 *
 * Pasa por la misma regla que las columnas: lo que salio de aqui se llama
 * `chequeo-preoperacional.csv` --por la etiqueta de la tabla-- y volver a
 * soltarlo tiene que crear "Chequeo preoperacional", no el nombre tecnico.
 */
export function dataFileName(file: File): string {
  return readableLabel(fileTitle(file.name));
}

/**
 * La tabla que ya guarda lo que trae este archivo, si es que hay alguna.
 *
 * Las tres capas viven en `tableGuess.ts`; aqui se les da lo que necesitan: el
 * archivo leido y una forma de preguntarle a la base por unos identificadores.
 *
 * Las dos primeras capas miran dentro del archivo. Si no se deja leer --formato
 * roto, hoja vacia-- queda la del nombre, que no lo necesita: un archivo
 * ilegible sigue diciendo de que tabla salio.
 */
export async function matchingTable(
  tables: TableRecord[],
  file: File,
): Promise<TableRecord | null> {
  if (tables.length === 0) return null;
  const read = await readDataFile(file).catch(() => null);
  const shape: FileShape = {
    name: file.name,
    columns: read?.columns ?? [],
    rows: read?.rows ?? [],
  };
  return guessTable(tables, shape, idsExist);
}

/**
 * Si alguno de esos identificadores es ya una fila de esa tabla.
 *
 * Se pide una sola fila: lo que se pregunta es si existe alguno, no cuantos.
 */
const idsExist: IdsExist = async (table, ids) => {
  const filter = ids.map((id) => `id = ${JSON.stringify(id)}`).join(" || ");
  const found = await pb
    .collection(table.dataCollection)
    .getList<{ id: string }>(1, 1, { filter, fields: "id", skipTotal: true })
    .catch(() => null);
  return (found?.items.length ?? 0) > 0;
};

/** Que hacer con las filas del archivo cuando la tabla ya existe. */
export type ImportMode = "update" | "add" | "replace";

/**
 * El orden de las filas cuando lo que importa es cual es la primera.
 *
 * Exportar e importar tienen que contar igual: si al salir la fila 1 es la
 * mas antigua, al volver a entrar tambien. Por eso el orden se pide a mano en
 * los dos sitios en vez de dejarlo al gusto de la base. La id desempata a las
 * que nacieron en el mismo lote y comparten el instante.
 */
export const ROW_ORDER = "created,id";

/** Crea una pagina con el HTML del archivo y devuelve la pagina creada. */
export async function pageFromHtmlFile(
  appId: string,
  file: File,
  order: number,
): Promise<PageRecord> {
  const content = await file.text();
  const name = baseName(file);

  const page = await pb.collection("pages").create<PageRecord>({
    app: appId,
    name,
    slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
    icon: "file-01",
    order,
    isHome: false,
  });

  const saved = await put<{ doc: string }>(`/api/apps/${appId}/paginas/${page.id}/html`, {
    content,
  });
  return { ...page, doc: saved.doc };
}

/** Escribe el HTML del archivo encima de una pagina que ya existe. */
export async function htmlIntoPage(
  appId: string,
  pageId: string,
  file: File,
): Promise<{ doc: string }> {
  return put<{ doc: string }>(`/api/apps/${appId}/paginas/${pageId}/html`, {
    content: await file.text(),
  });
}

/**
 * Lee el archivo y devuelve sus columnas y sus filas, ya recortadas al tope.
 *
 * Una hoja de calculo se convierte antes a CSV: lo que sigue --adivinar el
 * separador, emparejar columnas, convertir celdas-- es el mismo camino que el
 * de un `.csv`, y asi hay uno solo que mantener.
 */
async function readDataFile(file: File): Promise<{ columns: string[]; rows: string[][] }> {
  let text: string;
  let separator: string;
  if (isSheetFile(file)) {
    text = (await readSheet(file)).csv;
    separator = ",";
  } else {
    text = await file.text();
    separator = file.name.toLowerCase().endsWith(".tsv") ? "\t" : detectSeparator(text);
  }
  const parsed = parseImport(text, separator);
  if (!parsed.ok) throw new Error(parsed.error);
  if (!parsed.data.columns.length) throw new Error("El archivo no tiene columnas.");
  return { columns: parsed.data.columns, rows: parsed.data.rows.slice(0, MAX_IMPORT_ROWS) };
}

/** Columnas reservadas de PocketBase que nunca se convierten en campos. */
const SYSTEM_COLUMNS = new Set(["id", "created", "updated"]);

/** Un archivo de datos ya leido, a un paso de ser una tabla. */
export interface DataFilePlan {
  /** Como se va a llamar la tabla, ya sin la cola del nombre del archivo. */
  label: string;
  columns: string[];
  rows: string[][];
  /**
   * Las columnas que se conservan, con su sitio en el archivo. Se guarda el
   * sitio para volver a su celda al guardar aunque se hayan saltado las de
   * sistema.
   */
  kept: { column: string; index: number }[];
}

/**
 * Lee el archivo y deja decidido que columnas se conservan, sin escribir nada.
 *
 * Se separa de crear la tabla porque entre lo uno y lo otro hay una pregunta:
 * si alguna columna esta nombrando usuarios, se ofrece relacionarla antes de
 * que exista ninguna fila. Ver `guessPersonColumns`.
 *
 * Las columnas reservadas de la base (id, created, updated) se saltan: si
 * entraran, el servidor las rebautizaria id_1/created_1/updated_1.
 */
export async function planDataFile(file: File): Promise<DataFilePlan> {
  const { columns, rows } = await readDataFile(file);
  const kept = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !SYSTEM_COLUMNS.has(column.trim().toLowerCase()));
  return { label: dataFileName(file), columns, rows, kept };
}

/**
 * Crea la tabla con las columnas del archivo y guarda sus filas.
 *
 * Todo entra como texto salvo lo que se deja convertir: adivinar tipos con
 * datos de verdad delante sale mas caro que dejar cambiarlos despues.
 *
 * La excepcion es la columna que se acepto relacionar con los usuarios, que
 * nace ya de tipo persona. Emparejando al entrar, la fila queda enlazada de una
 * vez y al corralito solo van los que de verdad no son de nadie. Convertirla
 * despues tambien sirve --al guardar el cambio se emparejan los valores que
 * quedaron esperando, ver `linkParkedValues`-- pero hacerlo al entrar ahorra el
 * paso entero.
 */
export async function tableFromPlan(
  appId: string,
  plan: DataFilePlan,
  /** La columna que nombra usuarios, si se acepto relacionarla. */
  link: PersonLink | null,
  /** Las tablas de la aplicacion y sus invitados: hacen falta para emparejar. */
  context: { tables: TableRecord[]; people: AppPerson[] },
): Promise<{ table: TableRecord; rows: number; linked: number }> {
  // La columna que nombra usuarios nace como una relacion a la tabla de
  // personas, que es la unica forma de apuntar a alguien.
  const people = peopleTableOf(context.tables);
  const fields: FieldDef[] = plan.kept.map(({ column }) =>
    link && column === link.column && people
      ? {
          name: "",
          label: readableLabel(column),
          type: "relation",
          relationTableId: people.id,
          displayField: link.key,
        }
      : { name: "", label: readableLabel(column), type: "text" },
  );

  const table = await post<TableRecord>(`/api/apps/${appId}/tables`, {
    label: plan.label,
    fields,
  });

  /*
   * El emparejado va de golpe y antes de guardar nada: mil filas suelen traer
   * treinta cedulas distintas, y buscarlas fila a fila seria repetir la misma
   * consulta treinta y tres veces por cada una.
   *
   * `targets` va alineado con las columnas del archivo y no con las de la
   * tabla, que es como lee las filas `matchRelationColumns`.
   */
  const linkField = link
    ? table.fields[plan.kept.findIndex((k) => k.column === link.column)]
    : null;
  const matches = linkField
    ? (
        await matchRelationColumns({
          targets: plan.columns.map((column) => (column === link?.column ? linkField : null)),
          rows: plan.rows,
          tables: context.tables,
          keys: { [linkField.name]: link?.key ?? "" },
          lookup: panelLookup(context.people),
        })
      ).matches
    : new Map<string, Map<string, Match>>();

  let saved = 0;
  let linked = 0;
  for (const row of plan.rows) {
    const values: Record<string, unknown> = {};
    table.fields.forEach((field, i) => {
      const raw = (row[plan.kept[i].index] ?? "").trim();
      if (!raw) return;

      // Una relacion ocupa dos columnas reales y se decide por el emparejado,
      // no por el texto: el id si lo encontro, el corralito si no.
      if (isRelationField(field) && field.multiple !== true) {
        const match = matches.get(field.name)?.get(raw) ?? { id: "", value: raw };
        if (match.id) linked++;
        Object.assign(values, relationCellValues(field, match));
        return;
      }

      const converted = convertValue(field, raw);
      if (converted.ok) values[field.name] = converted.value;
    });
    try {
      await pb.collection(table.dataCollection).create(values);
      saved++;
    } catch {
      // Una fila que la base rechaza no para a las demas.
    }
  }

  return { table, rows: saved, linked };
}

/** Una escritura de las que van al lote. */
interface BatchRequest {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

/** Cuantas escrituras caben en un mismo lote. */
const BATCH_SIZE = 200;

/**
 * Manda las escrituras en lotes y cuenta las que la base rechazo.
 * Una fila mala no para a las demas: se dice cuantas quedaron fuera y ya.
 */
async function runBatch(requests: BatchRequest[]): Promise<number> {
  let failures = 0;
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    const res = await fetch("/pb/api/batch", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: pb.authStore.token },
      body: JSON.stringify({ requests: chunk }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        errorMessage({ message: `La API de lote respondio ${res.status}`, response: body }),
      );
    }
    const data = (await res.json()) as Record<string, { status: number }>;
    for (const key of Object.keys(data)) {
      if (data[key].status >= 400) failures++;
    }
  }
  return failures;
}

/**
 * Mete las filas del archivo en una tabla que ya existe.
 *
 * Las columnas se emparejan por su nombre visible; las que el archivo trae de
 * mas se crean como texto, y las que la tabla tiene y el archivo no se quedan
 * como estaban. Una columna llamada `id` no cuenta como columna de datos.
 *
 * Las filas se emparejan por su sitio, no por su contenido: la primera del
 * archivo es la primera de la tabla. Es lo que espera quien exporta, cambia
 * cuatro celdas en una hoja de calculo y vuelve a soltar el mismo archivo.
 */
export async function importIntoTable(
  table: TableRecord,
  file: File,
  mode: ImportMode,
  /** Las tablas de la aplicacion y sus invitados: hacen falta para emparejar. */
  context?: { tables: TableRecord[]; people: AppPerson[] },
): Promise<{ table: TableRecord; rows: number; failed: number }> {
  const { columns, rows } = await readDataFile(file);

  const esId = (column: string) => column.trim().toLowerCase() === "id";
  const buscar = (fields: FieldDef[], column: string) =>
    fields.find((f) => f.name === column || sameName(f.label, column));

  /* 1. Lo que el archivo trae de mas se crea antes de guardar ninguna fila. */
  let fields = table.fields;
  const nuevas = columns.filter((column) => !esId(column) && !buscar(fields, column));
  let record = table;
  if (nuevas.length > 0) {
    record = await patch<TableRecord>(`/api/tables/${table.id}`, {
      fields: [
        ...fields,
        ...nuevas.map((column) => ({
          name: "",
          label: readableLabel(column),
          type: "text" as const,
        })),
      ],
    });
    fields = record.fields;
  }

  /* 2. Cada columna del archivo, a su sitio en la tabla. */
  const destino = columns.map((column) => (esId(column) ? "id" : (buscar(fields, column) ?? null)));

  /*
   * 3. Que filas hay ahora, y en que orden.
   *
   * Por antiguedad, que es el mismo orden con el que salen al exportar (ver
   * `ROW_ORDER`): asi la fila 1 de aqui es la fila 1 del archivo que salio de
   * esta misma tabla, y un archivo retocado vuelve a su sitio exacto. La id
   * desempata a las que nacieron en el mismo lote y comparten instante.
   */
  const existentes =
    mode === "add"
      ? []
      : await pb
          .collection(record.dataCollection)
          .getFullList<{ id: string }>({ fields: "id", sort: ROW_ORDER });

  /*
   * 3b. Las columnas de relacion, emparejadas por su llave.
   *
   * Igual que al importar desde el dialogo: lo que trae el archivo es una
   * cedula o un correo, y aqui se convierte en el enlace al registro. Lo que no
   * encuentra dueno se guarda con su valor a la vista, sin frenar la fila.
   */
  const matches = context
    ? (
        await matchRelationColumns({
          targets: destino.map((d) => (d && d !== "id" ? d : null)),
          rows,
          tables: context.tables,
          keys: {},
          lookup: panelLookup(context.people),
        })
      ).matches
    : new Map<string, Map<string, Match>>();

  const url = (id: string) =>
    `/api/collections/${record.dataCollection}/records${id ? `/${id}` : ""}`;
  const requests: BatchRequest[] = [];

  /* Reemplazar es dejar la tabla como la deja el archivo: fuera lo anterior. */
  if (mode === "replace") {
    for (const fila of existentes) requests.push({ method: "DELETE", url: url(fila.id), body: {} });
  }

  rows.forEach((row, index) => {
    /*
     * Actualizar cambia la fila entera, no solo lo que el archivo rellena:
     * una celda que el archivo trae vacia deja vacia la de la tabla. Si no,
     * "la fila 1 pasa a ser la del archivo" seria mentira a medias.
     */
    const posicion = mode === "update" ? existentes[index] : undefined;
    const values: Record<string, unknown> = {};
    destino.forEach((field, columna) => {
      const raw = (row[columna] ?? "").trim();
      // La columna `id` del archivo no es un dato: con las filas emparejadas
      // por su sitio, no hay nada que buscar con ella.
      if (!field || field === "id") return;

      // Una relacion ocupa dos columnas reales y se decide por el emparejado,
      // no por el texto: el id si lo encontro, el corralito si no.
      if (isRelationField(field) && field.multiple !== true) {
        if (!raw) {
          if (posicion) Object.assign(values, relationCellValues(field, { id: "", value: "" }));
          return;
        }
        const match = matches.get(field.name)?.get(raw) ?? { id: "", value: raw };
        Object.assign(values, relationCellValues(field, match));
        return;
      }

      if (!raw) {
        if (posicion) values[field.name] = null;
        return;
      }
      const converted = convertValue(field, raw);
      if (converted.ok) values[field.name] = converted.value;
    });

    // Cada fila del archivo cae sobre la que ocupa su mismo sitio; las que
    // sobran --el archivo trae mas de las que hay-- nacen al final.
    if (posicion) {
      requests.push({ method: "PATCH", url: url(posicion.id), body: values });
      return;
    }
    requests.push({ method: "POST", url: url(""), body: values });
  });

  const escrituras = requests.length - (mode === "replace" ? existentes.length : 0);
  const failed = await runBatch(requests);
  return { table: record, rows: Math.max(0, escrituras - failed), failed };
}
