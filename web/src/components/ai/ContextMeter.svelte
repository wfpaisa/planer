<!--
  Cuanto contexto lleva gastado la peticion.

  Se mide lo que el modelo tuvo delante en su ultimo turno, que es lo que de
  verdad ocupa: la conversacion entera vuelve a ir delante en cada turno. Un
  modelo sin ventana declarada solo puede decir el numero, sin contra que
  medirlo.
-->
<script lang="ts" module>
  /** Un numero de tokens en corto: 12400 se lee mucho mejor como 12,4k. */
  export function short(value: number): string {
    if (value < 1000) return String(value);
    const thousands = value / 1000;
    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`;
  }
</script>

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
  {#if usage.window > 0}
    <span class="meter-track block">
      <span
        class={cx("meter-fill block h-full", share > 0.85 && "meter-fill-high")}
        style="width: {share * 100}%"
      ></span>
    </span>
  {/if}
  {usage.window ? `${short(usage.input)}/${short(usage.window)}` : short(usage.input)}
</span>

<style>
  .meter-ai-context {
    gap: var(--sp-6);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .meter-track {
    height: 0.25rem;
    width: 2.5rem;
    overflow: hidden;
    border-radius: 62.5rem;
    background: var(--bg-field);
  }

  .meter-fill {
    border-radius: 62.5rem;
    background: var(--accent);

    /* Casi lleno: avisa en ambar, que es lo unico que hay que mirar. */
    &.meter-fill-high {
      background: var(--warning);
    }
  }
</style>
