/**
 * Las pruebas de dibujado que la IA pide a mitad de una petición.
 *
 * Aquí no hay navegador. El único sitio donde el HTML de una página se ejecuta
 * de verdad --con su puente, sus colores y sus datos-- es el navegador de quien
 * construye, así que la prueba se le pide a el: el servidor manda un aviso con
 * la huella del documento, quien este mirando lo dibuja en un marco escondido y
 * devuelve lo que la consola solto.
 *
 * Esto guarda ese hueco de espera. Es memoria de este proceso y no sobrevive a
 * un reinicio, igual que las peticiones en marcha.
 *
 * Si nadie contesta --el panel esta cerrado, la petición vino de otro sitio--
 * la espera vence y la IA se entera de que no se pudo probar. Nunca se queda
 * colgada: una petición no puede depender de que haya alguien mirando.
 */
import type { PageIssue, PageProbeReport } from "../../shared/types.ts";

/** Cuanto se espera una respuesta antes de darla por perdida. */
export const PROBE_TIMEOUT = 15_000;

interface Waiting {
  settle: (report: PageProbeReport | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

const waiting = new Map<string, Waiting>();

let counter = 0;
const uid = () => `probe${Date.now().toString(36)}${(++counter).toString(36)}`;

/**
 * Abre una espera y devuelve su identificador junto con la promesa.
 *
 * El identificador viaja al panel dentro del aviso; la promesa se resuelve
 * cuando el panel responde con ese mismo identificador, o con `null` cuando
 * vence el plazo.
 */
export function openProbe(timeoutMs = PROBE_TIMEOUT): {
  probeId: string;
  wait: Promise<PageProbeReport | null>;
} {
  const probeId = uid();
  let settle!: (report: PageProbeReport | null) => void;
  const wait = new Promise<PageProbeReport | null>((resolve) => {
    settle = (report) => {
      const entry = waiting.get(probeId);
      if (!entry) return;
      waiting.delete(probeId);
      clearTimeout(entry.timer);
      resolve(report);
    };
  });

  const timer = setTimeout(() => settle(null), timeoutMs);
  waiting.set(probeId, { settle, timer });
  return { probeId, wait };
}

/**
 * El panel termino de probar. Devuelve si había alguien esperando: una
 * respuesta que llega tarde, después de vencer el plazo, no vale para nada.
 */
export function closeProbe(report: PageProbeReport): boolean {
  const entry = waiting.get(report.probeId);
  if (!entry) return false;
  entry.settle(report);
  return true;
}

/** Cierra una espera sin resultado. Para cuando la petición se detiene. */
export function cancelProbe(probeId: string): void {
  waiting.get(probeId)?.settle(null);
}

/**
 * Limpia lo que llego: un documento roto puede soltar el mismo fallo miles de
 * veces, y lo que le sirve al modelo es la lista de fallos distintos.
 */
export function tidyIssues(issues: PageIssue[], max = 10): PageIssue[] {
  const out: PageIssue[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    const key = `${issue.tipo}|${issue.mensaje}|${issue.linea ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
    if (out.length >= max) break;
  }
  return out;
}
