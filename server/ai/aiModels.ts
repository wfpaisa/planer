/**
 * El catalogo de modelos de un servidor que sabe contarlo.
 *
 * OpenRouter publica lo que hace falta saber de cada modelo --cuanto le cabe
 * delante, cuanto puede escribir, si piensa y con que niveles, si ve
 * imagenes--, asi que no hay ninguna razon para que eso se escriba a mano.
 * Aqui se lee y se traduce a lo que la plataforma entiende.
 *
 * Lo que no viene o no se entiende no rompe nada: se cae en una medida
 * prudente, que quien administra puede corregir en la misma pantalla.
 */
import { AI_NEW_MODEL, AI_THINKING_BUDGET_LEVELS, aiThinkingRank } from "../../shared/aiCatalog.ts";
import { AI_THINKING_OFF, type AiModel, type AiThinking } from "../../shared/types.ts";
import { HttpError } from "../auth.ts";

/** Cuanto se conserva la lista traida. Es grande y no cambia cada minuto. */
const CACHE_MS = 10 * 60_000;

const cache = new Map<string, { at: number; models: AiModel[] }>();

/** Lo que interesa de una ficha del catalogo. El resto se ignora. */
interface CatalogEntry {
  id?: string;
  name?: string;
  context_length?: number;
  architecture?: { input_modalities?: string[] };
  top_provider?: { context_length?: number; max_completion_tokens?: number | null };
  supported_parameters?: string[];
  reasoning?: {
    mandatory?: boolean;
    supported_efforts?: string[];
  };
}

/**
 * Los niveles llegan con el nombre que les da el servidor y se guardan asi.
 *
 * Traducirlos a una escala propia seria perder los que no caben en ella: un
 * modelo que ofrece `max` no ofrece "mucho", ofrece `max`, y eso es lo que hay
 * que mandarle. La unica igualacion es `none`, que es como se escribe en
 * algunos sitios lo mismo que aqui se llama `off`.
 */
const normalizeEffort = (level: string): AiThinking =>
  level.trim().toLowerCase() === "none" ? AI_THINKING_OFF : level.trim().toLowerCase();

/** Una ficha del catalogo, en lo que la plataforma sabe usar. */
function readEntry(raw: CatalogEntry): AiModel | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  // El de arriba es el que atiende de verdad; el general puede ser mayor que lo
  // que ninguna maquina llega a servir.
  const window = Math.round(Number(raw.top_provider?.context_length || raw.context_length || 0));
  const max = Math.round(Number(raw.top_provider?.max_completion_tokens ?? 0));

  const params = raw.supported_parameters ?? [];
  const declared = raw.reasoning?.supported_efforts ?? [];
  const thinking =
    !!raw.reasoning || params.includes("reasoning") || params.includes("reasoning_effort");

  const efforts: AiThinking[] = [];
  for (const level of declared) {
    const name = normalizeEffort(String(level));
    if (name && !efforts.includes(name)) efforts.push(name);
  }
  /*
   * Hay modelos que dicen que piensan sin decir con que niveles. Ahi la lista
   * se queda vacia, que es como se dice "los de siempre"; rellenarla a medias
   * seria recortarle niveles que si acepta.
   *
   * Y a los que declaran niveles solo se les anade "sin pensar" si de verdad
   * pueden no pensar: pedirselo a uno que piensa siempre es pedirle algo que su
   * servidor no va a hacer.
   */
  if (efforts.length && !raw.reasoning?.mandatory && !efforts.includes(AI_THINKING_OFF)) {
    efforts.unshift(AI_THINKING_OFF);
  }
  // Un modelo cuyo unico nivel es "sin pensar" no piensa, diga lo que diga.
  const reasons = thinking && !(efforts.length === 1 && efforts[0] === AI_THINKING_OFF);

  return {
    id,
    label: String(raw.name ?? "").trim(),
    // Sin tope declarado se deja uno prudente que quepa en su contexto: pedirle
    // mas de lo que acepta hace fallar la peticion entera.
    maxTokens: max > 0 ? max : Math.min(AI_NEW_MODEL.maxTokens, window || AI_NEW_MODEL.maxTokens),
    contextWindow: window,
    thinking: reasons,
    // De menos a mas, para que el menu del chat se lea en ese orden.
    efforts: reasons ? efforts.sort((a, b) => aiThinkingRank(a) - aiThinkingRank(b)) : [],
    vision: (raw.architecture?.input_modalities ?? []).includes("image"),
  };
}

/* ------------------------------------------------------------------ */
/* llama.cpp: un solo modelo, leido de sus propiedades                  */
/* ------------------------------------------------------------------ */

/** Lo que interesa de `/props`. El resto --muestreo, plantilla completa-- se ignora. */
interface LlamaCppProps {
  model_alias?: string;
  model_path?: string;
  default_generation_settings?: { n_ctx?: number };
  modalities?: { vision?: boolean };
  chat_template?: string;
}

/**
 * Si esta plantilla sabe pensar, tal y como lo detecta la interfaz propia de
 * llama.cpp (`chat-template-thinking-detector.ts` de su webui).
 *
 * `/props` no trae un aviso directo de "esto piensa": hay que leerlo de la
 * propia plantilla. Se prueban tres senales, de la mas fiable a la menos: una
 * variable que la plantilla reciba de fuera (`enable_thinking`,
 * `reasoning_effort`, `thinking_budget`), un condicional escrito a mano sobre
 * esas mismas palabras, o un par de etiquetas de pensamiento --`<think>`, y
 * las que usan otras familias de modelos--.
 */
const THINKING_KWARG_VARS = ["enable_thinking", "reasoning_effort", "thinking_budget"];

const THINKING_TAG_PATTERNS: [string, string | null][] = [
  ["<think>", "</think>"],
  ["<|channel>thought", "<|channel|>"],
  ["<|think|>", "</|think|>"],
  ["<seed:think|>", "</seed:think|>"],
  ["<think></think>", null],
];

const JINJA_THINKING_CONDITIONALS: RegExp[] = [
  /\{%-?\s*if\s+\(?\s*\w*enable[\s_]+\w*(thinking|think|reasoning)/i,
  /\{%-?\s*if\s+\w*(thinking|reasoning)\s*(is not|==|!=)/i,
  /\{%-?\s*if\s+not\s+\w*enable/i,
  /\{%-?\s*if\s+ns\.enable_thinking/i,
];

function detectsThinking(template: string): boolean {
  if (!template) return false;
  for (const kwarg of THINKING_KWARG_VARS) {
    const re = new RegExp(
      `(\\{\\{[^{}]*\\b${kwarg}\\b[^{}]*\\}\\}|\\{%[^{}]*\\b${kwarg}\\b[^{}]*%\\})`,
      "i",
    );
    if (re.test(template)) return true;
  }
  for (const p of JINJA_THINKING_CONDITIONALS) {
    if (p.test(template)) return true;
  }
  for (const [start, end] of THINKING_TAG_PATTERNS) {
    if (template.includes(start) && (!end || template.includes(end))) return true;
  }
  return false;
}

/**
 * El unico modelo que atiende un servidor de llama.cpp, leido de `/props`.
 *
 * A diferencia de OpenRouter, aqui no hay lista que buscar: el servidor sirve
 * un modelo cargado y eso es lo unico que puede haber. `/props` vive en la
 * raiz del servidor, no bajo `/v1`, asi que se le quita ese trozo a la
 * direccion antes de preguntarle.
 *
 * Si piensa, no se le preguntan sus propios niveles: se le ofrecen los cinco
 * fijos de llama.cpp (`AI_THINKING_BUDGET_LEVELS`), con tope de tokens en vez
 * de un nombre. Es lo que hace su propia interfaz, y sirve en cualquier
 * modelo con bloque de pensamiento, lo declare o no.
 */
export async function llamaCppModel(base: string, apiKey: string): Promise<AiModel> {
  const root = base.replace(/\/v1\/?$/, "");
  const props = (await fetchJson(`${root}/props`, apiKey)) as LlamaCppProps | null;
  if (!props) throw new HttpError(502, "El servidor no devolvió sus propiedades.");

  const path = String(props.model_path ?? "");
  const id = String(props.model_alias ?? "").trim() || path.split("/").pop() || "modelo";
  const window = Math.round(Number(props.default_generation_settings?.n_ctx ?? 0));
  const thinking = detectsThinking(String(props.chat_template ?? ""));

  return {
    id,
    label: "",
    maxTokens: Math.min(AI_NEW_MODEL.maxTokens, window || AI_NEW_MODEL.maxTokens),
    contextWindow: window,
    thinking,
    efforts: thinking ? [...AI_THINKING_BUDGET_LEVELS] : [],
    vision: props.modalities?.vision === true,
    ...(thinking ? { thinkingBudget: true as const } : {}),
  };
}

/** El catalogo de llama.cpp es siempre el mismo: el unico modelo cargado. */
export async function llamaCppCatalog(base: string, apiKey: string): Promise<AiModel[]> {
  return [await llamaCppModel(base, apiKey)];
}

async function fetchJson(url: string, apiKey: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, `No se pudo consultar el catálogo de modelos. ${detail}`);
  }
  if (!res.ok) throw new HttpError(502, `El catálogo de modelos respondió ${res.status}`);
  return await res.json().catch(() => null);
}

/**
 * Todos los modelos que ofrece el servidor.
 *
 * Se guarda un rato lo traido: la lista pasa del megabyte y quien esta
 * conectando un servidor la va a pedir varias veces seguidas mientras busca.
 */
export async function listCatalog(base: string, apiKey: string): Promise<AiModel[]> {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.models;

  const payload = (await fetchJson(`${base}/models`, apiKey)) as { data?: CatalogEntry[] } | null;
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const models = items.map(readEntry).filter((m) => m !== null);
  if (!models.length) throw new HttpError(502, "El catálogo de modelos llegó vacío.");

  models.sort((a, b) => a.id.localeCompare(b.id));
  cache.set(base, { at: Date.now(), models });
  return models;
}

/**
 * Un modelo suelto, con sus datos.
 *
 * Se pregunta primero por el, que es una respuesta pequena; si el servidor no
 * atiende esa forma, se busca dentro de la lista entera, que si esta.
 */
export async function findCatalogModel(base: string, apiKey: string, id: string): Promise<AiModel> {
  const wanted = id.trim();
  if (!wanted) throw new HttpError(400, "Escribe el nombre del modelo.");

  const one = (await fetchJson(`${base}/models/${wanted}`, apiKey).catch(() => null)) as {
    data?: CatalogEntry;
  } | null;
  const direct = one?.data ? readEntry(one.data) : null;
  // El catalogo responde con el nombre canonico --con fecha--; se conserva el
  // que se escribio, que es el que hay que mandarle luego al servidor.
  if (direct) return { ...direct, id: wanted };

  const all = await listCatalog(base, apiKey);
  const found = all.find((m) => m.id === wanted);
  if (!found) throw new HttpError(404, `El catálogo no conoce ningún modelo "${wanted}".`);
  return found;
}
