/**
 * La IA escribiendo el HTML de una página.
 *
 * Una petición toca una sola página: la que esta abierta. La IA no arma
 * configuración, escribe el documento entero, y recibe en cada petición el
 * contexto armado en ese momento --colores, medidas, tablas, quien esta
 * mirando y los limites-- para que nunca trabaje con una tabla que ya cambio.
 *
 * Los cambios de base de datos sin riesgo se aplican solos. Los que pueden
 * romper algo no se aplican aquí: se apuntan y vuelven al panel, que los
 * presenta todos juntos en el diálogo de impacto (ver `dataImpact.ts`).
 *
 * Este archivo es el orquestador: arma el contexto, abre la conversación con
 * el modelo y gobierna el bucle de rondas. Los prompts, el esquema de las
 * herramientas, el contexto que se les arma y su ejecucion viven en los demás
 * modulos de esta carpeta.
 */
import { buildHtmlContract } from "../../../shared/htmlContract.ts";
import type {
  AiChatFile,
  AiChoice,
  AiMessage,
  AiPageResult,
  AiPlanIntent,
  AiProgress,
  AiUsage,
  AppPerson,
  AppRecord,
  DataImpact,
  HtmlSource,
  PageRecord,
  PickedBlock,
  StructureChange,
  TableRecord,
} from "../../../shared/types.ts";
import { peopleOf } from "../../access.ts";
import { HttpError } from "../../auth.ts";
import { INTERNAL } from "../../config.ts";
import { impactOptions, pagesForChanges } from "../../dataImpact.ts";
import { quote } from "../../filter.ts";
import { pruneDocs, readDoc, saveDoc } from "../../html/htmlDocs.ts";
import { openProbe } from "../../html/htmlProbe.ts";
import { injectPageRefs, type PageRef } from "../../page/pageAssets.ts";
import { listRecords, updateRecord } from "../../pb.ts";
import { pruneVersions, saveVersion } from "../../versions.ts";
import { AI_MISSING, aiEnabled, askAi, startConversation } from "../ai.ts";
import { saveAiDebug } from "../aiDebug.ts";
import { findAiFile, nameAiFiles, readAiFileBase64, sampleAiFile } from "../aiFiles.ts";
import { ContextBudgetError } from "../contextBudget.ts";
import { type ShownFile, sourcesFor, type ToolContext } from "./context.ts";
import { runMemoryPass } from "./memory.ts";
import { FIX_SYSTEM_TAIL, systemPrompt, USE_SYSTEM } from "./prompts.ts";
import { MAX_PROBES, runTool } from "./toolRuntime.ts";
import { PLAN_MODE_WRITE_TOOLS, toolsFor } from "./tools.ts";

const MAX_ROUNDS = 12;

/* ------------------------------------------------------------------ */
/* Leer y escribir la página                                            */
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
 * Guarda el HTML de una página.
 *
 * Lo que llega pasa antes por la reposicion de las dos referencias, venga de
 * la IA o del editor de código: una página sin ellas se dibujaria sin estilos
 * y sin puente. El documento anterior puede quedarse sin duenos, así que se
 * recorta después.
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
 * Los turnos anteriores de la conversación, listos para mandarlos.
 *
 * Por cada turno, dos mensajes: lo que escribio quien construye y el texto con
 * el que la IA cerro. Ni el razonamiento ni las llamadas a herramientas: el
 * razonamiento de un turno cerrado no aporta al siguiente, hay servidores que
 * lo rechazan al reenviarlo, y las herramientas ya dejaron su efecto en la
 * aplicación, que la IA vuelve a leer en el contexto de cada petición.
 *
 * Al pasarse del tope se deja fuera lo mas antiguo, nunca lo mas reciente: lo
 * que se acaba de decir es lo que explica lo que se esta pidiendo ahora.
 */
export function priorTurns(history: AiMessage[]): { role: "user" | "assistant"; text: string }[] {
  const exchanges: { role: "user" | "assistant"; text: string }[][] = [];
  for (const message of history) {
    const text = String(message.text ?? "").trim();
    if (!text) continue;
    const kept =
      text.length > MAX_HISTORY_MESSAGE
        ? text.slice(0, MAX_HISTORY_MESSAGE) +
          "\n[Earlier message shortened. Do not assume missing details.]"
        : text;
    if (message.from === "yo") exchanges.push([{ role: "user", text: kept }]);
    else exchanges.at(-1)?.push({ role: "assistant", text: kept });
  }
  let groups = exchanges.slice(-MAX_HISTORY_TURNS);
  while (
    groups.length > 1 &&
    groups.flat().reduce((size, item) => size + item.text.length, 0) > MAX_HISTORY_CHARS
  )
    groups = groups.slice(1);
  const kept = groups.flat();
  return kept;
}

/**
 * La pregunta con la que la IA cerro el turno anterior, si lo cerro así.
 *
 * Es lo que le falta a la pasada para entender el turno que la contesta: "Si,
 * cambiarlo" suelto no dice de que. Solo cuenta la del ultimo mensaje de la
 * IA; mas atras la pregunta ya se resolvio y no es de este intercambio (D5).
 */
function lastQuestion(history: AiMessage[]): string | undefined {
  const last = [...history].reverse().find((message) => message.from === "ia");
  return last?.question?.question || undefined;
}

/* ------------------------------------------------------------------ */
/* Una petición                                                         */
/* ------------------------------------------------------------------ */

/**
 * Deja un punto al que volver antes de que la IA toque nada, con el texto que
 * lo pidio como nombre. Es lo que hace que una petición entera se pueda
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
 * Una petición sobre una página, dejando constancia de lo que se mando.
 *
 * La constancia se escribe al cerrar el turno, termine bien o mal --el fallo
 * es el caso que justifica guardarla-- y después de tener el resultado: un
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
    /** Los archivos que se adjuntaron a esta petición, como referencias. */
    files?: AiChatFile[];
    /**
     * Los turnos anteriores de la conversación, del mas viejo al mas nuevo.
     *
     * Dos cosas salen de aquí: los ultimos turnos que se le ponen delante al
     * modelo --hasta que "ahora ponle un buscador" sepa a que pantalla se
     * refiere-- y los adjuntos de esos turnos, que siguen estando mientras la
     * conversación siga abierta.
     */
    history?: AiMessage[];
    /**
     * Con que atenderla: que modelo y cuanto se le pide pensar. Sin esto va con
     * lo que este puesto por defecto en los ajustes.
     */
    choice?: Partial<AiChoice>;
    /**
     * Se llama con cada cosa que la IA va produciendo. Es solo para mirar: el
     * resultado sigue siendo lo que devuelve esta función, una sola vez.
     */
    onProgress?: (event: AiProgress) => void;
    /**
     * Pararlo detiene la petición por el primer sitio seguro: se corta lo que el
     * modelo este escribiendo y no se empieza otra ronda ni otra herramienta. Lo
     * que ya se había aplicado se queda aplicado --deshacerlo a medias dejaria la
     * página peor-- y para eso esta el punto de vuelta atras de siempre.
     */
    signal?: AbortSignal;
    /**
     * Manda ademas, en cada ronda, todo lo que se le mando al modelo --sistema,
     * herramientas y mensajes--. Pesa, así que solo viaja si se pidio: es para
     * quien construye quiere ver por que la IA respondio lo que respondio, no
     * para el uso de cada dia.
     */
    debug?: boolean;
    /** La intencion de modo Plan que mando el botón del composer. Ver `planModeFor`. */
    planIntent?: AiPlanIntent;
  },
  traced: Traced,
): Promise<Omit<AiPageResult, "chatId">> {
  if (!(await aiEnabled())) throw new HttpError(400, AI_MISSING);

  const stopped = () => opts.signal?.aborted === true;

  // Construir desde la conversación también necesita ejecutar y confirmar los cambios.
  if (opts.planIntent === "cortar") {
    opts = {
      ...opts,
      prompt:
        "Construye ahora la versión acordada para esta página según esta conversación. Comprueba lo que ya existe y conserva las reglas guardadas.",
      planIntent: "implementar",
    };
  }

  /*
   * El resto de la petición: el modo Plan gatea las herramientas de esta
   * ronda solo cuando el botón mando "activar" con ella. Un plan cerrado y
   * sin implementar que haya quedado en el hilo no lo bloquea: el composer
   * solo manda "activar" cuando el botón lo muestra apagado, y volver a
   * activarlo abre un plan distinto (D1 de `ia-modo-plan`).
   */
  const planActive = opts.planIntent === "activar";

  const [tables, pages, people] = await Promise.all([
    appTables(opts.app.id),
    appPages(opts.app.id),
    // Quien esta invitado, para poder nombrarlo al contar la consecuencia de un
    // cambio de acceso. Es la aplicación de quien pide y son sus propios
    // invitados: no abre ningún dato que no sea suyo.
    peopleOf(opts.app.id).catch(() => [] as AppPerson[]),
  ]);

  const ctx: ToolContext = {
    app: opts.app,
    page: opts.page,
    tables,
    pages,
    // Se llenan en cuanto se sepa que adjuntos tiene delante la conversación:
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
    plan: null,
    reviewed: false,
    /*
     * Probar es lo único que necesita algo de vuelta, y de un sitio donde este
     * servidor no manda: el navegador de quien construye. Se guarda el
     * documento --por su huella, como cualquier otro-- y se manda solo esa
     * huella; el panel lo pide por el camino de siempre, con el puente puesto.
     *
     * El documento queda suelto, sin que ninguna página lo apunte, y `pruneDocs`
     * lo recoge mas adelante. La página no cambia por probarla.
     *
     * Si nadie contesta, la espera vence y se sigue sin resultado: una petición
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
   * Los adjuntos que la conversación tiene delante: los de esta petición y los
   * de los turnos anteriores, en el orden en que se adjuntaron. El nombre con
   * el que se ofrece cada uno se desempata aquí, una sola vez, para que sea el
   * mismo en el contexto y en las ordenes.
   */
  const earlier = (opts.history ?? []).flatMap((message) => message.files ?? []);
  const mine = opts.files ?? [];
  const named = nameAiFiles([...earlier, ...mine]);
  const shown: ShownFile[] = [];
  for (const file of named) {
    const saved = await findAiFile(opts.app.id, file.ref);
    // Un adjunto que ya no esta guardado no se nombra: ofrecerlo seria ofrecer
    // algo que después falla al abrirlo.
    if (!saved) continue;
    shown.push({
      file,
      sample: mine.some((item) => item.ref === file.ref)
        ? await sampleAiFile(saved).catch(() => ({
            body: "",
            language: "",
            truncated: false,
            detail: "",
          }))
        : { body: "", language: "", truncated: true, detail: "" },
      earlier: !mine.some((f) => f.ref === file.ref),
    });
  }
  ctx.files = shown;

  /*
   * Las imagenes viajan en la petición, no en el contexto: no se pueden contar
   * con palabras. Se leen del almacen --ya no llegan dentro de la petición del
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
    systemPrompt(opts.app, opts.page, tables, opts.picked ?? [], shown, people, planActive),
    opts.prompt,
    toolsFor(planActive),
    {
      boundedContext: true,
      signal: opts.signal,
      choice: opts.choice,
      images,
      history: priorTurns(opts.history ?? []),
    },
  );

  const allowedTools = new Set(toolsFor(planActive).map((tool) => tool.name));
  const failures = new Map<string, number>();
  /*
   * Cómo terminó cada escritura, por herramienta y objetivo (el bloque o la
   * tabla). Una lectura fallida no deja nada a medias, así que no cuenta; una
   * escritura que falló y luego salió bien sobre lo mismo, tampoco.
   */
  const lastToolStatus = new Map<string, boolean>();
  const writeKey = (name: string, input: Record<string, unknown>) =>
    `${name}:${String(input.bloque ?? input.tabla ?? input.columna ?? input.persona ?? "")}`;
  let completed = false;
  let interruptedByLimit = false;
  let contextLimited = false;
  let responseTruncated = false;
  let message = "";
  let reasoning = "";
  /*
   * Cuanto contexto lleva gastado.
   *
   * Se queda el ultimo turno, no la suma: cada turno le pone delante al modelo
   * la conversación entera otra vez, así que el ultimo ya cuenta todo lo que
   * hay. Sumarlos daria un número que no significa nada.
   */
  let usage: AiUsage | undefined;
  /* Las sumas de la petición entera, para el detalle del medidor. */
  const totals = { input: 0, output: 0, cached: 0, seconds: 0 };

  /*
   * La revision de cierre.
   *
   * Falta cuando la petición dejo la página escrita y lo escrito todavía no
   * paso por "revisar_errores" --porque el modelo no la pidio, o porque
   * corrigio después de la ultima--. El tope de revisiones sigue mandando: si
   * ya se gastaron, no se fuerza ninguna mas.
   */
  const reviewPending = () =>
    ctx.changed &&
    !ctx.reviewed &&
    ctx.probes < MAX_PROBES &&
    !ctx.question &&
    !ctx.plan &&
    !stopped();

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
    lastToolStatus.set("revisar_errores", !!output && added.every((step) => step.ok));
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
    const askedAt = performance.now();
    const turn = await chat
      .ask((ev) => {
        // Lo que el modelo va soltando se reenvia tal cual: el texto mientras
        // escribe y las ideas mientras piensa. El resultado del turno llega
        // después, en la respuesta.
        opts.onProgress?.(ev);
      })
      .catch((err: unknown) => {
        // Al detener, el proveedor falla porque se le corto: eso no es un error
        // que contar, es lo que se pidio.
        if (stopped()) return null;
        if (err instanceof ContextBudgetError) {
          ctx.notices.push(err.message);
          contextLimited = true;
          return null;
        }
        throw err;
      });
    if (!turn) break;
    /*
     * Lo que el turno costo de mas. Va al mismo sitio que el resto de avisos
     * --ya esta hecho, solo hay que enterarse-- y no se repite: lo que se
     * cedio se cedio en la conversación, no en la ronda.
     */
    if (turn.notice && !ctx.notices.includes(turn.notice)) ctx.notices.push(turn.notice);
    if (turn.usage) {
      totals.input += turn.usage.input;
      totals.output += turn.usage.output;
      totals.cached += turn.usage.cached ?? 0;
      totals.seconds += (performance.now() - askedAt) / 1000;
      usage = {
        input: turn.usage.input,
        output: turn.usage.output,
        cached: turn.usage.cached ?? 0,
        window: chat.with.model.contextWindow,
        model: chat.with.model.id,
        totals: { ...totals },
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
    if (turn.truncated) {
      responseTruncated = true;
      break;
    }
    if (!turn.calls.length) {
      // El modelo da por terminado. Si dejo la página escrita sin revisarla,
      // se revisa aquí y lo que salga vuelve a el: no cierra sin pasar por
      // ahi, lo pida o no.
      if (!reviewPending()) {
        completed = true;
        break;
      }
      const back = await forceReview();
      if (!back) {
        completed = true;
        break;
      }
      chat.say(back);
      continue;
    }

    const results = [];
    for (const call of turn.calls) {
      // Se para entre herramienta y herramienta, nunca dentro de una: cortar a
      // media escritura dejaria el documento a medias.
      if (stopped()) break;
      // Se cuenta cuantos pasos había para poder mandar solo los nuevos: una
      // herramienta puede dejar mas de uno, o ninguno.
      const before = ctx.steps.length;
      const signature = JSON.stringify([call.name, call.input]);
      if ((failures.get(signature) ?? 0) >= 2) {
        interruptedByLimit = true;
        break;
      }
      const output = await (
        allowedTools.has(call.name)
          ? runTool(call.name, call.input, ctx)
          : Promise.resolve(
              "Error: tool unavailable in the current mode. Use only the tools provided.",
            )
      ).catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : "fallo desconocido";
        ctx.steps.push({ tool: call.name, summary: detail, ok: false });
        return `Error: ${detail}`;
      });
      if (/^Error:/i.test(output)) {
        failures.set(signature, (failures.get(signature) ?? 0) + 1);
        if (ctx.steps.length === before)
          ctx.steps.push({
            tool: call.name,
            summary: "No se pudo completar esta acción",
            ok: false,
          });
      }
      if (PLAN_MODE_WRITE_TOOLS.has(call.name) || call.name === "revisar_errores")
        lastToolStatus.set(
          call.name === "revisar_errores" ? call.name : writeKey(call.name, call.input),
          !/^Error:/i.test(output) && ctx.steps.slice(before).every((step) => step.ok),
        );
      for (const paso of ctx.steps.slice(before)) opts.onProgress?.({ tipo: "paso", paso });
      results.push({ id: call.id, output });
      if (ctx.question || ctx.plan || interruptedByLimit) break;
    }
    // Preguntar y cerrar el plan cierran el turno: no se abre otra ronda, así
    // que lo que el modelo llevara escrito se queda como esta y sale al panel.
    if (ctx.question || ctx.plan || interruptedByLimit) break;
    chat.reply(results);
  }

  // Si las rondas se acabaron antes de que el modelo cerrara, la revision se
  // hace igual: no queda ronda para devolversela, pero el estilo queda mirado y
  // el paso, a la vista de quien construye.
  if (reviewPending()) await forceReview();

  // Todos los cambios con riesgo de la petición viajan juntos: una sola
  // pregunta, una sola decision. Si se detuvo no se pregunta nada: quien para
  // una petición no quiere que le abran un diálogo para seguirla.
  // La pregunta se cuenta antes del `fin` para que el panel la tenga sin
  // esperar al resultado. Al detener no se pregunta nada: quien para una
  // petición no quiere que le abran una eleccion para seguirla.
  const question = stopped() ? null : ctx.question;
  if (question) opts.onProgress?.({ tipo: "pregunta", pregunta: question });

  // Lo mismo que con la pregunta: se cuenta antes del `fin`, y no se cuenta
  // nada si se detuvo a medias.
  const plan = stopped() ? null : ctx.plan;
  if (plan) opts.onProgress?.({ tipo: "plan", plan });

  // Lo mismo que con el impacto: quien para una petición no quiere que le
  // abran una autorizacion para seguirla.
  const grants = stopped() ? [] : ctx.grants;

  let impact: DataImpact | null = null;
  if (ctx.pending.length && !stopped()) {
    // Las páginas de ahora: la IA pudo declarar tablas nuevas en la suya.
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
   * Al detener se dice que se detuvo, y que pasa con lo que ya se había hecho.
   * Lo escrito por la IA hasta ese momento se conserva delante: es lo único que
   * explica por donde iba.
   */
  const halted = stopped();
  const incomplete = !completed && !question && !plan && !halted;
  if (incomplete && !contextLimited && !responseTruncated)
    ctx.notices.push(
      interruptedByLimit
        ? "La solicitud quedó incompleta porque una acción falló repetidamente. Revisa los cambios antes de continuar."
        : "La solicitud llegó al límite de pasos. Revisa lo que quedó hecho antes de continuar.",
    );
  const ending = halted
    ? `Petición detenida.${ctx.changed ? " Lo que ya se había aplicado se queda como está." : ""}`
    : "";

  // Al preguntar o cerrar el plan, ese texto es la respuesta: el modelo tiene
  // dicho que no escriba resumen, y la conversación guardada tiene que leerse
  // igual de bien sin los botones delante.
  const closing = plan ? plan.texto : question ? question.question : "Listo.";
  const answer = plan
    ? plan.texto
    : question
      ? question.question
      : [message, ending].filter(Boolean).join("\n\n") ||
        (incomplete ? "La solicitud quedó incompleta." : closing);

  /*
   * La memoria de la página se escribe aquí, con el turno ya cerrado: la
   * respuesta lleva rato en la pantalla --salio por los avisos segun se
   * escribia-- así que esperar a la pasada no retrasa nada de lo que se ve. Lo
   * que si espera es el `fin`, y eso es lo que se quiere: la caja de Memorias
   * se desbloquea con el texto ya escrito, no con el de antes (D8).
   *
   * No se pasa por aquí cuando el turno cerro preguntando, cerrando un plan o
   * detenido. En los tres la IA no construyo nada y el intercambio esta a
   * medias: lo que se pidio todavía no tiene respuesta, y guardar la regla que
   * se estaba proponiendo seria darla por aceptada antes de que nadie la
   * acepte. Se guarda en el turno siguiente, que es el que trae la
   * confirmacion y --por `question`-- también la pregunta (D5).
   */
  if (!question && !plan && !halted && !incomplete) {
    const savedMemory = await runMemoryPass({
      app: opts.app,
      page: opts.page,
      choice: opts.choice,
      exchange: {
        prompt: opts.prompt,
        question: lastQuestion(opts.history ?? []),
        answer,
        steps: ctx.steps,
      },
      // Que la pasada falle no puede tumbar un turno que ya salio bien: se
      // deja constancia y la memoria queda como estaba (`page-memory`: "La
      // pasada falla").
    }).catch((err: unknown) => {
      console.error(
        `[memoria] La pasada de la página "${opts.page.name}" falló:`,
        err instanceof Error ? err.message : err,
      );
      ctx.notices.push(
        "No se pudieron guardar las reglas de esta página. Puedes revisarlas en los ajustes, en Memorias.",
      );
      return null;
    });
    if (
      savedMemory === null &&
      /recuerda|memoriza|memorias|no se te olvide/i.test(opts.prompt) &&
      !ctx.notices.some((notice) => notice.startsWith("No se pudieron guardar"))
    )
      ctx.notices.push(
        "No se añadieron reglas nuevas. Puedes comprobar lo que ya está guardado en los ajustes de la página, en Memorias.",
      );
    if (savedMemory !== null)
      ctx.notices.push(
        "Las reglas de esta página se actualizaron. Puedes revisarlas en los ajustes, en Memorias.",
      );
  }

  return {
    completed:
      completed &&
      [...lastToolStatus.values()].every(Boolean) &&
      !ctx.pending.length &&
      !ctx.grants.length,
    message: answer,
    steps: ctx.steps,
    notices: ctx.notices,
    changed: ctx.changed,
    impact,
    access: grants,
    question,
    plan,
    reasoning: reasoning || undefined,
    stopped: halted,
    ...(usage ? { usage } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Para el diálogo de impacto                                           */
/* ------------------------------------------------------------------ */

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

/**
 * La IA arregla una página distinta de la abierta. Solo se llega aquí desde el
 * diálogo de impacto: es la única grieta del alcance de una página.
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

/** El modelo suele envolver la respuesta en un bloque de código. */
function unfence(text: string): string {
  const fenced = /^\s*```[\w-]*\s*\n([\s\S]*?)\n?```\s*$/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}
