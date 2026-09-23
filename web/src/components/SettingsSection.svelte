<!--
  Una funcionalidad de los ajustes, encerrada en su propia tarjeta: arriba el
  título con lo que hace, en medio los controles y abajo el pie con lo que se
  puede hacer con todo ello.

  El pie es el `card-foot` del catálogo (`styles/components.css`): empuja sus
  acciones al extremo derecho, que es donde se busca el botón de guardar. Lo
  que sea explicacion y no accion se marca con `foot-settings-note` y se queda
  a la izquierda.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../lib/cx";

  let {
    id,
    icon,
    title,
    description,
    class: className,
    children,
    footer,
  }: {
    id?: string;
    icon: Snippet;
    title: string;
    description: string;
    /** Clase raíz que identifica a la sección en la UI. */
    class?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<section {id} class={cx("section-settings card card-solid", className)}>
  <header class="card-head">
    <div class="head-settings-copy">
      <h2 class="title-settings-section card-title flex items-center gap-2">
        <span class="icon-settings-section">{@render icon()}</span>
        {title}
      </h2>
      <p class="description-settings-section card-sub">{description}</p>
    </div>
  </header>

  <div class="card-body body-settings-section flex flex-col gap-3">{@render children()}</div>

  {#if footer}
    <div class="card-foot footer-settings-section">{@render footer()}</div>
  {/if}
</section>

<style>
  .head-settings-copy {
    min-width: 0;
  }

  /* La caja, el título y el subtitulo son `.card`, `.card-title` y
     `.card-sub` del catálogo; aqui solo lo que esta sección pide
     distinto: el título un escalon mas grande que el de una card
     corriente --es la cabecera de una pantalla, no de una ficha-- y el
     subtitulo un escalon mas chico, que es una nota y no un resumen. */
  .title-settings-section {
    font-size: var(--text-lg);
    line-height: var(--text-lg--line-height);
  }

  .icon-settings-section {
    color: var(--accent-soft-text);
  }

  .description-settings-section {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  /* La medida y el reparto los pone `.card-foot`; aqui solo el papel: una
     franja separada de los controles, con el texto en tono accesorio. */
  .footer-settings-section {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);

    /* Lo escribe quien usa la sección, asi que va con `:global`. El auto lo
       separa de las acciones, que `.card-foot` mantiene a la derecha. */
    & :global(.foot-settings-note) {
      margin-right: auto;
      max-width: 34rem;
      min-width: 0;
    }
  }
</style>
