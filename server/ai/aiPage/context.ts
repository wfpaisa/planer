/**
 * El contexto que se le arma a la IA en cada peticion: que tablas declara la
 * pagina, que le senalaron con el cursor, que archivos tiene delante --y el
 * tipo `ToolContext` que las ordenes leen y mutan mientras se ejecutan.
 */
import type {
  AccessChange,
  AiChatFile,
  AiQuestion,
  AiStep,
  AppPerson,
  AppRecord,
  HtmlSource,
  PageProbeReport,
  PageRecord,
  PickedBlock,
  StructureChange,
  TableRecord,
} from "../../../shared/types.ts";
import type { AiFileSample } from "../aiFiles.ts";

/** El manifiesto de las tablas que la IA declaro para la pagina. */
export function sourcesFor(names: unknown, tables: TableRecord[]): HtmlSource[] {
  const wanted = Array.isArray(names) ? names.map(String) : [];
  const out: HtmlSource[] = [];

  for (const name of wanted) {
    const table =
      tables.find((t) => t.name === name) ??
      tables.find((t) => t.id === name) ??
      tables.find((t) => t.label.toLowerCase() === name.toLowerCase());
    if (!table || out.some((s) => s.tableId === table.id)) continue;

    // El HTML nombra las columnas como se las conto el contexto --por su
    // nombre tecnico-- y el manifiesto las traduce a su id interno, que es lo
    // unico que sobrevive a un cambio de nombre.
    const fields: Record<string, string> = {};
    for (const field of table.fields ?? []) {
      if (field.id) fields[field.name] = field.id;
    }
    out.push({ name: table.name, tableId: table.id, fields });
  }
  return out;
}

/**
 * Lo que quien construye senalo con el cursor antes de pedir esto.
 *
 * Va en el contexto y no en la peticion porque es estado de la pagina, no
 * texto de nadie. Cada uno llega con su referencia --el nombre si ya lo tiene,
 * el sitio si todavia no-- para que la IA pueda editarlo sin buscarlo.
 */
export function pickedSection(picked: PickedBlock[]): string {
  const blocks = picked.map((pick, i) => {
    const ref = pick.name || pick.path;
    const cut = pick.truncated
      ? '\n\nThat HTML is **trimmed**: it is not everything inside. If you need the rest, ask for it with "leer_bloque".'
      : "";
    return `### ${i + 1}. ${pick.label}

- To edit it, put this in "bloque": \`${ref}\`
- How it stands now:

\`\`\`html
${pick.html}
\`\`\`${cut}`;
  });

  return `## What they pointed at

The builder pointed at ${picked.length === 1 ? "this element" : "these elements"} of the document before asking you this. When they say "esto", "esta tabla" or "aqui", they mean ${picked.length === 1 ? "that one" : "one of these"}.

${blocks.join("\n\n")}

Each edit targets one block. If what is asked touches several, do them one at a time.`;
}

/**
 * Un adjunto de la conversacion, ya nombrado y con lo que se le ensena de el.
 *
 * `label` es con lo que la IA lo nombra en una orden: el nombre del archivo,
 * desempatado cuando la conversacion trae dos que se llaman igual. La huella es
 * cosa del almacen y el modelo no la ve nunca.
 */
export interface ShownFile {
  file: AiChatFile & { label: string };
  sample: AiFileSample;
  /** Se adjunto en un turno anterior, no en esta peticion. */
  earlier: boolean;
}

/** El tamano de un archivo, dicho en la unidad que se lee de un vistazo. */
export function weigh(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Los archivos adjuntados a esta conversacion.
 *
 * Van en el contexto, como lo senalado: son material que hay que tener delante,
 * no la peticion. Quien escribe dice que hacer con ellos --"toma como
 * referencia este HTML", "crea una tabla con estas columnas"-- y aqui solo se
 * ponen a la vista con su nombre, para que se les pueda nombrar.
 *
 * Lo que viaja es una muestra, no el archivo: de una hoja de calculo o un CSV,
 * sus columnas y unas pocas filas; de un JSON que es una lista, sus claves y
 * sus primeros elementos; de un texto o un HTML, el archivo entero mientras
 * quepa. El archivo guardado esta entero, y "leer_archivo" lo abre por tramos.
 *
 * Entran tambien los de turnos anteriores: un adjunto sigue estando mientras la
 * conversacion siga abierta, asi que preguntar por el dos turnos despues no
 * obliga a adjuntarlo otra vez.
 */
export function filesSection(shown: ShownFile[]): string {
  const blocks = shown.map((item, i) => {
    const { file, sample } = item;
    const head = [
      `### ${i + 1}. ${file.label}`,
      "",
      `- To name it in a command, write it exactly like this: \`${file.label}\``,
      `- ${weigh(file.size)}${item.earlier ? ", attached in an earlier turn of this conversation" : ""}`,
      ...(sample.detail ? [`- It carries ${sample.detail}`] : []),
    ];

    if (file.kind === "image") {
      head.push("- It is an image and it is attached to this same request: look at it there.");
      return head.join("\n");
    }

    head.push(
      sample.truncated
        ? `- What you see below is **only part of it**. To read the rest, use "leer_archivo" with \`${file.label}\`.`
        : `- What you see below is the whole file. "leer_archivo" reads it again by ranges if you need it.`,
      "",
      `\`\`\`${sample.language}`,
      sample.body,
      "```",
    );
    return head.join("\n");
  });

  const one = shown.length === 1;
  return `## The files attached to this conversation

${one ? "This file was attached" : "These files were attached"} to the conversation. ${
    one ? "It is material" : "They are material"
  } for handling what is being asked, not the request itself: what to do with ${
    one ? "it" : "them"
  } is said in the text they wrote.

${blocks.join("\n\n")}

Two things to hold on to:

- **Do not state a figure you did not read.** What you have above is a sample. Counting rows, adding up a column or checking whether a value appears means reading the file first with "leer_archivo"; answering from the sample would be inventing.
- None of this is stored in the app yet. If what is being asked is for something here to be stored --a table with this data, a screen with this HTML-- it has to be created with the usual commands, and a table is filled from a file with "llenar_tabla", never by typing the rows out.`;
}

export interface ToolContext {
  app: AppRecord;
  page: PageRecord;
  tables: TableRecord[];
  pages: PageRecord[];
  /**
   * Los adjuntos que esta conversacion tiene delante, ya nombrados: los de esta
   * peticion y los de los turnos anteriores. Es la lista contra la que se
   * resuelve el nombre que la IA escribe en "leer_archivo" y "llenar_tabla", y
   * lo que hace que un archivo de otra conversacion no se alcance desde aqui.
   */
  files: ShownFile[];
  steps: AiStep[];
  /** Avisos cortos de lo que se aplico solo. */
  notices: string[];
  /** Cambios con riesgo, esperando el dialogo de impacto. */
  pending: StructureChange[];
  /** Las personas invitadas, como estaban al empezar la peticion. */
  people: AppPerson[];
  /**
   * Accesos que la IA quiere dar y todavia no ha dado.
   *
   * Van aparte de `ctx.pending` y no dentro: un permiso no tiene tabla, y las
   * cuatro salidas del dialogo de impacto no significan nada para el. Cada uno
   * se confirma por su cuenta, leyendo su consecuencia.
   */
  grants: AccessChange[];
  changed: boolean;
  /** Deja el punto al que volver, una sola vez por peticion. */
  step: () => Promise<void>;
  /**
   * Manda el HTML de ahora a dibujarse y espera lo que suelte la consola.
   * `null` cuando no habia nadie mirando y no se pudo probar.
   */
  probe: (html: string) => Promise<PageProbeReport | null>;
  /** Revisiones gastadas. Hay tope: corregir a ciegas no converge. */
  probes: number;
  /**
   * Lo que la IA pregunto, si pregunto. Mientras tenga algo, el turno se
   * cierra: preguntar y seguir escribiendo seria preguntar por cortesia.
   */
  question: AiQuestion | null;
  /**
   * El plan con el que se cerro el modo Plan, si se cerro. Mismo papel que
   * `question`: mientras tenga algo, el turno se cierra.
   */
  plan: { texto: string; implementado: boolean } | null;
  /**
   * Si lo que hay escrito ahora mismo ya paso por la revision.
   *
   * Cada escritura lo deja en falso otra vez: lo revisado era el documento
   * anterior, no este. Es lo que mira el cierre del turno para pedir la
   * revision cuando el modelo no la pidio.
   */
  reviewed: boolean;
}

export const findTable = (ctx: ToolContext, name: unknown): TableRecord | undefined => {
  const wanted = String(name ?? "").trim();
  return (
    ctx.tables.find((t) => t.name === wanted) ??
    ctx.tables.find((t) => t.id === wanted) ??
    ctx.tables.find((t) => t.label.toLowerCase() === wanted.toLowerCase())
  );
};

/**
 * El manifiesto despues de una edicion parcial.
 *
 * Un trozo nuevo puede pedir datos que la pagina todavia no declaraba, y una
 * fuente sin declarar se rechaza al pedirla. Las que ya estaban no se quitan:
 * el resto del documento --que no se ha tocado-- las sigue usando.
 */
export function withSources(ctx: ToolContext, names: unknown): HtmlSource[] {
  const current = ctx.page.sources ?? [];
  const added = sourcesFor(names, ctx.tables).filter(
    (s) => !current.some((c) => c.tableId === s.tableId),
  );
  return added.length ? [...current, ...added] : current;
}

/**
 * Lo que se le contesta cuando nombra un archivo que no es de esta
 * conversacion. Se dice y se falla, con los que si tiene delante: nombrar mal
 * se corrige en la vuelta siguiente, inventar el contenido no.
 */
export function missingFile(ctx: ToolContext, wanted: string, tool: string): string {
  ctx.steps.push({ tool, summary: `No hay ningún archivo "${wanted}"`, ok: false });
  const names = ctx.files.map((f) => `"${f.file.label}"`).join(", ");
  return names
    ? `Error: no file called "${wanted}" is attached to this conversation. The ones that are: ${names}. Name it exactly as the context gave it to you.`
    : `Error: nothing is attached to this conversation, so there is no file to read. Ask them to attach it.`;
}

/** Como se llama la pantalla segun lo escrito: su encabezado, o su titulo. */
export function titleFromHtml(html: string): string {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return unescapeHtml((h1?.[1] ?? title?.[1] ?? "").replace(/<[^>]+>/g, " "));
}

/** Lo justo para leer un encabezado: lo demas no cabe en un nombre de pagina. */
function unescapeHtml(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? whole;
    const point = Number(code[1]?.toLowerCase() === "x" ? `0x${code.slice(2)}` : code.slice(1));
    // Un numero que no es un caracter se queda escrito como vino: en un nombre
    // de pagina molesta menos verlo que reventar por el.
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : whole;
  });
}
