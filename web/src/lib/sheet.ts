/**
 * Hojas de calculo: leerlas y escribirlas.
 *
 * El CSV se lee y se escribe a mano en `importParse` y en `tableExport`, que
 * para eso basta con contar comillas. Un `.xlsx` no: es un zip con XML dentro,
 * y ademas trae fechas en el calendario de Lotus, celdas combinadas y varias
 * hojas. Eso lo hacen `read-excel-file` y `write-excel-file`.
 *
 * Son dos librerias y no una a proposito. La de siempre para esto --SheetJS--
 * lee y escribe con una sola API, pero lo ultimo que publica npm es de marzo
 * de 2022 y arrastra dos avisos de severidad alta sin version corregida ahi;
 * uno de ellos se dispara justo con lo que se hace aqui, parsear un archivo
 * que llega de fuera. Estas dos pesan 35 kB comprimidos entre las dos --contra
 * 139 kB-- y se mantienen al dia. Lo que cuestan es el formato viejo: ver
 * `LEGACY_EXTENSIONS`.
 *
 * Todo pasa por aqui, y todo pasa por CSV: una hoja que entra se convierte en
 * texto separado por comas antes de que nadie la mire, asi el resto del
 * programa sigue viendo lo mismo que veia con un `.csv` --el mismo lector, el
 * mismo emparejado de columnas, el mismo tope de filas-- y estas librerias no
 * se cuelan en ninguna otra parte.
 *
 * Se cargan cuando hacen falta, no al abrir el panel: la mayoria de las visitas
 * no sueltan ninguna hoja.
 */

/** Las extensiones que se leen como hoja de calculo. Las dos son el mismo zip. */
const SHEET_EXTENSIONS = [".xlsx", ".xlsm"];

/**
 * Los formatos que ya no se leen.
 *
 * `.xls` es el binario de Excel 97-2003, `.xlsb` el binario moderno y `.ods` el
 * de LibreOffice: ninguno es el zip con XML que se lee aqui. Se reconocen para
 * poder decir que hacer --volver a guardarlo como `.xlsx`-- en vez de fallar
 * con que el archivo no se entiende.
 */
const LEGACY_EXTENSIONS = [".xls", ".xlsb", ".ods"];

/** Lo que hay que poner en un `accept` para ofrecerlas en el selector. */
export const SHEET_ACCEPT = SHEET_EXTENSIONS.join(",");

const endsWithAny = (file: File, list: string[]) => {
  const name = file.name.toLowerCase();
  return list.some((ext) => name.endsWith(ext));
};

/** Si el archivo es una hoja de calculo que se sabe leer. */
export const isSheetFile = (file: File) => endsWithAny(file, SHEET_EXTENSIONS);

/** Si es una hoja de calculo de las que ya no se leen. */
export const isLegacySheetFile = (file: File) => endsWithAny(file, LEGACY_EXTENSIONS);

/** Lo que se le dice a quien suelta una de esas. */
export const legacySheetMessage = (file: File) =>
  `"${file.name}" viene en un formato de hoja de calculo que no se lee. Abrelo y guardalo como .xlsx.`;

/* ------------------------------------------------------------------ */
/* Leer                                                                 */
/* ------------------------------------------------------------------ */

/** Una celda tal como la devuelve el lector, antes de volverse texto. */
type Cell = string | number | boolean | Date | null;

/**
 * Una fecha, en el mismo formato con el que se exporta.
 *
 * En horario universal y no en el del ordenador: el lector de hojas devuelve
 * la fecha de la celda como medianoche universal, asi que leerla con la hora
 * local restaba un dia entero en cualquier huso al oeste de Greenwich --que es
 * donde se usa esto-- y el 1 de marzo se importaba como 28 de febrero.
 */
const asDate = (value: Date) =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate(),
  ).padStart(2, "0")}`;

/** Una celda, ya como texto. */
function asText(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return asDate(value);
  if (typeof value === "boolean") return value ? "si" : "no";
  return String(value);
}

/** Escapa un valor para que viva dentro de un campo CSV separado por comas. */
const csvCell = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * El contenido de una hoja, ya en CSV.
 *
 * Se lee la primera hoja con datos y no todas: lo que sigue --emparejar
 * columnas, crear una tabla-- es de una sola tabla, y pegar varias hojas una
 * detras de otra daria un archivo con dos encabezados y ninguna forma de
 * saberlo. Las demas se nombran para poder decir cuales quedaron fuera.
 */
export interface SheetRead {
  csv: string;
  /** El nombre de la hoja que se leyo. */
  sheet: string;
  /** Todas las hojas del archivo, en su orden. */
  sheets: string[];
}

export async function readSheet(file: File): Promise<SheetRead> {
  if (isLegacySheetFile(file)) throw new Error(legacySheetMessage(file));

  const read = (await import("read-excel-file/browser")).default;
  const book = (await read(file)) as unknown as { sheet: string; data: Cell[][] }[];
  if (!book.length) throw new Error("El archivo no tiene ninguna hoja.");

  /*
   * La primera con algo escrito, no la primera del libro: es normal que la
   * primera sea una portada vacia, y leerla dejaria la importacion sin
   * columnas. Una fila entera en blanco en medio de la hoja tampoco es una
   * fila de datos, asi que se cae.
   */
  const conDatos = book.map((hoja) => ({
    sheet: hoja.sheet,
    rows: hoja.data.map((row) => row.map(asText)).filter((row) => row.some((cell) => cell !== "")),
  }));
  const elegida = conDatos.find((hoja) => hoja.rows.length > 0) ?? conDatos[0];

  return {
    csv: elegida.rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    sheet: elegida.sheet,
    sheets: book.map((hoja) => hoja.sheet),
  };
}

/* ------------------------------------------------------------------ */
/* Escribir                                                             */
/* ------------------------------------------------------------------ */

/**
 * El nombre de la hoja dentro del libro, tal como Excel lo admite.
 *
 * No pasa de 31 caracteres y no lleva los signos con los que Excel escribe sus
 * formulas. El escritor lo rechaza en vez de arreglarlo por su cuenta --que es
 * lo correcto-- asi que se arregla aqui, que es donde se sabe de donde venia.
 */
function sheetName(label: string): string {
  const limpio = label
    .replace(/[[\]:*?/\\]/g, " ")
    .trim()
    .slice(0, 31)
    .trim();
  return limpio || "Hoja1";
}

/** Una hoja de calculo con estas filas, lista para descargar. */
export async function sheetBlob(
  /** La cabecera, con los nombres tecnicos de las columnas. */
  header: string[],
  rows: string[][],
  /** Como se llama la hoja dentro del libro. */
  name: string,
): Promise<Blob> {
  const write = (await import("write-excel-file/browser")).default;
  return write([header, ...rows], { sheet: sheetName(name) }).toBlob();
}
