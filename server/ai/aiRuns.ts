/**
 * Las peticiones a la IA que estan en marcha.
 *
 * Una petición no vive en la conexion que la pidio, vive aquí. El navegador se
 * puede recargar, cerrar o irse a otra parte y la petición sigue su curso; al
 * volver a la misma página, quien construye se engancha otra vez a la misma y
 * recibe de golpe lo que se perdio.
 *
 * Lo visto se guarda resumido, no evento a evento: el texto y el razonamiento
 * llegan como fotos completas --cada aviso trae todo lo escrito hasta ese
 * momento-- así que basta con quedarse con la ultima. De lo contrario la
 * memoria creceria con cada fragmento de cada petición.
 *
 * Hay como mucho una petición por página: dos a la vez escribirian sobre el
 * mismo documento.
 *
 * Es memoria de este proceso, no de la base de datos. Si el servidor se
 * reinicia, lo que estaba en marcha se pierde; el panel se entera porque al
 * preguntar por la petición ya no hay ninguna.
 */
import type { AiActiveRun, AiProgress, AiRunInfo, AiStep, AiUsage } from "../../shared/types.ts";

/** Cuanto se conserva una petición terminada, esperando a que alguien la recoja. */
const KEEP_DONE = 10 * 60_000;

/** Tope de seguridad: una petición que lleve viva mas de esto ya no cuenta. */
const MAX_LIFE = 60 * 60_000;

export interface AiRun {
  id: string;
  appId: string;
  pageId: string;
  prompt: string;
  started: number;
  finished: number;
  /** Lo ultimo que la IA lleva escrito. */
  text: string;
  /** Lo ultimo que la IA lleva pensado. */
  reasoning: string;
  steps: AiStep[];
  /** Lo ultimo que se sabe del contexto gastado. */
  usage: AiUsage | null;
  /** El final, cuando llega: `fin` o `error`. Solo hay uno. */
  ending: AiProgress | null;
  done: boolean;
  /** Se pidio pararla: la petición corta por el primer sitio seguro. */
  stop: AbortController;
  watchers: Set<(event: AiProgress) => void>;
}

const runs = new Map<string, AiRun>();

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** La petición de una página: la que sigue o la que acaba de terminar. */
export function pageRun(appId: string, pageId: string): AiRun | null {
  sweep();
  for (const run of runs.values()) {
    if (run.appId === appId && run.pageId === pageId) return run;
  }
  return null;
}

/**
 * Las páginas de una aplicación donde la IA esta trabajando ahora mismo.
 *
 * Solo las que siguen: una terminada se conserva diez minutos esperando a que
 * alguien recoja su resultado, y eso no es trabajo en curso --encenderia la
 * senal diez minutos de mas--.
 */
export function activeRuns(appId: string): AiActiveRun[] {
  sweep();
  const out: AiActiveRun[] = [];
  for (const run of runs.values()) {
    if (run.appId !== appId || run.done) continue;
    out.push({ page: run.pageId, started: new Date(run.started).toISOString() });
  }
  return out;
}

export function startRun(opts: { appId: string; pageId: string; prompt: string }): AiRun {
  sweep();
  // La de antes ya no le sirve a nadie: la nueva escribe sobre lo mismo.
  const previous = pageRun(opts.appId, opts.pageId);
  if (previous) runs.delete(previous.id);

  const run: AiRun = {
    id: uid(),
    appId: opts.appId,
    pageId: opts.pageId,
    prompt: opts.prompt,
    started: Date.now(),
    finished: 0,
    text: "",
    reasoning: "",
    steps: [],
    usage: null,
    ending: null,
    done: false,
    stop: new AbortController(),
    watchers: new Set(),
  };
  runs.set(run.id, run);
  return run;
}

/** Cuenta algo nuevo: se guarda para quien llegue tarde y se reparte a quien mira. */
export function pushRun(run: AiRun, event: AiProgress): void {
  if (run.done) return;

  if (event.tipo === "texto") run.text = event.texto;
  else if (event.tipo === "razonamiento") run.reasoning = event.texto;
  else if (event.tipo === "paso") run.steps.push(event.paso);
  else if (event.tipo === "uso") run.usage = event.uso;
  else if (event.tipo === "fin" || event.tipo === "error") {
    run.ending = event;
    run.done = true;
    run.finished = Date.now();
  }

  for (const watch of [...run.watchers]) watch(event);
  if (run.done) run.watchers.clear();
}

/** Todo lo visto hasta ahora, en forma de avisos: para quien se acaba de enganchar. */
export function replayRun(run: AiRun): AiProgress[] {
  const out: AiProgress[] = [];
  if (run.reasoning) out.push({ tipo: "razonamiento", texto: run.reasoning });
  if (run.text) out.push({ tipo: "texto", texto: run.text });
  for (const paso of run.steps) out.push({ tipo: "paso", paso });
  if (run.usage) out.push({ tipo: "uso", uso: run.usage });
  if (run.ending) out.push(run.ending);
  return out;
}

/** Mirar lo que vaya pasando. Devuelve como dejar de mirar. */
export function watchRun(run: AiRun, watch: (event: AiProgress) => void): () => void {
  run.watchers.add(watch);
  return () => {
    run.watchers.delete(watch);
  };
}

/** Lo que el panel necesita saber para reconocer la petición al volver. */
export const runInfo = (run: AiRun): AiRunInfo => ({
  id: run.id,
  prompt: run.prompt,
  started: new Date(run.started).toISOString(),
  done: run.done,
});

/** Quita las terminadas hace rato y las que llevan vivas demasiado tiempo. */
function sweep(): void {
  const now = Date.now();
  for (const [id, run] of runs) {
    const stale = run.done ? now - run.finished > KEEP_DONE : now - run.started > MAX_LIFE;
    if (stale) runs.delete(id);
  }
}
