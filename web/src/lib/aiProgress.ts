/**
 * El avance de una petición a la IA, mientras dura.
 *
 * Vive aparte del panel porque lo escribe quien escucha el hilo de avisos y lo
 * lee quien lo dibuja, que son dos componentes distintos.
 */
import type { AiStep } from "@shared/types";

export interface Progress {
  text: string;
  /** Cada paso lleva su número, para no reordenarse cuando la lista crece. */
  steps: { id: number; step: AiStep }[];
  /** Lo que la IA lleva pensado en la ronda que todavía esta en marcha. */
  reasoning: string;
  /**
   * Lo pensado en rondas ya cerradas, una por una y en orden.
   *
   * Cada ronda del modelo piensa desde cero: lo que suelta no continua lo de
   * la ronda anterior, la reemplaza. Por eso, en cuanto empieza una herramienta
   * --senal de que la ronda que pensaba ya cerro-- ese pensamiento se guarda
   * aquí tal cual quedo, en vez de dejar que el siguiente lo borre.
   */
  reasoningLog: { id: number; text: string }[];
  /** El contexto tal y como se le mando al modelo, si se pidio verlo. */
  context: string;
}

export const NO_PROGRESS: Progress = {
  text: "",
  steps: [],
  reasoning: "",
  reasoningLog: [],
  context: "",
};

/** La ultima línea escrita: lo ultimo que la IA lleva pensado. */
export function latestLine(text: string): string {
  const visible = text.trimEnd();
  const cut = visible.lastIndexOf("\n");
  return cut === -1 ? visible : visible.slice(cut + 1);
}

/** Los pasos vistos, listos para quedarse en la conversación. */
export const taken = (p: Progress): AiStep[] | undefined =>
  p.steps.length ? p.steps.map((e) => e.step) : undefined;

/** Hay algo que ensenar de lo que la petición lleva hecho. */
export const hasProgress = (p: Progress): boolean =>
  !!p.text || p.steps.length > 0 || !!p.reasoning || p.reasoningLog.length > 0 || !!p.context;

/** Un pensamiento ya cerrado o un paso dado, en el orden en que pasaron. */
export type TimelineItem =
  { id: number; kind: "thought"; text: string } | { id: number; kind: "step"; step: AiStep };

/**
 * Cada ronda pensada junto a lo que hizo justo después, en el orden en que de
 * verdad ocurrieron: no todo el pensamiento delante y todos los pasos detras.
 * Los identificadores de ambos salen de la misma cuenta, así que ordenarlos
 * juntos basta para no mezclar el orden.
 */
export function timelineOf(p: Progress): TimelineItem[] {
  return [
    ...p.reasoningLog.map((t) => ({ id: t.id, kind: "thought" as const, text: t.text })),
    ...p.steps.map((s) => ({ id: s.id, kind: "step" as const, step: s.step })),
  ].sort((a, b) => a.id - b.id);
}

/** Cuanto lleva trabajando, en corto: "7s" hasta el minuto, luego "1:23". */
export function elapsedLabel(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}
