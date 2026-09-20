/**
 * Ejecucion de las ordenes que la IA puede pedir sobre una pagina: el
 * despachador `runTool` y una funcion por herramienta con trabajo real.
 */
import { IMPORT_BATCH_CHUNK, MAX_IMPORT_ROWS } from "../../../shared/importBatch.ts";
import { detectSeparator, type ParsedTable, parseImport } from "../../../shared/importParse.ts";
import { convertValue } from "../../../shared/importValues.ts";
import {
  cleanPageIcon,
  cleanPageName,
  isDefaultPageIcon,
  isDefaultPageName,
} from "../../../shared/pages.ts";
import { isPeopleNameField, isPeopleTable, normalizeRole } from "../../../shared/people.ts";
import type {
  AccessChange,
  AiQuestion,
  FieldType,
  HtmlSource,
  StructureChange,
  TableRecord,
} from "../../../shared/types.ts";
import { isFieldType } from "../../../shared/types.ts";
import { peopleOf, setPersonAccess } from "../../access.ts";
import { INTERNAL } from "../../config.ts";
import { accessRisky, describeChange } from "../../dataImpact.ts";
import { auditPageHtml, auditSummary } from "../../html/htmlAudit.ts";
import {
  BlockError,
  insertBlock,
  readBlock,
  removeBlock,
  replaceBlock,
} from "../../html/htmlBlocks.ts";
import { readDoc } from "../../html/htmlDocs.ts";
import { tidyIssues } from "../../html/htmlProbe.ts";
import { createRecord, listRecords, pb, updateRecord } from "../../pb.ts";
import {
  createDataCollection,
  dataCollectionName,
  uniqueTableName,
  updateDataCollection,
} from "../../schema.ts";
import { findAiFile, findByName, readAiFileChunk } from "../aiFiles.ts";
import {
  findTable,
  missingFile,
  sourcesFor,
  titleFromHtml,
  type ToolContext,
  withSources,
} from "./context.ts";
import { accessDirection, type FillPlan, normalizeFieldDefs, planFill } from "./fields.ts";
import { writePageDoc } from "./index.ts";
import { MAX_QUERY_ROWS } from "./tools.ts";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Revisiones que se le consienten a una peticion. */
export const MAX_PROBES = 2;

/** Salidas que se pintan en una pregunta. Mas no se eligen de un vistazo. */
const MAX_OPTIONS = 4;

/** El HTML que tiene ahora mismo la pagina abierta. */
async function currentHtml(ctx: ToolContext): Promise<string> {
  if (!ctx.page.doc) return "";
  return (await readDoc(ctx.app.id, ctx.page.doc)) ?? "";
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
 * Le pone nombre e icono a una pagina que todavia se llama como nacio.
 *
 * Una pagina recien creada se llama "Pagina 3", lleva un archivo generico por
 * icono y esta en blanco: las dos cosas son relleno, no una decision, asi que
 * la primera vez que se escribe se cambian por unas que digan de que va la
 * pantalla. El que manda es lo que propuso la IA, que es quien leyo lo que se
 * pidio; si no mando nombre, se saca del titulo de lo que acaba de escribir,
 * que dice lo mismo. Un icono no se deduce de nada: si no lo mando, o mando uno
 * que la fuente no tiene, la pagina se queda con el suyo.
 *
 * Lo elegido a mano no se toca nunca, aunque la pagina se reescriba entera:
 * cambiarle a alguien lo que ya decidio es perderle algo suyo. Cada uno mira su
 * propio relleno, porque se pueden haber puesto por separado.
 */
async function namePage(
  ctx: ToolContext,
  input: Record<string, unknown>,
  html: string,
): Promise<{ name: string | null; icon: string | null }> {
  const name = isDefaultPageName(ctx.page.name)
    ? (cleanPageName(input.nombre) ?? cleanPageName(titleFromHtml(html)))
    : null;
  const icon = isDefaultPageIcon(ctx.page.icon) ? cleanPageIcon(input.icono) : null;
  if (!name && !icon) return { name: null, icon: null };

  const patch = { ...(name ? { name } : {}), ...(icon ? { icon } : {}) };
  await updateRecord(INTERNAL.pages, ctx.page.id, patch);
  ctx.page = { ...ctx.page, ...patch };
  return { name, icon };
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

/*
 * La friccion es asimetrica y la decide la direccion, no el tamano del
 * cambio: quitar se aplica aqui mismo, dar se apunta con su consecuencia
 * delante. Ver `accessRisky` en `dataImpact.ts`.
 */
async function runCambiarAcceso(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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
async function runCambiarRolesPagina(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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
function runPreguntar(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): string {
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
  ctx.question = { question, header: header || "Elige", options } as AiQuestion;
  note(`Pregunta: ${question}`);
  return "The question is on its way. Your turn ends here: write nothing else and add no summary. Choosing an option arrives as a new request.";
}

/*
 * Cierra el modo Plan. No construye nada -- las herramientas que lo harian
 * ni siquiera estan en la lista mientras el modo esta activo-- solo deja
 * apuntado el plan concretado, con el mismo patron que "preguntar".
 */
function runCerrarPlan(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): string {
  const texto = String(input.plan ?? "").trim();
  if (!texto) {
    note("Plan sin contenido", false);
    return 'Error: send the concreted plan\'s text in "plan".';
  }
  ctx.plan = { texto, implementado: false };
  note("Plan cerrado");
  return "The plan is on its way. Your turn ends here: write nothing else and add no summary.";
}

async function runRevisarErrores(
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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

async function runVerPagina(ctx: ToolContext): Promise<string> {
  const html = ctx.page.doc ? await readDoc(ctx.app.id, ctx.page.doc) : null;
  return JSON.stringify({
    nombre: ctx.page.name,
    html: html ?? "",
    vacia: !html,
    tablas: (ctx.page.sources ?? []).map((s) => s.name),
  });
}

async function runEscribirPagina(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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
  const named = await namePage(ctx, input, html);
  if (named.name) note(`Página nombrada "${named.name}"`);
  if (named.icon) note(`Icono de la página: ${named.icon}`);

  return JSON.stringify({
    guardado: true,
    tablas: sources.map((s) => s.name),
    repuesto: restored,
    estilo,
    ...(named.name ? { nombre: named.name } : {}),
    ...(named.icon ? { icono: named.icon } : {}),
  });
}

/*
 * El bisturi. Las cuatro comparten forma: leer el documento de ahora,
 * aplicar la operacion sobre el trozo y guardar el resultado entero.
 *
 * Si la referencia no resuelve, `htmlBlocks` lanza `BlockError` antes de
 * tocar nada: el documento se queda como estaba y la IA recibe el porque.
 */
async function runEditarBloque(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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
async function runLeerArchivo(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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
async function runLlenarTabla(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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

async function runConsultarDatos(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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

async function runCrearTabla(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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

async function runAgregarColumnas(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
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

async function runRenombrarColumna(
  input: Record<string, unknown>,
  ctx: ToolContext,
  note: (summary: string, ok?: boolean) => void,
): Promise<string> {
  const table = findTable(ctx, input.tabla);
  if (!table) return "Error: that table does not exist.";
  const current = (table.fields ?? []).find((f) => f.name === String(input.columna ?? ""));
  if (!current) return "Error: that column does not exist.";
  const label = String(input.etiqueta ?? "").trim();
  if (!label) return "Error: the new name is missing.";
  await ctx.step();

  // Solo cambia la etiqueta: el nombre tecnico y el id se quedan, asi que
  // ni los datos ni las paginas que la declaran se enteran.
  const fields = (table.fields ?? []).map((f) => (f.name === current.name ? { ...f, label } : f));
  const saved = await updateRecord<TableRecord>(INTERNAL.tables, table.id, { fields });
  Object.assign(table, saved);

  note(`"${current.label}" ahora se llama "${label}"`);
  return JSON.stringify({ etiqueta: label });
}

async function runCambiarColumna(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
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

async function runBorrarTabla(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
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
  return hold(ctx, { ...change, what: describeChange(change) }, "borrar_tabla");
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
    case "cambiar_acceso":
      return runCambiarAcceso(input, ctx, note);
    case "cambiar_roles_pagina":
      return runCambiarRolesPagina(input, ctx, note);
    case "preguntar":
      return runPreguntar(input, ctx, note);
    case "cerrar_plan":
      return runCerrarPlan(input, ctx, note);
    case "revisar_errores":
      return runRevisarErrores(ctx, note);
    case "ver_pagina":
      return runVerPagina(ctx);
    case "escribir_pagina":
      return runEscribirPagina(input, ctx, note);
    case "leer_bloque":
    case "reemplazar_bloque":
    case "insertar_bloque":
    case "quitar_bloque":
      return runEditarBloque(name, input, ctx, note);
    case "leer_archivo":
      return runLeerArchivo(name, input, ctx, note);
    case "llenar_tabla":
      return runLlenarTabla(name, input, ctx, note);
    case "consultar_datos":
      return runConsultarDatos(input, ctx, note);
    case "crear_tabla":
      return runCrearTabla(input, ctx, note);
    case "agregar_columnas":
      return runAgregarColumnas(input, ctx, note);
    case "renombrar_columna":
      return runRenombrarColumna(input, ctx, note);
    case "borrar_columna":
    case "cambiar_tipo_columna":
      return runCambiarColumna(name, input, ctx);
    case "borrar_tabla":
      return runBorrarTabla(input, ctx);
    default:
      return `Error: there is no command called "${name}".`;
  }
}
