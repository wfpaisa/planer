/**
 * El esquema de las herramientas que se le ofrecen a la IA para escribir una
 * pagina: que ordenes existen, que reciben, y cuales se le quitan en modo
 * Plan.
 */
import type { ToolDef } from "../ai.ts";
import { MAX_READ_LINES, READ_LINES } from "../aiFiles.ts";
import { FIELD_TYPES, RETYPE_TYPES } from "./fields.ts";

/** Tope de filas que devuelve una consulta de solo lectura. */
export const MAX_QUERY_ROWS = 20;

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
        icono: {
          type: "string",
          description:
            "The name of the icon the page is read with in the sidebar, taken from the safe list of icon names you were given (without the `hgi-` prefix): `user-group` for people, `invoice-01` for billing, `analytics-01` for a dashboard. It says what the screen holds, so never a generic file or page. A name outside the font is ignored. It is only taken while the page still carries the filler icon it was born with; once it has one of its own, this is ignored.",
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
      'Asks the person one question and ends your turn: after calling it you write nothing else, and choosing an option starts a new request. Two cases only. One: the answer is picking between things that already exist in this app --which table, which source-- and you cannot carry on without it. Two: what you were asked contradicts a rule saved in "The rules of this page" --then you quote the rule and ask whether it gets replaced, before touching anything. Never for open design questions --which columns, which layout--: build a first version and let them correct it.',
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

/**
 * Las herramientas que escriben la pagina o las tablas. En modo Plan no se le
 * ofrecen al modelo: es lo que de verdad le impide construir, no una
 * instruccion que pueda ignorar (D3 de `ia-modo-plan`).
 */
const PLAN_MODE_WRITE_TOOLS = new Set([
  "escribir_pagina",
  "reemplazar_bloque",
  "insertar_bloque",
  "quitar_bloque",
  "crear_tabla",
  "agregar_columnas",
  "renombrar_columna",
  "borrar_columna",
  "cambiar_tipo_columna",
  "borrar_tabla",
  "llenar_tabla",
  "cambiar_acceso",
  "cambiar_roles_pagina",
]);

/**
 * Cierra el modo Plan sin construir nada, con el mismo patron que "preguntar":
 * termina el turno y trae lo que hay que guardar. Solo se ofrece mientras el
 * modo esta activo.
 */
const CERRAR_PLAN_TOOL: ToolDef = {
  name: "cerrar_plan",
  description:
    'Closes plan mode and ends your turn: nothing gets built here. Use it once you have nothing left to ask about the idea. After calling it write nothing else: no summary, the same as "preguntar".',
  schema: {
    type: "object",
    properties: {
      plan: {
        type: "string",
        description:
          'The concreted plan, in Spanish markdown, for the app\'s owner (not the builder): short, plain words, no table/column/function names. Shape: a numbered list under "Se va a hacer:", then "### Esto cambia" and "### Esto mejora", each a short paragraph.',
      },
    },
    required: ["plan"],
  },
};

/** La lista de herramientas que de verdad se le ofrece al modelo esta ronda. */
export function toolsFor(planActive: boolean): ToolDef[] {
  if (!planActive) return TOOLS;
  return [...TOOLS.filter((tool) => !PLAN_MODE_WRITE_TOOLS.has(tool.name)), CERRAR_PLAN_TOOL];
}
