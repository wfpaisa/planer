/**
 * Llevarse los servidores de IA de una instalacion a otra: el archivo que sale
 * de "Exportar" en los ajustes y lo que se lee al volver a soltarlo.
 *
 * **Las claves no salen, y no porque se filtren aquí.** Lo que se escribe es lo
 * que el panel tiene delante (`AiConfigView`), y el panel no recibe ninguna
 * clave nunca: `aiView()` (`server/routes.ts`) las quita antes de mandarle la
 * configuración, y lo único que llega es `hasKey`. Así que no hay una lista de
 * la que excluirlas ni una lista que alguien pueda olvidarse de mantener. Al
 * importar hay que volver a escribirlas --salvo las que ya estuvieran
 * guardadas para ese mismo servidor, que el servidor conserva solo--.
 *
 * Lo que se lee no se guarda: se aplica al formulario de `AiForm`, y de ahi no
 * sale hasta que quien administra pulsa Guardar. Es lo mismo que hace el resto
 * de esa pantalla, y es lo que permite revisar lo importado --y escribir las
 * claves que falten-- antes de que nada cambie.
 */
import { AI_NEW_MODEL, aiThinkingRank } from "@shared/aiCatalog";
import {
  AI_THINKING_OFF,
  type AiChoice,
  type AiConfigView,
  type AiModel,
  type AiProvider,
  type AiProviderConfig,
  type AiProviderView,
} from "@shared/types";

/** Como se reconoce un archivo de estos. Igual que `plane-columnas`. */
export const AI_CONFIG_FORMAT = "plane-servidores-ia";

/** Como se llama el archivo que se descarga. */
export const AI_CONFIG_FILE = "servidores-ia.json";

/** Igual que en el servidor: a lo que se cae si el archivo no trae un número válido. */
const AI_DEFAULT_RUN_TIMEOUT_MINUTES = 40;

/** Lo que trae un archivo, ya leido y sin nada que no se entienda. */
export interface AiConfigFile {
  providers: AiProviderConfig[];
  fallback: AiChoice;
  enabled: boolean;
  debugButton: boolean;
  runTimeoutMinutes: number;
}

export type AiConfigFileResult =
  | { ok: true; file: AiConfigFile; invalid: { index: number; message: string }[] }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Escribir                                                            */
/* ------------------------------------------------------------------ */

/**
 * La configuración de la sección, como texto para descargar.
 *
 * Sale lo que se esta viendo, no lo ultimo guardado: en esa pantalla lo escrito
 * vive en el formulario hasta que se guarda, y exportar otra cosa daria un
 * archivo que no se parece a lo que hay delante.
 */
export function aiConfigToJson(config: AiConfigView): string {
  const servidores = config.providers.map(({ hasKey, ...provider }) => ({
    ...provider,
    models: provider.models.map((m) => ({ ...m })),
  }));
  return JSON.stringify(
    {
      formato: AI_CONFIG_FORMAT,
      version: 1,
      activa: config.enabled,
      botonDepuracion: config.debugButton,
      tiempoMaximoMinutos: config.runTimeoutMinutes,
      porDefecto: { ...config.fallback },
      servidores,
    },
    null,
    2,
  );
}

/* ------------------------------------------------------------------ */
/* Leer                                                                */
/* ------------------------------------------------------------------ */

const isProvider = (value: unknown): value is AiProvider =>
  value === "anthropic" || value === "openai" || value === "openrouter" || value === "llamacpp";

/** Un nivel de pensamiento es cualquier palabra: los nombra cada servidor. */
const isThinking = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9_-]{1,24}$/i.test(value);

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Un modelo del archivo, con las medidas dejadas en numeros que se pueden usar.
 *
 * Lo que no venga o no se entienda cae en la medida prudente de un modelo
 * recien anadido a mano: es corregible en la misma pantalla, y es mejor que
 * perder el modelo entero por un número mal escrito.
 */
function readModel(raw: unknown): AiModel | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const id = text(source.id);
  if (!id) return null;

  const max = Math.round(Number(source.maxTokens));
  const window = Math.round(Number(source.contextWindow));
  const efforts = Array.isArray(source.efforts)
    ? source.efforts.map((e) => String(e).trim().toLowerCase()).filter(isThinking)
    : [];

  return {
    id,
    label: text(source.label),
    maxTokens: Number.isFinite(max) && max > 0 ? max : AI_NEW_MODEL.maxTokens,
    contextWindow: Number.isFinite(window) && window > 0 ? window : 0,
    thinking: source.thinking === true,
    efforts: [...new Set(efforts)].sort((a, b) => aiThinkingRank(a) - aiThinkingRank(b)),
    vision: source.vision === true,
    ...(source.thinkingBudget === true ? { thinkingBudget: true as const } : {}),
  };
}

/** Un servidor del archivo, o por que no se puede traer. */
function readProvider(raw: unknown): { provider?: AiProviderConfig; message?: string } {
  if (!raw || typeof raw !== "object") return { message: "No es un objeto" };
  const source = raw as Record<string, unknown>;

  if (!isProvider(source.provider)) {
    return { message: `Clase de servidor desconocida: ${String(source.provider)}` };
  }

  const baseUrl = text(source.baseUrl);
  // La misma comprobacion que hace el servidor al guardar, hecha antes: así el
  // fallo se lee aquí, con el servidor que lo trae al lado, y no al guardar.
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return { message: `La dirección "${baseUrl}" no empieza por http:// o https://` };
  }

  const models = Array.isArray(source.models)
    ? source.models.map(readModel).filter((m) => m !== null)
    : [];

  return {
    provider: {
      id: text(source.id) || `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: text(source.name),
      provider: source.provider,
      baseUrl,
      models,
      // Como en el servidor: lo que no dice nada viene de una versión sin
      // interruptor, y apagarlo por cuenta propia seria apagarselo a alguien.
      enabled: source.enabled !== false,
    },
  };
}

/**
 * Lee un texto y lo interpreta como una configuración de servidores de IA.
 *
 * Acepta el formato propio o una lista pelada de servidores --lo que alguien
 * pegaria si recorta el archivo--. Los servidores que no se pueden traer se
 * apartan en `invalid` en vez de romper el resto.
 */
export function parseAiConfigFile(input: string): AiConfigFileResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Pega o selecciona un archivo JSON" };

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "No se pudo leer el JSON" };
  }

  let list: unknown[];
  let head: Record<string, unknown> = {};
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    head = data as Record<string, unknown>;
    if (head.formato !== AI_CONFIG_FORMAT || !Array.isArray(head.servidores)) {
      return { ok: false, error: "El archivo no contiene una configuración de IA válida" };
    }
    list = head.servidores;
  } else {
    return { ok: false, error: "El archivo no contiene una configuración de IA válida" };
  }

  if (list.length === 0) return { ok: false, error: "El archivo no contiene servidores" };

  const providers: AiProviderConfig[] = [];
  const invalid: { index: number; message: string }[] = [];
  list.forEach((item, index) => {
    const { provider, message } = readProvider(item);
    if (provider) providers.push(provider);
    else invalid.push({ index, message: message ?? "Servidor no válido" });
  });

  const chosen = (head.porDefecto ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    file: {
      providers,
      fallback: {
        provider: text(chosen.provider),
        model: text(chosen.model),
        thinking: isThinking(chosen.thinking) ? chosen.thinking : AI_THINKING_OFF,
      },
      enabled: head.activa === true,
      debugButton: head.botonDepuracion === true,
      runTimeoutMinutes: readRunTimeoutMinutes(head.tiempoMaximoMinutos),
    },
    invalid,
  };
}

/** Igual que en el servidor: 0 quita el tope, lo demás se redondea a minutos. */
function readRunTimeoutMinutes(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : AI_DEFAULT_RUN_TIMEOUT_MINUTES;
}

/* ------------------------------------------------------------------ */
/* Aplicar                                                             */
/* ------------------------------------------------------------------ */

/**
 * Que hacer con lo que trae el archivo.
 *
 *   add      solo entran los servidores que aquí no estan; lo demás --el
 *            modelo por defecto, los dos interruptores y el tiempo maximo--
 *            se queda como esta.
 *   replace  se restaura la sección entera, interruptores incluidos.
 */
export type AiImportMode = "add" | "replace";

export interface AiImportPlan {
  /** Como queda la sección si se aplica. */
  next: AiConfigView;
  /** Los del archivo que entran. */
  added: AiProviderView[];
  /** Los del archivo que no entran porque ese servidor ya estaba. */
  skipped: AiProviderView[];
  /** Los que estaban y el reemplazo se lleva por delante, con su clave. */
  removed: AiProviderView[];
}

/** Si una eleccion sigue senalando a un modelo al que se puede llamar. */
const resolves = (providers: AiProviderConfig[], choice: AiChoice | undefined): boolean =>
  !!choice?.provider &&
  !!choice.model &&
  providers.some((p) => p.id === choice.provider && p.models.some((m) => m.id === choice.model));

/**
 * El primero de los candidatos que todavía senale a algo; si ninguno, el
 * primer modelo que haya. Sin esto la sección puede quedar con un modelo por
 * defecto que ya no existe, que es quedarse sin nada cuando nadie elige.
 */
function pickFallback(providers: AiProviderConfig[], candidates: AiChoice[]): AiChoice {
  for (const candidate of candidates) {
    if (resolves(providers, candidate)) return { ...candidate };
  }
  const first = providers.find((p) => p.models.length);
  return {
    provider: first?.id ?? "",
    model: first?.models[0]?.id ?? "",
    thinking: candidates[0]?.thinking ?? AI_THINKING_OFF,
  };
}

/**
 * Lo que va a pasar si se importa, sin que pase todavía.
 *
 * Los servidores se emparejan por su `id`, que es el que el archivo conserva:
 * uno que se reimporta sobre si mismo se reconoce, y con eso el servidor le
 * mantiene la clave guardada al escribirlo (ver `mergeConfig` en
 * `server/ai/ai.ts`). Por eso `hasKey` se lee de lo que ya hay y no del archivo,
 * que nunca lo trae: es lo único honesto que se puede decir de una clave que
 * no ha viajado.
 */
export function planAiImport(
  file: AiConfigFile,
  current: AiConfigView,
  mode: AiImportMode,
): AiImportPlan {
  const view = (provider: AiProviderConfig): AiProviderView => ({
    ...provider,
    hasKey: current.providers.find((p) => p.id === provider.id)?.hasKey ?? false,
  });
  const incoming = file.providers.map(view);

  if (mode === "add") {
    const taken = new Set(current.providers.map((p) => p.id));
    const added = incoming.filter((p) => !taken.has(p.id));
    const skipped = incoming.filter((p) => taken.has(p.id));
    const providers = [...current.providers, ...added];
    return {
      next: {
        ...current,
        providers,
        fallback: pickFallback(providers, [current.fallback, file.fallback]),
      },
      added,
      skipped,
      removed: [],
    };
  }

  return {
    next: {
      providers: incoming,
      fallback: pickFallback(incoming, [file.fallback, current.fallback]),
      // El archivo no lo trae --no esta en el formato-- así que se conserva el
      // que hubiera. Si senalaba un modelo que ya no existe, el servidor lo
      // borra al guardar, que es donde se puede saber.
      memoryChoice: current.memoryChoice,
      enabled: file.enabled,
      debugButton: file.debugButton,
      runTimeoutMinutes: file.runTimeoutMinutes,
    },
    added: incoming,
    skipped: [],
    removed: current.providers.filter((p) => !incoming.some((i) => i.id === p.id)),
  };
}
