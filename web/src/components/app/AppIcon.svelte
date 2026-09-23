<!--
  El icono de una aplicación, con su paleta.

  El color no se elige aparte: es el de la aplicación. Por eso la pastilla
  lleva su propia paleta --la de la aplicación, no la del panel-- y de ahi
  sale el acento con el que se pinta. Asi la misma marca se ve igual en el
  panel, en el sidebar y en la lista de aplicaciones. El modo (claro u
  oscuro) si es el de quien mira: la pastilla lo hereda.

  La pastilla no lleva `data-theme`, solo `data-palette`; el puente
  (`compat.css`) también se declara ahi, asi que dentro valen igual los
  nombres nativos (`--accent`) y los del puente (`--color-primary`).
-->
<script lang="ts">
  import type { AppTheme } from "@shared/types";

  import { paletteAttrs } from "../../lib/appTheme";
  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  let {
    app,
    size = 24,
    class: className,
    onclick,
    tip,
    ariaLabel,
  }: {
    app: { icon: string; theme?: AppTheme | null };
    size?: number;
    class?: string;
    /** Si viene, la pastilla se vuelve un botón: cursor, foco y accesible. */
    onclick?: () => void;
    /** El globo de ayuda. Lo dibuja `TooltipLayer`, no la pastilla. */
    tip?: string;
    ariaLabel?: string;
  } = $props();

  const base = $derived(
    cx(
      onclick ? "btn-open-app icon-app" : "icon-app-static",
      "app-icon",
      "flex shrink-0 items-center justify-center",
      onclick && "app-icon-action",
      className ?? "app-icon-default",
    ),
  );
</script>

{#if onclick}
  <button
    type="button"
    {onclick}
    data-tip={tip}
    aria-label={ariaLabel}
    class={base}
    {...paletteAttrs(app.theme, { fontScale: false })}
  >
    <Icon name={app.icon} {size} />
  </button>
{:else}
  <span class={base} {...paletteAttrs(app.theme, { fontScale: false })}>
    <Icon name={app.icon} {size} />
  </span>
{/if}

<style>
  /* La pastilla lleva los colores de la aplicación, no los del panel. */
  .app-icon {
    border-radius: var(--radius-sm);
    background: color-mix(in oklab, var(--accent) 20%, transparent);
    color: var(--accent-soft-text);
  }

  .app-icon-default {
    width: 1.75rem;
    height: 1.75rem;
  }

  .app-icon-action {
    cursor: pointer;
    transition:
      background-color 150ms,
      color 150ms;

    &:hover {
      background: color-mix(in oklab, var(--accent) 30%, transparent);
    }
  }
</style>
