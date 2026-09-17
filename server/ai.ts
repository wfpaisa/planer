/**
 * La conexion con los servidores de inteligencia artificial.
 *
 * Aqui vive lo que no depende de para que se use el modelo: la configuracion
 * guardada, los proveedores conectados y las dos formas de hablarles --una
 * pregunta suelta, o una conversacion con herramientas--. Que herramientas hay
 * y que hacen lo decide quien abre la conversacion; ver `aiPage.ts`.
 *
 * Se pueden conectar varios servidores a la vez y darle a cada uno sus modelos.
 * Cada peticion elige con cual se atiende y cuanto se le pide pensar; si no
 * elige, manda lo que dejo puesto quien administra. Las claves viven solo aqui,
 * en el servidor.
 */
import Anthropic from "@anthropic-ai/sdk";

import {
  AI_PROVIDER_BASE,
  AI_SUGGESTED,
  AI_THINKING_BUDGET_TOKENS,
  aiNearestThinking,
  aiThinkingRank,
} from "../shared/aiCatalog.ts";
import {
  AI_THINKING_OFF,
  type AiChoice,
  type AiConfig,
  type AiModel,
  type AiProvider,
  type AiProviderConfig,
  type AiThinking,
} from "../shared/types.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { createRecord, firstRecord, updateRecord } from "./pb.ts";

/** Lo que se le deja escribir a un modelo del que no se sabe el tope. */
const FALLBACK_MAX_TOKENS = 16000;

/**
 * De lo que se parte cuando hay que describir un modelo sin saber nada de el:
 * el que venia de una instalacion de las de antes, donde solo se guardaba su
 * nombre. Las medidas se corrigen en la pantalla de ajustes.
 */
const FALLBACK_MODEL: AiModel = {
  id: "",
  label: "",
  maxTokens: FALLBACK_MAX_TOKENS,
  contextWindow: 0,
  thinking: false,
  efforts: [],
  vision: false,
};

/**
 * Cuantas ideas se le dejan a Claude en cada nivel, de menos a mas.
 *
 * Va por posicion y no por nombre porque los nombres los pone cada servidor:
 * lo unico comparable entre un `high` y un `max` es cual pide mas. Los
 * compatibles con ChatGPT no reciben un numero sino la palabra tal cual, asi
 * que esta tabla es solo de Claude.
 */
const THINKING_BUDGET = [0, 1024, 2048, 8192, 16384, 24576, 32000];

/** Lo minimo que Claude acepta como presupuesto de ideas. */
const MIN_BUDGET = 1024;

/* ------------------------------------------------------------------ */
/* Configuracion guardada                                              */
/* ------------------------------------------------------------------ */

/** Un proveedor tal y como se guarda: con su clave, que no sale de aqui. */
export interface StoredProvider extends AiProviderConfig {
  apiKey: string;
}

export interface StoredConfig extends Omit<AiConfig, "providers"> {
  providers: StoredProvider[];
}

const EMPTY: StoredConfig = {
  providers: [],
  fallback: { provider: "", model: "", thinking: AI_THINKING_OFF },
  enabled: false,
  debugButton: false,
};

/** La forma que tenia la configuracion cuando solo cabia un servidor. */
interface LegacyConfig {
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  enabled?: boolean;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const isProvider = (value: unknown): value is AiProvider =>
  value === "anthropic" || value === "openai" || value === "openrouter" || value === "llamacpp";

/** Con que formato se le habla. OpenRouter habla el de ChatGPT. */
const speaksAnthropic = (provider: AiProvider) => provider === "anthropic";

/**
 * Un nivel de pensamiento es cualquier palabra que un servidor use para
 * nombrarlo. Lo unico que se comprueba es que sea una palabra.
 */
const isThinking = (value: unknown): value is AiThinking =>
  typeof value === "string" && /^[a-z0-9_-]{1,24}$/i.test(value);

/** Lo que un modelo dice de si mismo, dejado en numeros que se pueden usar. */
function readModel(raw: Partial<AiModel>): AiModel | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const max = Math.round(Number(raw.maxTokens));
  const window = Math.round(Number(raw.contextWindow));
  const efforts = Array.isArray(raw.efforts)
    ? raw.efforts.map((e) => String(e).trim().toLowerCase()).filter(isThinking)
    : [];
  return {
    id,
    label: String(raw.label ?? "").trim(),
    maxTokens: Number.isFinite(max) && max > 0 ? max : FALLBACK_MAX_TOKENS,
    contextWindow: Number.isFinite(window) && window > 0 ? window : 0,
    thinking: raw.thinking === true,
    efforts: [...new Set(efforts)].sort((a, b) => aiThinkingRank(a) - aiThinkingRank(b)),
    vision: raw.vision === true,
    ...(raw.thinkingBudget === true ? { thinkingBudget: true } : {}),
  };
}

function readProvider(raw: Partial<StoredProvider>): StoredProvider | null {
  if (!isProvider(raw.provider)) return null;
  const models = Array.isArray(raw.models)
    ? raw.models.map((m) => readModel(m as Partial<AiModel>)).filter((m) => m !== null)
    : [];
  return {
    id: String(raw.id ?? "").trim() || uid(),
    name: String(raw.name ?? "").trim(),
    provider: raw.provider,
    baseUrl: String(raw.baseUrl ?? "").trim(),
    models,
    // Lo que no dice nada viene de una version que no tenia el interruptor:
    // apagarlo por su cuenta seria apagarle a alguien la IA al actualizar.
    enabled: raw.enabled !== false,
    apiKey: String(raw.apiKey ?? ""),
  };
}

/**
 * El nombre del proveedor que sale de una instalacion de las de antes.
 *
 * Es fijo a proposito. La forma vieja no tiene nombres, asi que hay que
 * ponerle uno al leerla; si fuera distinto en cada lectura, el primer guardado
 * no reconoceria al que ya estaba y le borraria la clave.
 */
const LEGACY_ID = "principal";

/**
 * Lo guardado, en la forma de ahora.
 *
 * Una instalacion que venia de la version de un solo servidor se lee como un
 * proveedor con un modelo: nadie tiene que volver a escribir su clave.
 */
function readConfig(value: unknown): StoredConfig {
  const raw = (value ?? {}) as Partial<StoredConfig> & LegacyConfig;

  if (!Array.isArray(raw.providers)) {
    if (!isProvider(raw.provider)) return EMPTY;
    const model = String(raw.model ?? "").trim();
    const known = AI_SUGGESTED[raw.provider].find((m) => m.id === model);
    const provider: StoredProvider = {
      id: LEGACY_ID,
      name: "",
      provider: raw.provider,
      baseUrl: String(raw.baseUrl ?? "").trim(),
      models: model ? [known ?? { ...FALLBACK_MODEL, id: model }] : [],
      enabled: true,
      apiKey: String(raw.apiKey ?? ""),
    };
    return {
      providers: [provider],
      fallback: { provider: provider.id, model, thinking: AI_THINKING_OFF },
      enabled: raw.enabled === true,
      debugButton: false,
    };
  }

  const providers = raw.providers
    .map((p) => readProvider(p as Partial<StoredProvider>))
    .filter((p) => p !== null);
  const fallback = (raw.fallback ?? {}) as Partial<AiChoice>;
  return {
    providers,
    fallback: {
      provider: String(fallback.provider ?? "").trim(),
      model: String(fallback.model ?? "").trim(),
      thinking: isThinking(fallback.thinking) ? fallback.thinking : AI_THINKING_OFF,
    },
    enabled: raw.enabled === true,
    debugButton: raw.debugButton === true,
  };
}

export async function loadAiConfig(): Promise<StoredConfig> {
  const row = await firstRecord<{ value: unknown }>(INTERNAL.settings, 'key = "ai"').catch(
    () => null,
  );
  return readConfig(row?.value);
}

/**
 * Combina lo que llega del formulario con lo que ya estaba guardado.
 *
 * La regla de las claves es la de siempre: una clave vacia significa "deja la
 * que ya estaba", porque el panel nunca las recibe y no las puede devolver.
 */
function mergeConfig(input: Partial<StoredConfig>, current: StoredConfig): StoredConfig {
  const next = readConfig({ ...current, ...input });

  next.providers = next.providers.map((provider) => {
    if (provider.apiKey) return provider;
    const before = current.providers.find((p) => p.id === provider.id);
    return before ? { ...provider, apiKey: before.apiKey } : provider;
  });

  for (const provider of next.providers) {
    // Se guarda ya limpia: vacia sigue queriendo decir "la oficial", pero una
    // barra de mas no puede quedar escrita para que la quite cada lectura.
    provider.baseUrl = provider.baseUrl.replace(/\/$/, "");
    resolveBaseUrl(provider);
  }

  // Un modelo por defecto que ya no existe deja la plataforma sin nada que
  // usar cuando nadie elige: se cae al primero que haya.
  if (!findModel(next, next.fallback)) {
    const first = next.providers.find((p) => p.models.length);
    next.fallback = {
      provider: first?.id ?? "",
      model: first?.models[0]?.id ?? "",
      thinking: next.fallback.thinking,
    };
  }

  return next;
}

/**
 * Como se llama el tope de escritura en este servidor.
 *
 * ChatGPT dejo de aceptar `max_tokens` en sus modelos que razonan y pide
 * `max_completion_tokens`; los demas servidores compatibles --Ollama, LM
 * Studio, llama.cpp, OpenRouter-- siguen con el nombre de siempre y no conocen
 * el nuevo. Se mira la direccion porque es lo unico que distingue a uno de otro.
 */
function maxTokensField(base: string, max: number): Record<string, number> {
  const official = /(^|\/\/)([^/]*\.)?openai\.com(\/|$)/i.test(base);
  return official ? { max_completion_tokens: max } : { max_tokens: max };
}

/**
 * Quita la barra final y comprueba que sea una direccion de verdad. Sin esto
 * el autocompletado del navegador puede colar cualquier texto en el campo.
 */
function resolveBaseUrl(provider: { provider: AiProvider; baseUrl: string }): string {
  const base = (provider.baseUrl || AI_PROVIDER_BASE[provider.provider]).replace(/\/$/, "");
  if (base && !/^https?:\/\//i.test(base)) {
    throw new HttpError(
      400,
      `La dirección del servidor debe empezar por http:// o https://. Ahora dice "${base}".`,
    );
  }
  return base;
}

export async function saveAiConfig(input: Partial<StoredConfig>): Promise<StoredConfig> {
  const current = await loadAiConfig();
  const next = mergeConfig(input, current);

  const row = await firstRecord<{ id: string }>(INTERNAL.settings, 'key = "ai"').catch(() => null);
  if (row) await updateRecord(INTERNAL.settings, row.id, { value: next });
  else await createRecord(INTERNAL.settings, { key: "ai", value: next });

  return next;
}

/* ------------------------------------------------------------------ */
/* Elegir con que se atiende una peticion                               */
/* ------------------------------------------------------------------ */

/** El proveedor y el modelo de una eleccion, si los dos siguen existiendo. */
function findModel(
  cfg: StoredConfig,
  choice: Partial<AiChoice> | undefined,
): { provider: StoredProvider; model: AiModel } | null {
  if (!choice?.provider || !choice.model) return null;
  // Un servidor apagado no atiende: es lo que significa apagarlo.
  const provider = cfg.providers.find((p) => p.id === choice.provider && p.enabled);
  const model = provider?.models.find((m) => m.id === choice.model);
  return provider && model ? { provider, model } : null;
}

/** Con que se atiende de verdad: lo pedido, o lo que dejo puesto quien administra. */
export interface Resolved {
  provider: StoredProvider;
  model: AiModel;
  thinking: AiThinking;
}

/**
 * Decide con que se atiende.
 *
 * Lo que pide quien construye manda, pero solo si existe: un modelo que se
 * quito de los ajustes no puede dejar la peticion sin atender, asi que se cae
 * en lo que este puesto por defecto.
 */
export function resolveChoice(cfg: StoredConfig, choice?: Partial<AiChoice>): Resolved {
  const picked = findModel(cfg, choice) ?? findModel(cfg, cfg.fallback);
  if (!picked) throw new HttpError(400, AI_MISSING);
  if (!picked.provider.apiKey) {
    throw new HttpError(
      400,
      `El servidor de IA "${picked.provider.name || picked.provider.id}" no tiene clave. Entra a Ajustes para ponerla.`,
    );
  }

  const asked = isThinking(choice?.thinking) ? choice.thinking : cfg.fallback.thinking;
  return {
    provider: picked.provider,
    model: picked.model,
    // Un nivel que el modelo no ofrece no es una peticion mal escrita: es un
    // ajuste que se quedo viejo. Se baja al mas parecido en vez de fallar.
    thinking: aiNearestThinking(picked.model, asked),
  };
}

/**
 * Como se le pide pensar a un servidor que habla el formato de ChatGPT.
 *
 * OpenRouter lo recibe en su propio bloque `reasoning`, que es lo que sabe
 * repartir entre las marcas que enruta; los demas entienden el
 * `reasoning_effort` de ChatGPT. Sin nivel no se manda nada: hay servidores
 * que rechazan el campo aunque venga vacio.
 *
 * llama.cpp es distinto: no se le pregunta que nombres declara su plantilla,
 * se le manda lo mismo que manda su propia interfaz --un tope de tokens, mas
 * el interruptor `enable_thinking`, mas `reasoning_control` para poder cortar
 * el pensamiento en marcha--. Por defecto piensa siempre, asi que apagarlo hay
 * que decirlo expresamente, tambien cuando se elige "sin pensar".
 */
function thinkingField(cfg: Resolved): Record<string, unknown> {
  if (cfg.model.thinkingBudget) {
    const on = cfg.thinking !== AI_THINKING_OFF;
    return {
      chat_template_kwargs: { enable_thinking: on },
      ...(on ? { thinking_budget_tokens: AI_THINKING_BUDGET_TOKENS[cfg.thinking] ?? -1 } : {}),
      reasoning_control: true,
    };
  }
  if (cfg.thinking === AI_THINKING_OFF) return {};
  return cfg.provider.provider === "openrouter"
    ? { reasoning: { effort: cfg.thinking } }
    : { reasoning_effort: cfg.thinking };
}

/**
 * Lo que se le deja pensar, en ideas, a un modelo de Claude.
 *
 * El presupuesto tiene que caber dentro de lo que puede escribir --si no, el
 * servidor rechaza la peticion-- y dejar sitio para la respuesta. Un modelo con
 * un tope demasiado corto se queda sin pensar en vez de fallar.
 */
function thinkingBudget(model: AiModel, thinking: AiThinking): number {
  if (thinking === AI_THINKING_OFF) return 0;
  const room = model.maxTokens - MIN_BUDGET;
  if (room < MIN_BUDGET) return 0;
  const wanted = THINKING_BUDGET[aiThinkingRank(thinking)] ?? MIN_BUDGET;
  return Math.min(wanted, room);
}

/* ------------------------------------------------------------------ */
/* Proveedores                                                          */
/* ------------------------------------------------------------------ */

/**
 * Una imagen que viaja con la primera peticion.
 *
 * Es lo unico de un adjunto que no cabe en el texto del contexto: el resto de
 * los archivos --HTML, CSS, una hoja de calculo ya en CSV-- se cuentan con
 * palabras, y una imagen hay que ensenarla. Va en bloques de contenido, que es
 * como la reciben los dos formatos de proveedor.
 */
export interface PromptImage {
  /** El tipo MIME, tal cual: `image/png`, `image/jpeg`. */
  mime: string;
  /** El contenido en base64, sin el prefijo `data:`. */
  data: string;
}

/**
 * Un turno anterior de la conversacion, tal como se le vuelve a poner delante.
 *
 * Solo el texto: lo que se escribio y lo que se respondio. Ni razonamiento ni
 * llamadas a herramientas --ver `priorTurns` en `server/aiPage.ts`--, que es lo
 * que hace que valga igual para los dos formatos de proveedor.
 */
export interface PriorTurn {
  role: "user" | "assistant";
  text: string;
}

/** Una orden que el modelo puede pedir. Que hace, lo decide quien la define. */
export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Lo que el modelo tuvo delante y lo que escribio, en un turno. */
export interface TurnUsage {
  input: number;
  output: number;
}

export interface Turn {
  text: string;
  calls: ToolCall[];
  /** Lo que penso el modelo, si su servidor lo dejo escrito. */
  reasoning?: string;
  /** Cuanto contexto ocupo el turno, si su servidor lo conto. */
  usage?: TurnUsage;
  /**
   * Lo que hubo que ceder para que el turno saliera adelante. La peticion se
   * atendio igual, pero no entera: quien la hizo tiene que enterarse.
   */
  notice?: string;
}

/** Lo que el proveedor esta soltando mientras piensa y escribe. */
export type TurnProgress =
  { tipo: "texto"; texto: string } | { tipo: "razonamiento"; texto: string };

export interface Conversation {
  /** Con que se esta atendiendo: para poder decirlo y para medir el contexto. */
  readonly with: Resolved;
  /**
   * Pide lo que sigue. Mientras el modelo piensa y escribe, llama a
   * `onProgress` con cada fragmento para que se pueda mostrar en vivo; al
   * terminar devuelve el turno completo.
   */
  ask(onProgress?: (ev: TurnProgress) => void): Promise<Turn>;
  reply(results: { id: string; output: string }[]): void;
  /**
   * Pone un mensaje mas en la conversacion, como si lo escribiera quien pide.
   *
   * Es para lo que el modelo no llego a pedir y aun asi tiene que ver --una
   * revision forzada al cerrar el turno--: un resultado de herramienta no
   * sirve ahi, porque nombra una llamada que el modelo nunca hizo.
   */
  say(text: string): void;
  /**
   * Todo lo que se le mandaria al proveedor ahora mismo, para el modo debug.
   * No dispara nada: solo lee lo que ya esta armado.
   */
  dump(): { model: string; system: string; tools: unknown[]; messages: unknown[] };
}

const callId = () => Math.random().toString(36).slice(2, 10);

/** Claude, a traves del SDK oficial de Anthropic. */
function anthropicConversation(
  cfg: Resolved,
  system: string,
  prompt: string,
  TOOLS: ToolDef[],
  signal?: AbortSignal,
  images: PromptImage[] = [],
  history: PriorTurn[] = [],
): Conversation {
  const baseUrl = resolveBaseUrl(cfg.provider);
  const client = new Anthropic({
    apiKey: cfg.provider.apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });
  /*
   * Las imagenes van delante del texto y no detras: el modelo lee la peticion
   * ya sabiendo que tiene delante, en vez de encontrarse las imagenes despues
   * de haberla entendido sin ellas.
   */
  const messages: Anthropic.MessageParam[] = [
    // Los turnos anteriores van delante, en el orden en que ocurrieron: la
    // peticion de ahora se lee sabiendo de que se venia hablando.
    ...history.map((turn) => ({ role: turn.role, content: turn.text })),
    {
      role: "user" as const,
      content: images.length
        ? [
            ...images.map((image) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: image.mime as "image/png",
                data: image.data,
              },
            })),
            { type: "text" as const, text: prompt },
          ]
        : prompt,
    },
  ];
  const tools: Anthropic.Tool[] = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.schema as Anthropic.Tool.InputSchema,
  }));
  const budget = thinkingBudget(cfg.model, cfg.thinking);

  return {
    with: cfg,

    dump: () => ({ model: cfg.model.id, system, tools, messages }),

    async ask(onProgress) {
      /*
       * Se pide la respuesta en streaming y se va contando lo que llega: el
       * texto segun se escribe y las ideas segun se piensan. Asi quien mira lo
       * ve avanzar en vez de esperar a que el modelo termine un turno entero.
       */
      const stream = client.messages.stream(
        {
          model: cfg.model.id,
          max_tokens: cfg.model.maxTokens,
          system,
          tools,
          messages,
          ...(budget ? { thinking: { type: "enabled" as const, budget_tokens: budget } } : {}),
        },
        // Detener la peticion corta tambien lo que el modelo este escribiendo:
        // esperar a que termine el turno seria no detener nada.
        signal ? { signal } : undefined,
      );
      // `snapshot` es todo lo que se lleva escrito del fragmento: se manda asi,
      // acumulado, para no encadenar trocitos en el cliente.
      stream.on("text", (_delta, snapshot) => onProgress?.({ tipo: "texto", texto: snapshot }));
      stream.on("thinking", (_delta, snapshot) =>
        onProgress?.({ tipo: "razonamiento", texto: snapshot }),
      );

      const response = await stream.finalMessage().catch((err: unknown) => {
        throw new HttpError(502, readableProviderError(err));
      });

      if (response.stop_reason === "refusal") {
        throw new HttpError(400, "El modelo no quiso responder a esta petición.");
      }

      // Se devuelve el contenido completo: los bloques de razonamiento
      // deben viajar de vuelta tal cual llegaron.
      messages.push({ role: "assistant", content: response.content });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      const calls = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          name: b.name,
          input: (b.input ?? {}) as Record<string, unknown>,
        }));

      // El razonamiento vive en los bloques `thinking`. Los `redacted_thinking`
      // llegan cifrados y no se pueden leer, asi que no se muestran.
      const reasoning = response.content
        .filter((b): b is Anthropic.ThinkingBlock => b.type === "thinking")
        .map((b) => b.thinking)
        .join("\n")
        .trim();

      return {
        text,
        calls,
        reasoning: reasoning || undefined,
        usage: {
          // Lo leido de la memoria del proveedor tambien ocupa sitio delante:
          // sin sumarlo, una conversacion larga pareceria caber en nada.
          input:
            response.usage.input_tokens +
            (response.usage.cache_read_input_tokens ?? 0) +
            (response.usage.cache_creation_input_tokens ?? 0),
          output: response.usage.output_tokens,
        },
      };
    },

    reply(results) {
      messages.push({
        role: "user",
        content: results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.id,
          content: r.output,
        })),
      });
    },

    say(text) {
      messages.push({ role: "user", content: text });
    },
  };
}

/**
 * Si el servidor rechazo la peticion por las imagenes que llevaba.
 *
 * Que un modelo mire imagenes es una casilla de sus ajustes, y una casilla es
 * lo que alguien dijo, no lo que el modelo hace. Cuando lo que dice la casilla
 * y lo que hace el modelo no coinciden, quien lo sabe es el servidor, y lo
 * dice al rechazar: unos nombrando la imagen y otros diciendo solo que ahi
 * dentro nada mas cabe texto. Se reconocen las dos formas.
 */
const IMAGE_REJECTED = [
  /allowed values[^\n]*text/i,
  /image[^.\n]*\b(not supported|unsupported|invalid)/i,
  /\b(not supported|unsupported|invalid)[^.\n]*\bimage/i,
  /does not support[^.\n]*(image|vision|multimodal)/i,
];

/** Lo que se dice cuando la peticion salio adelante, pero sin las imagenes. */
const WITHOUT_IMAGES =
  "El modelo elegido no mira imágenes: se atendió la petición sin ellas. " +
  "Quita «Ve imágenes» en sus ajustes, o elige un modelo con visión.";

/** El mensaje con el que el servidor explico el fallo, si lo explico. */
const failureText = (body: unknown) =>
  (body as { error?: { message?: string } } | null)?.error?.message ?? "";

/** ChatGPT y cualquier servidor que hable su mismo formato. */
function openAiConversation(
  cfg: Resolved,
  system: string,
  prompt: string,
  TOOLS: ToolDef[],
  signal?: AbortSignal,
  images: PromptImage[] = [],
  history: PriorTurn[] = [],
): Conversation {
  const base = resolveBaseUrl(cfg.provider);
  /*
   * La peticion se guarda aparte de la lista porque puede hacer falta
   * rehacerla: si el servidor rechaza las imagenes, se le quitan y se vuelve a
   * preguntar. Es el unico mensaje al que le pasa.
   */
  const asked: Record<string, unknown> = {
    role: "user",
    content: images.length
      ? [
          ...images.map((image) => ({
            type: "image_url",
            image_url: { url: `data:${image.mime};base64,${image.data}` },
          })),
          { type: "text", text: prompt },
        ]
      : prompt,
  };
  const messages: Record<string, unknown>[] = [
    { role: "system", content: system },
    // Los turnos anteriores van delante, en el orden en que ocurrieron.
    ...history.map((turn) => ({ role: turn.role, content: turn.text })),
    asked,
  ];

  /** Dejar la peticion en solo texto. Dice si habia imagenes que quitar. */
  const dropImages = (): boolean => {
    if (!Array.isArray(asked.content)) return false;
    asked.content = prompt;
    return true;
  };
  const tools = TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.schema },
  }));

  return {
    with: cfg,

    dump: () => ({ model: cfg.model.id, system, tools, messages }),

    async ask(onProgress) {
      const send = () =>
        fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cfg.provider.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model.id,
            ...maxTokensField(base, cfg.model.maxTokens),
            messages,
            tools,
            tool_choice: "auto",
            stream: true,
            // El recuento no viaja en el streaming si no se pide: hay que
            // pedirlo aqui o no habria contra que medir el contexto.
            stream_options: { include_usage: true },
            ...thinkingField(cfg),
          }),
          // Detener la peticion corta tambien lo que el modelo este escribiendo.
          ...(signal ? { signal } : {}),
        });

      let res = await send();
      let failed = res.ok ? null : ((await res.json().catch(() => null)) as unknown);
      /*
       * Adjuntar mal no puede tumbar una peticion, y una casilla mal puesta
       * tampoco. Si lo que sobraba eran las imagenes, se quitan y se pregunta
       * otra vez: se pierde lo que la imagen aportaba, no la peticion. Una sola
       * vez, porque la segunda ya va sin ellas.
       */
      let notice: string | undefined;
      if (failed && IMAGE_REJECTED.some((rule) => rule.test(failureText(failed))) && dropImages()) {
        notice = WITHOUT_IMAGES;
        res = await send();
        failed = res.ok ? null : ((await res.json().catch(() => null)) as unknown);
      }
      if (!res.ok || !res.body) {
        throw new HttpError(
          res.status === 401 ? 401 : 502,
          failureText(failed) || `El servidor de IA respondió ${res.status}`,
        );
      }

      /*
       * La respuesta llega en fragmentos (SSE). Se van juntando el texto, las
       * ideas y las llamadas a herramientas --que llegan partidas-- para tener
       * el turno entero al cerrar.
       */
      let text = "";
      let reasoning = "";
      let usage: TurnUsage | undefined;
      const calls: { index: number; id: string; name: string; args: string }[] = [];

      function onEvent(event: Record<string, unknown>) {
        const counted = event.usage as
          { prompt_tokens?: number; completion_tokens?: number } | undefined;
        if (counted) {
          usage = {
            input: Number(counted.prompt_tokens ?? 0),
            output: Number(counted.completion_tokens ?? 0),
          };
        }
        const delta = ((event.choices as Record<string, unknown>[] | undefined)?.[0]?.delta ??
          {}) as Record<string, unknown>;
        const piece = String(delta.content ?? "");
        if (piece) {
          text += piece;
          onProgress?.({ tipo: "texto", texto: text });
        }
        const thought = String(delta.reasoning_content ?? delta.reasoning ?? "");
        if (thought) {
          reasoning += thought;
          onProgress?.({ tipo: "razonamiento", texto: reasoning });
        }
        const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
        for (const tc of toolCalls) {
          const raw = tc as Record<string, unknown>;
          const fn = (raw.function ?? {}) as { name?: string; arguments?: string };
          const idx = Number(raw.index ?? calls.length);
          const existing = calls.find((c) => c.index === idx);
          if (existing) {
            existing.id += String(raw.id ?? "");
            existing.name += String(fn.name ?? "");
            existing.args += String(fn.arguments ?? "");
          } else {
            calls.push({
              index: idx,
              id: String(raw.id ?? callId()),
              name: String(fn.name ?? ""),
              args: String(fn.arguments ?? ""),
            });
          }
        }
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        let cut = buffer.indexOf("\n\n");
        while (cut !== -1) {
          const chunk = buffer.slice(0, cut).trim();
          buffer = buffer.slice(cut + 2);
          if (chunk.startsWith("data:")) {
            const payload = chunk.slice(5).trim();
            if (payload === "[DONE]") continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(payload) as Record<string, unknown>;
            } catch {
              continue;
            }
            onEvent(event);
          }
          cut = buffer.indexOf("\n\n");
        }
      }

      const done = calls.map((c) => {
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(c.args || "{}");
        } catch {
          input = {};
        }
        return { id: c.id, name: c.name, input };
      });

      messages.push({
        role: "assistant",
        content: text || null,
        ...(done.length
          ? {
              tool_calls: done.map((c) => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      });

      return {
        text: text.trim(),
        calls: done,
        reasoning: reasoning.trim() || undefined,
        usage,
        ...(notice ? { notice } : {}),
      };
    },

    reply(results) {
      for (const r of results) {
        messages.push({ role: "tool", tool_call_id: r.id, content: r.output });
      }
    },

    say(text) {
      messages.push({ role: "user", content: text });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Abrir una conversacion con herramientas                              */
/* ------------------------------------------------------------------ */

/**
 * Prepara una conversacion con el proveedor elegido. Quien la abre pone el
 * texto de sistema, la primera peticion y las herramientas; el bucle de rondas
 * tambien es suyo, porque solo el sabe cuando parar.
 *
 * Con `signal`, pararlo corta la llamada al proveedor a mitad. Quien llama
 * tiene que mirar la senal para no confundir ese corte con un fallo.
 */
export async function startConversation(
  system: string,
  prompt: string,
  tools: ToolDef[],
  opts: {
    signal?: AbortSignal;
    choice?: Partial<AiChoice>;
    images?: PromptImage[];
    /** Los turnos anteriores de la conversacion, del mas viejo al mas nuevo. */
    history?: PriorTurn[];
  } = {},
): Promise<Conversation> {
  const cfg = await loadAiConfig();
  if (!cfg.enabled) throw new HttpError(400, AI_MISSING);
  const picked = resolveChoice(cfg, opts.choice);

  // Un modelo sin vista no sabe que hacer con una imagen, y hay servidores que
  // rechazan la peticion entera por llevarla. Se suelta y ya: lo demas del
  // adjunto --su nombre, que se adjunto-- sigue contado en el contexto.
  const images = picked.model.vision ? (opts.images ?? []) : [];

  const history = opts.history ?? [];
  return speaksAnthropic(picked.provider.provider)
    ? anthropicConversation(picked, system, prompt, tools, opts.signal, images, history)
    : openAiConversation(picked, system, prompt, tools, opts.signal, images, history);
}

/**
 * Un proveedor tal y como llega del formulario, listo para hablarle.
 *
 * Se usa para todo lo que hay que hacer contra un servidor antes de guardarlo
 * --probarlo, mirar su catalogo--: lo que se prueba es lo que se esta
 * escribiendo, no lo que hay guardado. La clave es la excepcion: si el campo
 * viene vacio es que no se toco, asi que se usa la que ya estaba.
 */
export async function providerFromInput(
  input: Partial<StoredProvider> | undefined,
  /**
   * Si sin clave no hay nada que hacer. Mirar un catalogo publico no la
   * necesita, y pedirla ahi obligaria a tenerla a mano solo para ver que
   * modelos existen.
   */
  needsKey = true,
): Promise<{ provider: StoredProvider; base: string }> {
  const asked = readProvider(input ?? {});
  if (!asked) throw new HttpError(400, "Elige qué clase de servidor es antes de probarlo.");

  const current = await loadAiConfig();
  const before = current.providers.find((p) => p.id === asked.id);
  const provider: StoredProvider = {
    ...asked,
    apiKey: asked.apiKey || (before?.apiKey ?? ""),
  };
  if (needsKey && !provider.apiKey) throw new HttpError(400, "Falta la clave del servidor de IA.");

  return { provider, base: resolveBaseUrl(provider) };
}

/**
 * Comprobacion rapida de que un servidor y un modelo sirven. Recibe lo que hay
 * en el formulario para poder probar antes de guardar.
 */
export async function testAiConfig(input: {
  provider?: Partial<StoredProvider>;
  model?: string;
}): Promise<{ ok: true; model: string }> {
  const { provider, base } = await providerFromInput(input.provider);

  const model =
    provider.models.find((m) => m.id === input.model) ??
    provider.models[0] ??
    AI_SUGGESTED[provider.provider][0];
  if (!model) throw new HttpError(400, "Añade un modelo antes de probar la conexión.");

  if (speaksAnthropic(provider.provider)) {
    const client = new Anthropic({
      apiKey: provider.apiKey,
      ...(base ? { baseURL: base } : {}),
    });
    try {
      await client.messages.create({
        model: model.id,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with just: ok" }],
      });
    } catch (err) {
      throw new HttpError(400, readableProviderError(err));
    }
    return { ok: true, model: model.id };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: model.id,
        ...maxTokensField(base, 16),
        messages: [{ role: "user", content: "Reply with just: ok" }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, `No se pudo conectar con ${base}. ${detail}`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new HttpError(
      400,
      (body as { error?: { message?: string } })?.error?.message ??
        `El servidor respondió ${res.status}`,
    );
  }
  return { ok: true, model: model.id };
}

/* ------------------------------------------------------------------ */
/* Una pregunta suelta, sin herramientas                                */
/* ------------------------------------------------------------------ */

/** Si hay un servidor de IA conectado, encendido y con un modelo que usar. */
export async function aiEnabled(): Promise<boolean> {
  const cfg = await loadAiConfig();
  if (!cfg.enabled) return false;
  try {
    resolveChoice(cfg);
    return true;
  } catch {
    return false;
  }
}

/** El mismo aviso en todos los sitios donde hace falta la IA y no esta. */
export const AI_MISSING =
  "Todavía no hay un servidor de IA configurado. Entra a Ajustes para conectarlo.";

/**
 * Una sola pregunta, una sola respuesta de texto.
 *
 * La varita magica trabaja asi: cada paso manda un trozo del archivo y
 * recibe ese mismo trozo reescrito. No hace falta la rueda de herramientas
 * que usa la generacion de pantallas.
 *
 * Va siempre con el modelo que este puesto por defecto: son peticiones que
 * nadie pide a mano, asi que no hay quien elija.
 */
export async function askAi(system: string, prompt: string, maxTokens = 8000): Promise<string> {
  const cfg = await loadAiConfig();
  if (!cfg.enabled) throw new HttpError(400, AI_MISSING);
  const picked = resolveChoice(cfg);
  const base = resolveBaseUrl(picked.provider);
  // Nunca por encima de lo que el modelo puede escribir: quien llama pide lo
  // que le cabe a su tarea, no lo que soporta el servidor.
  const max = Math.min(maxTokens, picked.model.maxTokens);

  if (speaksAnthropic(picked.provider.provider)) {
    const client = new Anthropic({
      apiKey: picked.provider.apiKey,
      ...(base ? { baseURL: base } : {}),
    });
    const response = await client.messages
      .create({
        model: picked.model.id,
        max_tokens: max,
        system,
        messages: [{ role: "user", content: prompt }],
      })
      .catch((err: unknown) => {
        throw new HttpError(502, readableProviderError(err));
      });

    if (response.stop_reason === "refusal") {
      throw new HttpError(400, "El modelo no quiso responder a esta petición.");
    }
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${picked.provider.apiKey}`,
      },
      body: JSON.stringify({
        model: picked.model.id,
        ...maxTokensField(base, max),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (err) {
    // Si el servidor de IA no responde, hay que decir cual y por que: es lo
    // unico que le sirve a quien tiene que ir a arreglarlo.
    const detail = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, `No se pudo conectar con ${base}. ${detail}`);
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      (payload as { error?: { message?: string } })?.error?.message ??
      `El servidor de IA respondió ${res.status}`;
    throw new HttpError(res.status === 401 ? 401 : 502, detail);
  }

  const message = (payload as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
    ?.message;
  if (!message) throw new HttpError(502, "El servidor de IA devolvió una respuesta vacía.");
  return String(message.content ?? "").trim();
}

function readableProviderError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "La clave no es válida.";
  if (err instanceof Anthropic.NotFoundError)
    return "Ese modelo no existe o la cuenta no tiene acceso.";
  if (err instanceof Anthropic.RateLimitError)
    return "El servidor está ocupado. Inténtalo de nuevo.";
  if (err instanceof Anthropic.APIConnectionError)
    return "No se pudo conectar con el servidor de IA. Revisa la dirección en Ajustes.";
  if (err instanceof Anthropic.APIError) return err.message;
  return "No se pudo conectar con el servidor de IA.";
}
