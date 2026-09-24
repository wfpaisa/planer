<!--
  Una opción de menú que abre otro menú al lado.

  Vive dentro del menú de un `Dropdown`: su lista es otro `popover` metido en
  el DOM del primero, y por eso el navegador los trata como una pila --abrir
  este no cierra el de fuera, y abrir un hermano cierra este--. Se abre al
  pasar el ratón y también al pulsar, que es lo único que hay en un táctil.

  La lista sale a la derecha y crece hacia arriba desde la fila: los menús de
  este panel viven abajo, pegados al campo de escribir. Si no cabe, se voltea.
-->
<script lang="ts" module>
  // Cada submenú ancla su propia lista: dos abiertos a la vez no pueden
  // compartir un anchor-name.
  let anchorSeq = 0;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  let {
    icon,
    value,
    disabled = false,
    class: className,
    menuClass,
    children,
    content,
  }: {
    icon?: Snippet;
    /** Lo que está elegido ahora, apagado a la derecha del rótulo. */
    value?: string;
    disabled?: boolean;
    class?: string;
    menuClass?: string;
    /** El rótulo de la fila. */
    children: Snippet;
    /** La lista; recibe con qué cerrarla. */
    content: Snippet<[() => void]>;
  } = $props();

  let open = $state(false);
  let list = $state<HTMLDivElement | null>(null);

  anchorSeq += 1;
  const anchorName = `--menu-sub-${anchorSeq}`;

  const show = () => {
    if (!disabled && !open) list?.showPopover();
  };
  const close = () => list?.hidePopover();
  const toggle = () => (open ? close() : show());
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wrap-menu-sub" style:anchor-name={anchorName} onmouseenter={show} onmouseleave={close}>
  <button
    type="button"
    {disabled}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}
    class={cx(className, "menu-sub-trigger", open && "is-open")}
  >
    {@render icon?.()}
    <span class="menu-sub-label">{@render children()}</span>
    {#if value}
      <span class="menu-sub-value">{value}</span>
    {/if}
    <Icon name="arrow-right-01" size={12} class="menu-sub-caret" />
  </button>

  <div
    bind:this={list}
    popover
    role="menu"
    class={cx("menu menu-sub", menuClass)}
    style:position-anchor={anchorName}
    ontoggle={(e) => {
      open = (e as ToggleEvent).newState === "open";
    }}
  >
    {@render content(close)}
  </div>
</div>

<style>
  .wrap-menu-sub {
    display: flex;
  }

  .menu-sub-trigger {
    &.is-open {
      background: var(--bg-field);
      color: var(--text-primary);
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }

    & .menu-sub-label {
      flex-shrink: 0;
    }

    & .menu-sub-value {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      color: var(--text-muted);
      font-weight: 400;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  /* El Icon es un componente: su clase sale del ámbito. */
  :global(.menu-sub-caret) {
    flex-shrink: 0;
    margin-left: auto;
    opacity: 0.6;
  }

  /*
    Pisa la posición de `.menu` (debajo del disparador): a la derecha de la
    fila, con el borde de abajo a su altura. Sin separación: el hueco entre la
    fila y la lista haría saltar el `mouseleave` al cruzarlo.
  */
  .menu-sub {
    margin: 0;
    max-height: var(--menu-max-height, 20rem);
    overflow-y: auto;
    position-area: right span-top;
    align-self: end;
    justify-self: start;
    transform-origin: left bottom;
    position-try-fallbacks:
      flip-block,
      flip-inline,
      flip-block flip-inline;
  }
</style>
