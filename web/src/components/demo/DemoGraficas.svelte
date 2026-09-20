<!--
  Gráficas: las figuras del panel de referencia.

  No son del catálogo, y por eso van con su script: son canvas de Chart.js
  (`./charts.ts`), y un canvas no lee variables CSS. Cada color se resuelve en
  el momento y se vuelve a pintar todo al cambiar la paleta de la demo o el
  tema, que es lo que vigila el observador de aquí abajo.

  Una de las cinco secciones de la galería; la cabecera de cada ficha y el modal
  con su código los pone `DemoGallery.svelte`, que es quien las compone.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { buildDemoCharts, CHANNELS, destroyDemoCharts, KPIS } from "./charts.ts";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();

  let spark = $state<HTMLCanvasElement | null>(null);
  let main = $state<HTMLCanvasElement | null>(null);
  let donut = $state<HTMLCanvasElement | null>(null);
  let category = $state<HTMLCanvasElement | null>(null);
  let kpiSparks = $state<(HTMLCanvasElement | null)[]>([]);

  const RANGES = [
    { days: 7, label: "7 D" },
    { days: 30, label: "30 D" },
    { days: 90, label: "90 D" },
  ] as const;
  let range = $state<number>(30);

  // La paleta de la demo va en `#demo-page` (el color a mano, como `--palette-1`
  // en su `style`) y el tema en `<html>`; un canvas no se entera de ninguno de
  // los dos, así que hay que avisarle a mano.
  let repaint = $state(0);
  $effect(() => {
    const bump = () => {
      repaint += 1;
    };
    const targets: [Element, string[]][] = [[document.documentElement, ["data-theme"]]];
    const page = document.getElementById("demo-page");
    if (page) targets.push([page, ["data-palette", "style"]]);
    const observers = targets.map(([el, attributeFilter]) => {
      const o = new MutationObserver(bump);
      o.observe(el, { attributes: true, attributeFilter });
      return o;
    });
    return () => {
      for (const o of observers) o.disconnect();
    };
  });

  $effect(() => {
    void repaint;
    buildDemoCharts({ spark, main, donut, category, kpiSparks }, range);
  });

  $effect(() => () => destroyDemoCharts());

  const channelsTotal = CHANNELS.reduce((sum, c) => sum + c.val, 0);
</script>

<div id="demo-graficas" class="gallery-group">
  <div class="gallery-group-head">
    <h3>Gráficas</h3>
    <p>Canvas de Chart.js pintados con los colores del sistema</p>
  </div>
  <div class="gallery-grid">
    <!-- Line -->
    {#snippet lineRanges()}
      <div class="chips">
        {#each RANGES as r (r.days)}
          <button
            type="button"
            class="chip"
            class:active={range === r.days}
            onclick={() => (range = r.days)}
          >
            {r.label}
          </button>
        {/each}
      </div>
    {/snippet}
    <article class="card gallery-item wide col-span-2">
      {@render head(
        "Line chart",
        "Dos series y el periodo anterior. En páginas generadas",
        lineRanges,
      )}
      <div class="card-body">
        <div class="chart-figure"><canvas bind:this={main}></canvas></div>
        <div class="legend">
          <span class="legend-item">
            <i class="swatch" style="background: var(--chart-1)"></i>
            Ingresos
            <b class="number">$184.320</b>
          </span>
          <span class="legend-item">
            <i class="swatch" style="background: var(--chart-2)"></i>
            Sesiones
            <b class="number">96.480</b>
          </span>
          <span class="legend-item">
            <i class="swatch" style="background: var(--text-muted); opacity: 0.5"></i>
            Periodo anterior
          </span>
        </div>
      </div>
    </article>
    <!-- Donut -->
    <article class="card gallery-item">
      {@render head("Doughnut chart", "Reparto con el total en el centro. En páginas generadas")}
      <div class="card-body">
        <div class="donut-wrap">
          <canvas bind:this={donut}></canvas>
          <div class="donut-center">
            <b class="number">96,4 K</b>
            <span>sesiones totales</span>
          </div>
        </div>
        <div class="dist-list">
          {#each CHANNELS as c (c.name)}
            <div class="dist">
              <i class="swatch" style="background: var({c.c})"></i>
              <span class="dist-name">{c.name}</span>
              <span class="dist-val number">{c.val.toLocaleString("es-CO")}</span>
              <span class="dist-pct number">{((c.val / channelsTotal) * 100).toFixed(1)} %</span>
            </div>
          {/each}
        </div>
      </div>
    </article>
    <!-- Bar -->
    <article class="card gallery-item col-span-2">
      {@render head("Bar chart", "Una barra por categoría. En páginas generadas")}
      <div class="card-body">
        <div class="bar-figure"><canvas bind:this={category}></canvas></div>
      </div>
    </article>
    <!-- KPI -->
    <article class="card gallery-item wide col-span-2">
      {@render head("Metric", "Cifra con tendencia y minigráfica. En páginas generadas")}
      <div class="card-body">
        <div class="kpis">
          {#each KPIS as k, i (k.label)}
            <article class="card kpi">
              <div class="kpi-head">
                <span class="kpi-ico"><i class="hgi-stroke {k.ico}"></i></span>
                <span class="kpi-label">{k.label}</span>
              </div>
              <div>
                <div class="kpi-row">
                  <span class="kpi-val number">{k.val}</span>
                  <span class="tag {k.up ? 'tag-success' : 'tag-error'}">
                    <i class="hgi-stroke hgi-arrow-{k.up ? 'up' : 'down'}-right-01"></i>
                    {k.d}
                  </span>
                </div>
                <div class="kpi-foot number">{k.foot}</div>
              </div>
              <div class="spark"><canvas bind:this={kpiSparks[i]}></canvas></div>
            </article>
          {/each}
        </div>
      </div>
    </article>
    <!-- Sparkline -->
    <article class="card gallery-item">
      {@render head("Sparkline", "La tendencia debajo de una cifra. En páginas generadas")}
      <div class="card-body">
        <div class="stat">
          <span class="s-label">Ingresos netos</span>
          <span class="s-val number">
            $184.320 <span class="tag tag-success">
              <i class="hgi-stroke hgi-arrow-up-right-01"></i>
              12.4 %
            </span>
          </span>
          <span class="s-foot">vs. $163.980 del periodo anterior</span>
        </div>
        <div class="spark"><canvas bind:this={spark}></canvas></div>
      </div>
    </article>
  </div>
</div>

<style>
  /* ==========================================================
     Gráficas: la disposición de las figuras, de la hoja de aplicación de
     origen. Chart.js redimensiona el canvas por atributo, así que el alto lo
     fija la figura y el ancho lo manda el CSS.
     ========================================================== */
  .chart-figure {
    height: 16rem;
    padding: var(--sp-10) 0 var(--sp-4);
  }

  .bar-figure {
    height: 14rem;
    padding: var(--sp-10) var(--sp-8) var(--sp-6);
  }

  .chart-figure canvas,
  .bar-figure canvas {
    width: 100% !important;
  }

  /* Leyenda de una gráfica: cuadro de color + texto. Es del catálogo de
     origen; el de aquí no la trae. */
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-18);
    padding-top: var(--sp-12);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-secondary);

    & b {
      color: var(--text-primary);
      font-weight: 700;
    }
  }

  .swatch {
    width: 0.5625rem;
    height: 0.5625rem;
    flex: none;
    border-radius: 0.1875rem;
  }

  /* Donut: el total va en el centro del agujero */
  .donut-wrap {
    position: relative;
    height: 12rem;
    padding: var(--sp-8) var(--sp-6) 0;

    & .donut-center {
      position: absolute;
      /* Mismo recuadro que el canvas, menos su acolchado */
      inset: var(--sp-8) var(--sp-6) 0;
      display: grid;
      place-content: center;
      text-align: center;
      /* No debe robarle el hover a los segmentos */
      pointer-events: none;

      & b {
        display: block;
        font-size: var(--text-xl);
        font-weight: 800;
        letter-spacing: -0.025em;
      }

      & span {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-muted);
      }
    }
  }

  /* Reparto por canal: la leyenda con cifras del donut */
  .dist-list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-top: var(--sp-12);

    & .dist {
      display: flex;
      align-items: center;
      gap: var(--sp-10);
      padding: var(--sp-8);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      transition: background 0.15s;

      &:hover {
        background: var(--bg-field);
      }
    }

    & .dist-name {
      font-weight: 600;
    }

    & .dist-val {
      margin-left: auto;
      font-weight: 700;
    }

    & .dist-pct {
      width: 2.75rem;
      text-align: right;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
    }
  }

  /* La sparkline se sale del acolchado del cuerpo para tocar los bordes de la
     card, como en el panel de origen. */
  .spark {
    height: 2.75rem;
    margin: var(--sp-12) calc(var(--sp-20) * -1) calc(var(--sp-18) * -1);
  }
</style>
