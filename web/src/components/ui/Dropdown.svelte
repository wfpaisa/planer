<script lang="ts" module>
  // Contador compartido entre instancias: cada Dropdown de la sesion saca un
  // anchor-name distinto, sin depender de un id externo.
  let anchorSeq = 0;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../../lib/cx";

  let {
    trigger,
    children,
    align = "left",
    class: className,
    wrapClass,
    closeOnLeave = false,
    up = false,
  }: {
    trigger: Snippet<[{ open: boolean; toggle: () => void }]>;
    children: Snippet<[() => void]>;
    align?: "left" | "right";
    class?: string;
    /**
     * Clases del contenedor, no del menu.
     *
     * El contenedor se encoge hasta lo que mide el disparador (ancla el
     * menu contra el), asi que un boton que quiera ocupar todo su hueco
     * necesita que el contenedor lo ocupe primero: con `w-full` solo en el
     * boton se queda del ancho del texto.
     */
    wrapClass?: string;
    closeOnLeave?: boolean;
    /** Abre hacia arriba: para menus que viven en la parte de abajo de la pantalla. */
    up?: boolean;
  } = $props();

  let open = $state(false);
  let menu = $state<HTMLDivElement | null>(null);

  const close = () => menu?.hidePopover();
  const toggle = () => {
    if (open) menu?.hidePopover();
    else menu?.showPopover();
  };

  // Cada instancia ancla su propio menu: dos desplegables abiertos a la vez
  // (una fila por columna, por ejemplo) no pueden compartir un anchor-name.
  anchorSeq += 1;
  const anchorName = `--dropdown-${anchorSeq}`;
  const positionArea = $derived(
    `${up ? "top" : "bottom"} ${align === "right" ? "span-left" : "span-right"}`,
  );
  /*
   * El area de `span-left` no acaba en el boton: llega hasta el borde
   * izquierdo de la pantalla. Con el `justify-self: start` que `.menu` trae
   * de serie, el menu se pega a ESE borde en vez de al disparador, y un
   * desplegable alineado a la derecha se va a la otra punta. Cada lado se
   * alinea contra su propio extremo del area.
   */
  const justifySelf = $derived(align === "right" ? "end" : "start");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={cx("wrap-dropdown", wrapClass)}
  style:anchor-name={anchorName}
  onmouseleave={closeOnLeave ? close : undefined}
>
  {@render trigger({ open, toggle })}
  <div
    bind:this={menu}
    class={cx("menu", up && "menu-up", className)}
    popover
    style:position-anchor={anchorName}
    style:position-area={positionArea}
    style:justify-self={justifySelf}
    ontoggle={(e) => {
      open = (e as ToggleEvent).newState === "open";
    }}
  >
    {@render children(close)}
  </div>
</div>

<style>
  .wrap-dropdown {
    display: inline-flex;
  }

  .menu {
    margin: 0;
    margin-top: var(--sp-6);
    /*
      El area de `position-area` no recorta: un menu mas alto que el hueco que
      le toca se sale de la pantalla en vez de encogerse --y hacia arriba se
      sale por el borde de arriba, que es donde esta el principio de la lista.
      Con tope y desplazamiento, el menu largo cabe siempre; quien quiera uno
      mas corto pisa la medida con la variable.
    */
    max-height: var(--menu-max-height, 60vh);
    overflow-y: auto;
    /* Si del lado que le toca no cabe, que se vaya al otro. */
    position-try-fallbacks: flip-block;
  }

  .menu-up {
    margin-top: 0;
    margin-bottom: var(--sp-6);
  }
</style>
