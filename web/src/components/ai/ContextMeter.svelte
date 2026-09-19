<!--
  Cuanto contexto lleva gastado la peticion.

  Se mide lo que el modelo tuvo delante en su ultimo turno, que es lo que de
  verdad ocupa: la conversacion entera vuelve a ir delante en cada turno. Un
  modelo sin ventana declarada solo puede decir el numero, sin contra que
  medirlo.

  El anillo va en SVG y no en conic-gradient: el degradado conico rasteriza el
  corte y el contorno sin suavizado y el circulo sale dentado. Un trazo con
  stroke-dasharray lo dibuja el mismo rasterizador que las curvas, con
  antialias en los dos bordes.
-->
<script lang="ts">
  import type { AiUsage } from "@shared/types";

  import { cx } from "../../lib/cx";

  let { usage }: { usage: AiUsage } = $props();

  const share = $derived(usage.window ? Math.min(1, usage.input / usage.window) : 0);
  const detail = $derived(
    usage.window
      ? `El modelo tuvo delante ${usage.input.toLocaleString("es")} de ${usage.window.toLocaleString("es")} y escribió ${usage.output.toLocaleString("es")}.`
      : `El modelo tuvo delante ${usage.input.toLocaleString("es")} y escribió ${usage.output.toLocaleString("es")}.`,
  );
</script>

<span data-tip={detail} class="meter-ai-context flex shrink-0 items-center">
  <!-- pathLength=100 vuelve el perimetro una escala de 0 a 100: el trazo se
       recorta con el porcentaje tal cual, sin calcular la circunferencia. -->
  <svg
    class={cx("meter-ring block", share > 0.85 && "meter-ring-high")}
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <circle class="meter-track" cx="10" cy="10" r="8.5" pathLength="100" />
    <circle
      class="meter-arc"
      cx="10"
      cy="10"
      r="8.5"
      pathLength="100"
      stroke-dasharray="{share * 100} 100"
    />
  </svg>
</span>

<style>
  .meter-ai-context {
    color: var(--text-muted);
  }

  .meter-ring {
    width: 1.2rem;
    height: 1.2rem;

    & circle {
      fill: none;
      stroke-width: 3;
    }

    & .meter-track {
      stroke: var(--border);
    }

    /* El trazo arranca a las tres en punto: se gira para empezar arriba. */
    & .meter-arc {
      stroke: var(--accent);
      transform: rotate(-90deg);
      transform-origin: 50% 50%;
      transition: stroke-dasharray 180ms ease-out;
    }

    /* Casi lleno: avisa en ambar, que es lo unico que hay que mirar. */
    &.meter-ring-high {
      & .meter-track {
        stroke: var(--bg-field);
      }

      & .meter-arc {
        stroke: var(--warning);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .meter-ring .meter-arc {
      transition: none;
    }
  }
</style>
