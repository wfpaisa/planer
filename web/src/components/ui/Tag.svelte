<!--
  La etiqueta del catálogo.

  Es la pieza `.tag` de `styles/components.css` --pastilla redonda, letra
  pequena y en negrita-- y el único sitio donde se escribe su marcado. El
  color no se elige a mano ni viaja en un `style`: se pide por `tone`, que
  son las clases de tinte del tema (`tint-1`..`tint-10`) y las semanticas
  (`tag-success`, `tag-warning`, `tag-error`), nombradas por lo que
  significan y no por el color que tienen hoy.

  Sin `tone` la etiqueta va en `tint-1`, que es la normal. `tone="off"` es la
  otra cara: la pastilla sin fondo, solo su línea, que es como se queda lo
  que se puede encender y ahora esta apagado (un filtro, una opción sin
  marcar).

  Con `onRemove` aparece dentro la cruz de quitar (`.tag-remove`), que vive
  dentro de la etiqueta y hereda su tinta; con `onclick` la etiqueta entera
  pasa a ser un botón, para los filtros que se encienden y se apagan.

  El globo de ayuda va por `tip`, como en `Button`: lo dibuja `TooltipLayer`
  a partir de `data-tip`, nunca el `title` del navegador.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  export type Tone =
    | "tint-1"
    | "tint-2"
    | "tint-3"
    | "tint-4"
    | "tint-5"
    | "tint-6"
    | "tint-7"
    | "tint-8"
    | "tint-9"
    | "tint-10"
    | "tag-success"
    | "tag-warning"
    | "tag-error"
    | "off";

  let {
    tone = "tint-1",
    class: className,
    tip,
    tipSide,
    onclick,
    pressed,
    ariaLabel,
    onRemove,
    removeLabel,
    children,
  }: {
    /** El color, por lo que significa. `off` es la pastilla apagada. */
    tone?: Tone;
    class?: string;
    /** El globo de ayuda. Lo dibuja `TooltipLayer`, no la etiqueta. */
    tip?: string;
    /** De que lado sale el globo. Por defecto, arriba. */
    tipSide?: "top" | "bottom" | "left" | "right";
    /** Si viene, la etiqueta entera es un botón. */
    onclick?: () => void;
    /** Para la etiqueta-botón que se queda encendida, como un filtro puesto. */
    pressed?: boolean;
    /** Lo que dice la etiqueta-botón en voz alta, si su texto solo no basta. */
    ariaLabel?: string;
    /** Si viene, dentro sale la cruz de quitar. */
    onRemove?: () => void;
    /** Que se quita, para quien no ve la cruz. Por defecto, "Quitar". */
    removeLabel?: string;
    children: Snippet;
  } = $props();

  const classes = $derived(cx(className, "tag", tone !== "off" && tone));
</script>

{#snippet body()}
  {@render children()}
  {#if onRemove}
    <!--
      El botón no hereda el toque de la etiqueta: quitar y abrir son dos
      cosas distintas, y una etiqueta-botón con cruz las tendria pegadas.
    -->
    <button
      type="button"
      class="tag-remove"
      aria-label={removeLabel ?? "Quitar"}
      data-tip="Quitar"
      onclick={(e) => {
        e.stopPropagation();
        onRemove?.();
      }}
    >
      <Icon name="cancel-01" size={12} />
    </button>
  {/if}
{/snippet}

{#if onclick}
  <button
    type="button"
    {onclick}
    class={classes}
    aria-label={ariaLabel}
    aria-pressed={pressed}
    data-tip={tip}
    data-tip-side={tip ? tipSide : undefined}
  >
    {@render body()}
  </button>
{:else}
  <span class={classes} data-tip={tip} data-tip-side={tip ? tipSide : undefined}>
    {@render body()}
  </span>
{/if}
