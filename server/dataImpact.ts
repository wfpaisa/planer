/**
 * Que puede romper un cambio de la base de datos, y que no.
 *
 * Las columnas se guardan por su id interno y el API de tablas los devuelve
 * tal cual, así que PocketBase renombra en sitio: un cambio de nombre no
 * pierde datos ni obliga a tocar ninguna página. Borrar y cambiar el tipo si.
 * De ahi salen los dos grupos.
 *
 * "Que páginas usan la tabla X" se responde recorriendo el `sources` de las
 * páginas. No hay índice aparte: el manifiesto es lo que el puente consulta en
 * cada llamada, así que no puede quedarse desincronizado.
 */
import { isPeopleNameField, isPeopleTable } from "../shared/people.ts";
import type {
  AccessDirection,
  ChangeKind,
  FieldDef,
  FieldType,
  ImpactChoice,
  ImpactedPage,
  ImpactOption,
  PageRecord,
  StructureChange,
  TableRecord,
} from "../shared/types.ts";
import { isFieldType } from "../shared/types.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { deleteRecord, updateRecord } from "./pb.ts";
import { dropDataCollection, updateDataCollection } from "./schema.ts";

/* ------------------------------------------------------------------ */
/* Clasificacion por riesgo                                             */
/* ------------------------------------------------------------------ */

/** Todo lo que se puede hacer con la estructura de una tabla. */
export type Operation = ChangeKind | "crear_tabla" | "agregar_columna" | "renombrar_columna";

/**
 * Sin riesgo: nadie declara todavía lo que se crea, y renombrar no cambia el
 * id, así que el manifiesto de las páginas absorbe el cambio.
 * Con riesgo: lo que se declara deja de existir o deja de valer.
 */
const RISKY: Record<Operation, boolean> = {
  crear_tabla: false,
  agregar_columna: false,
  renombrar_columna: false,
  borrar_columna: true,
  cambiar_tipo: true,
  borrar_tabla: true,
};

export const isRisky = (op: Operation): boolean => RISKY[op] === true;

/**
 * Si un cambio de acceso tiene riesgo, que aquí se decide solo por su
 * dirección.
 *
 * Dar acceso nuevo lo tiene siempre: lo que alguien alcanzo a ver ya lo vio, y
 * ningún punto de vuelta atras deshace eso. Quitarlo no: como mucho corrige
 * algo que sobraba, y lo quitado se vuelve a dar.
 *
 * No mira ni el nivel ni los roles a propósito. Pasar de "mira" a "administra"
 * y anadir un rol son la misma cosa vistas desde aquí --alguien alcanza algo
 * que antes no-- y clasificarlas distinto solo abriria un hueco por el que
 * colar lo segundo.
 */
export const accessRisky = (direction: AccessDirection): boolean => direction === "dar";

/* ------------------------------------------------------------------ */
/* Quien usa que                                                        */
/* ------------------------------------------------------------------ */

/**
 * Las páginas que declaran una tabla o, si se nombra, una columna suya.
 * La columna se busca por id interno porque así la guarda el manifiesto.
 */
export function pagesUsing(pages: PageRecord[], tableId: string, fieldId?: string): ImpactedPage[] {
  const out: ImpactedPage[] = [];
  for (const page of pages) {
    const sources = Array.isArray(page.sources) ? page.sources : [];
    const uses = sources.some((source) => {
      if (source.tableId !== tableId) return false;
      if (!fieldId) return true;
      return Object.values(source.fields ?? {}).includes(fieldId);
    });
    if (uses) out.push({ id: page.id, name: page.name });
  }
  return out;
}

/** Todas las páginas afectadas por un grupo de cambios, sin repetir. */
export function pagesForChanges(pages: PageRecord[], changes: StructureChange[]): ImpactedPage[] {
  const seen = new Map<string, ImpactedPage>();
  for (const change of changes) {
    for (const page of pagesUsing(pages, change.tableId, change.fieldId)) {
      seen.set(page.id, page);
    }
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ */
/* Las salidas del diálogo                                              */
/* ------------------------------------------------------------------ */

/** Un cambio tiene variante inocua cuando se puede conseguir sin destruir. */
const hasHarmless = (change: StructureChange) =>
  change.kind === "borrar_columna" || change.kind === "cambiar_tipo";

/** Como se cuenta la variante inocua de cada cambio. */
export function harmlessOf(change: StructureChange): string {
  switch (change.kind) {
    case "borrar_columna":
      return `ocultar "${change.fieldLabel ?? change.field}" en vez de borrarla`;
    case "cambiar_tipo":
      return `anadir una columna nueva con el tipo pedido y dejar "${
        change.fieldLabel ?? change.field
      }" como esta`;
    case "borrar_tabla":
      return `conservar la tabla "${change.tableLabel}"`;
  }
}

/**
 * Las opciones del diálogo. La primera es siempre la que no rompe nada, y la
 * de no tocar la tabla esta siempre: sin ella, la única salida de una pregunta
 * seria aceptarla.
 */
export function impactOptions(changes: StructureChange[], pages: ImpactedPage[]): ImpactOption[] {
  const options: ImpactOption[] = [];
  const harmless = changes.filter(hasHarmless);

  if (harmless.length) {
    options.push({
      id: "conservar",
      label: "Conservar los datos",
      hint: `Sin borrar nada: ${harmless.map(harmlessOf).join("; ")}.`,
    });
  }

  const noTouch: ImpactOption = {
    id: "no_tocar",
    label: "No tocar la tabla",
    hint: "La base de datos se queda igual y la IA sigue con lo que si puede hacer.",
  };
  // Sin variante inocua, la única opción que no rompe nada es esta, así que
  // pasa a ir primera.
  if (!harmless.length) options.push(noTouch);

  if (pages.length) {
    options.push({
      id: "aplicar_y_arreglar",
      label: "Aplicar y arreglar las páginas",
      hint: `Se hace el cambio y la IA reescribe ${
        pages.length === 1 ? "la página afectada" : `las ${pages.length} páginas afectadas`
      }.`,
    });
  }

  options.push({
    id: "aplicar",
    label: "Aplicar el cambio",
    hint: pages.length
      ? "Se hace el cambio y las páginas afectadas se quedan como están."
      : "Se hace el cambio.",
  });

  if (harmless.length) options.push(noTouch);
  return options;
}

/* ------------------------------------------------------------------ */
/* Aplicar                                                             */
/* ------------------------------------------------------------------ */

/**
 * Reescribe las columnas de una tabla.
 *
 * No hay que soltar las reglas antes: la regla de una tabla no nombra ninguna
 * columna --solo dice quien es el dueno de la aplicación-- desde que se retiro
 * la columna que decidia quien ve cada fila. Ver `accessRules`.
 */
async function writeFields(table: TableRecord, fields: FieldDef[]): Promise<TableRecord> {
  const { fields: saved } = await updateDataCollection({
    dataCollection: table.dataCollection,
    fields,
  });
  return updateRecord<TableRecord>(INTERNAL.tables, table.id, { fields: saved });
}

const fieldOf = (table: TableRecord, name?: string) =>
  (table.fields ?? []).find((f) => f.name === name);

/** Deja la columna fuera de la vista sin tocar lo que guarda. */
async function hideField(table: TableRecord, name: string): Promise<void> {
  const meta = table.meta ?? {};
  const hidden = [...new Set([...(meta.hidden ?? []), name])];
  await updateRecord(INTERNAL.tables, table.id, { meta: { ...meta, hidden } });
}

/**
 * Hace un cambio, con o sin su variante inocua. Devuelve como contarlo.
 * Las filas nunca se tocan aquí: lo único que cambia es la estructura.
 */
export async function applyChange(opts: {
  table: TableRecord;
  change: StructureChange;
  /** `true` hace la variante que no destruye nada. */
  harmless: boolean;
}): Promise<string> {
  const { table, change } = opts;

  if (opts.harmless && !hasHarmless(change)) {
    return `La tabla "${table.label}" se quedó como estaba.`;
  }

  switch (change.kind) {
    case "borrar_columna": {
      const field = fieldOf(table, change.field);
      if (!field) return `La columna "${change.field}" ya no existe en "${table.label}".`;
      // Una columna de relación ocupa dos columnas reales --la relación y su
      // valor sin dueno-- y las dos se van con ella: `updateDataCollection` solo
      // emite el corralito de las relaciones que siguen en la lista, así que lo
      // que se quita aquí desaparece entero. Ocultarla no borra ninguna.
      if (opts.harmless) {
        await hideField(table, field.name);
        return `Se ocultó "${field.label}" en "${table.label}"; sus datos siguen ahí.`;
      }
      await writeFields(
        table,
        (table.fields ?? []).filter((f) => f.name !== field.name),
      );
      return `Se borró la columna "${field.label}" de "${table.label}".`;
    }

    case "cambiar_tipo": {
      const field = fieldOf(table, change.field);
      if (!field) return `La columna "${change.field}" ya no existe en "${table.label}".`;
      const type = (change.newType ?? field.type) as FieldType;
      // Dejar de ser una relación se lleva también su valor sin dueno, por lo
      // mismo que al borrarla: deja de emitirse. Al reves --pasar a relación--
      // el corralito nace vacío, que es su estado normal.

      if (opts.harmless) {
        // La nueva nace sin id: PocketBase le asigna uno y la vieja se queda
        // intacta con el suyo.
        const name = `${field.name}_nuevo`;
        await writeFields(table, [
          ...(table.fields ?? []),
          { name, label: `${field.label} (nueva)`, type },
        ]);
        return `Se añadió "${field.label} (nueva)" a "${table.label}" con el tipo pedido; la original se quedó.`;
      }

      await writeFields(
        table,
        (table.fields ?? []).map((f) => (f.name === field.name ? { ...f, type } : f)),
      );
      return `La columna "${field.label}" de "${table.label}" cambio de tipo.`;
    }

    case "borrar_tabla": {
      await dropDataCollection(table.dataCollection);
      await deleteRecord(INTERNAL.tables, table.id);
      return `Se borró la tabla "${table.label}" con sus filas.`;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Lo que llega del panel                                               */
/* ------------------------------------------------------------------ */

const KINDS: ChangeKind[] = ["borrar_columna", "cambiar_tipo", "borrar_tabla"];

const CHOICES: ImpactChoice[] = ["conservar", "aplicar", "aplicar_y_arreglar", "no_tocar"];

export function readChoice(value: unknown): ImpactChoice {
  if (typeof value === "string" && CHOICES.includes(value as ImpactChoice)) {
    return value as ImpactChoice;
  }
  throw new HttpError(400, "La opción elegida no existe");
}

/**
 * Vuelve a armar los cambios contra las tablas de ahora mismo. Lo que manda el
 * panel es lo que se le mostro, no una orden: aquí se comprueba que siga
 * existiendo antes de tocar nada.
 */
export function readChanges(value: unknown, tables: TableRecord[]): StructureChange[] {
  if (!Array.isArray(value)) return [];
  const out: StructureChange[] = [];

  for (const item of value) {
    const raw = item as Partial<StructureChange>;
    if (!KINDS.includes(raw.kind as ChangeKind)) continue;
    const table = tables.find((t) => t.id === raw.tableId);
    if (!table) continue;
    // La tabla de personas no se borra por aquí tampoco. La ruta de borrar
    // tablas lo comprueba (`guardSystemTable`), y este camino --lo que la IA
    // propone y el diálogo confirma-- llegaba hasta `dropDataCollection` sin
    // pasar por ella: se llevaria por delante quien entra a la aplicación.
    if (raw.kind === "borrar_tabla" && isPeopleTable(table)) continue;

    const change: StructureChange = {
      kind: raw.kind as ChangeKind,
      tableId: table.id,
      tableLabel: table.label,
      what: typeof raw.what === "string" ? raw.what.slice(0, 200) : "",
    };

    if (change.kind !== "borrar_tabla") {
      const field = fieldOf(table, typeof raw.field === "string" ? raw.field : "");
      if (!field) continue;
      // Las dos columnas que sostienen el acceso no se borran ni cambian de
      // tipo: es la misma defensa que `guardSystemFields` hace en la ruta de
      // tablas, puesta también en este camino.
      if (field.system !== undefined) continue;
      // La del nombre si cambia de tipo --es del constructor-- pero tampoco se
      // borra: es de donde sale el nombre de cada persona.
      if (change.kind === "borrar_columna" && isPeopleNameField(table, field)) continue;
      change.field = field.name;
      change.fieldLabel = field.label;
      change.fieldId = field.id;
      if (change.kind === "cambiar_tipo") {
        // Un tipo que no existe llegaba hasta la base y volvia como "Tipo de
        // columna desconocido": aquí el cambio simplemente no se aplica.
        if (!isFieldType(raw.newType)) continue;
        change.newType = raw.newType;
      }
    }

    out.push({ ...change, what: change.what || describeChange(change) });
  }
  return out;
}

/** El cambio contado en una línea, para el diálogo y para el historial. */
export function describeChange(change: StructureChange): string {
  switch (change.kind) {
    case "borrar_columna":
      return `Borrar la columna "${change.fieldLabel ?? change.field}" de la tabla "${change.tableLabel}"`;
    case "cambiar_tipo":
      return `Cambiar el tipo de la columna "${change.fieldLabel ?? change.field}" de la tabla "${change.tableLabel}"`;
    case "borrar_tabla":
      return `Borrar la tabla "${change.tableLabel}" con sus filas`;
  }
}
