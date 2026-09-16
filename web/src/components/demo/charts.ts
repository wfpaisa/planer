/**
 * Las gráficas de la galería: los mismos canvas del panel de referencia
 * (`/home/projects/ia/dashboard`, `lib/charts.svelte.js`), vestidos con los
 * tokens de este panel.
 *
 * Chart.js no entiende de variables CSS: pinta sobre un canvas y a un canvas
 * hay que darle colores resueltos. Cada color se despeja en el propio canvas
 * que va a pintarlo, para que herede la paleta de la demo (`data-palette` en
 * `#demo-page`) y el tema del `<html>`; por eso quien llama reconstruye las
 * gráficas al cambiar cualquiera de los dos.
 */

import type { ChartArea } from "chart.js";
import { Chart } from "chart.js/auto";

export interface DemoChartRefs {
  spark: HTMLCanvasElement | null;
  main: HTMLCanvasElement | null;
  donut: HTMLCanvasElement | null;
  category: HTMLCanvasElement | null;
  kpiSparks: (HTMLCanvasElement | null)[];
}

/* Datos de ejemplo, los del panel de referencia. */
const SPARK = [38, 42, 40, 47, 52, 49, 58, 61, 57, 66, 72, 78];

export const KPIS = [
  {
    label: "Ingresos netos",
    val: "$184.320",
    d: "12.4 %",
    up: true,
    foot: "vs. $163.980 anterior",
    ico: "hgi-dollar-circle",
    spark: [38, 42, 40, 47, 52, 49, 58, 61, 57, 66, 72, 78],
    c: "--chart-1",
  },
  {
    label: "Pedidos",
    val: "2.486",
    d: "8.1 %",
    up: true,
    foot: "214 nuevos esta semana",
    ico: "hgi-shopping-bag-02",
    spark: [22, 26, 25, 30, 28, 34, 33, 38, 41, 39, 45, 48],
    c: "--chart-2",
  },
  {
    label: "Ticket medio",
    val: "$74.140",
    d: "-2.3 %",
    up: false,
    foot: "objetivo 78,00 €",
    ico: "hgi-sale-tag-02",
    spark: [52, 50, 53, 49, 48, 51, 47, 46, 48, 45, 44, 43],
    c: "--chart-3",
  },
  {
    label: "Conversión",
    val: "3.82 %",
    d: "0.6 pp",
    up: true,
    foot: "96.480 sesiones",
    ico: "hgi-target-02",
    spark: [28, 30, 29, 33, 35, 34, 37, 36, 40, 42, 41, 46],
    c: "--chart-4",
  },
] as const;

export const CHANNELS = [
  { name: "Búsqueda orgánica", val: 38240, c: "--chart-1" },
  { name: "Campañas de pago", val: 24610, c: "--chart-2" },
  { name: "Redes sociales", val: 18930, c: "--chart-3" },
  { name: "Directo y correo", val: 14700, c: "--chart-4" },
] as const;

const CATEGORY_SALES = [
  { name: "Software", val: 52400, c: "--chart-1" },
  { name: "Servicios", val: 38150, c: "--chart-2" },
  { name: "Hardware", val: 21870, c: "--chart-3" },
  { name: "Formación", val: 14300, c: "--chart-4" },
  { name: "Soporte", val: 9760, c: "--chart-2" },
] as const;

/**
 * Color resuelto de una variable CSS, despejado en el elemento que va a
 * pintarlo. Los tokens son `light-dark()` y solo un elemento de verdad sabe en
 * qué `color-scheme` y bajo qué paleta está.
 */
function cssColor(el: HTMLElement, name: string): string {
  el.style.color = "";
  el.style.color = `var(${name})`;
  const color = getComputedStyle(el).color;
  el.style.color = "";
  return color;
}

/* Serie sintética reproducible: sin Math.random, para que la gráfica se vea
   igual en cada carga. */
function serie(n: number, seed: number, base: number, amp: number, trend: number): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin((i + seed) / 3.1) * amp * 0.45 + Math.sin((i + seed) / 7.7) * amp * 0.3;
    v += trend + Math.sin((i * i + seed) / 5.3) * amp * 0.22;
    out.push(Math.max(4, Math.round(v + wave)));
  }
  return out;
}

function labelsFor(n: number): string[] {
  const out: string[] = [];
  const end = new Date(2026, 8, 12);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }));
  }
  return out;
}

/* Mismo color con otra alfa, sea cual sea su formato (oklch, hex…). */
const withAlpha = (color: string, alpha: number) => `oklch(from ${color} l c h / ${alpha})`;

/* Degradado bajo la línea: del color al transparente. */
function grad(ctx: CanvasRenderingContext2D, area: ChartArea | undefined, color: string) {
  if (!area) return "transparent";
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, withAlpha(color, 0.24));
  g.addColorStop(1, withAlpha(color, 0));
  return g;
}

let charts: Chart[] = [];

export function destroyDemoCharts() {
  for (const c of charts) c.destroy();
  charts = [];
}

/* Mini-linea sin ejes ni tooltip: la sparkline suelta y la de cada KPI
   comparten exactamente esta misma figura. */
function buildSparkline(el: HTMLCanvasElement, data: readonly number[], color: string): Chart {
  return new Chart<"line">(el, {
    type: "line",
    data: {
      labels: data.map((_, j) => j),
      datasets: [
        {
          data: [...data],
          borderColor: color,
          borderWidth: 2,
          tension: 0.42,
          pointRadius: 0,
          fill: true,
          backgroundColor: (c) => grad(c.chart.ctx, c.chart.chartArea, color),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: { duration: 600 },
    },
  });
}

export function buildDemoCharts(refs: DemoChartRefs, range: number) {
  destroyDemoCharts();

  // Cualquier canvas presente sirve de sonda: todos cuelgan del mismo sitio.
  const probe =
    refs.main ?? refs.donut ?? refs.category ?? refs.spark ?? refs.kpiSparks.find(Boolean) ?? null;
  if (!probe) return;

  const textMuted = cssColor(probe, "--text-muted");
  const gridColor = cssColor(probe, "--chart-grid");
  const surface = cssColor(probe, "--bg-level2");

  Chart.defaults.font.family = getComputedStyle(probe).fontFamily;
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = textMuted;

  const tooltip = {
    backgroundColor: surface,
    titleColor: cssColor(probe, "--text-primary"),
    bodyColor: cssColor(probe, "--text-secondary"),
    borderColor: cssColor(probe, "--border-strong"),
    borderWidth: 1,
    padding: 11,
    cornerRadius: 10,
    boxPadding: 5,
    usePointStyle: true,
    displayColors: true,
    titleFont: { weight: 700, size: 12 },
    bodyFont: { weight: 600, size: 12 },
  };

  /* --- Sparkline --- */
  if (refs.spark) {
    charts.push(buildSparkline(refs.spark, SPARK, cssColor(refs.spark, "--chart-1")));
  }

  /* --- Sparkline de cada KPI: mismo dibujo, un color de la serie por tarjeta --- */
  KPIS.forEach((k, i) => {
    const el = refs.kpiSparks[i];
    if (!el) return;
    charts.push(buildSparkline(el, k.spark, cssColor(el, k.c)));
  });

  /* --- Gráfica principal --- */
  if (refs.main) {
    const n = range;
    const step = n > 45 ? 12 : n > 20 ? 5 : 1;
    const labels = labelsFor(n);
    const c1 = cssColor(refs.main, "--chart-1");
    const c2 = cssColor(refs.main, "--chart-2");

    charts.push(
      new Chart<"line">(refs.main, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Ingresos (€)",
              data: serie(n, 3, 3800, 900, 42),
              borderColor: c1,
              borderWidth: 2.5,
              tension: 0.38,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: c1,
              pointHoverBorderColor: surface,
              pointHoverBorderWidth: 2.5,
              fill: true,
              backgroundColor: (c) => grad(c.chart.ctx, c.chart.chartArea, c1),
            },
            {
              label: "Sesiones",
              data: serie(n, 11, 2400, 620, 26),
              borderColor: c2,
              borderWidth: 2.5,
              tension: 0.38,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: c2,
              pointHoverBorderColor: surface,
              pointHoverBorderWidth: 2.5,
              fill: true,
              backgroundColor: (c) => grad(c.chart.ctx, c.chart.chartArea, c2),
            },
            {
              label: "Periodo anterior",
              data: serie(n, 21, 3300, 700, 24),
              borderColor: textMuted,
              borderWidth: 1.6,
              borderDash: [5, 5],
              tension: 0.38,
              pointRadius: 0,
              pointHoverRadius: 4,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          layout: { padding: { left: 6, right: 6, top: 4, bottom: 0 } },
          plugins: { legend: { display: false }, tooltip },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              offset: false,
              ticks: {
                maxRotation: 0,
                autoSkip: false,
                callback: (_v, i) => (i % step === 0 ? labels[i] : ""),
              },
            },
            y: {
              beginAtZero: false,
              grid: { color: gridColor, drawTicks: false },
              border: { display: false },
              ticks: {
                padding: 6,
                callback: (v) => `${(Number(v) / 1000).toFixed(1).replace(".", ",")} K`,
              },
            },
          },
          animation: { duration: 700 },
        },
      }),
    );
  }

  /* --- Donut de canales --- */
  if (refs.donut) {
    const el = refs.donut;
    charts.push(
      new Chart<"doughnut">(el, {
        type: "doughnut",
        data: {
          labels: CHANNELS.map((c) => c.name),
          datasets: [
            {
              data: CHANNELS.map((c) => c.val),
              backgroundColor: CHANNELS.map((c) => cssColor(el, c.c)),
              borderColor: surface,
              borderWidth: 3,
              hoverOffset: 8,
              borderRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "72%",
          plugins: { legend: { display: false }, tooltip },
          animation: { duration: 700 },
        },
      }),
    );
  }

  /* --- Barras verticales: categorías --- */
  if (refs.category) {
    const el = refs.category;
    charts.push(
      new Chart<"bar">(el, {
        type: "bar",
        data: {
          labels: CATEGORY_SALES.map((c) => c.name),
          datasets: [
            {
              data: CATEGORY_SALES.map((c) => c.val),
              backgroundColor: CATEGORY_SALES.map((c) => cssColor(el, c.c)),
              borderRadius: 6,
              maxBarThickness: 40,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip },
          layout: { padding: { left: 0, right: 0, top: 4, bottom: 0 } },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { font: { weight: 600 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor, drawTicks: false },
              border: { display: false },
              ticks: {
                mirror: true,
                padding: 4,
                z: 1,
                callback: (v) => `${(Number(v) / 1000).toFixed(0)} K`,
              },
            },
          },
          animation: { duration: 700 },
        },
      }),
    );
  }
}
