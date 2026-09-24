<!--
  Cuanto contexto lleva gastado la petición.

  Se mide lo que el modelo tuvo delante en su ultima llamada, que es lo que de
  verdad ocupa: la conversación entera vuelve a ir delante en cada una. Un
  modelo sin ventana declarada solo puede decir el número, sin contra que
  medirlo.

  El anillo es un botón: al pulsarlo sale una tarjeta con lo mismo dicho en
  números --cuánto ocupa, cuánto queda-- y, plegado, el detalle: lo evaluado y
  lo escrito en toda la conversación, lo que salió de la caché en la última
  llamada y la velocidad media de escritura.

  El anillo va en SVG y no en conic-gradient: el degradado conico rasteriza el
  corte y el contorno sin suavizado y el circulo sale dentado. Un trazo con
  stroke-dasharray lo dibuja el mismo rasterizador que las curvas, con
  antialias en los dos bordes.
-->
<script lang="ts" module>
  /* El detalle se queda como se dejó al volver a abrir la tarjeta. */
  let detailsOpen = $state(false);
</script>

<script lang="ts">
  import type { AiUsage, AiUsageTotals } from "@shared/types";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";
  import { Dropdown } from "../ui";

  let { usage, totals }: { usage: AiUsage; totals: AiUsageTotals | null } = $props();

  const share = $derived(usage.window ? Math.min(1, usage.input / usage.window) : 0);
  const percent = $derived(Math.round(share * 100));
  /* Los mismos umbrales para el anillo y la barra: aviso al 80 %, alarma al 95 %. */
  const level = $derived(share >= 0.95 ? "critical" : share >= 0.8 ? "warning" : "ok");
  const cached = $derived(usage.cached ?? 0);
  const speed = $derived(
    totals && totals.seconds > 0 && totals.output > 0 ? totals.output / totals.seconds : null,
  );

  /** Miles con dos decimales, como se lee una ventana: «30,50 K». */
  function short(n: number): string {
    if (n < 1000) return n.toLocaleString("es");
    const value = (n / 1000).toLocaleString("es", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${value} K`;
  }

  const tok = (n: number) => `${n.toLocaleString("es")} tok`;

  /*
   * La tarjeta sale al pasar el ratón y se va al salir. Entre el anillo y la
   * tarjeta hay un hueco: el cierre espera un momento para que cruzarlo no la
   * cierre. Pulsar solo abre --en un táctil no hay ratón que pase--, y se
   * cierra tocando fuera, como cualquier popover.
   */
  const LEAVE_MS = 150;
  let root = $state<HTMLElement | null>(null);
  let leaving: ReturnType<typeof setTimeout> | undefined;
  const card = () => root?.querySelector<HTMLElement>(".popup-ai-context") ?? null;

  function show(): void {
    clearTimeout(leaving);
    const node = card();
    if (node && !node.matches(":popover-open")) node.showPopover();
  }

  function hide(): void {
    clearTimeout(leaving);
    leaving = setTimeout(() => card()?.hidePopover(), LEAVE_MS);
  }

  $effect(() => () => clearTimeout(leaving));
</script>

{#snippet row(label: string, value: string, subtitle?: string)}
  <div class="row-ai-usage">
    <div class="row-ai-usage-line">
      <span class="row-ai-usage-label">{label}</span>
      <span class="row-ai-usage-value">{value}</span>
    </div>
    {#if subtitle}
      <span class="row-ai-usage-note">{subtitle}</span>
    {/if}
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span bind:this={root} class="wrap-ai-context" onmouseenter={show} onmouseleave={hide}>
  <Dropdown up align="right" class="popup-ai-context">
    {#snippet trigger({ open })}
      <button
        type="button"
        aria-label="Uso del contexto"
        aria-expanded={open}
        onclick={show}
        class="meter-ai-context flex shrink-0 items-center"
      >
        <!-- pathLength=100 vuelve el perimetro una escala de 0 a 100: el trazo se
           recorta con el porcentaje tal cual, sin calcular la circunferencia. -->
        <svg
          class={cx("meter-ring block", level !== "ok" && `meter-ring-${level}`)}
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
      </button>
    {/snippet}

    {#snippet children(_close)}
      <div class="card-ai-context flex flex-col" role="status">
        <p class="head-ai-context">
          <span class="head-ai-context-title">Contexto</span>
          <span class="head-ai-context-dot">·</span>
          <span class="head-ai-context-count">
            {short(usage.input)} / {usage.window ? short(usage.window) : "—"}
          </span>
        </p>

        {#if usage.window}
          <div class="bar-ai-context">
            <div class={cx("bar-ai-context-fill", `is-${level}`)} style:scale="{share} 1"></div>
          </div>
          <div class="legend-ai-context flex justify-between">
            <span>
              <span class={cx("legend-ai-percent", `is-${level}`)}>{percent} %</span>
              usado
            </span>
            <span>{short(Math.max(0, usage.window - usage.input))} libres</span>
          </div>
        {:else}
          <p class="legend-ai-context">
            El modelo no informa su capacidad total: no hay contra qué medirlo.
          </p>
        {/if}

        <details class="details-ai-usage" bind:open={detailsOpen}>
          <summary class="summary-ai-usage flex items-center">
            <span>Detalle del uso de tokens</span>
            <Icon name="arrow-down-01" size={12} class="summary-ai-usage-caret" />
          </summary>

          <div class="body-ai-usage flex flex-col">
            {#if totals && (totals.input > 0 || totals.output > 0)}
              <section class="group-ai-usage">
                <h3 class="group-ai-usage-title">En toda la conversación</h3>
                <div class="flex flex-col">
                  {@render row(
                    "Entrada evaluada",
                    tok(totals.input),
                    totals.cached > 0
                      ? `${totals.cached.toLocaleString("es")} reutilizados de la caché`
                      : undefined,
                  )}
                  {@render row("Tokens generados", tok(totals.output))}
                </div>
              </section>
            {/if}

            <section class="group-ai-usage">
              <h3 class="group-ai-usage-title">Última llamada · caché</h3>
              <div class="flex flex-col">
                {@render row(
                  "Entrada",
                  tok(usage.input),
                  cached > 0
                    ? `${(usage.input - cached).toLocaleString("es")} nuevos + ${cached.toLocaleString("es")} en caché`
                    : undefined,
                )}
                {@render row("Generados", tok(usage.output))}
                <div class="total-ai-usage">
                  {@render row("Total en contexto", tok(usage.input + usage.output))}
                </div>
              </div>
            </section>

            {#if speed !== null}
              <div class="total-ai-usage">
                {@render row("Velocidad media", `${speed.toFixed(1)} t/s`)}
              </div>
            {/if}

            <p class="model-ai-usage">{usage.model}</p>
          </div>
        </details>
      </div>
    {/snippet}
  </Dropdown>
</span>

<style>
  .wrap-ai-context {
    display: inline-flex;
  }

  .meter-ai-context {
    padding: 0.125rem;
    border-radius: 62.5rem;
    color: var(--text-muted);
    cursor: pointer;

    &:hover,
    &[aria-expanded="true"] {
      background: var(--bg-field);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
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

    /* Casi lleno: avisa en ambar; a punto de no caber, en rojo. */
    &.meter-ring-warning,
    &.meter-ring-critical {
      & .meter-track {
        stroke: var(--bg-field);
      }
    }

    &.meter-ring-warning .meter-arc {
      stroke: var(--warning);
    }

    &.meter-ring-critical .meter-arc {
      stroke: var(--danger);
    }
  }

  /* La clase lleva el menú de Dropdown (un componente): sale del ámbito. */
  :global(.popup-ai-context) {
    width: 17rem;
    padding: var(--sp-12);
    cursor: default;
  }

  .card-ai-context {
    gap: var(--sp-8);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-primary);
  }

  .head-ai-context {
    display: flex;
    align-items: center;
    gap: var(--sp-6);

    & .head-ai-context-title {
      font-weight: 600;
    }

    & .head-ai-context-dot,
    & .head-ai-context-count {
      color: var(--text-muted);
    }

    & .head-ai-context-count {
      font-family: var(--font-mono);
    }
  }

  .bar-ai-context {
    height: 0.375rem;
    overflow: hidden;
    border-radius: 62.5rem;
    background: var(--bg-field);

    & .bar-ai-context-fill {
      height: 100%;
      border-radius: 62.5rem;
      background: var(--success);
      transform-origin: left center;
      transition: scale 300ms ease-out;

      &.is-warning {
        background: var(--warning);
      }

      &.is-critical {
        background: var(--danger);
      }
    }
  }

  .legend-ai-context {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);

    & .legend-ai-percent.is-warning {
      color: var(--warning);
    }

    & .legend-ai-percent.is-critical {
      color: var(--danger);
    }
  }

  .details-ai-usage {
    margin-top: var(--sp-4);
    padding-top: var(--sp-10);
    border-top: var(--border-width) solid var(--border);

    & .summary-ai-usage {
      gap: var(--sp-4);
      cursor: pointer;
      list-style: none;
      font-size: var(--text-xs);
      color: var(--text-muted);

      &::-webkit-details-marker {
        display: none;
      }

      &:hover {
        color: var(--text-primary);
      }
    }

    &[open] :global(.summary-ai-usage-caret) {
      rotate: 180deg;
    }
  }

  /* El Icon es un componente: su clase sale del ámbito. */
  :global(.summary-ai-usage-caret) {
    margin-left: auto;
    transition: rotate 150ms;
  }

  .body-ai-usage {
    gap: var(--sp-12);
    padding-top: var(--sp-12);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);

    & .flex-col {
      gap: var(--sp-8);
    }
  }

  .group-ai-usage-title {
    margin-bottom: var(--sp-6);
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .row-ai-usage {
    display: grid;
    gap: 0.125rem;

    & .row-ai-usage-line {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-8);
    }

    & .row-ai-usage-label {
      color: var(--text-secondary);
    }

    & .row-ai-usage-value {
      font-family: var(--font-mono);
      color: var(--text-secondary);
    }

    & .row-ai-usage-note {
      font-size: 0.625rem;
      line-height: 1.3;
      color: var(--text-muted);
    }
  }

  .total-ai-usage {
    padding-top: var(--sp-6);
    border-top: var(--border-width) solid var(--border);

    & .row-ai-usage-value {
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .model-ai-usage {
    overflow: hidden;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .meter-ring .meter-arc,
    .bar-ai-context .bar-ai-context-fill {
      transition: none;
    }
  }
</style>
