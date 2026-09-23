<!--
  Claro u oscuro: el mismo botón en todas partes.

  Había tres copias --el panel, la demo y la aplicación publicada-- con tres
  medidas y dos velocidades de giro distintas. La pieza es siempre la misma: un
  botón fantasma con el sol y la luna en la misma celda, del que solo se ve el
  que corresponde al modo puesto. Lo único que cambia de un sitio a otro es de
  donde sale `dark` y a quien se le cuenta el cambio, y eso entra por props.
-->
<script lang="ts">
  import type { ThemeName } from "@shared/themes";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  let {
    dark,
    onToggle,
    tipLight = "Tema claro",
    tipDark = "Tema oscuro",
    id,
    class: className,
  }: {
    /** Si ahora mismo se esta pintando en oscuro. */
    dark: boolean;
    /** El modo al que se quiere ir. */
    onToggle: (next: ThemeName) => void;
    /** Que se ofrece al pulsar en oscuro; también compone el `aria-label`. */
    tipLight?: string;
    /** Que se ofrece al pulsar en claro. */
    tipDark?: string;
    id?: string;
    class?: string;
  } = $props();

  const tip = $derived(dark ? tipLight : tipDark);
</script>

<button
  {id}
  type="button"
  onclick={() => onToggle(dark ? "light" : "dark")}
  aria-label="Cambiar al {tip.toLowerCase()}"
  aria-pressed={dark}
  data-tip={tip}
  class={cx(className, "mode-toggle")}
>
  <Icon name="moon-02" size={18} class="mode-toggle-icon mode-toggle-moon" />
  <Icon name="sun-01" size={22} class="mode-toggle-icon mode-toggle-sun" />
</button>

<style>
  /* Sol y luna comparten la misma celda del grid, asi que `place-items` centra
     a los dos; el que sale gira y se encoge. Se ocultan con opacidad, no con
     `display`: si desaparecieran del flujo no habria nada que animar. */
  .mode-toggle {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    background: transparent;
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-sm);
    color: color-mix(in oklab, var(--text-primary) 70%, var(--bg-level2));
    cursor: pointer;

    &:hover {
      background: color-mix(in oklab, var(--text-primary) 8%, var(--bg-field));
      color: var(--text-primary);
    }

    & :global(.mode-toggle-icon) {
      grid-area: 1 / 1;
      transition:
        transform 0.65s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.3s;
    }

    /* Cual sobra lo dice el botón, no un ancestro: en una aplicación publicada
       dentro del panel hay dos `data-theme` en la cadena --el del panel y el de
       la aplicación-- y mirar hacia arriba escondia los dos iconos a la vez. */
    &[aria-pressed="false"] :global(.mode-toggle-sun) {
      opacity: 0;
      transform: rotate(90deg) scale(0.5);
    }

    &[aria-pressed="true"] :global(.mode-toggle-moon) {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-toggle :global(.mode-toggle-icon) {
      transition: opacity 0.2s;
    }

    .mode-toggle[aria-pressed="false"] :global(.mode-toggle-sun),
    .mode-toggle[aria-pressed="true"] :global(.mode-toggle-moon) {
      transform: none;
    }
  }
</style>
