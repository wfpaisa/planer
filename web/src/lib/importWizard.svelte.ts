/**
 * El estado que comparten los pasos del asistente de importar: en que
 * pantalla esta, el archivo leido y como se emparejan sus columnas.
 *
 * A donde va cada columna y como se convierte cada celda vive en
 * `importPlan.ts`; aqui esta el hilo que va de "un archivo" a "sus filas ya
 * convertidas", que es lo que cada paso necesita leer.
 */
import type { TableRecord } from "@shared/types";

import { detectSeparator, MAX_IMPORT_ROWS, parseImport } from "./importParse";
import {
  buildPlans,
  type ColumnRule,
  type ColumnTarget,
  type ConvertedRow,
  convertRows,
  defaultMapping,
  IGNORED_SYSTEM_COLUMNS,
  type ImportError,
  looksJson,
  type SaveMode,
  SEPARATORS,
} from "./importPlan";
import { errorMessage } from "./pb";
import { isLegacySheetFile, isSheetFile, legacySheetMessage, readSheet } from "./sheet";

export type ImportStage = "content" | "preview";

/** El mismo tono que usa `Toast.svelte`, sin depender del componente. */
export type NoticeKind = "error" | "warning" | "success" | "info";

export interface ImportNotice {
  kind: NoticeKind;
  text: string;
}

/**
 * Pasa por las tres pantallas del asistente sin recrearse: la instancia nace
 * al abrir el dialogo y muere con el.
 */
export class ImportWizard {
  #table: () => TableRecord;

  constructor(table: () => TableRecord) {
    this.#table = table;
  }

  stage = $state<ImportStage>("content");
  text = $state("");
  separator = $state(";");
  /**
   * De donde viene el contenido: de un archivo o pegado a mano.
   *
   * Las dos formas escriben el mismo `text` --un archivo se lee y se vuelca
   * ahi--, asi que esto solo decide cual de las dos se ensena. Empieza en el
   * archivo, que es lo que se hace casi siempre; el area de pegar ocupaba media
   * pantalla para el caso raro.
   */
  source = $state<"archivo" | "texto">("archivo");
  /**
   * El nombre del ultimo archivo leido.
   *
   * Con el area de texto escondida, la zona de arrastre es lo unico que queda
   * mirando: sin decir que archivo entro, soltar uno y no soltar nada se ven
   * igual.
   */
  fileName = $state("");
  /**
   * Lo que hay que contar de esta importacion, con su tono. No todo lo que se
   * dice aqui es un fallo --una hoja de mas, filas que se quedaron fuera-- y
   * contarlo todo en rojo hacia parecer roto lo que solo estaba incompleto.
   */
  notice = $state<ImportNotice | null>(null);
  /**
   * Lo que se cambio a mano, por nombre de columna.
   *
   * Solo lo cambiado: lo demas sale de `defaultMapping` cada vez que se lee el
   * archivo. Asi cambiar el separador sin salir de la previsualizacion vuelve a
   * leerlo conservando lo elegido, y una columna que con el separador nuevo ya
   * no existe deja de mirarse sola.
   */
  overrides = $state<Record<string, ColumnTarget>>({});
  /**
   * Lo que se le exige a cada columna, por nombre de columna.
   *
   * Es de esta importacion y no de la tabla: nada de esto se guarda al terminar.
   * Se pone desde el encabezado de la columna, como su destino.
   */
  rules = $state<Record<string, ColumnRule>>({});
  mode = $state<SaveMode>("add");

  say = (kind: NoticeKind, text: string): void => {
    this.notice = { kind, text };
  };
  fail = (err: unknown): void => {
    this.say("error", errorMessage(err));
  };
  hush = (): void => {
    this.notice = null;
  };

  setTarget = (column: string, target: ColumnTarget): void => {
    this.overrides = { ...this.overrides, [column]: target };
  };
  /** Devolver una columna a lo sugerido: se quita lo que se habia elegido. */
  clearTarget = (column: string): void => {
    const next = { ...this.overrides };
    delete next[column];
    this.overrides = next;
  };
  setRule = (column: string, rule: ColumnRule): void => {
    this.rules = { ...this.rules, [column]: rule };
  };

  parsed = $derived(parseImport(this.text, this.separator));
  tooMany = $derived(this.parsed.ok && this.parsed.data.rows.length > MAX_IMPORT_ROWS);
  /**
   * Si el archivo que entro sirve para seguir.
   *
   * Lo que decide el color de la zona de arrastre: uno que se leyo pero no se
   * puede importar --sin columnas, con mas filas de la cuenta-- pintado en
   * verde diria que todo fue bien y mandaria a leer el aviso de abajo para
   * enterarse de que no.
   */
  fileOk = $derived(this.parsed.ok && !this.tooMany);
  /**
   * El archivo que entro pero no se puede importar.
   *
   * Es lo unico que la zona de arrastre tiene que ensenar de un archivo ya
   * leido: el que se puede importar no llega a verse ahi, porque abre la
   * previsualizacion en cuanto se lee.
   */
  fileRejected = $derived(!!this.fileName && !this.fileOk);
  /** El archivo ya leido. Se rehace solo cuando cambia el texto o el separador. */
  parsedTable = $derived(this.parsed.ok ? this.parsed.data : null);
  /**
   * Lo sugerido, con lo elegido a mano encima.
   *
   * Con `$derived.by` y no con `$derived` por la tabla: un campo de clase que
   * el constructor rellena no existe todavia cuando corren los inicializadores
   * de los demas campos, asi que leerlo ahi mismo no compila. Dentro de la
   * funcion se lee cuando toca, que es cuando ya esta.
   */
  mapping = $derived.by(() =>
    this.parsedTable
      ? { ...defaultMapping(this.parsedTable, this.#table()), ...this.overrides }
      : {},
  );
  isJson = $derived(looksJson(this.text));

  plans = $derived(this.parsedTable ? buildPlans(this.parsedTable, this.mapping) : []);
  /** Las columnas que se ensenan y se dejan elegir: sin las de la base. */
  shownPlans = $derived(
    this.plans.filter((p) => !IGNORED_SYSTEM_COLUMNS.has(p.column.trim().toLowerCase())),
  );
  conversion: { converted: ConvertedRow[]; errors: ImportError[] } = $derived(
    this.parsedTable ? convertRows(this.parsedTable, this.plans) : { converted: [], errors: [] },
  );
  failing = $derived(this.conversion.converted.filter((c) => c.errors.length > 0));
  visiblePlans = $derived(this.plans.filter((p) => p.target.kind !== "skip"));

  async readFile(file: File): Promise<void> {
    this.hush();
    // Una hoja en formato viejo no se lee, pero se sabe que es: se dice que
    // hacer con ella en vez de dejar que falle como un archivo cualquiera.
    if (isLegacySheetFile(file)) {
      this.say("warning", legacySheetMessage(file));
      return;
    }
    try {
      // Una hoja de calculo se convierte a CSV antes de nada: de ahi en
      // adelante es el mismo archivo que cualquier otro, con el mismo lector y
      // el mismo emparejado de columnas.
      if (isSheetFile(file)) {
        const { csv, sheet, sheets } = await readSheet(file);
        this.separator = ",";
        this.text = csv;
        this.fileName = file.name;
        if (sheets.length > 1) {
          this.say(
            "warning",
            `El archivo tiene ${sheets.length} hojas y se leyo "${sheet}". Las demas quedan fuera.`,
          );
        }
        this.seguir();
        return;
      }

      const content = await file.text();
      // El separador se adivina del propio archivo, y solo si es uno de los dos
      // que se ofrecen: dejarlo en uno que no esta en los botones seria dejar
      // los dos apagados y sin manera de volver. Cuando falla se cambia a mano
      // en la previsualizacion, sin volver a soltar el archivo.
      const found = looksJson(content) ? "" : detectSeparator(content);
      if (SEPARATORS.some((s) => s.value === found)) this.separator = found;
      this.text = content;
      this.fileName = file.name;
      this.seguir();
    } catch (err) {
      this.fail(err);
    }
  }

  /**
   * Un archivo que se leyo bien pasa solo a la previsualizacion.
   *
   * Antes se quedaba en la primera pantalla, con la zona de arrastre en verde
   * diciendo que ya estaba cargado y un boton "Previsualizar" al lado: un paso
   * que solo servia para confirmar lo que ya se veia. Se sigue de largo, que es
   * a donde se iba igualmente.
   *
   * El que NO se puede importar --ilegible, sin columnas, con mas filas de la
   * cuenta-- se queda aqui: ahi la primera pantalla si tiene algo que decir, y
   * lo dice en rojo. Lo avisado al leerlo (una hoja de calculo con varias
   * pestanas) viaja con el aviso, que la previsualizacion tambien ensena.
   */
  seguir = (): void => {
    if (this.fileOk) this.stage = "preview";
  };
}
