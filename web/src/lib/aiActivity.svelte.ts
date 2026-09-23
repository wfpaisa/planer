/**
 * En que páginas de la aplicación esta trabajando la IA ahora mismo.
 *
 * La petición vive en el servidor y no en el dock: se pide en una página y
 * sigue su curso aunque se cambie a otra. Sin esto, al salir de esa página no
 * quedaria nada --ni que hay algo en marcha, ni sobre que página, ni como
 * volver-- y se podrian dejar dos trabajando sin saberlo.
 *
 * Es un modulo con runas y no un contexto, como el cursor o el dock: lo leen
 * el sidebar, la barra de dirección y el panel, que son tres ramas distintas
 * del árbol sin nadie en comun mas que la escena entera.
 *
 * Dos cosas lo llenan, y en este orden:
 *
 * 1. La ruta por aplicación, al entrar. Es la fuente de verdad: dice lo que el
 *    servidor tiene en marcha de verdad, y es lo que apaga la senal cuando el
 *    servidor se reinicio y ya no hay nada.
 * 2. Quien escucha el hilo de avisos de una petición, al empezar y al
 *    terminar. El hilo sobrevive a que el panel se desmonte, así que sigue
 *    contando lo que pasa en la página que quedo atras.
 *
 * Sondear cada pocos segundos seria trafico constante para un estado que el
 * hilo de avisos ya cuenta en el momento exacto en que cambia.
 */
import type { AiActiveRun, AiProgress } from "@shared/types";

import { api, stream } from "./pb";

/** Los ids de las páginas donde la IA trabaja. */
let working = $state<string[]>([]);
/** De que aplicación es lo que hay apuntado: cambiar de aplicación lo vacía. */
let scope = "";

/**
 * Las peticiones de otras páginas a las que esta pestana ya esta enganchada,
 * para no abrir dos hilos sobre la misma.
 */
const followed = new Set<string>();

export const aiActivity = {
  /** Las páginas donde la IA trabaja, por id. */
  get pages(): string[] {
    return working;
  },
  /** La primera que trabaja, o vacío. El panel bloquea contra esta. */
  get page(): string {
    return working[0] ?? "";
  },
  /** Hay algo en marcha en la aplicación. */
  get busy(): boolean {
    return working.length > 0;
  },
  /** La IA trabaja en esta página. */
  has(pageId: string): boolean {
    return working.includes(pageId);
  },
};

/** Apuntar o borrar que la IA trabaja en una página. */
export function setAiWorking(pageId: string, on: boolean): void {
  if (!pageId) return;
  const already = working.includes(pageId);
  if (on === already) return;
  working = on ? [...working, pageId] : working.filter((id) => id !== pageId);
}

/** Empezar de cero. Al cambiar de aplicación lo de la anterior no cuenta. */
export function resetAiActivity(): void {
  working = [];
  followed.clear();
  scope = "";
}

/**
 * Preguntar al servidor que hay en marcha y engancharse a lo que no se este
 * mirando ya.
 *
 * Se llama al entrar en la aplicación. Sin el segundo paso la senal viviria
 * solo hasta la primera recarga: el hilo que la mantenia al dia se corto con
 * la ventana anterior, y nadie volveria a contar que la petición termino.
 *
 * `skip` es la página que se tiene abierta: de esa se encarga el panel, que
 * ademas la enseña avanzando. Engancharse aquí también no rompe nada --el
 * servidor admite varios oyentes-- pero seria un hilo de mas.
 */
export async function seedAiActivity(appId: string, skip: string): Promise<void> {
  if (scope !== appId) resetAiActivity();
  scope = appId;

  let runs: AiActiveRun[];
  try {
    runs = await api<AiActiveRun[]>(`/api/apps/${appId}/ia/enMarcha`);
  } catch {
    // Sin respuesta no se inventa una senal: lo que se sepa por el hilo de
    // avisos sigue valiendo, y lo demás se sabra al volver a entrar.
    return;
  }
  if (scope !== appId) return;

  working = runs.map((run) => run.page);
  for (const run of runs) {
    if (run.page === skip) continue;
    followRun(appId, run.page);
  }
}

/**
 * Mirar de lejos una petición de otra página: solo para saber cuando termina.
 *
 * No recoge nada de lo que la IA escribe --eso es del panel de esa página, y
 * lo vuelve a pedir entero cuando se abra--. Lo único que hace aquí es apagar
 * la senal en cuanto deja de haber trabajo.
 */
function followRun(appId: string, pageId: string): void {
  const mark = `${appId}:${pageId}`;
  if (followed.has(mark)) return;
  followed.add(mark);

  const release = () => {
    followed.delete(mark);
    setAiWorking(pageId, false);
  };

  void stream<AiProgress>(`/api/apps/${appId}/paginas/${pageId}/ia/seguir`, {}, (part) => {
    if (part.tipo === "fin" || part.tipo === "error") release();
  })
    .then(release)
    .catch(release);
}
