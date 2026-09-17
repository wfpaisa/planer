/**
 * La IA escribiendo el HTML de una pagina.
 *
 * Una peticion toca una sola pagina: la que esta abierta. La IA no arma
 * configuracion, escribe el documento entero, y recibe en cada peticion el
 * contexto armado en ese momento --colores, medidas, tablas, quien esta
 * mirando y los limites-- para que nunca trabaje con una tabla que ya cambio.
 *
 * Los cambios de base de datos sin riesgo se aplican solos. Los que pueden
 * romper algo no se aplican aqui: se apuntan y vuelven al panel, que los
 * presenta todos juntos en el dialogo de impacto (ver `dataImpact.ts`).
 */
import { buildHtmlContract } from "../shared/htmlContract.ts";
import { IMPORT_BATCH_CHUNK, MAX_IMPORT_ROWS } from "../shared/importBatch.ts";
import { detectSeparator, type ParsedTable, parseImport } from "../shared/importParse.ts";
import { convertValue } from "../shared/importValues.ts";
import { cleanPageName, isDefaultPageName } from "../shared/pages.ts";
import { isPeopleNameField, isPeopleTable, normalizeRole } from "../shared/people.ts";
import { keyCandidates } from "../shared/relations.ts";
import type {
  AccessChange,
  AccessDirection,
  AiChatFile,
  AiChoice,
  AiMessage,
  AiPageResult,
  AiProgress,
  AiQuestion,
  AiStep,
  AiUsage,
  AppPerson,
  AppRecord,
  DataImpact,
  FieldDef,
  FieldType,
  HtmlSource,
  PageProbeReport,
  PageRecord,
  PickedBlock,
  StructureChange,
  TableRecord,
} from "../shared/types.ts";
import { isFieldType } from "../shared/types.ts";
import { peopleOf, setPersonAccess } from "./access.ts";
import { AI_MISSING, aiEnabled, askAi, startConversation, type ToolDef } from "./ai.ts";
import { saveAiDebug } from "./aiDebug.ts";
import {
  type AiFileSample,
  findAiFile,
  findByName,
  MAX_READ_LINES,
  nameAiFiles,
  READ_LINES,
  readAiFileBase64,
  readAiFileChunk,
  sampleAiFile,
} from "./aiFiles.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { accessRisky, describeChange, impactOptions, pagesForChanges } from "./dataImpact.ts";
import { quote } from "./filter.ts";
import { auditPageHtml, auditSummary } from "./htmlAudit.ts";
import { BlockError, insertBlock, readBlock, removeBlock, replaceBlock } from "./htmlBlocks.ts";
import { pruneDocs, readDoc, saveDoc } from "./htmlDocs.ts";
import { openProbe, tidyIssues } from "./htmlProbe.ts";
import { injectPageRefs, type PageRef } from "./pageAssets.ts";
import { createRecord, listRecords, pb, updateRecord } from "./pb.ts";
import {
  createDataCollection,
  dataCollectionName,
  identifier,
  uniqueTableName,
  updateDataCollection,
} from "./schema.ts";
import { pruneVersions, saveVersion } from "./versions.ts";

const MAX_ROUNDS = 12;

/** Tope de filas que devuelve una consulta de solo lectura. */
const MAX_QUERY_ROWS = 20;

const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* Leer y escribir la pagina                                            */
/* ------------------------------------------------------------------ */

export const appPages = async (appId: string): Promise<PageRecord[]> =>
  (
    await listRecords<PageRecord>(INTERNAL.pages, {
      filter: `app = "${quote(appId)}"`,
      sort: "order,created",
      perPage: 200,
      skipTotal: 1,
    })
  ).items;

export const appTables = async (appId: string): Promise<TableRecord[]> =>
  (
    await listRecords<TableRecord>(INTERNAL.tables, {
      filter: `app = "${quote(appId)}"`,
      sort: "order,created",
      perPage: 200,
      skipTotal: 1,
    })
  ).items;

/**
 * Guarda el HTML de una pagina.
 *
 * Lo que llega pasa antes por la reposicion de las dos referencias, venga de
 * la IA o del editor de codigo: una pagina sin ellas se dibujaria sin estilos
 * y sin puente. El documento anterior puede quedarse sin duenos, asi que se
 * recorta despues.
 */
export async function writePageDoc(opts: {
  app: AppRecord;
  page: PageRecord;
  html: string;
  sources?: HtmlSource[];
}): Promise<{ doc: string; restored: PageRef[]; sources: HtmlSource[] }> {
  const { content, restored } = injectPageRefs(opts.html);
  const { hash } = await saveDoc(opts.app.id, content);

  const sources = opts.sources ?? opts.page.sources ?? [];
  const saved = await updateRecord<PageRecord>(INTERNAL.pages, opts.page.id, {
    doc: hash,
    sources,
  });

  if (opts.page.doc && opts.page.doc !== hash) {
    await pruneDocs(opts.app.id, await appPages(opts.app.id)).catch(() => 0);
  }

  return { doc: hash, restored, sources: saved.sources ?? [] };
}

/** El manifiesto de las tablas que la IA declaro para la pagina. */
function sourcesFor(names: unknown, tables: TableRecord[]): HtmlSource[] {
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

/* ------------------------------------------------------------------ */
/* El texto de sistema                                                  */
/* ------------------------------------------------------------------ */

const TOOL_GUIDE = `## How to work

1. If the page already has something written, look at it before touching it: "ver_pagina" brings back the whole document, "leer_bloque" brings back a single piece.
2. **Check first that you know which source this is about.** If two or more of the tables you were given could equally be it, you do not know: ask with "preguntar" and stop there. Guessing right half the time means building the wrong screen half the time, and nothing later in this guide fixes that. Anything else that is unclear --how it looks, which columns, what order-- is not asked: it is built and then corrected.
3. If a table or a column is missing, ask for it with its command before writing.
4. Choose what you write with, because it matters:
   - **A local change** --a title, a table, a card, a search box next to a list that already exists-- is made with "reemplazar_bloque", "insertar_bloque" or "quitar_bloque". What you do not touch is not generated again, so it cannot come out different from how it was when it was right.
   - **Redoing the screen** --a different structure, a different layout-- is made with "escribir_pagina", which replaces the whole document. When you use it, say so at the end and say why.
5. "tablas" carries the names of the sources your HTML uses. Anything you do not declare there is refused when the page asks for it.
6. **Before finishing, call "revisar_errores".** It reviews the style against the house system and draws the page for real in the browser. If anything comes back --in "estilo" or in "errores"-- fix it and check again. If you close the turn without having called it, it is run for you and the result comes back to you to fix: calling it yourself is faster, not optional.
7. Finish with a short summary, in Spanish, of what you left done.

## Checking for errors

It catches what reading the code does not show. Two different things, and both come back from the same call:

- **"estilo"**: where the HTML leaves the house system. It is read from the code, so it always comes back --even with nobody watching-- and it is what catches a screen that draws perfectly and still looks like nobody's: a colour written by hand, a \`var(--something)\` that does not exist, the brand fill used as letters, a button rewritten from scratch when \`class="btn"\` was already there.
- **"errores"**: what the console said when the page ran --a variable that does not exist, an element looked up before it exists, a response arriving in a different shape from the one you expected. This one needs the panel open; when it is not, the style review still arrives.

Rules:

- Call it once, at the end, when everything is written. Not after every block.
- It is not optional. If you finish a request that wrote or changed the page without having called it, it is called for you and what it found comes back to you, so you end up doing the same work later. The two-check limit counts those too.
- If the person writing to you says something does not work, or pastes HTML of their own saying it is failing, call it **even before touching anything**: that is how you see what this is about instead of editing code blind.
- If it returns failures, fix **only** what the failures say and check again.
- Two checks per request at most. If it still fails on the second one, stop and say so at the end, quoting the failure message as it came.
- "Warnings" are not failures. Do not rewrite anything over a warning.
- If it answers that the page could not be tested, that is not your HTML's fault: carry on and do not mention it.

It only sees what happens as the page loads. A failure that only shows up when a button is pressed does not appear there.

## Asking before building

There is one command to ask, "preguntar", and it ends your turn: what you ask arrives as buttons, and pressing one starts a new request. So ask only when both of these hold:

- **You cannot carry on without the answer.** Not "it would be useful to know": actually stuck. The clearest case, and the one that comes up most: two tables you were given fit the request equally well, and nothing in what was written tells them apart. Having a hunch about which one they meant is not knowing.
- **The answer is picking between things that already exist in this app** --which of two tables holds the orders, which source a list reads from--. If you cannot write the options out of what the context already gave you, this is not that kind of question.

Everything else is not asked, it is built. A question about how it should look, which columns to show, how to lay it out, has no options to offer: write a first version, say what you assumed in one sentence, and let them correct it. Somebody who does not know what they need until they see it cannot answer that question in the abstract.

- One question, never a chain of them.
- Between two and four options, each one true of this app.
- If you ask, ask before writing anything, and write nothing else in that turn: no summary.

## Proposing something they did not ask for

When you have finished building, you may add **one** proposal, and only when you find one of these four things:

- **An implicit scope left open**: the request used a broad word --"todos", "los pedidos"-- and the table has a column telling states or owners apart that the page does not use.
- **A capability the data is asking for and nobody used**: what is stored points at something the platform already does --dates nobody filters by, a person column with no owner per row-- and the screen ignores it.
- **A contradiction with what already exists**: what was asked repeats or fights something this app already has.
- **A datum visible to more people than the request suggests**: what you put on the screen reaches somebody the request did not have in mind.

Nothing else is a proposal. In particular, never propose:

- How it looks --colour, spacing, layout--: the style review already covers that, and it reads it from the code.
- Features nobody hinted at.
- Reorganising what they did not touch.

And only in these conditions:

- **One per answer**, at the end, in a single sentence. If two of the four fit, say the one that costs most to leave unsaid.
- **Only after a real build turn**: you wrote the page with "escribir_pagina", you created a table, or you used a source for the first time.
- **Never on a small correction**: a colour, a title, a wrong figure, a block moved. Somebody fixing one detail is not asking for a second opinion.
- If none of the four fits, say nothing. Saying nothing is the normal outcome, not a failure.

## How you write back

- In Spanish, professional and plain: what you left done, and why if it is not obvious.
- **Never the name of the person you are writing to**, and never addressed by it.
- No jokes, no cheering, no emoji: this is somebody's work, not a game.
- No interrogation either. Ask when the rules above call for a question; do not chain questions.
- Short. Whoever reads it wants to know what changed.

## Scope

You write on a single page: the one that is open. There is no command to create or to touch other pages.

If what is being asked would also require changing other pages, do what you can on this one and **say so explicitly** at the end, in a sentence starting with "Quedo fuera:" that says what is missing and why.

## The database

Creating a table, adding a column and renaming a column are applied straight away.

Deleting a column, deleting a table and changing a column's type can break other pages, so they are not yours to decide: asking for them files them, and the builder authorises them. Carry on with what you can do on the page and report it at the end.

## People and permissions

"cambiar_acceso" changes the roles one invited person holds, which is what decides the screens they get. Only somebody already on the invited list --inviting is not yours to do-- and only when it was asked for. Never as the proposal of a turn. "roles" is the whole list they end up with, not what is added.

Which way it goes is what decides how it is applied, and you do not choose that:

- **Taking away** --a role they stop holding-- is applied straight away. At worst it removes something that was left over, and there is a point to come back to.
- **Giving** --a role they did not hold-- is filed. Nothing about a person who already saw something can be undone, so the builder authorises it first, reading the sentence you wrote.

That sentence, "consecuencia", is the whole point of the filing: it has to say what that person is going to be able to do, naming them and naming the real data --"Ana podrá ver los pedidos de todos los clientes, no solo los suyos"--. Not "se le darán permisos de administrador", which says nothing to somebody who does not know what an administrator is here.

"cambiar_roles_pagina" changes which roles can open the page you are on. An empty list opens it to everybody who reaches the app; naming roles requires a signed-in account holding one of them, even in a public app. It is the only thing that really keeps data out of somebody's browser, so it is what you reach for when you are asked to *protect* something rather than to fit the screen.

It is applied straight away, and **you always say what it changed**: who can open the page now and who stopped being able to. Narrowing it can leave somebody out --that is the point-- and widening it hands the declared tables to whoever holds the link.

## The files they attached

Two commands work on an attached file, and both name it by the name you were given for it, never by anything else.

- **"leer_archivo"** brings back what the file really carries, by ranges. Use it whenever the answer depends on the whole file and not on the sample: a count, a sum, whether some value is in there, what the last rows say. It changes nothing --not the page, not the tables, not the data-- so there is no reason to hold back from it.
- **"llenar_tabla"** writes the file's rows into a table that already exists. You send which column of the file goes into which column of the table; the rows themselves you never write out.

What you must not do:

- **Never state a figure about a file you did not read.** The sample in the context is a few rows out of however many it has. "Trae 5.000 registros" said from a twenty-row sample is made up, and it is read as fact.
- Never type a file's rows into the page's HTML, and never ask for them one by one with "crear_tabla". That is what "llenar_tabla" is for.

## Filling a table from a file

"llenar_tabla" **adds** rows. It never replaces and never empties: what the table already had stays exactly as it was. If they ask you to replace what is there, say that you can only add, and that emptying a table is not yours to do.

- The table has to exist first. Create it with "crear_tabla" --its columns taken from the file's columns-- and then fill it.
- "columnas" is the pairing: for each column of the file, which column of the table it goes into. A column of the file you leave out stays out, and that is said back to you.
- The reply tells you how many rows went in, how many stayed out and why. **Say those figures in your summary**, exactly as they came back. If rows stayed out, say how many and why.
- If the file has more rows than a single import takes, nothing is written: it comes back saying how many it had and what the cap is. Do not try to split it yourself.

## Counting rows

There is one rule and it has no exceptions: **a count comes from \`total\`, never from counting the rows you were handed.**

- "consultar_datos" brings back a handful of rows so you can see what the data looks like. Its \`total\` is how many the table has. Saying "trae 197 registros" after looking at twenty of them is making it up.
- The same holds inside the page you write: \`plane.listar\` has a ceiling per call, \`r.total\` is the real figure and \`r.filas.length\` is the page size. To count something a filter can express, the page uses \`plane.contar\`.
- **If a figure looks short, it is the page size before it is anything else.** Do not explain it away with a story about the data --rows that did not import, a file that was cut off--. Rows that were saved do not disappear, and what an import did is not something you can see from here. Check \`total\` first.

## What you never claim

The summary you close a turn with says what was left done **by your commands**, and nothing else.

- If you did not call the command, it did not happen. A table is not filled because you created it; a page is not written because you described it.
- If what was asked cannot be done with the commands you have, say so plainly and say what you did instead. "Listo" over something that did not happen is the worst answer you can give: it is read as fact and it is found out later.
- If a command came back with an error you could not fix, say it, quoting what it said.

## What you always warn about

Two things get said out loud, in one sentence, without being asked:

- **A page that saves data and can be opened without an account.** Whoever arrives without one gets a notice asking them to sign in when they try to save. Say it when you build the form, not later.
- **Hiding by role is not protecting.** Whenever you write a check against "plane.usuario.roles" to hide something, say that the data still reaches the browser and that limiting the page to that role is what stops it.`;

/**
 * Lo que quien construye senalo con el cursor antes de pedir esto.
 *
 * Va en el contexto y no en la peticion porque es estado de la pagina, no
 * texto de nadie. Cada uno llega con su referencia --el nombre si ya lo tiene,
 * el sitio si todavia no-- para que la IA pueda editarlo sin buscarlo.
 */
function pickedSection(picked: PickedBlock[]): string {
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
function weigh(bytes: number): string {
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
function filesSection(shown: ShownFile[]): string {
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

/**
 * Lo que se le dice cuando la pagina todavia se llama como nacio.
 *
 * El nombre de relleno --"Pagina 3"-- no dice nada en el sidebar, y quien pide
 * una pantalla ya conto de que va: el nombre sale de ahi. Solo se le ofrece
 * mientras el de relleno siga puesto; uno escrito a mano no se toca.
 */
const UNNAMED_PAGE = `This page still carries the name it was born with, which says nothing about what it holds. When you write it with "escribir_pagina", send \`nombre\` as well: a short name in Spanish, two or three words at most, taken from what they asked you to build --"Clientes", "Panel de ventas", "Alta de pedidos"--. It is read in the sidebar, so it names the screen, it does not describe it: no article in front, no verb, no sentence. If they named the screen themselves in what they wrote, use their name.`;

function systemPrompt(
  app: AppRecord,
  page: PageRecord,
  tables: TableRecord[],
  picked: PickedBlock[],
  files: ShownFile[],
  people: AppPerson[],
): string {
  const contract = buildHtmlContract({
    appName: app.name,
    tables,
    pageRoles: page.roles,
    appRoles: app.roles,
    people,
    blocks: true,
    audience: true,
  });

  const parts = [
    contract,
    `## This page\n\nYou are writing the page "${page.name}"${
      page.isHome ? ", which is the app's home screen" : ""
    }.${isDefaultPageName(page.name) ? `\n\n${UNNAMED_PAGE}` : ""}`,
  ];

  if (picked.length) parts.push(pickedSection(picked));
  if (files.length) parts.push(filesSection(files));
  parts.push(TOOL_GUIDE);

  return parts.join("\n\n---\n\n");
}

/* ------------------------------------------------------------------ */
/* Las ordenes                                                          */
/* ------------------------------------------------------------------ */

/**
 * Los tipos de columna que la IA puede crear.
 *
 * `relation` esta aqui y no en el cambio de tipo: crear una columna que apunta
 * a otra tabla es cosa suya, convertir una que ya existe no. Ver `design.md`
 * D6 de `ia-crea-columnas-de-relacion`.
 */
const FIELD_TYPES = [
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
 * Convertir a relacion conserva los valores guardados, y eso lo resuelve el
 * camino del constructor. Aqui no aparece, y el ejecutor lo rechaza aparte:
 * el listado es una restriccion del modelo, no una comprobacion.
 */
const RETYPE_TYPES = FIELD_TYPES.filter((type) => type !== "relation");

const FIELD_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", description: "The column's visible name, in Spanish" },
    type: {
      type: "string",
      enum: FIELD_TYPES,
      description:
        "The data type. `relation` is a column pointing at another table of this app, written and matched by a value --never by an id--: use it when a row belongs to something that lives in another table. The app's people table is one more table here: point at it when each row belongs to somebody invited to the app.",
    },
    relationTable: {
      type: "string",
      description:
        "Only for `relation`: the source name of the table this column points at, exactly as you were given it. The table has to exist already; create it first if it does not.",
    },
    displayColumn: {
      type: "string",
      description:
        "Only for `relation`: which column of that table the cell shows, and the value rows are written and matched by. Leave it out to use the target's first key column.",
    },
    required: { type: "boolean", description: "Whether it is required" },
    unique: {
      type: "boolean",
      description:
        "Nobody can repeat its value in this table. Mark it on the columns that identify somebody --an ID number, a plate, a code--: only a column like that works as the key for pulling data out of a file.",
    },
    options: {
      type: "array",
      items: { type: "string" },
      description: "Options, only for the select type",
    },
  },
  required: ["label", "type"],
} as const;

/** Como se nombra el bloque sobre el que actua una orden. */
const BLOCK_REF = {
  type: "string",
  description:
    "The block to act on: its name (`data-plane`), or the reference you were given for an element they pointed at. A CSS selector matching exactly one element also works.",
} as const;

const BLOCK_NAME = {
  type: "string",
  description:
    "A meaningful name for the block, in Spanish, lowercase and hyphenated: `lista-clientes`, `cabecera`, `tarjeta-total`. Never `bloque` or `bloque-1`: it has to say what it is, because it is read in the HTML. If the block already has a name, its own is kept and this one is ignored.",
} as const;

const BLOCK_SOURCES = {
  type: "array",
  items: { type: "string" },
  description:
    "New sources this piece uses, if it asks for data the page did not declare yet. They are added to the ones it already has.",
} as const;

const TOOLS: ToolDef[] = [
  {
    name: "ver_pagina",
    description:
      "Returns the HTML the open page holds right now and the tables it declares. Use it before rewriting the page.",
    schema: { type: "object", properties: {} },
  },
  {
    name: "escribir_pagina",
    description:
      "Redoes the whole page: what you send replaces the entire document, so always send a complete file. Use it only when the structure of the screen changes. For a local change use 'reemplazar_bloque', which does not regenerate what was already right.",
    schema: {
      type: "object",
      properties: {
        html: { type: "string", description: "The complete HTML document" },
        tablas: {
          type: "array",
          items: { type: "string" },
          description: "Names of the sources the HTML uses. Undeclared, they cannot be asked for.",
        },
        nombre: {
          type: "string",
          description:
            "A short name for the page, in Spanish, two or three words at most: `Clientes`, `Panel de ventas`. It is read in the sidebar, so it names the screen rather than describing it. It is only taken while the page still carries the filler name it was born with (`Página 3`); once it has a name of its own, this is ignored.",
        },
      },
      required: ["html"],
    },
  },
  {
    name: "leer_bloque",
    description:
      "Returns the HTML of a single block, as it stands now. It lets you see what you are about to change without re-reading the whole document.",
    schema: {
      type: "object",
      properties: { bloque: BLOCK_REF },
      required: ["bloque"],
    },
  },
  {
    name: "reemplazar_bloque",
    description:
      "Swaps a block for other HTML and leaves the rest of the document untouched. It is the normal way to make a local change.",
    schema: {
      type: "object",
      properties: {
        bloque: BLOCK_REF,
        html: { type: "string", description: "The block's new HTML, that piece alone" },
        nombre: BLOCK_NAME,
        tablas: BLOCK_SOURCES,
      },
      required: ["bloque", "html", "nombre"],
    },
  },
  {
    name: "insertar_bloque",
    description:
      "Puts a new block right before or right after one that already exists, without touching anything else.",
    schema: {
      type: "object",
      properties: {
        bloque: BLOCK_REF,
        donde: {
          type: "string",
          enum: ["antes", "despues"],
          description:
            "Whether the new block goes before (`antes`) or after (`despues`) the one you name",
        },
        html: { type: "string", description: "The new block's HTML" },
        nombre: BLOCK_NAME,
        tablas: BLOCK_SOURCES,
      },
      required: ["bloque", "donde", "html", "nombre"],
    },
  },
  {
    name: "quitar_bloque",
    description: "Takes a block out of the document, with everything inside it.",
    schema: {
      type: "object",
      properties: { bloque: BLOCK_REF },
      required: ["bloque"],
    },
  },
  {
    name: "leer_archivo",
    description:
      "Returns what an attached file really carries, by ranges of lines. Use it whenever the answer depends on the whole file and not on the sample you were shown: a count, a sum, whether a value appears. It changes nothing: neither the page, nor the tables, nor the data.",
    schema: {
      type: "object",
      properties: {
        archivo: {
          type: "string",
          description: "The file's name, exactly as the context gave it to you",
        },
        desde: {
          type: "number",
          description: "First line to read, counting from 1. Leave it out to start at the top.",
        },
        lineas: {
          type: "number",
          description: `How many lines to bring back, up to ${MAX_READ_LINES}. Default ${READ_LINES}.`,
        },
      },
      required: ["archivo"],
    },
  },
  {
    name: "llenar_tabla",
    description:
      "Writes the rows of an attached file into a table that already exists. You send the pairing --which column of the file goes into which column of the table-- and the rows are read from the stored file: you never write the data out. It ADDS: nothing already in the table is replaced or deleted.",
    schema: {
      type: "object",
      properties: {
        tabla: { type: "string", description: "The table name" },
        archivo: {
          type: "string",
          description: "The file's name, exactly as the context gave it to you",
        },
        columnas: {
          type: "array",
          description:
            "One entry per column of the file you want to bring in. A column of the file you leave out stays out.",
          items: {
            type: "object",
            properties: {
              columna: {
                type: "string",
                description: "The column's name in the file, as its header says it",
              },
              destino: {
                type: "string",
                description: "The technical name of the table column it goes into",
              },
            },
            required: ["columna", "destino"],
          },
        },
      },
      required: ["tabla", "archivo", "columnas"],
    },
  },
  {
    name: "consultar_datos",
    description: `Reads rows from a table so you can answer a question. It changes nothing: neither the table nor the page. It brings back at most ${MAX_QUERY_ROWS} rows, and \`total\` says how many the table really has: those are different numbers and the rows are a sample, never the count.`,
    schema: {
      type: "object",
      properties: {
        tabla: { type: "string", description: "The table name" },
        limite: { type: "number", description: `Rows to return, up to ${MAX_QUERY_ROWS}` },
      },
      required: ["tabla"],
    },
  },
  {
    name: "crear_tabla",
    description: "Creates a new table with its columns. Applied straight away.",
    schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "The table's visible name, in Spanish" },
        fields: { type: "array", items: FIELD_SCHEMA },
      },
      required: ["label", "fields"],
    },
  },
  {
    name: "agregar_columnas",
    description:
      "Adds columns to a table that already exists, without touching the ones it has. Applied straight away.",
    schema: {
      type: "object",
      properties: {
        tabla: { type: "string" },
        fields: { type: "array", items: FIELD_SCHEMA },
      },
      required: ["tabla", "fields"],
    },
  },
  {
    name: "renombrar_columna",
    description:
      "Changes a column's visible name. Applied straight away: neither the data nor the pages notice.",
    schema: {
      type: "object",
      properties: {
        tabla: { type: "string" },
        columna: { type: "string", description: "The column's technical name" },
        etiqueta: { type: "string", description: "The new visible name, in Spanish" },
      },
      required: ["tabla", "columna", "etiqueta"],
    },
  },
  {
    name: "borrar_columna",
    description:
      "Asks to delete a column. Not applied: the builder authorises it, because it can break other pages.",
    schema: {
      type: "object",
      properties: { tabla: { type: "string" }, columna: { type: "string" } },
      required: ["tabla", "columna"],
    },
  },
  {
    name: "cambiar_tipo_columna",
    description:
      "Asks to change a column's type. Not applied: the builder authorises it, because the stored values may not convert.",
    schema: {
      type: "object",
      properties: {
        tabla: { type: "string" },
        columna: { type: "string" },
        tipo: { type: "string", enum: RETYPE_TYPES },
      },
      required: ["tabla", "columna", "tipo"],
    },
  },
  {
    name: "borrar_tabla",
    description:
      "Asks to delete a table with its rows. Not applied: the builder authorises it, because the data is lost.",
    schema: {
      type: "object",
      properties: { tabla: { type: "string" } },
      required: ["tabla"],
    },
  },
  {
    name: "cambiar_acceso",
    description:
      "Changes the roles one invited person holds, which is what decides the screens they get. Taking roles away is applied straight away. Giving one is not: it is filed with the sentence you write in 'consecuencia', and the builder authorises it reading that sentence. Only for people already on the invited list.",
    schema: {
      type: "object",
      properties: {
        persona: {
          type: "string",
          description: "The person's account or name, exactly as the invited list gives it",
        },
        roles: {
          type: "array",
          items: { type: "string" },
          description:
            "The roles they end up with, if the roles change. It is the whole list, not what is added: what is not here they no longer hold. Only roles the app defines.",
        },
        consecuencia: {
          type: "string",
          description:
            'What that person is going to be able to do --or stop doing-- said in one sentence, in Spanish, naming them and naming the real data: "Ana podrá ver los pedidos de todos los clientes, no solo los suyos". Never a generic sentence about permissions.',
        },
      },
      required: ["persona", "roles", "consecuencia"],
    },
  },
  {
    name: "cambiar_roles_pagina",
    description:
      "Changes which roles can open the page you are on. An empty list opens it to everybody who reaches the app; naming roles requires a signed-in account holding one of them, even in a public app. This is what actually keeps the declared tables out of somebody's browser --hiding by role in the HTML does not--. Applied straight away; say what it changed.",
    schema: {
      type: "object",
      properties: {
        roles: {
          type: "array",
          items: { type: "string" },
          description:
            "The roles that end up able to open the page. It is the whole list, not what is added. Empty opens it to everybody. Only roles the app defines.",
        },
      },
      required: ["roles"],
    },
  },
  {
    name: "preguntar",
    description:
      "Asks the person one question and ends your turn: after calling it you write nothing else, and choosing an option starts a new request. Use it only when the answer is picking between things that already exist in this app --which table, which source-- and you cannot carry on without it. Never for open design questions --which columns, which layout--: build a first version and let them correct it.",
    schema: {
      type: "object",
      properties: {
        pregunta: {
          type: "string",
          description: "The question, in Spanish, in one line",
        },
        encabezado: {
          type: "string",
          description: "What it is about, in two or three words, in Spanish",
        },
        opciones: {
          type: "array",
          description: "Between two and four options, each one already existing in the app",
          items: {
            type: "object",
            properties: {
              etiqueta: { type: "string", description: "The button's text, in Spanish. Short." },
              detalle: {
                type: "string",
                description: "What choosing it means, in Spanish, if the label alone is not enough",
              },
            },
            required: ["etiqueta"],
          },
        },
      },
      required: ["pregunta", "encabezado", "opciones"],
    },
  },
  {
    name: "revisar_errores",
    description:
      "Reviews the page as it stands and returns two things. One, 'estilo': where the HTML departs from the house system --a colour written by hand, a variable that does not exist, a brand fill used as letters, a piece of the catalogue rewritten from scratch--, which is read from the code and always comes back. Two, 'errores': what the console reported when the page was drawn for real in the browser --exceptions, rejected promises, resources that did not load--, which needs somebody with the panel open. Call it when you have finished writing. The commands that store data do not run during the test.",
    schema: { type: "object", properties: {} },
  },
];

/* ------------------------------------------------------------------ */
/* Ejecucion de las ordenes                                             */
/* ------------------------------------------------------------------ */

/**
 * Las columnas que propone la IA, o por que no se puede crear ninguna.
 *
 * Devuelve un texto cuando algo no cuadra, y ese texto es la respuesta que
 * recibe la IA: lo lee y corrige en la vuelta siguiente, dentro de la misma
 * peticion. Por eso dice el paso que falta y no solo que fallo.
 *
 * Un rechazo para la orden entera, no solo para la columna: crear la tabla sin
 * la columna que se rechazo deja una tabla equivocada y la IA sigue
 * construyendo la pantalla encima. Ver `design.md` D4.
 *
 * Necesita las tablas de la aplicacion porque la IA nombra el destino de una
 * relacion por su nombre tecnico --el mismo con el que nombra tablas en las
 * demas ordenes-- y lo que se guarda es su identificador.
 */
function normalizeFieldDefs(raw: unknown, tables: TableRecord[]): FieldDef[] | string {
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
       * marca de unica: las de la tabla de personas llegan importando la
       * nomina y nadie vuelve a marcarlas.
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
   * Si lo que hay escrito ahora mismo ya paso por la revision.
   *
   * Cada escritura lo deja en falso otra vez: lo revisado era el documento
   * anterior, no este. Es lo que mira el cierre del turno para pedir la
   * revision cuando el modelo no la pidio.
   */
  reviewed: boolean;
}

/** Revisiones que se le consienten a una peticion. */
const MAX_PROBES = 2;

/** Salidas que se pintan en una pregunta. Mas no se eligen de un vistazo. */
const MAX_OPTIONS = 4;

/**
 * Si un cambio de acceso da o quita.
 *
 * Da en cuanto quede con un rol que no tenia. Un mismo cambio que anada uno y
 * quite otro cuenta como que da: lo que se abre es lo que no se deshace.
 */
function accessDirection(person: AppPerson, roles: string[]): AccessDirection {
  return roles.some((role) => !person.roles.includes(role)) ? "dar" : "quitar";
}

const findTable = (ctx: ToolContext, name: unknown): TableRecord | undefined => {
  const wanted = String(name ?? "").trim();
  return (
    ctx.tables.find((t) => t.name === wanted) ??
    ctx.tables.find((t) => t.id === wanted) ??
    ctx.tables.find((t) => t.label.toLowerCase() === wanted.toLowerCase())
  );
};

/** El HTML que tiene ahora mismo la pagina abierta. */
async function currentHtml(ctx: ToolContext): Promise<string> {
  if (!ctx.page.doc) return "";
  return (await readDoc(ctx.app.id, ctx.page.doc)) ?? "";
}

/**
 * El manifiesto despues de una edicion parcial.
 *
 * Un trozo nuevo puede pedir datos que la pagina todavia no declaraba, y una
 * fuente sin declarar se rechaza al pedirla. Las que ya estaban no se quitan:
 * el resto del documento --que no se ha tocado-- las sigue usando.
 */
function withSources(ctx: ToolContext, names: unknown): HtmlSource[] {
  const current = ctx.page.sources ?? [];
  const added = sourcesFor(names, ctx.tables).filter(
    (s) => !current.some((c) => c.tableId === s.tableId),
  );
  return added.length ? [...current, ...added] : current;
}

/**
 * Guarda el documento despues de editar un trozo.
 *
 * Una edicion parcial se guarda igual que una reescritura: mismo camino, misma
 * version, mismo punto al que volver. Desde "Cambios" no se distingue una de
 * otra, que es justo lo que hace que se pueda deshacer.
 */
async function saveEdit(ctx: ToolContext, html: string, sources: HtmlSource[]): Promise<void> {
  const { doc } = await writePageDoc({ app: ctx.app, page: ctx.page, html, sources });
  ctx.page = { ...ctx.page, doc, sources };
  ctx.changed = true;
  ctx.reviewed = false;
}

/**
 * Le pone nombre a una pagina que todavia se llama como nacio.
 *
 * Una pagina recien creada se llama "Pagina 3" y esta en blanco: ese nombre es
 * relleno, no una decision, asi que la primera vez que se escribe se cambia por
 * uno que diga de que va la pantalla. El que manda es el que propuso la IA, que
 * es quien leyo lo que se pidio; si no mando ninguno, se saca del titulo de lo
 * que acaba de escribir, que dice lo mismo.
 *
 * Un nombre escrito a mano no se toca nunca, aunque la pagina se reescriba
 * entera: renombrarle a alguien lo que ya nombro es perderle algo suyo.
 */
async function namePage(ctx: ToolContext, proposed: unknown, html: string): Promise<string | null> {
  if (!isDefaultPageName(ctx.page.name)) return null;
  const name = cleanPageName(proposed) ?? cleanPageName(titleFromHtml(html));
  if (!name) return null;

  await updateRecord(INTERNAL.pages, ctx.page.id, { name });
  ctx.page = { ...ctx.page, name };
  return name;
}

/** Como se llama la pantalla segun lo escrito: su encabezado, o su titulo. */
function titleFromHtml(html: string): string {
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

/* ------------------------------------------------------------------ */
/* Los adjuntos, desde una orden                                        */
/* ------------------------------------------------------------------ */

/**
 * Lo que se le contesta cuando nombra un archivo que no es de esta
 * conversacion. Se dice y se falla, con los que si tiene delante: nombrar mal
 * se corrige en la vuelta siguiente, inventar el contenido no.
 */
function missingFile(ctx: ToolContext, wanted: string, tool: string): string {
  ctx.steps.push({ tool, summary: `No hay ningún archivo "${wanted}"`, ok: false });
  const names = ctx.files.map((f) => `"${f.file.label}"`).join(", ");
  return names
    ? `Error: no file called "${wanted}" is attached to this conversation. The ones that are: ${names}. Name it exactly as the context gave it to you.`
    : `Error: nothing is attached to this conversation, so there is no file to read. Ask them to attach it.`;
}

/** Un adjunto leido como filas y columnas, o por que no se pudo. */
async function parseAiFile(saved: {
  id: string;
  kind: string;
  content: string;
}): Promise<ParsedTable | string> {
  const record = saved as Parameters<typeof readAiFileChunk>[0];
  const text = (await readAiFileChunk(record, { from: 1, lines: Number.MAX_SAFE_INTEGER })).text;
  const parsed = parseImport(text, detectSeparator(text));
  if (!parsed.ok) return parsed.error;
  return parsed.data;
}

/** A que columna de la tabla va cada columna del archivo. */
interface FillPlan {
  /** Columna del archivo --por su posicion-- y columna de la tabla. */
  pairs: { index: number; column: string; field: FieldDef }[];
  /** Las columnas del archivo que no se emparejaron con ninguna. */
  unmapped: string[];
}

/**
 * Lee el emparejamiento que mando la IA y lo comprueba contra la tabla.
 *
 * Devuelve un texto cuando algo no cuadra, y ese texto es lo que la IA lee: lo
 * corrige en la vuelta siguiente, dentro de la misma peticion. Un rechazo para
 * el emparejamiento entero, no columna a columna: llenar la tabla a medias deja
 * filas que hay que buscar despues.
 */
function planFill(parsed: ParsedTable, table: TableRecord, raw: unknown): FillPlan | string {
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
 * Escribe las filas, en lotes.
 *
 * En lotes y no una a una porque son las mismas escrituras que hace la
 * importacion manual y el mismo tope las gobierna: el tramo es una transaccion,
 * asi que del que falle no entra ninguna fila. Las que no se pudieron convertir
 * se quedan fuera contadas, con lo que dijo la conversion.
 */
async function fillTable(
  ctx: ToolContext,
  table: TableRecord,
  parsed: ParsedTable,
  plan: FillPlan,
): Promise<{ written: number; before: number; reasons: string[] }> {
  const before = await listRecords<{ id: string }>(table.dataCollection, {
    perPage: 1,
    fields: "id",
  })
    .then((res) => res.totalItems)
    .catch(() => 0);

  /** Lo que dejo fuera cada fila, agrupado: una razon repetida se cuenta. */
  const counted = new Map<string, number>();
  const bodies: Record<string, unknown>[] = [];

  for (const row of parsed.rows) {
    const values: Record<string, unknown> = {};
    let reason = "";
    for (const pair of plan.pairs) {
      const cell = String(row[pair.index] ?? "");
      const converted = convertValue(pair.field, cell);
      if (!converted.ok) {
        reason = `${pair.column}: ${converted.error}`;
        break;
      }
      if (converted.value !== null) values[pair.field.name] = converted.value;
    }
    if (reason) {
      counted.set(reason, (counted.get(reason) ?? 0) + 1);
      continue;
    }
    bodies.push(values);
  }

  const url = `/api/collections/${table.dataCollection}/records`;
  let written = 0;
  for (let i = 0; i < bodies.length; i += IMPORT_BATCH_CHUNK) {
    const chunk = bodies.slice(i, i + IMPORT_BATCH_CHUNK);
    const res = await pb<Record<string, { status: number }>>("/api/batch", {
      method: "POST",
      body: JSON.stringify({
        requests: chunk.map((body) => ({ method: "POST", url, body })),
      }),
    }).catch(() => null);

    if (!res) {
      counted.set(
        "la base rechazó el lote",
        (counted.get("la base rechazó el lote") ?? 0) + chunk.length,
      );
      continue;
    }
    for (const result of Object.values(res)) {
      if (result.status < 400) written++;
      else counted.set("la base la rechazó", (counted.get("la base la rechazó") ?? 0) + 1);
    }
  }

  if (written > 0) ctx.changed = true;

  const reasons = [...counted.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${n} ${n === 1 ? "fila" : "filas"} — ${reason}`);
  return { written, before, reasons };
}

/** Apunta un cambio con riesgo en vez de hacerlo. */
function hold(ctx: ToolContext, change: StructureChange, name: string): string {
  const already = ctx.pending.some(
    (c) => c.kind === change.kind && c.tableId === change.tableId && c.field === change.field,
  );
  if (!already) ctx.pending.push(change);
  ctx.steps.push({ tool: name, summary: `${change.what}: falta autorizacion`, ok: true });
  return `Filed, but not done yet: "${change.what}" has to be authorised by the builder. Carry on with what you can do on the page and say so at the end.`;
}

/**
 * Ejecuta una orden de la IA y devuelve lo que la IA lee a continuacion.
 *
 * Se exporta para poder comprobar las ordenes sin el modelo delante: lo que
 * hay que probar es que crear una tabla con una relacion funciona y que un
 * rechazo dice el paso que falta, no que el modelo acierte a pedirlo.
 */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const note = (summary: string, ok = true) => ctx.steps.push({ tool: name, summary, ok });

  switch (name) {
    /*
     * La unica orden que no toca nada: manda la pagina a dibujarse y trae lo
     * que la consola solto. El HTML es el de ahora, ya guardado, asi que lo que
     * se prueba es exactamente lo que quedo escrito.
     */
    /*
     * La friccion es asimetrica y la decide la direccion, no el tamano del
     * cambio: quitar se aplica aqui mismo, dar se apunta con su consecuencia
     * delante. Ver `accessRisky` en `dataImpact.ts`.
     */
    case "cambiar_acceso": {
      const wanted = String(input.persona ?? "")
        .trim()
        .toLowerCase();
      const person =
        ctx.people.find((p) => p.email.toLowerCase() === wanted) ??
        ctx.people.find((p) => p.name.toLowerCase() === wanted) ??
        ctx.people.find((p) => p.id === String(input.persona ?? "").trim());
      if (!person) {
        note("Persona no encontrada", false);
        return `Error: nobody invited to this app answers to "${String(input.persona ?? "")}". You can only change the access of somebody already on the invited list; inviting is not yours to do.`;
      }

      const named = Array.isArray(input.roles)
        ? [...new Set(input.roles.map(String).map((r) => normalizeRole(r)))].filter(Boolean)
        : undefined;
      const roles = named?.filter((r) => (ctx.app.roles ?? []).includes(r));
      // Nombrar roles y que no quede ninguno no es "quitarselos todos": es que
      // esos roles no existen. Guardarlo asi le borraria en silencio los que si
      // tiene, que es lo contrario de lo que se pidio.
      if (named?.length && !roles?.length) {
        note("Roles que la aplicación no define", false);
        return `Error: this app does not define ${named.map((r) => `"${r}"`).join(", ")}. The roles it does define are the ones the context named; creating a role is not yours to do.`;
      }
      if (!roles) {
        note("Cambio de acceso sin contenido", false);
        return "Error: say which roles they end up with. Roles arrive as the whole list, not as what is added.";
      }

      const consequence = String(input.consecuencia ?? "").trim();
      if (!consequence) {
        note("Cambio de acceso sin consecuencia", false);
        return "Error: a change of access needs its sentence in 'consecuencia', naming the person and the real data. Without it the builder is authorising something nobody explained.";
      }

      const direction = accessDirection(person, roles);
      const change: AccessChange = {
        personId: person.id,
        personName: person.name || person.email,
        personEmail: person.email,
        direction,
        roles,
        consequence,
      };

      if (accessRisky(direction)) {
        // Ya apuntado: dos veces la misma persona en un turno es la IA
        // repitiendose, no dos decisiones.
        if (!ctx.grants.some((g) => g.personId === change.personId)) ctx.grants.push(change);
        note(`Dar acceso a ${change.personName}: falta autorización`);
        return "Filed, not done: giving access is authorised by the builder, reading the sentence you wrote. Carry on with what you can do on the page and say so at the end.";
      }

      await ctx.step();
      await setPersonAccess({
        appId: ctx.app.id,
        memberId: person.id,
        roles,
        appRoles: ctx.app.roles ?? [],
      });
      ctx.people = await peopleOf(ctx.app.id);
      ctx.notices.push(consequence);
      note(`Acceso de ${change.personName} reducido`);
      return "Done. Taking access away is applied straight away; there is a point to come back to if it turns out they needed it.";
    }

    /*
     * Quien abre la pagina. Es lo unico que de verdad deja datos fuera de un
     * navegador: esconder por rol dentro del HTML es presentacion. Por eso se
     * aplica directo y se obliga a decir a quien deja fuera.
     */
    case "cambiar_roles_pagina": {
      const named = Array.isArray(input.roles)
        ? [...new Set(input.roles.map((r) => normalizeRole(r)))].filter(Boolean)
        : null;
      if (!named) {
        note("Roles de la página sin lista", false);
        return "Error: 'roles' arrives as the whole list the page ends up with. An empty list opens it to everybody; it is not a way of saying 'leave it as it is'.";
      }

      const roles = named.filter((r) => (ctx.app.roles ?? []).includes(r));
      // Nombrar roles y que no quede ninguno no es "abrirla a todos": es que
      // esos roles no existen. Guardarlo asi abriria la pagina a cualquiera,
      // que es lo contrario de lo que se pidio.
      if (named.length && !roles.length) {
        note("Roles que la aplicación no define", false);
        return `Error: this app does not define ${named.map((r) => `"${r}"`).join(", ")}. The roles it does define are the ones the context named; creating a role is not yours to do.`;
      }

      const before = ctx.page.roles ?? [];
      const same = before.length === roles.length && before.every((r) => roles.includes(r));
      if (same) {
        note("Quién abre la página: sin cambios");
        return "Nothing to do: the page already opens to exactly those.";
      }

      await ctx.step();
      await updateRecord(INTERNAL.pages, ctx.page.id, { roles });
      ctx.page = { ...ctx.page, roles };
      ctx.changed = true;
      note(roles.length ? `Página limitada a ${roles.join(", ")}` : "Página abierta a todos");
      return roles.length
        ? `Done: only ${roles.join(", ")} can open this page now. Say who stopped being able to open it, and that this --and not hiding things in the HTML-- is what keeps the data out of their browser.`
        : "Done: anybody who reaches the app can open this page now. Say it plainly: the data of its declared tables reaches the browser of whoever holds the link.";
    }

    /*
     * La unica orden que cierra el turno. No escribe nada: deja la pregunta
     * apuntada y el bucle de rondas para al verla. La respuesta no vuelve por
     * aqui --llega como una peticion nueva, con la pregunta dentro-- porque
     * cada peticion abre una conversacion nueva con el modelo.
     */
    case "preguntar": {
      const question = String(input.pregunta ?? "").trim();
      const header = String(input.encabezado ?? "").trim();
      const options = (Array.isArray(input.opciones) ? input.opciones : [])
        .map((item) => {
          const o = item as Record<string, unknown>;
          const label = String(o.etiqueta ?? "").trim();
          if (!label) return null;
          const description = String(o.detalle ?? "").trim();
          return { label, ...(description ? { description } : {}) };
        })
        .filter((o) => o !== null)
        .slice(0, MAX_OPTIONS);
      if (!question || options.length < 2) {
        note("Pregunta sin opciones", false);
        return "Error: a question needs its text and at least two options that already exist in this app. If there is nothing to choose between, do not ask: build a first version and let them correct it.";
      }
      ctx.question = { question, header: header || "Elige", options };
      note(`Pregunta: ${question}`);
      return "The question is on its way. Your turn ends here: write nothing else and add no summary. Choosing an option arrives as a new request.";
    }

    case "revisar_errores": {
      const html = await currentHtml(ctx);
      if (!html.trim()) {
        return "Error: this page has no HTML to test yet.";
      }
      if (ctx.probes >= MAX_PROBES) {
        note("Revision agotada", false);
        return JSON.stringify({
          probado: false,
          razon: `It has already been checked ${MAX_PROBES} times in this request. Do not check again: finish and report what is still failing.`,
        });
      }
      ctx.probes++;
      ctx.reviewed = true;

      /*
       * El estilo se revisa siempre. No hace falta navegador --se lee del
       * codigo-- asi que llega tambien cuando no hay nadie mirando, que es
       * justo cuando el dibujado no se puede hacer.
       */
      const estilo = auditPageHtml(html);

      const report = await ctx.probe(html);
      if (!report) {
        note(estilo.length ? auditSummary(estilo) : "No se pudo probar la página", !estilo.length);
        return JSON.stringify({
          probado: false,
          razon:
            "There is no open view able to draw the page, so the console could not be read. This is not a failure of your HTML. The style review below did run.",
          estilo,
        });
      }

      const issues = tidyIssues(report.issues);
      note(
        [
          issues.length
            ? `Revision: ${issues.length} ${issues.length === 1 ? "error" : "errores"}`
            : "Revision: sin errores",
          auditSummary(estilo),
        ].join(" · "),
        issues.length === 0 && estilo.length === 0,
      );
      return JSON.stringify({
        probado: true,
        errores: issues,
        estilo,
        avisos: report.warnings.slice(0, 5),
        ...(issues.length || estilo.length
          ? {}
          : { nota: "The page drew clean and follows the system. Do not change anything else." }),
      });
    }

    case "ver_pagina": {
      const html = ctx.page.doc ? await readDoc(ctx.app.id, ctx.page.doc) : null;
      return JSON.stringify({
        nombre: ctx.page.name,
        html: html ?? "",
        vacia: !html,
        tablas: (ctx.page.sources ?? []).map((s) => s.name),
      });
    }

    case "escribir_pagina": {
      const html = String(input.html ?? "");
      if (!html.trim()) return "Error: no HTML arrived.";
      await ctx.step();

      const sources = sourcesFor(input.tablas, ctx.tables);
      const { doc, restored } = await writePageDoc({
        app: ctx.app,
        page: ctx.page,
        html,
        sources,
      });
      ctx.page = { ...ctx.page, doc, sources };
      ctx.changed = true;
      ctx.reviewed = false;

      /*
       * La revision de estilo va aqui y no solo en "revisar_errores": lo
       * escrito acaba de pasar por delante del modelo, asi que es el momento
       * mas barato de corregirlo. Esperar al final significa reescribir.
       */
      const estilo = auditPageHtml(html);
      note(`Página "${ctx.page.name}" escrita · ${auditSummary(estilo)}`, !estilo.length);

      // El nombre va despues de guardar: lo que se nombra es una pantalla que
      // ya existe, y si la escritura falla no se renombra nada.
      const named = await namePage(ctx, input.nombre, html);
      if (named) note(`Página nombrada "${named}"`);

      return JSON.stringify({
        guardado: true,
        tablas: sources.map((s) => s.name),
        repuesto: restored,
        estilo,
        ...(named ? { nombre: named } : {}),
      });
    }

    /*
     * El bisturi. Las cuatro comparten forma: leer el documento de ahora,
     * aplicar la operacion sobre el trozo y guardar el resultado entero.
     *
     * Si la referencia no resuelve, `htmlBlocks` lanza `BlockError` antes de
     * tocar nada: el documento se queda como estaba y la IA recibe el porque.
     */
    case "leer_bloque":
    case "reemplazar_bloque":
    case "insertar_bloque":
    case "quitar_bloque": {
      const doc = await currentHtml(ctx);
      if (!doc.trim()) {
        return "Error: this page has no HTML yet. Write it whole with 'escribir_pagina'.";
      }

      try {
        if (name === "leer_bloque") {
          return JSON.stringify({ html: readBlock(doc, input.bloque) });
        }

        if (name === "quitar_bloque") {
          const out = removeBlock(doc, input.bloque);
          await ctx.step();
          await saveEdit(ctx, out, ctx.page.sources ?? []);
          note(`Bloque "${String(input.bloque)}" quitado`);
          return JSON.stringify({ guardado: true });
        }

        const html = String(input.html ?? "");
        if (!html.trim()) return "Error: no HTML arrived for the block.";

        const done =
          name === "reemplazar_bloque"
            ? replaceBlock(doc, input.bloque, html, input.nombre)
            : insertBlock(
                doc,
                input.bloque,
                input.donde === "antes" ? "antes" : "despues",
                html,
                input.nombre,
              );

        await ctx.step();
        const sources = withSources(ctx, input.tablas);
        await saveEdit(ctx, done.doc, sources);

        note(
          name === "reemplazar_bloque"
            ? `Bloque "${done.name}" cambiado`
            : `Bloque "${done.name}" ${input.donde === "antes" ? "insertado antes" : "insertado después"} de "${String(input.bloque)}"`,
        );
        return JSON.stringify({
          guardado: true,
          bloque: done.name,
          tablas: sources.map((s) => s.name),
        });
      } catch (err) {
        if (err instanceof BlockError) {
          // El mensaje del error va en ingles, como todo lo que lee el modelo,
          // asi que el paso que ve quien construye se escribe aparte.
          note(`No se pudo editar el bloque "${String(input.bloque ?? "")}"`, false);
          return `Error: ${err.message}`;
        }
        throw err;
      }
    }

    /*
     * Leer un adjunto entero, por tramos. No cambia nada: es la unica forma de
     * contestar con una cifra en vez de con la muestra, que son unas pocas
     * filas de las que traiga.
     */
    case "leer_archivo": {
      const wanted = String(input.archivo ?? "");
      const found = findByName(
        ctx.files.map((f) => f.file),
        wanted,
      );
      if (!found) return missingFile(ctx, wanted, name);

      if (found.kind === "image") {
        note(`No se puede leer "${found.label}" como texto`, false);
        return `Error: "${found.label}" is an image. It is attached to the request itself: look at it there.`;
      }

      const saved = await findAiFile(ctx.app.id, found.ref);
      if (!saved) return missingFile(ctx, wanted, name);

      const chunk = await readAiFileChunk(saved, {
        from: Number(input.desde) || undefined,
        lines: Number(input.lineas) || undefined,
      });
      note(
        `Se leyó "${found.label}": ${chunk.lines === 1 ? "1 línea" : `${chunk.lines} líneas`} de ${chunk.total}`,
      );
      return JSON.stringify({
        archivo: found.label,
        desde: chunk.from,
        lineas: chunk.lines,
        total_lineas: chunk.total,
        hay_mas: chunk.more,
        contenido: chunk.text,
        ...(chunk.more
          ? { nota: `There is more. Ask again with "desde": ${chunk.from + chunk.lines}.` }
          : {}),
      });
    }

    /*
     * Llenar una tabla desde un adjunto. Lo que llega es el emparejamiento, no
     * los datos: el servidor lee el archivo guardado, convierte cada celda al
     * tipo de su columna y escribe las filas. Anade, nunca reemplaza.
     */
    case "llenar_tabla": {
      const table = findTable(ctx, input.tabla);
      if (!table) return "Error: that table does not exist.";

      const wanted = String(input.archivo ?? "");
      const found = findByName(
        ctx.files.map((f) => f.file),
        wanted,
      );
      if (!found) return missingFile(ctx, wanted, name);
      if (found.kind === "image") {
        note(`No se puede llenar "${table.label}" desde una imagen`, false);
        return `Error: "${found.label}" is an image: there are no rows and columns in it to bring in.`;
      }

      const saved = await findAiFile(ctx.app.id, found.ref);
      if (!saved) return missingFile(ctx, wanted, name);

      const parsed = await parseAiFile(saved);
      if (typeof parsed === "string") {
        note(`No se pudo leer "${found.label}" como filas y columnas`, false);
        return `Error: ${parsed}`;
      }

      const plan = planFill(parsed, table, input.columnas);
      if (typeof plan === "string") {
        note(`Emparejamiento inválido para "${table.label}"`, false);
        return `Error: ${plan}`;
      }

      if (parsed.rows.length === 0) {
        note(`"${found.label}" no trae filas`, false);
        return `Error: "${found.label}" has a header but no rows under it. Nothing was written.`;
      }

      // Un archivo mas grande que el tope no se escribe a medias: media tabla
      // dentro es peor que ninguna, porque no se ve cual falta.
      if (parsed.rows.length > MAX_IMPORT_ROWS) {
        note(`"${found.label}" trae ${parsed.rows.length} filas: más del tope`, false);
        return `Error: "${found.label}" carries ${parsed.rows.length} rows and a single import takes at most ${MAX_IMPORT_ROWS}. Nothing was written. Say this in your answer: the file has to be split before it can be brought in.`;
      }

      await ctx.step();
      const done = await fillTable(ctx, table, parsed, plan);

      // Una tabla que ya tenia filas se avisa: lo que se anade convive con lo
      // que habia, y quien construye tiene que enterarse sin preguntarlo.
      if (done.before > 0) {
        ctx.notices.push(
          `"${table.label}" ya tenía ${done.before} ${done.before === 1 ? "fila" : "filas"}; las ${done.written} del archivo se añadieron a ellas.`,
        );
      }

      const left = parsed.rows.length - done.written;
      note(
        `"${table.label}": ${done.written} ${done.written === 1 ? "fila" : "filas"} desde "${found.label}"` +
          (left > 0 ? ` · ${left} fuera` : ""),
        done.written > 0,
      );
      ctx.notices.push(
        `Se llenó "${table.label}" con ${done.written} ${done.written === 1 ? "fila" : "filas"} de "${found.label}".`,
      );

      return JSON.stringify({
        tabla: table.name,
        archivo: found.label,
        filas_leidas: parsed.rows.length,
        filas_escritas: done.written,
        filas_fuera: left,
        motivos: done.reasons,
        columnas_sin_emparejar: plan.unmapped,
        filas_que_ya_tenia: done.before,
        nota: "Rows were added; nothing that was already in the table was replaced. Say these figures in your summary, as they came back.",
      });
    }

    case "consultar_datos": {
      const table = findTable(ctx, input.tabla);
      if (!table) return "Error: that table does not exist.";
      const limit = Math.min(Math.max(Number(input.limite) || 10, 1), MAX_QUERY_ROWS);
      const res = await listRecords<Record<string, unknown>>(table.dataCollection, {
        perPage: limit,
        sort: "created,id",
      });
      const columns = (table.fields ?? []).map((f) => f.name);
      note(`Consulta a "${table.label}"`);
      const shown = res.items.length;
      return JSON.stringify({
        tabla: table.name,
        // Cuantas filas tiene la tabla, y cuantas de ellas van aqui. Las dos,
        // separadas y dichas: contar las de la muestra era lo que hacia que
        // una tabla de cientos de filas se contara por decenas.
        total: res.totalItems,
        filas_en_esta_muestra: shown,
        muestra: shown < res.totalItems,
        filas: res.items.map((row) =>
          Object.fromEntries([["id", row.id], ...columns.map((c) => [c, row[c]])]),
        ),
        ...(shown < res.totalItems
          ? {
              nota: `"total" is how many rows the table has. The ${shown} below are a sample. Never report a count taken from them.`,
            }
          : {}),
      });
    }

    case "crear_tabla": {
      const label = String(input.label ?? "").trim() || "Tabla";
      const fields = normalizeFieldDefs(input.fields, ctx.tables);
      // Un rechazo no deja aviso: no se aplico nada, y la IA lo corrige en la
      // vuelta siguiente. Ver `design.md` D7.
      if (typeof fields === "string") return fields;
      if (!fields.length) {
        note(`No se pudo crear "${label}": faltan columnas`, false);
        return "Error: the table needs at least one column.";
      }
      await ctx.step();

      // Unico dentro de la aplicacion: el nombre es con lo que la IA y el HTML
      // de una pagina nombran la tabla, y dos con el mismo dejan la segunda
      // inalcanzable. Ver `uniqueTableName`.
      const tableName = await uniqueTableName(ctx.app.id, label);
      const collection = dataCollectionName(ctx.app.slug, `${tableName}_${uid()}`);
      const created = await createDataCollection({
        dataCollection: collection,
        appId: ctx.app.id,
        fields,
      });
      const table = await createRecord<TableRecord>(INTERNAL.tables, {
        app: ctx.app.id,
        name: tableName,
        label,
        dataCollection: collection,
        order: ctx.tables.length,
        fields: created.fields,
        meta: { columnOrder: created.fields.map((f) => f.name), hidden: [], widths: {} },
      });
      ctx.tables.push(table);

      note(`Tabla "${label}" con ${created.fields.length} columnas`);
      ctx.notices.push(`Se creó la tabla "${label}" con ${created.fields.length} columnas.`);
      return JSON.stringify({
        nombre: table.name,
        columnas: created.fields.map((f) => f.name),
      });
    }

    case "agregar_columnas": {
      const table = findTable(ctx, input.tabla);
      if (!table) return "Error: that table does not exist.";
      const added = normalizeFieldDefs(input.fields, ctx.tables);
      if (typeof added === "string") return added;
      if (!added.length) return "Error: no column arrived.";
      await ctx.step();

      // Ninguna regla nombra una columna que acaba de nacer, asi que no hace
      // falta soltarlas antes: esto no puede romper nada.
      const { fields } = await updateDataCollection({
        dataCollection: table.dataCollection,
        fields: [...(table.fields ?? []), ...added],
      });
      const saved = await updateRecord<TableRecord>(INTERNAL.tables, table.id, { fields });
      Object.assign(table, saved);

      const names = added.map((f) => f.label).join(", ");
      note(`Columnas nuevas en "${table.label}": ${names}`);
      ctx.notices.push(
        `Se anadio a "${table.label}" ${added.length === 1 ? "la columna" : "las columnas"} ${names}.`,
      );
      return JSON.stringify({ columnas: fields.map((f) => f.name) });
    }

    case "renombrar_columna": {
      const table = findTable(ctx, input.tabla);
      if (!table) return "Error: that table does not exist.";
      const current = (table.fields ?? []).find((f) => f.name === String(input.columna ?? ""));
      if (!current) return "Error: that column does not exist.";
      const label = String(input.etiqueta ?? "").trim();
      if (!label) return "Error: the new name is missing.";
      await ctx.step();

      // Solo cambia la etiqueta: el nombre tecnico y el id se quedan, asi que
      // ni los datos ni las paginas que la declaran se enteran.
      const fields = (table.fields ?? []).map((f) =>
        f.name === current.name ? { ...f, label } : f,
      );
      const saved = await updateRecord<TableRecord>(INTERNAL.tables, table.id, { fields });
      Object.assign(table, saved);

      note(`"${current.label}" ahora se llama "${label}"`);
      return JSON.stringify({ etiqueta: label });
    }

    case "borrar_columna":
    case "cambiar_tipo_columna": {
      const table = findTable(ctx, input.tabla);
      if (!table) return "Error: that table does not exist.";
      const field = (table.fields ?? []).find((f) => f.name === String(input.columna ?? ""));
      if (!field) return "Error: that column does not exist.";
      if (field.system !== undefined) {
        return "Error: that column holds the app's access (the account or the roles) and cannot be removed or retyped.";
      }
      if (name === "borrar_columna" && isPeopleNameField(table, field)) {
        return "Error: that column holds each person's name for the whole app and cannot be removed. It can be renamed or hidden.";
      }
      if (name === "cambiar_tipo_columna" && !isFieldType(input.tipo)) {
        return "Error: that column type does not exist.";
      }
      // El listado de tipos de esta orden ya deja fuera la relacion. Esto es
      // lo que de verdad cierra el camino: sin el, un tipo que llegue igual
      // archivaria una peticion sin destino que revienta al aplicarse.
      if (name === "cambiar_tipo_columna" && input.tipo === "relation") {
        return "Error: a column that already exists is not turned into a relation from here. The builder does it from the panel, which keeps the values already stored.";
      }

      const change: StructureChange = {
        kind: name === "borrar_columna" ? "borrar_columna" : "cambiar_tipo",
        tableId: table.id,
        tableLabel: table.label,
        field: field.name,
        fieldLabel: field.label,
        fieldId: field.id,
        ...(name === "cambiar_tipo_columna" ? { newType: String(input.tipo) as FieldType } : {}),
        what: "",
      };
      return hold(ctx, { ...change, what: describeChange(change) }, name);
    }

    case "borrar_tabla": {
      const table = findTable(ctx, input.tabla);
      if (!table) return "Error: that table does not exist.";
      if (isPeopleTable(table)) {
        return "Error: the people table holds who can sign in to this app and cannot be deleted.";
      }
      const change: StructureChange = {
        kind: "borrar_tabla",
        tableId: table.id,
        tableLabel: table.label,
        what: "",
      };
      return hold(ctx, { ...change, what: describeChange(change) }, name);
    }

    default:
      return `Error: there is no command called "${name}".`;
  }
}

/* ------------------------------------------------------------------ */
/* Los turnos anteriores                                                */
/* ------------------------------------------------------------------ */

/** Cuantos turnos anteriores se le ponen delante al modelo. */
const MAX_HISTORY_TURNS = 10;

/** Y cuanto pueden ocupar entre todos, en caracteres. */
const MAX_HISTORY_CHARS = 40_000;

/** Lo que se conserva de un mensaje suelto de esos turnos. */
const MAX_HISTORY_MESSAGE = 6_000;

/**
 * Los turnos anteriores de la conversacion, listos para mandarlos.
 *
 * Por cada turno, dos mensajes: lo que escribio quien construye y el texto con
 * el que la IA cerro. Ni el razonamiento ni las llamadas a herramientas: el
 * razonamiento de un turno cerrado no aporta al siguiente, hay servidores que
 * lo rechazan al reenviarlo, y las herramientas ya dejaron su efecto en la
 * aplicacion, que la IA vuelve a leer en el contexto de cada peticion.
 *
 * Al pasarse del tope se deja fuera lo mas antiguo, nunca lo mas reciente: lo
 * que se acaba de decir es lo que explica lo que se esta pidiendo ahora.
 */
export function priorTurns(history: AiMessage[]): { role: "user" | "assistant"; text: string }[] {
  const turns: { role: "user" | "assistant"; text: string }[] = [];
  for (const message of history) {
    const text = String(message.text ?? "")
      .trim()
      .slice(0, MAX_HISTORY_MESSAGE);
    if (!text) continue;
    turns.push({ role: message.from === "yo" ? "user" : "assistant", text });
  }

  // Se cuentan turnos --peticion y respuesta-- y no mensajes sueltos.
  let kept = turns.slice(-MAX_HISTORY_TURNS * 2);
  let size = kept.reduce((sum, t) => sum + t.text.length, 0);
  while (kept.length && size > MAX_HISTORY_CHARS) {
    size -= kept[0].text.length;
    kept = kept.slice(1);
  }

  /*
   * El primero tiene que ser de quien pide: los dos formatos de proveedor
   * esperan que la conversacion empiece por ahi, y recortar por tamano puede
   * dejar arriba una respuesta suelta.
   */
  while (kept.length && kept[0].role !== "user") kept = kept.slice(1);
  return kept;
}

/* ------------------------------------------------------------------ */
/* Una peticion                                                         */
/* ------------------------------------------------------------------ */

/**
 * Deja un punto al que volver antes de que la IA toque nada, con el texto que
 * lo pidio como nombre. Es lo que hace que una peticion entera se pueda
 * deshacer de una sola vez, por mucho que la IA haya hecho dentro.
 */
function stepBefore(app: AppRecord, label: string, authorId: string): () => Promise<void> {
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    const [pages, tables] = await Promise.all([appPages(app.id), appTables(app.id)]);
    await saveVersion({
      app,
      pages,
      tables,
      kind: "manual",
      label: `Antes de: ${label}`,
      authorId,
    })
      // Una peticion tras otra deja un punto cada vez: el historial se recorta
      // aqui mismo para que no crezca sin fin. Los documentos no se recortan:
      // el que la IA esta a punto de escribir todavia no lo nombra nadie.
      .then(() => pruneVersions(app.id, app.liveVersion ?? ""))
      .catch(() => null);
  };
}

/**
 * Lo que el registro de depuracion necesita y solo se sabe por dentro: el
 * contexto de la ultima ronda, con que modelo se atendio y lo que penso.
 */
interface Traced {
  context: string;
  model: string;
  reasoning: string;
}

/**
 * Una peticion sobre una pagina, dejando constancia de lo que se mando.
 *
 * La constancia se escribe al cerrar el turno, termine bien o mal --el fallo
 * es el caso que justifica guardarla-- y despues de tener el resultado: un
 * fallo al guardarla no puede cambiar lo que recibe quien construye.
 */
export async function runPageRequest(
  opts: Parameters<typeof pageRequest>[0],
): Promise<Omit<AiPageResult, "chatId">> {
  const started = Date.now();
  const traced: Traced = { context: "", model: "", reasoning: "" };

  const record = (answer: string) =>
    void saveAiDebug({
      appId: opts.app.id,
      pageId: opts.page.id,
      prompt: opts.prompt,
      context: traced.context,
      reasoning: traced.reasoning,
      answer,
      model: traced.model,
      ms: Date.now() - started,
    });

  try {
    const result = await pageRequest(opts, traced);
    record(result.message);
    return result;
  } catch (err) {
    record(err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function pageRequest(
  opts: {
    app: AppRecord;
    page: PageRecord;
    prompt: string;
    authorId: string;
    /** Lo que se senalo con el cursor, si se senalo algo. */
    picked?: PickedBlock[];
    /** Los archivos que se adjuntaron a esta peticion, como referencias. */
    files?: AiChatFile[];
    /**
     * Los turnos anteriores de la conversacion, del mas viejo al mas nuevo.
     *
     * Dos cosas salen de aqui: los ultimos turnos que se le ponen delante al
     * modelo --hasta que "ahora ponle un buscador" sepa a que pantalla se
     * refiere-- y los adjuntos de esos turnos, que siguen estando mientras la
     * conversacion siga abierta.
     */
    history?: AiMessage[];
    /**
     * Con que atenderla: que modelo y cuanto se le pide pensar. Sin esto va con
     * lo que este puesto por defecto en los ajustes.
     */
    choice?: Partial<AiChoice>;
    /**
     * Se llama con cada cosa que la IA va produciendo. Es solo para mirar: el
     * resultado sigue siendo lo que devuelve esta funcion, una sola vez.
     */
    onProgress?: (event: AiProgress) => void;
    /**
     * Pararlo detiene la peticion por el primer sitio seguro: se corta lo que el
     * modelo este escribiendo y no se empieza otra ronda ni otra herramienta. Lo
     * que ya se habia aplicado se queda aplicado --deshacerlo a medias dejaria la
     * pagina peor-- y para eso esta el punto de vuelta atras de siempre.
     */
    signal?: AbortSignal;
    /**
     * Manda ademas, en cada ronda, todo lo que se le mando al modelo --sistema,
     * herramientas y mensajes--. Pesa, asi que solo viaja si se pidio: es para
     * quien construye quiere ver por que la IA respondio lo que respondio, no
     * para el uso de cada dia.
     */
    debug?: boolean;
  },
  traced: Traced,
): Promise<Omit<AiPageResult, "chatId">> {
  if (!(await aiEnabled())) throw new HttpError(400, AI_MISSING);

  const stopped = () => opts.signal?.aborted === true;

  const [tables, pages, people] = await Promise.all([
    appTables(opts.app.id),
    appPages(opts.app.id),
    // Quien esta invitado, para poder nombrarlo al contar la consecuencia de un
    // cambio de acceso. Es la aplicacion de quien pide y son sus propios
    // invitados: no abre ningun dato que no sea suyo.
    peopleOf(opts.app.id).catch(() => [] as AppPerson[]),
  ]);

  const ctx: ToolContext = {
    app: opts.app,
    page: opts.page,
    tables,
    pages,
    // Se llenan en cuanto se sepa que adjuntos tiene delante la conversacion:
    // leerlos del almacen es una ida a la base, y el contexto los necesita ya
    // nombrados.
    files: [],
    steps: [],
    notices: [],
    pending: [],
    people,
    grants: [],
    changed: false,
    step: stepBefore(opts.app, opts.prompt, opts.authorId),
    probes: 0,
    question: null,
    reviewed: false,
    /*
     * Probar es lo unico que necesita algo de vuelta, y de un sitio donde este
     * servidor no manda: el navegador de quien construye. Se guarda el
     * documento --por su huella, como cualquier otro-- y se manda solo esa
     * huella; el panel lo pide por el camino de siempre, con el puente puesto.
     *
     * El documento queda suelto, sin que ninguna pagina lo apunte, y `pruneDocs`
     * lo recoge mas adelante. La pagina no cambia por probarla.
     *
     * Si nadie contesta, la espera vence y se sigue sin resultado: una peticion
     * no puede quedarse colgada porque no haya nadie mirando.
     */
    probe: async (html) => {
      if (!opts.onProgress || stopped()) return null;
      const { hash } = await saveDoc(opts.app.id, html);
      const { probeId, wait } = openProbe();
      opts.onProgress({ tipo: "probar", probeId, hash });
      return wait;
    },
  };

  /*
   * Los adjuntos que la conversacion tiene delante: los de esta peticion y los
   * de los turnos anteriores, en el orden en que se adjuntaron. El nombre con
   * el que se ofrece cada uno se desempata aqui, una sola vez, para que sea el
   * mismo en el contexto y en las ordenes.
   */
  const earlier = (opts.history ?? []).flatMap((message) => message.files ?? []);
  const mine = opts.files ?? [];
  const named = nameAiFiles([...earlier, ...mine]);
  const shown: ShownFile[] = [];
  for (const file of named) {
    const saved = await findAiFile(opts.app.id, file.ref);
    // Un adjunto que ya no esta guardado no se nombra: ofrecerlo seria ofrecer
    // algo que despues falla al abrirlo.
    if (!saved) continue;
    shown.push({
      file,
      sample: await sampleAiFile(saved).catch(() => ({
        body: "",
        language: "",
        truncated: false,
        detail: "",
      })),
      earlier: !mine.some((f) => f.ref === file.ref),
    });
  }
  ctx.files = shown;

  /*
   * Las imagenes viajan en la peticion, no en el contexto: no se pueden contar
   * con palabras. Se leen del almacen --ya no llegan dentro de la peticion del
   * navegador-- y un modelo sin vista las suelta por su cuenta.
   */
  const images: { mime: string; data: string }[] = [];
  for (const item of shown) {
    if (item.file.kind !== "image" || item.earlier) continue;
    const saved = await findAiFile(opts.app.id, item.file.ref);
    if (!saved) continue;
    const data = await readAiFileBase64(saved).catch(() => "");
    if (data) images.push({ mime: saved.mime || "image/png", data });
  }

  const chat = await startConversation(
    systemPrompt(opts.app, opts.page, tables, opts.picked ?? [], shown, people),
    opts.prompt,
    TOOLS,
    {
      signal: opts.signal,
      choice: opts.choice,
      images,
      history: priorTurns(opts.history ?? []),
    },
  );

  let message = "";
  let reasoning = "";
  /*
   * Cuanto contexto lleva gastado.
   *
   * Se queda el ultimo turno, no la suma: cada turno le pone delante al modelo
   * la conversacion entera otra vez, asi que el ultimo ya cuenta todo lo que
   * hay. Sumarlos daria un numero que no significa nada.
   */
  let usage: AiUsage | undefined;

  /*
   * La revision de cierre.
   *
   * Falta cuando la peticion dejo la pagina escrita y lo escrito todavia no
   * paso por "revisar_errores" --porque el modelo no la pidio, o porque
   * corrigio despues de la ultima--. El tope de revisiones sigue mandando: si
   * ya se gastaron, no se fuerza ninguna mas.
   */
  const reviewPending = () =>
    ctx.changed && !ctx.reviewed && ctx.probes < MAX_PROBES && !ctx.question && !stopped();

  /**
   * Pide la revision en nombre del modelo y deja su paso a la vista.
   * Devuelve lo que hay que contarle, o `null` si no hubo nada que corregir.
   */
  const forceReview = async (): Promise<string | null> => {
    const before = ctx.steps.length;
    const output = await runTool("revisar_errores", {}, ctx).catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : "fallo desconocido";
      ctx.steps.push({ tool: "revisar_errores", summary: detail, ok: false });
      return "";
    });
    const added = ctx.steps.slice(before);
    for (const paso of added) opts.onProgress?.({ tipo: "paso", paso });
    // El paso ya dice si salio limpia: sin nada que corregir no hace falta
    // devolverle nada al modelo ni gastar otra ronda en ello.
    if (!output || added.every((paso) => paso.ok)) return null;
    return `The page was reviewed for you before closing, because you did not ask for it. This came back:\n\n${output}\n\nFix only what those failures say and check again. If it cannot be fixed, say so in your answer.`;
  };

  /*
   * Lo que se le mando al modelo en la ultima ronda.
   *
   * Se arma siempre, no solo en modo debug: es lo que hace falta para entender
   * un fallo que no se puede reproducir, y si hubiera que encenderlo antes
   * llegaria tarde. Al panel solo viaja si se pidio, que es lo que pesa.
   */
  traced.model = chat.with.model.id;

  for (let round = 0; round < MAX_ROUNDS && !stopped(); round++) {
    traced.context = JSON.stringify(chat.dump(), null, 2);
    if (opts.debug) opts.onProgress?.({ tipo: "contexto", texto: traced.context });
    const turn = await chat
      .ask((ev) => {
        // Lo que el modelo va soltando se reenvia tal cual: el texto mientras
        // escribe y las ideas mientras piensa. El resultado del turno llega
        // despues, en la respuesta.
        opts.onProgress?.(ev);
      })
      .catch((err: unknown) => {
        // Al detener, el proveedor falla porque se le corto: eso no es un error
        // que contar, es lo que se pidio.
        if (stopped()) return null;
        throw err;
      });
    if (!turn) break;
    /*
     * Lo que el turno costo de mas. Va al mismo sitio que el resto de avisos
     * --ya esta hecho, solo hay que enterarse-- y no se repite: lo que se
     * cedio se cedio en la conversacion, no en la ronda.
     */
    if (turn.notice && !ctx.notices.includes(turn.notice)) ctx.notices.push(turn.notice);
    if (turn.usage) {
      usage = {
        input: turn.usage.input,
        output: turn.usage.output,
        window: chat.with.model.contextWindow,
        model: chat.with.model.id,
      };
      opts.onProgress?.({ tipo: "uso", uso: usage });
    }
    if (turn.reasoning) {
      // Se conserva el del ultimo turno: es el que explica la respuesta final.
      reasoning = turn.reasoning;
      traced.reasoning = turn.reasoning;
      opts.onProgress?.({ tipo: "razonamiento", texto: turn.reasoning });
    }
    if (turn.text) {
      message = turn.text;
      opts.onProgress?.({ tipo: "texto", texto: turn.text });
    }
    if (!turn.calls.length) {
      // El modelo da por terminado. Si dejo la pagina escrita sin revisarla,
      // se revisa aqui y lo que salga vuelve a el: no cierra sin pasar por
      // ahi, lo pida o no.
      if (!reviewPending()) break;
      const back = await forceReview();
      if (!back) break;
      chat.say(back);
      continue;
    }

    const results = [];
    for (const call of turn.calls) {
      // Se para entre herramienta y herramienta, nunca dentro de una: cortar a
      // media escritura dejaria el documento a medias.
      if (stopped()) break;
      // Se cuenta cuantos pasos habia para poder mandar solo los nuevos: una
      // herramienta puede dejar mas de uno, o ninguno.
      const before = ctx.steps.length;
      const output = await runTool(call.name, call.input, ctx).catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : "fallo desconocido";
        ctx.steps.push({ tool: call.name, summary: detail, ok: false });
        return `Error: ${detail}`;
      });
      for (const paso of ctx.steps.slice(before)) opts.onProgress?.({ tipo: "paso", paso });
      results.push({ id: call.id, output });
    }
    // Preguntar cierra el turno: no se abre otra ronda, asi que lo que el
    // modelo llevara escrito se queda como esta y la pregunta sale al panel.
    if (ctx.question) break;
    chat.reply(results);
  }

  // Si las rondas se acabaron antes de que el modelo cerrara, la revision se
  // hace igual: no queda ronda para devolversela, pero el estilo queda mirado y
  // el paso, a la vista de quien construye.
  if (reviewPending()) await forceReview();

  // Todos los cambios con riesgo de la peticion viajan juntos: una sola
  // pregunta, una sola decision. Si se detuvo no se pregunta nada: quien para
  // una peticion no quiere que le abran un dialogo para seguirla.
  // La pregunta se cuenta antes del `fin` para que el panel la tenga sin
  // esperar al resultado. Al detener no se pregunta nada: quien para una
  // peticion no quiere que le abran una eleccion para seguirla.
  const question = stopped() ? null : ctx.question;
  if (question) opts.onProgress?.({ tipo: "pregunta", pregunta: question });

  // Lo mismo que con el impacto: quien para una peticion no quiere que le
  // abran una autorizacion para seguirla.
  const grants = stopped() ? [] : ctx.grants;

  let impact: DataImpact | null = null;
  if (ctx.pending.length && !stopped()) {
    // Las paginas de ahora: la IA pudo declarar tablas nuevas en la suya.
    const after = await appPages(opts.app.id);
    const affected = pagesForChanges(after, ctx.pending);
    impact = {
      request: opts.prompt,
      changes: ctx.pending,
      pages: affected,
      options: impactOptions(ctx.pending, affected),
    };
  }

  /*
   * Al detener se dice que se detuvo, y que pasa con lo que ya se habia hecho.
   * Lo escrito por la IA hasta ese momento se conserva delante: es lo unico que
   * explica por donde iba.
   */
  const halted = stopped();
  const ending = halted
    ? `Petición detenida.${ctx.changed ? " Lo que ya se había aplicado se queda como está." : ""}`
    : "";

  // Al preguntar, el texto de la pregunta es la respuesta: el modelo tiene
  // dicho que no escriba resumen, y la conversacion guardada tiene que leerse
  // igual de bien sin los botones delante.
  const closing = question ? question.question : "Listo.";

  return {
    message: [message, ending].filter(Boolean).join("\n\n") || closing,
    steps: ctx.steps,
    notices: ctx.notices,
    changed: ctx.changed,
    impact,
    access: grants,
    question,
    reasoning: reasoning || undefined,
    stopped: halted,
    ...(usage ? { usage } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Para el dialogo de impacto                                           */
/* ------------------------------------------------------------------ */

const USE_SYSTEM = `You explain what a screen uses a database column for.

You receive the screen's HTML and the column's name. Answer in two sentences at most, in correct Spanish with proper accents and ñ ("página", "añadir"), saying where it appears and what it is for there.

If the screen does not really use it, say so.`;

/** El detalle de "para que", consultado solo cuando quien construye lo pide. */
export async function explainPageUse(opts: {
  app: AppRecord;
  page: PageRecord;
  what: string;
}): Promise<string> {
  if (!(await aiEnabled())) throw new HttpError(400, AI_MISSING);
  const html = opts.page.doc ? await readDoc(opts.app.id, opts.page.doc) : null;
  if (!html) return `La página "${opts.page.name}" todavía no tiene HTML.`;

  return askAi(
    USE_SYSTEM,
    `Column: ${opts.what}\n\nScreen "${opts.page.name}":\n\n${html.slice(0, 60_000)}`,
    1000,
  );
}

const FIX_SYSTEM_TAIL = `## What to return

Return the complete corrected HTML document, with no explanation and no code fence. Change as little as possible: only what stopped existing in the database.`;

/**
 * La IA arregla una pagina distinta de la abierta. Solo se llega aqui desde el
 * dialogo de impacto: es la unica grieta del alcance de una pagina.
 */
export async function fixPage(opts: {
  app: AppRecord;
  page: PageRecord;
  tables: TableRecord[];
  changes: StructureChange[];
}): Promise<boolean> {
  const html = opts.page.doc ? await readDoc(opts.app.id, opts.page.doc) : null;
  if (!html) return false;

  const used = opts.tables.filter((t) => (opts.page.sources ?? []).some((s) => s.tableId === t.id));
  const system = [
    buildHtmlContract({
      appName: opts.app.name,
      tables: used,
      pageRoles: opts.page.roles,
      appRoles: opts.app.roles,
    }),
    FIX_SYSTEM_TAIL,
  ].join("\n\n---\n\n");

  const answer = await askAi(
    system,
    `The database changed:\n\n${opts.changes.map((c) => `- ${c.what}`).join("\n")}\n\n` +
      `Fix this screen so it keeps working with the tables as they now stand.\n\n${html}`,
    16_000,
  );

  const clean = unfence(answer);
  if (!/<html|<body|<div|<section/i.test(clean)) return false;

  // El manifiesto se rehace contra las tablas de ahora: lo que ya no existe
  // deja de estar declarado.
  await writePageDoc({
    app: opts.app,
    page: opts.page,
    html: clean,
    sources: sourcesFor(
      used.map((t) => t.name),
      opts.tables,
    ),
  });
  return true;
}

/** El modelo suele envolver la respuesta en un bloque de codigo. */
function unfence(text: string): string {
  const fenced = /^\s*```[\w-]*\s*\n([\s\S]*?)\n?```\s*$/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}
