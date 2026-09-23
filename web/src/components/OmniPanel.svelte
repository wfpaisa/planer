<!--
  El contenido con encabezado que llena una columna o una tarjeta.

  No es un diálogo: no tiene fondo, no tapa la ventana y no se coloca solo.
  Ocupa lo que le den --el dock de la IA, la tarjeta de publicar-- y solo pone
  su título, su cuerpo desplazable y su pie.

  El título es opcional: quien llena la cabecera con sus propios mandos --la
  conversación, que ahi pone el modelo y la lista-- no lo pide y no sale hueco
  ninguno. Cualquier otro panel si lo pone: es lo que dice de que van los
  ajustes que se acaban de abrir.

  El camino de vuelta es siempre el mismo, venga de donde venga: la equis, que
  en el dock lo esconde y en una tarjeta la cierra.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../lib/cx";
  import Icon from "./Icon.svelte";
  import Button from "./ui/Button.svelte";
  import { surface } from "./ui/surface";

  let {
    title,
    description,
    onClose,
    actions,
    footer,
    flush = false,
    children,
  }: {
    /** De que va el panel. Sin el, la cabecera es solo de los mandos. */
    title?: string;
    description?: string;
    onClose: () => void;
    /** Mandos propios del panel, a la izquierda de la equis. */
    actions?: Snippet;
    footer?: Snippet;
    /**
     * El cuerpo sin margenes ni desplazamiento propios: lo pone quien lo llena.
     * Para contenidos que mandan sobre su propio alto, como la conversación.
     */
    flush?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="panel-omni flex flex-1 flex-col">
  <div class={cx("header-panel-omni", surface.head)}>
    <div class="body-panel-omni-head">
      {#if title}
        <div class="titles-panel-omni">
          <h2 class={surface.title}>{title}</h2>
          {#if description}
            <p class={surface.description}>{description}</p>
          {/if}
        </div>
      {/if}
      {@render actions?.()}
    </div>

    <Button class="btn-icon btn-rounded" size="sm" onclick={onClose}>
      <Icon name="cancel-01" size={15} />
    </Button>
  </div>

  <div
    class={cx(
      "body-panel-omni",
      flush ? "body-panel-omni-flush" : "body-panel-omni-scroll",
      flush ? "" : surface.body,
    )}
  >
    {@render children()}
  </div>

  {#if footer}
    <div class={cx("footer-panel-omni", surface.foot)}>{@render footer()}</div>
  {/if}
</div>

<style>
  .panel-omni {
    min-height: 0;

    & .body-panel-omni-head {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-width: 0;
      flex: 1;

      /* El título cede el sitio: los mandos que vengan detras se quedan con el
         ancho que necesiten y el nombre se corta antes de empujarlos. */
      & .titles-panel-omni {
        min-width: 0;
        flex: 1;
      }
    }

    & .body-panel-omni {
      min-height: 0;
      flex: 1;
    }

    & .body-panel-omni-flush {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    & .body-panel-omni-scroll {
      overflow-y: auto;
    }
  }
</style>
