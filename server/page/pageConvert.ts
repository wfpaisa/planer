/**
 * Conversion asistida de una pagina de bloques a una pagina de HTML.
 *
 * Las aplicaciones que se armaron con bloques no tienen equivalente
 * automatico: un bloque es configuracion y una pagina es un documento. Lo que
 * si se puede hacer es contarle a la IA que habia --que bloques, sobre que
 * tablas y con que columnas-- y pedirle el HTML que hace lo mismo.
 *
 * Aqui no se escribe nada. Se devuelve el HTML propuesto con las tablas que
 * declararia, para que quien construye lo revise antes de reemplazar la
 * pagina. Guardarlo es el mismo guardado de siempre.
 */
import { buildHtmlContract } from "../../shared/htmlContract.ts";
import type {
  AppRecord,
  FieldDef,
  HtmlSource,
  LegacyBlock,
  PageRecord,
  TableRecord,
} from "../../shared/types.ts";
import { AI_MISSING, aiEnabled, askAi } from "../ai/ai.ts";
import { HttpError } from "../auth.ts";
import { readDoc } from "../html/htmlDocs.ts";

/** Tope de HTML que se le pide a la IA para una pagina entera. */
const MAX_TOKENS = 16_000;

/** Los bloques que guarda una pagina, si es de las de antes. */
export function legacyBlocks(page: PageRecord): LegacyBlock[] {
  const raw = (page as { blocks?: unknown }).blocks;
  return Array.isArray(raw) ? (raw as LegacyBlock[]) : [];
}

/* ------------------------------------------------------------------ */
/* Las tablas que usaban los bloques                                    */
/* ------------------------------------------------------------------ */

/** Las columnas que nombra un orden, sin el signo que marca el sentido. */
const sortFields = (sort?: string): string[] =>
  (sort ?? "")
    .split(",")
    .map((part) => part.trim().replace(/^[-+]/, ""))
    .filter(Boolean);

/**
 * Las columnas que nombra un filtro. Es texto libre, asi que no se
 * interpreta: se buscan las que existen de verdad en la tabla. Una de mas no
 * hace dano --declararla solo la deja disponible-- y una de menos rompe la
 * pagina convertida.
 */
const filterFields = (filter: string | undefined, table: TableRecord): string[] =>
  filter ? (table.fields ?? []).map((f) => f.name).filter((name) => filter.includes(name)) : [];

/**
 * El manifiesto que le corresponde a una pagina de bloques: las tablas que
 * usaban sus bloques, con las columnas que nombraban.
 *
 * Un bloque que no nombra ninguna columna las usa todas --un listado sin
 * columnas elegidas muestra la tabla entera--, asi que en ese caso se declara
 * la tabla completa. Las columnas viajan por su id interno, como siempre: es
 * lo unico que sobrevive a un cambio de nombre.
 */
export function sourcesFromBlocks(blocks: LegacyBlock[], tables: TableRecord[]): HtmlSource[] {
  const byId = new Map(tables.map((t) => [t.id, t]));
  /** Tabla -> nombres de columna pedidos. Vacio: la tabla entera. */
  const wanted = new Map<string, Set<string> | null>();

  const want = (tableId: string | undefined, names: (string | undefined)[]) => {
    if (!tableId || !byId.has(tableId)) return;
    const current = wanted.get(tableId);
    if (current === null) return; // Ya se pidio entera.
    const clean = names.filter((n): n is string => !!n);
    if (!clean.length) {
      wanted.set(tableId, null);
      return;
    }
    const set = current ?? new Set<string>();
    for (const name of clean) set.add(name);
    wanted.set(tableId, set);
  };

  const out: HtmlSource[] = [];

  for (const block of blocks) {
    // Un bloque de HTML ya trae su propio manifiesto: se conserva tal cual.
    if (block.type === "html") {
      for (const source of block.sources ?? []) {
        if (source?.tableId && !out.some((s) => s.tableId === source.tableId)) out.push(source);
      }
      continue;
    }

    if (block.type === "stats") {
      for (const item of block.items ?? []) {
        const table = item.tableId ? byId.get(item.tableId) : undefined;
        if (!table) continue;
        want(item.tableId, [item.field, ...filterFields(item.filter, table)]);
      }
      continue;
    }

    const table = block.tableId ? byId.get(block.tableId) : undefined;
    if (!table) continue;

    want(block.tableId, [
      ...(block.fields ?? []),
      block.titleField,
      block.subtitleField,
      block.bodyField,
      block.imageField,
      block.badgeField,
      ...sortFields(block.sort),
      ...filterFields(block.filter, table),
    ]);
  }

  for (const [tableId, names] of wanted) {
    const table = byId.get(tableId);
    if (!table || out.some((s) => s.tableId === tableId)) continue;
    const fields: Record<string, string> = {};
    // Por columna definida y no por columna real: una relacion ocupa dos
    // columnas en la base --ella y su valor sin dueno-- pero se declara una
    // sola vez, y el puente entrega las dos piezas por ese unico nombre.
    for (const field of table.fields ?? []) {
      if (!field.id) continue;
      if (names === null || names.has(field.name)) fields[field.name] = field.id;
    }
    out.push({ name: table.name, tableId, fields });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Contar que habia                                                     */
/* ------------------------------------------------------------------ */

const label = (table: TableRecord | undefined, name?: string): string => {
  const field = (table?.fields ?? []).find((f: FieldDef) => f.name === name);
  return field ? `\`${field.name}\` (${field.label})` : `\`${name}\``;
};

const AGG_NAMES: Record<string, string> = {
  count: "row count",
  sum: "sum",
  avg: "average",
  min: "minimum",
  max: "maximum",
};

/** Cada bloque contado en ingles, para que la IA sepa que tiene que rehacer. */
function describeBlock(block: LegacyBlock, byId: Map<string, TableRecord>): string {
  const table = block.tableId ? byId.get(block.tableId) : undefined;
  const head = block.title?.trim() ? `titled "${block.title.trim()}"` : "untitled";
  const sub = block.subtitle?.trim() ? ` Standfirst: "${block.subtitle.trim()}".` : "";
  const source = table ? ` over the source \`${table.name}\` (${table.label})` : "";
  const columns = block.fields?.length
    ? ` Columns: ${block.fields.map((f) => label(table, f)).join(", ")}.`
    : table
      ? " Columns: every one in the table."
      : "";
  const order = block.sort ? ` Order: \`${block.sort}\`.` : "";
  const filter = block.filter ? ` Filter: \`${block.filter}\`.` : "";
  const search = block.search ? " It carries a search box." : "";
  const size = block.pageSize ? ` Rows per page: ${block.pageSize}.` : "";

  switch (block.type) {
    case "table":
      return `- **List** ${head}${source}.${columns}${order}${filter}${search}${size}${
        block.editable ? " Rows can be created, edited and deleted from the list." : ""
      }${sub}`;

    case "cards": {
      const roles = [
        block.titleField && `title: ${label(table, block.titleField)}`,
        block.subtitleField && `subtitle: ${label(table, block.subtitleField)}`,
        block.bodyField && `body: ${label(table, block.bodyField)}`,
        block.imageField && `image: ${label(table, block.imageField)}`,
        block.badgeField && `badge: ${label(table, block.badgeField)}`,
      ].filter(Boolean);
      return `- **Cards** ${head}${source}, in ${block.columns ?? 3} columns.${
        roles.length ? ` Each card uses ${roles.join(", ")}.` : ""
      }${order}${filter}${search}${size}${sub}`;
    }

    case "form":
      return `- **Form** ${head}${source} for creating rows.${columns}${
        block.submitLabel ? ` Button: "${block.submitLabel}".` : ""
      }${block.successMessage ? ` On save it says: "${block.successMessage}".` : ""}${sub}`;

    case "detail":
      return `- **Record** ${head}${source}: a single row with its data.${columns} The row id used to arrive in the \`${
        block.paramName || "id"
      }\` parameter of the address; now solve it inside the page itself, for instance by picking the row from a list.${sub}`;

    case "stats": {
      const items = (block.items ?? []).map((item) => {
        const its = item.tableId ? byId.get(item.tableId) : undefined;
        const what = AGG_NAMES[item.agg ?? "count"] ?? item.agg;
        const on = item.field ? ` of ${label(its, item.field)}` : "";
        return `"${item.label ?? "Indicador"}" = ${what}${on} in \`${its?.name ?? "?"}\`${
          item.filter ? ` filtered by \`${item.filter}\`` : ""
        }`;
      });
      return `- **Metrics** ${head}: ${items.join("; ") || "no metrics"}.${sub}`;
    }

    case "text":
      return `- **Text** ${head}, aligned ${
        block.align === "center" ? "centre" : "left"
      }, size ${block.size ?? "md"}:\n\n> ${(block.content ?? "").replace(/\n/g, "\n> ")}`;

    case "html":
      return `- **Hand-written HTML** ${head}. Its code travels separately, further down; keep it as it is inside the new page.${sub}`;

    default:
      return `- **${block.type}** ${head}.${sub}`;
  }
}

/** Los bloques que solo ven ciertos roles se cuentan aparte: eso hay que conservarlo. */
function rolesNote(blocks: LegacyBlock[]): string {
  const limited = blocks.filter((b) => b.roles?.length);
  if (!limited.length) return "";
  const lines = limited.map(
    (b) => `- The block "${b.title?.trim() || b.type}" was only seen by: ${b.roles?.join(", ")}.`,
  );
  return `\n\n## What only some people see\n\nCompare against \`plane.usuario.roles\` to keep it that way:\n\n${lines.join(
    "\n",
  )}`;
}

const CONVERT_TAIL = `## What you are doing

This page was put together out of configuration blocks and becomes an HTML document. Below you have the blocks it held, in order, with the tables and columns they used.

Redo them as a single page doing the same: the same data, the same actions and the same order from top to bottom. It does not have to end up identical --the blocks imposed a design of their own and now there is none-- but nothing that could be done may be missing.

## What to return

Only the complete HTML document, with no explanation and no code fence.`;

/* ------------------------------------------------------------------ */
/* La conversion                                                        */
/* ------------------------------------------------------------------ */

export interface PageConversion {
  html: string;
  sources: HtmlSource[];
  /** Lo que se convirtio, contado en una linea. */
  resumen: string;
}

/**
 * Le pide a la IA el HTML equivalente a los bloques de una pagina.
 * No guarda nada: quien construye revisa el resultado y decide.
 */
export async function convertPageToHtml(opts: {
  app: AppRecord;
  page: PageRecord;
  tables: TableRecord[];
}): Promise<PageConversion> {
  if (!(await aiEnabled())) throw new HttpError(400, AI_MISSING);

  const blocks = legacyBlocks(opts.page);
  if (!blocks.length) {
    throw new HttpError(400, "Esta página no tiene bloques que convertir");
  }

  const sources = sourcesFromBlocks(blocks, opts.tables);
  const used = opts.tables.filter((t) => sources.some((s) => s.tableId === t.id));
  const byId = new Map(opts.tables.map((t) => [t.id, t]));

  // Sin `audience`: esa regla ensena a leer para quien es la pantalla a partir
  // de las palabras de un pedido, y aqui no hay pedido escrito. Lo que entra es
  // la descripcion de unos bloques que ya existian, con el publico que traian
  // puesto en `rolesNote`; deducirlo otra vez de sus titulos seria inventarlo.
  const system = [
    buildHtmlContract({
      appName: opts.app.name,
      tables: used,
      pageRoles: opts.page.roles,
      appRoles: opts.app.roles,
    }),
    CONVERT_TAIL,
  ].join("\n\n---\n\n");

  // El codigo de los bloques de HTML viaja entero: es lo unico que ya estaba
  // escrito a mano y lo que menos sentido tiene volver a inventar.
  const written: string[] = [];
  for (const block of blocks) {
    if (block.type !== "html" || !block.doc) continue;
    const html = await readDoc(opts.app.id, block.doc);
    if (html) {
      written.push(
        `### Code of the block "${block.title?.trim() || block.id}"\n\n${html.slice(0, 60_000)}`,
      );
    }
  }

  const prompt = [
    `Page "${opts.page.name}"${opts.page.isHome ? ", which is the app's home screen" : ""}.`,
    `## The blocks it held\n\n${blocks.map((b) => describeBlock(b, byId)).join("\n")}`,
    rolesNote(blocks).trim(),
    ...written,
  ]
    .filter(Boolean)
    .join("\n\n");

  const answer = await askAi(system, prompt, MAX_TOKENS);
  const html = unfence(answer);
  if (!/<html|<body|<div|<section/i.test(html)) {
    throw new HttpError(502, "La IA no devolvio un documento HTML. Vuelve a intentarlo.");
  }

  return {
    html,
    sources,
    resumen: `${blocks.length} ${blocks.length === 1 ? "bloque convertido" : "bloques convertidos"}${
      used.length ? ` sobre ${used.map((t) => t.label).join(", ")}` : ""
    }.`,
  };
}

/** El modelo suele envolver la respuesta en un bloque de codigo. */
function unfence(text: string): string {
  const fenced = /^\s*```[\w-]*\s*\n([\s\S]*?)\n?```\s*$/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}
