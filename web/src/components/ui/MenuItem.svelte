<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../../lib/cx";

  let {
    icon,
    description,
    danger = false,
    disabled = false,
    onclick,
    class: className,
    children,
  }: {
    icon?: Snippet;
    /**
     * La segunda línea: para que sirve la opción, cuando el rotulo solo no
     * basta para elegir. Sale debajo del título, mas pequena y apagada.
     */
    description?: string;
    danger?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<button
  type="button"
  {disabled}
  onclick={disabled ? undefined : onclick}
  class={cx(danger && "danger", description && "menu-item-described", className)}
>
  {@render icon?.()}
  {#if description}
    <span class="menu-item-stack">
      <span class="menu-item-content">{@render children()}</span>
      <span class="menu-item-note">{description}</span>
    </span>
  {:else}
    <span class="menu-item-content">{@render children()}</span>
  {/if}
</button>

<style>
  .menu-item-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /*
    Con descripcion el item deja de ser una línea: el icono se queda arriba,
    a la altura del título, y no centrado contra el bloque entero.
  */
  .menu-item-described {
    align-items: flex-start;
  }

  .menu-item-stack {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.0625rem;
  }

  .menu-item-note {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    font-weight: 400;
    color: var(--text-muted);
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
