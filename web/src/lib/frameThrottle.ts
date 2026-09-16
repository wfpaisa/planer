/**
 * Agrupar trabajo visual por intervalos de dibujado.
 *
 * La respuesta de la IA llega por trozos: el servidor manda uno por token y
 * `stream()` llama de vuelta con cada uno. Redibujar la conversacion --que
 * puede llevar decenas de mensajes con formato-- en cada trozo la deja sin
 * responder al desplazamiento ni a los clics.
 *
 * Aqui se pide el trabajo tantas veces como haga falta y se hace una sola vez
 * cada pocos frames, siempre con el ultimo valor. Se cuenta en frames y no en
 * milisegundos a proposito: un intervalo en milisegundos no esta alineado con
 * el dibujado del navegador y produce saltos.
 *
 * Se traduce tal cual desde la version de React. Con reactividad granular
 * puede que ya no haga falta; eso se mide en la Fase 7, con el panel de IA
 * funcionando. Ver `docs/MIGRACION-SVELTE.md`.
 */

/** Cada cuantos frames se hace el trabajo pendiente. */
const FRAMES = 3;

export interface FrameThrottle {
  /** Pide el trabajo. Llamarla con uno pendiente no encola otro. */
  (): void;
  /**
   * Cancela lo pendiente. Hay que llamarla al destruir el componente: un frame
   * pedido dejaria corriendo un trabajo sobre lo que ya no esta en pantalla.
   */
  cancel: () => void;
}

export function frameThrottle(work: () => void, frames = FRAMES): FrameThrottle {
  let pending: number | null = null;

  const ask = (() => {
    if (pending !== null) return;
    let left = frames;
    const advance = () => {
      left -= 1;
      if (left > 0) {
        pending = requestAnimationFrame(advance);
        return;
      }
      pending = null;
      work();
    };
    pending = requestAnimationFrame(advance);
  }) as FrameThrottle;

  ask.cancel = () => {
    if (pending === null) return;
    cancelAnimationFrame(pending);
    pending = null;
  };

  return ask;
}
