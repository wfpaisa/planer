<!--
  Cuanto contexto lleva gastado la peticion.

  Se mide lo que el modelo tuvo delante en su ultimo turno, que es lo que de
  verdad ocupa: la conversacion entera vuelve a ir delante en cada turno. Un
  modelo sin ventana declarada solo puede decir el numero, sin contra que
  medirlo.
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
  <span
    class={cx("meter-ring block", share > 0.85 && "meter-ring-high")}
    style="--meter-fill: {share * 100}%"
  ></span>
</span>

<style>
  .meter-ai-context {
    color: var(--text-muted);
  }

  .meter-ring {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    background: conic-gradient(var(--accent) var(--meter-fill), var(--bg-field) 0);
    mask-image: radial-gradient(farthest-side, transparent calc(100% - 0.16rem), #000 calc(100% - 0.16rem));
    -webkit-mask-image: radial-gradient(
      farthest-side,
      transparent calc(100% - 0.16rem),
      #000 calc(100% - 0.16rem)
    );

    /* Casi lleno: avisa en ambar, que es lo unico que hay que mirar. */
    &.meter-ring-high {
      background: conic-gradient(var(--warning) var(--meter-fill), var(--bg-field) 0);
    }
  }
</style>
