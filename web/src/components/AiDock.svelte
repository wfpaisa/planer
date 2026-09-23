<!--
  La columna de la inteligencia artificial.

  La conversación no se dibuja encima del documento: ocupa su propia columna a
  la izquierda de la escena y el documento se estrecha para dejarle sitio.
  Mientras se habla con la IA, lo construido se sigue viendo entero.

  Su ancho lo decide quien construye arrastrando el borde derecho, y se
  recuerda por aplicación en este navegador --eso vive en `lib/aiDock`--. Se
  esconde por completo --el documento recupera ese ancho-- y vuelve desde el
  botón de la barra superior; ni esconder ni traer empiezan una conversación
  nueva: lo conversado y lo escrito sin enviar viven en `aiConversation`.

  Es solo para quien construye. La vista publicada no lo monta.
-->
<script lang="ts">
  import type { AppRecord, DataImpact, PageRecord } from "@shared/types";

  import { type AiDockState, clampDock } from "../lib/aiDock.svelte";
  import AiPanel from "./AiPanel.svelte";
  import ImpactPanel from "./ImpactPanel.svelte";

  let {
    app,
    page,
    dock,
    onChangedAll,
    onNote,
  }: {
    app: AppRecord;
    page: PageRecord;
    dock: AiDockState;
    /** Releer páginas y tablas: la IA pudo tocar las dos. */
    onChangedAll: () => Promise<void> | void;
    /** Algo que contar sin interrumpir. */
    onNote: (text: string) => void;
  } = $props();

  /** Los cambios con riesgo que esperan decision, encadenados a la conversación. */
  let impact = $state<DataImpact | null>(null);
  let column = $state<HTMLElement | null>(null);
  /** Mientras se arrastra, el asa se queda encendida aunque el ratón se salga. */
  let resizing = $state(false);

  /*
   * Arrastrar el borde. La medida se escribe directamente sobre el nodo
   * mientras dura y solo se confirma al soltar: un cambio de estado por cada
   * `pointermove` redibujaria el árbol entero de la conversación sesenta veces
   * por segundo.
   */
  function startResize(e: PointerEvent): void {
    const node = column;
    if (!node) return;
    e.preventDefault();
    // Capturar el puntero evita que salirse del borde pierda el arrastre. Si el
    // navegador no lo concede, el arrastre sigue valiendo: los oyentes estan en
    // la ventana, asi que la captura es una mejora, no un requisito.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* sin captura, arrastrar muy rápido fuera del borde puede soltar antes */
    }

    const from = e.clientX;
    const base = dock.width;
    let last = base;
    resizing = true;

    // Sin esto, arrastrar va seleccionando el texto de la conversación.
    const body = document.body.style;
    const priorSelect = body.userSelect;
    const priorCursor = body.cursor;
    body.userSelect = "none";
    body.cursor = "col-resize";

    const move = (ev: PointerEvent) => {
      last = clampDock(base + (ev.clientX - from));
      node.style.width = `${last}px`;
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      body.userSelect = priorSelect;
      body.cursor = priorCursor;
      resizing = false;
      dock.setWidth(last);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }
</script>

{#if dock.open}
  <aside
    id="dock-ai"
    bind:this={column}
    style="width: {dock.width}px"
    class="dock-ai flex h-full shrink-0 flex-col"
  >
    <div class="dock-content flex flex-1 flex-col">
      {#if impact}
        <ImpactPanel
          {impact}
          appId={app.id}
          onClose={() => (impact = null)}
          onResolved={async (result) => {
            await onChangedAll();
            impact = null;
            onNote(result.message);
          }}
        />
      {:else}
        <AiPanel
          appId={app.id}
          {page}
          onClose={dock.toggle}
          onChanged={onChangedAll}
          onImpact={(next) => (impact = next)}
        />
      {/if}
    </div>

    <!--
      El borde es el asa. Es decoracion con la que se arrastra, no un mando con
      estado: quien no use el ratón tiene el ancho de partida y el botón que
      esconde la columna entera.

      Se agarra por una franja mas ancha que la línea que se ve, y la pastilla a
      media altura esta siempre dibujada: sin ella había que adivinar donde
      apuntar para que el asa se encendiera.
    -->
    <div
      aria-hidden="true"
      onpointerdown={startResize}
      data-tip="Arrastra para cambiar el ancho"
      data-tip-side="right"
      class="dock-resize-handle"
      class:is-resizing={resizing}
    ></div>
  </aside>
{/if}

<style>
  .dock-ai {
    position: relative;
    border-right: var(--border-width) solid var(--border);
    background: var(--bg-level2);
  }

  .dock-content {
    min-height: 0;
    overflow: hidden;
  }

  /*
    Entera dentro de la columna, no a caballo del borde: a la derecha empieza
    el sidebar, que esta en el mismo peldano de la escala de capas y se dibuja
    después, asi que cualquier trozo de asa que asome por alli queda debajo y
    no recibe el puntero.
  */
  .dock-resize-handle {
    position: absolute;
    inset-block: 0;
    right: 0;
    z-index: 10;
    display: flex;
    width: 0.75rem;
    align-items: center;
    justify-content: flex-end;
    cursor: col-resize;
    touch-action: none;
  }

  /* La franja que se tine al acercarse, pegada al borde. */
  .dock-resize-handle::before {
    content: "";
    position: absolute;
    inset-block: 0;
    right: 0;
    width: 0.25rem;
    background: transparent;
    transition: background-color 150ms;
  }

  /* La pastilla: lo único que se ve en reposo, y por eso siempre esta. */
  .dock-resize-handle::after {
    content: "";
    position: relative;
    width: 0.25rem;
    height: 2.5rem;
    border-radius: 62.5rem;
    /* Mas marcada que la línea del borde: si comparten color, la pastilla
       desaparece dentro de ella y no hay nada que buscar. */
    background: var(--border-strong);
    transition:
      background-color 150ms,
      height 150ms;
  }

  .dock-resize-handle:hover::before,
  .dock-resize-handle.is-resizing::before {
    background: color-mix(in oklab, var(--accent) 30%, transparent);
  }

  .dock-resize-handle:hover::after,
  .dock-resize-handle.is-resizing::after {
    height: 4rem;
    background: var(--accent);
  }
</style>
