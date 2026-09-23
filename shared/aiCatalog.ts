/**
 * Lo que se sabe de antemano de cada clase de servidor de IA.
 *
 * No es una lista cerrada: cualquier modelo se puede escribir a mano, con su
 * tope y su ventana. Esto es solo lo que se ofrece ya escrito para no tener que
 * buscarlo, y lo que se usa al conectar un servidor por primera vez.
 *
 * Los servidores con catálogo --hoy OpenRouter-- no necesitan nada de esto:
 * sus modelos se leen de su propia lista, con sus medidas de verdad.
 */
import {
  AI_THINKING_DEFAULT,
  AI_THINKING_OFF,
  type AiConfigView,
  type AiModel,
  type AiProvider,
  type AiProviderConfig,
  type AiThinking,
} from "./types.ts";

export const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT o compatible",
  openrouter: "OpenRouter",
  llamacpp: "llama.cpp",
};

/** Una frase de que es cada clase de servidor, para elegir sin saber de esto. */
export const AI_PROVIDER_ABOUT: Record<AiProvider, string> = {
  anthropic: "El servidor oficial de Claude.",
  openai: "Cualquier servidor con el formato de ChatGPT: Ollama, LM Studio, vLLM.",
  openrouter: "Cientos de modelos de muchas marcas con una sola clave.",
  llamacpp: "Un modelo GGUF corriendo en tu maquina con llama-server.",
};

export const AI_PROVIDER_HINT: Record<AiProvider, { base: string; key: string }> = {
  anthropic: {
    base: "Déjalo vacío para usar el servidor oficial de Anthropic.",
    key: "Empieza por sk-ant-",
  },
  openai: {
    base: "Dirección del servidor, terminada en /v1. Sirve para ChatGPT, Ollama, LM Studio y otros.",
    key: "La clave que entrega tu servidor.",
  },
  openrouter: {
    base: "Déjalo vacío para usar la dirección oficial de OpenRouter.",
    key: "Empieza por sk-or-",
  },
  llamacpp: {
    base: "Dirección de tu llama-server, terminada en /v1. Por ejemplo: http://localhost:8080/v1",
    key: "Vacía, si no le pusiste ninguna a llama-server.",
  },
};

/** La dirección oficial de cada clase, cuando la tiene. */
export const AI_PROVIDER_BASE: Record<AiProvider, string> = {
  anthropic: "",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  llamacpp: "",
};

/** Las clases que saben decir solas de que es capaz cada uno de sus modelos. */
export const aiHasCatalog = (provider: AiProvider) =>
  provider === "openrouter" || provider === "llamacpp";

/**
 * Como se llama en el panel cada nivel de los que se saben.
 *
 * La tabla no es la lista de niveles que existen --esa la pone cada servidor--
 * sino la traduccion de los nombres que ya se han visto. Uno que no este aquí
 * se muestra tal cual llego, que es mejor que esconderlo.
 *
 * Se dejan en ingles a propósito: son los nombres que usan las APIs de donde
 * vienen (OpenAI, OpenRouter, llama.cpp), y traducirlos los aleja de lo que
 * quien construye ve si mira la documentacion de su servidor.
 */
export const AI_THINKING_LABEL: Record<string, string> = {
  off: "Off",
  none: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

export const aiThinkingLabel = (level: AiThinking) => AI_THINKING_LABEL[level] ?? level;

export const AI_THINKING_HINT: Record<string, string> = {
  off: "Responde directo. Lo más rápido y lo más barato.",
  minimal: "Piensa lo justo antes de responder.",
  low: "Piensa un poco antes de responder.",
  medium: "Se detiene a pensar. Para cambios con varias partes.",
  high: "Piensa mucho. Para lo difícil, y tarda.",
  xhigh: "Piensa más todavía. Tarda bastante.",
  max: "Piensa todo lo que puede. Lo más lento y lo más caro.",
};

export const aiThinkingHint = (level: AiThinking) => AI_THINKING_HINT[level] ?? "";

/**
 * De menos a mas, para poder ordenar y comparar niveles que se llaman de
 * cualquier manera. Uno desconocido se pone en medio: es lo que menos se
 * equivoca cuando hay que elegir el mas parecido.
 */
const RANK: Record<string, number> = {
  off: 0,
  none: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  max: 6,
};

export const aiThinkingRank = (level: AiThinking) => RANK[level] ?? 3;

/**
 * Los niveles fijos de llama.cpp, para un modelo que piensa con tope de
 * tokens en vez de con un nombre que el declare.
 *
 * Son los mismos cinco que ofrece la interfaz propia de llama.cpp --Off, Low,
 * Medium, High, Max-- y no los de ningún modelo en concreto: el tope funciona
 * igual sepa o no la plantilla que existe, así que no hace falta preguntarle.
 */
export const AI_THINKING_BUDGET_LEVELS: AiThinking[] = ["off", "low", "medium", "high", "max"];

/** A cuantos tokens de pensamiento equivale cada nivel fijo. -1: sin tope. */
export const AI_THINKING_BUDGET_TOKENS: Record<string, number> = {
  low: 512,
  medium: 2048,
  high: 8192,
  max: -1,
};

/** Los nombres que se pueden marcar a mano, para un servidor sin catálogo. */
export const AI_THINKING_KNOWN: AiThinking[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

/**
 * Los niveles que se le pueden pedir a un modelo, de menos a mas.
 *
 * Un modelo que no sabe pensar solo tiene "sin pensar". Uno que no declara sus
 * niveles recibe los de siempre. Y si su lista no trae "sin pensar", es que
 * piensa siempre: ofrecerselo seria ofrecer algo que no va a hacer.
 */
export function aiThinkingLevels(model: Pick<AiModel, "thinking" | "efforts">): AiThinking[] {
  if (!model.thinking) return [AI_THINKING_OFF];
  const offered = model.efforts?.length ? model.efforts : AI_THINKING_DEFAULT;
  return [...offered].sort((a, b) => aiThinkingRank(a) - aiThinkingRank(b));
}

/** El nivel mas parecido al pedido de entre los que el modelo ofrece. */
export function aiNearestThinking(
  model: Pick<AiModel, "thinking" | "efforts">,
  wanted: AiThinking,
): AiThinking {
  const levels = aiThinkingLevels(model);
  if (levels.includes(wanted)) return wanted;
  // Se baja antes que subir: quien pidio poco no puede acabar pagando mucho.
  const order = aiThinkingRank(wanted);
  const below = levels.filter((l) => aiThinkingRank(l) < order).pop();
  return below ?? levels[0] ?? AI_THINKING_OFF;
}

/** Modelos conocidos de cada clase de servidor, con sus medidas. */
export const AI_SUGGESTED: Record<AiProvider, AiModel[]> = {
  anthropic: [
    {
      id: "claude-opus-5",
      label: "Claude Opus 5",
      maxTokens: 32000,
      contextWindow: 200000,
      thinking: true,
      efforts: [],
      vision: true,
    },
    {
      id: "claude-sonnet-5",
      label: "Claude Sonnet 5",
      maxTokens: 32000,
      contextWindow: 200000,
      thinking: true,
      efforts: [],
      vision: true,
    },
    {
      id: "claude-haiku-4-5",
      label: "Claude Haiku 4.5",
      maxTokens: 16000,
      contextWindow: 200000,
      thinking: true,
      efforts: [],
      vision: true,
    },
  ],
  openai: [
    {
      id: "gpt-5",
      label: "GPT-5",
      maxTokens: 32000,
      contextWindow: 400000,
      thinking: true,
      efforts: [],
      vision: true,
    },
    {
      id: "gpt-5-mini",
      label: "GPT-5 mini",
      maxTokens: 16000,
      contextWindow: 400000,
      thinking: true,
      efforts: [],
      vision: true,
    },
  ],
  // OpenRouter y llama.cpp tienen catálogo: sus modelos se buscan, no se adivinan.
  openrouter: [],
  llamacpp: [],
};

/** Un modelo recien anadido a mano: medidas prudentes que se pueden corregir. */
export const AI_NEW_MODEL: Omit<AiModel, "id"> = {
  label: "",
  maxTokens: 16000,
  contextWindow: 128000,
  thinking: false,
  efforts: [],
  vision: false,
};

/** Como se le llama a un servidor en el panel. */
export const aiProviderName = (provider: { name?: string; provider: AiProvider }) =>
  provider.name?.trim() || AI_PROVIDER_LABEL[provider.provider];

/** Como se le llama a un modelo en el panel. */
export const aiModelLabel = (model: { id: string; label?: string }) =>
  model.label?.trim() || model.id;

/** Un tamaño de contexto en corto, como se muestra en la lista: 200K, 1M. */
export function aiWindowLabel(tokens: number): string {
  if (!tokens) return "";
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${millions < 10 ? Number(millions.toFixed(1)) : Math.round(millions)}M`;
  }
  return `${Math.round(tokens / 1000)}K`;
}

/** Si a un servidor se le puede pedir algo ahora mismo. */
export const aiProviderReady = (provider: {
  enabled: boolean;
  hasKey?: boolean;
  models: unknown[];
}) => provider.enabled && provider.hasKey !== false && provider.models.length > 0;

/**
 * Si de verdad se le puede pedir algo a la IA.
 *
 * Encenderla no basta: hace falta al menos un servidor encendido, con su clave
 * puesta y con un modelo al que llamar. Sin eso, todo lo que la use se queda
 * esperando un error en vez de avisar antes.
 */
export const aiUsable = (cfg: AiConfigView | null | undefined): boolean =>
  !!cfg?.enabled && cfg.providers.some(aiProviderReady);

/** Un servidor recien conectado, todavía sin clave. */
export function aiNewProvider(kind: AiProvider, id: string): AiProviderConfig {
  return {
    id,
    name: AI_PROVIDER_LABEL[kind],
    provider: kind,
    baseUrl: "",
    // Se conecta con los modelos que ya se conocen: lo normal es querer esos, y
    // los que no se quieran se quitan de uno en uno. Los que tienen catálogo
    // empiezan vacios, porque ahi los modelos se buscan.
    models: AI_SUGGESTED[kind].map((m) => ({ ...m })),
    enabled: true,
  };
}
