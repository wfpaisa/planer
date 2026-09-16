/**
 * La peticion que la IA tiene en marcha, mientras dura.
 *
 * Vive fuera del panel por lo mismo que lo conversado --ver `aiConversation`--
 * pero por una razon mas apretada. El panel se desmonta al salir de la seccion
 * de la aplicacion --las bases de datos, los ajustes-- y al esconder el dock,
 * y la peticion no se corta con el: el hilo de avisos que la escucha sigue
 * vivo, y lo que llegue sigue aterrizando en la conversacion de su pagina.
 *
 * Si lo que se ve mientras trabaja viviera dentro del panel, volver a la
 * pagina lo encontraria en blanco: la peticion seguiria su curso, el sidebar
 * la seguiria senalando y aqui no habria ni reloj, ni lo que lleva pensado, ni
 * el boton de detener --solo recargar los traia de vuelta--. Aqui, quien vuelva
 * a dibujarse la encuentra donde iba.
 *
 * Es de esta pestana y de esta visita: quien la cuenta es quien la escucha. Lo
 * que sobrevive a recargar lo sabe el servidor, y el panel lo retoma al abrir
 * la pagina.
 *
 * Se guarda con la misma clave que lo conversado --aplicacion y pagina--: hay
 * una peticion por pagina, y varias paginas pueden trabajar a la vez.
 *
 * `aiActivity` dice en que paginas trabaja la IA; esto, como va la que se esta
 * escuchando. No es lo mismo: de las paginas que quedaron atras solo se espera
 * a que terminen, sin recoger nada de lo que escriben.
 */
import { SvelteMap } from "svelte/reactivity";

import { NO_PROGRESS, type Progress } from "./aiProgress";

export interface LiveRun {
  /** Desde cuando trabaja. Es lo que mueve el reloj. */
  startedAt: number;
  /**
   * Como la llama el servidor. Mientras tenga nombre, la peticion no depende
   * de esta ventana: se puede recargar o cerrar, y al volver a la pagina se
   * sigue viendo. Vacio mientras se pide y si el servidor no la reconoce.
   */
  runId: string;
  /** Se pidio detenerla y todavia no ha llegado el final. */
  stopping: boolean;
  /** Lo que lleva producido. Solo para mirar. */
  progress: Progress;
}

const live = new SvelteMap<string, LiveRun>();

/** La peticion en marcha de esa conversacion, o ninguna. */
export const liveRun = (key: string): LiveRun | undefined => live.get(key);

/**
 * Se empieza a escuchar una peticion. `since` es cuando empezo de verdad: al
 * retomar una que ya venia en marcha no es ahora, o el reloj se reiniciaria en
 * cada vuelta a la pagina aunque la IA llevara rato trabajando.
 */
export function openRun(key: string, since: number): void {
  live.set(key, { startedAt: since, runId: "", stopping: false, progress: NO_PROGRESS });
}

/**
 * Cambiar algo de la que esta en marcha. Si ya termino no queda nada que tocar:
 * un frame pedido que llega tarde no puede resucitar el reloj.
 */
export function markRun(key: string, patch: Partial<LiveRun>): void {
  const now = live.get(key);
  if (!now) return;
  live.set(key, { ...now, ...patch });
}

/** Termino. Lo que quede que contar ya vive en la conversacion. */
export function closeRun(key: string): void {
  live.delete(key);
}
