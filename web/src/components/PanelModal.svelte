<!--
  La tarjeta de un panel, centrada encima de todo.

  Publicar, compartir, los ajustes de la aplicacion y los de cada pagina se
  piden desde el encabezado y desde el sidebar, no desde una barra. Pero su
  aspecto es el mismo de siempre: la misma tarjeta, centrada y con el documento
  oscurecido atras.

  Se cierra con la equis del panel, con la tecla de escape o con un clic en el
  fondo. El alto que se pide es un tope: nunca pasa de lo que cabe en la
  ventana. Dentro se dibuja un `OmniPanel`: titulo, cuerpo y pie.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../lib/cx";
  import { portal } from "../lib/portal";
  import { surface } from "./ui/surface";

  let {
    open,
    onClose,
    width = "42rem",
    height = "34rem",
    fullscreen = false,
    hidden = false,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    width?: string;
    height?: string;
    /** En vez de un tamano propio, ocupa toda la ventana con un margen de 1rem. */
    fullscreen?: boolean;
    /**
     * Apartada: sigue montada --con lo que tenga cargado y donde estuviera--
     * pero no se ve ni se toca, para dejar mirar lo que hay debajo. Nada que ver
     * con cerrarla, que la desmonta y pierde lo que estaba abierto.
     */
    hidden?: boolean;
    children: Snippet;
  } = $props();

  $effect(() => {
    // Apartada no escucha el escape: cerraria una tarjeta que no se ve, y quien
    // lo pulsa esta mirando otra cosa.
    if (!open || hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

{#if open}
  <div
    use:portal
    class={cx(
      "layer-panel-modal flex items-center justify-center",
      fullscreen && "layer-panel-modal-full",
      hidden && "layer-panel-modal-hidden hidden",
    )}
  >
    <button
      type="button"
      aria-label="Cerrar"
      onclick={onClose}
      class={cx("btn-close-panel-backdrop", "backdrop-panel", surface.backdrop)}
    ></button>
    <div
      class={cx("card-panel rise", surface.card)}
      style={fullscreen
        ? "width: 100%; height: 100%;"
        : `max-width: ${width}; height: min(${height}, calc(100vh - 3rem));`}
    >
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .layer-panel-modal {
    position: fixed;
    inset: 0;
    /* Modales: el peldano 20 de la escala de capas. */
    z-index: 20;
    padding-inline: var(--sp-16);

    & .btn-close-panel-backdrop {
      position: absolute;
      inset: 0;
      cursor: default;
    }

    & .card-panel {
      position: relative;
      display: flex;
      width: 100%;
      flex-direction: column;
    }
  }

  .layer-panel-modal-full {
    padding: var(--sp-16);
  }
</style>
