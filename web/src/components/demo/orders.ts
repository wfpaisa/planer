/**
 * Los pedidos de la ficha Table de la galería: los mismos datos de ejemplo
 * del panel de referencia (`/home/projects/ia/dashboard`,
 * `lib/data.svelte.js`), con sus ayudas de formato.
 *
 * Allí la lista es `$state` porque el formulario de alta le añade filas;
 * aquí nadie la toca, así que viaja como una constante normal.
 */

export type OrderStatus = "ok" | "wait" | "fail";

export interface DemoOrder {
  /** Nombre del cliente. */
  n: string;
  /** Correo del cliente. */
  m: string;
  /** Referencia del pedido. */
  id: string;
  /** Fecha del pedido, en milisegundos. */
  ts: number;
  st: OrderStatus;
  /** Importe, sin divisa: la ficha lo da formateado. */
  amount: number;
}

export const ORDERS: DemoOrder[] = [
  {
    n: "Lucía Marín",
    m: "lucia@northwind.co",
    id: "#AR-4821",
    ts: new Date(2026, 8, 12, 9, 40).getTime(),
    st: "ok",
    amount: 1240.0,
  },
  {
    n: "Diego Cabrera",
    m: "diego@lumen.dev",
    id: "#AR-4820",
    ts: new Date(2026, 8, 12, 8, 15).getTime(),
    st: "ok",
    amount: 386.5,
  },
  {
    n: "Nora Esteban",
    m: "nora@vela.studio",
    id: "#AR-4819",
    ts: new Date(2026, 8, 11, 17, 5).getTime(),
    st: "wait",
    amount: 912.0,
  },
  {
    n: "Iván Ferrer",
    m: "ivan@meridian.io",
    id: "#AR-4818",
    ts: new Date(2026, 8, 11, 10, 30).getTime(),
    st: "ok",
    amount: 148.9,
  },
  {
    n: "Paula Sáenz",
    m: "paula@cobalto.es",
    id: "#AR-4817",
    ts: new Date(2026, 8, 10, 19, 20).getTime(),
    st: "fail",
    amount: 675.2,
  },
  {
    n: "Marc Olivares",
    m: "marc@atlas.group",
    id: "#AR-4816",
    ts: new Date(2026, 8, 10, 9, 0).getTime(),
    st: "ok",
    amount: 2104.0,
  },
  {
    n: "Carla Bustos",
    m: "carla@orbita.io",
    id: "#AR-4815",
    ts: new Date(2026, 8, 9, 18, 45).getTime(),
    st: "ok",
    amount: 540.0,
  },
  {
    n: "Hugo Beltrán",
    m: "hugo@nimbus.tech",
    id: "#AR-4814",
    ts: new Date(2026, 8, 9, 12, 10).getTime(),
    st: "wait",
    amount: 1785.4,
  },
  {
    n: "Alicia Roldán",
    m: "alicia@ferro.studio",
    id: "#AR-4813",
    ts: new Date(2026, 8, 8, 16, 25).getTime(),
    st: "ok",
    amount: 264.0,
  },
  {
    n: "Tomás Iglesias",
    m: "tomas@delta.works",
    id: "#AR-4812",
    ts: new Date(2026, 8, 8, 9, 55).getTime(),
    st: "fail",
    amount: 812.3,
  },
  {
    n: "Sara Montoya",
    m: "sara@quanta.co",
    id: "#AR-4811",
    ts: new Date(2026, 8, 7, 20, 10).getTime(),
    st: "ok",
    amount: 3120.0,
  },
  {
    n: "Rubén Casas",
    m: "ruben@vertice.dev",
    id: "#AR-4810",
    ts: new Date(2026, 8, 7, 11, 30).getTime(),
    st: "ok",
    amount: 96.5,
  },
  {
    n: "Elena Vidal",
    m: "elena@prisma.es",
    id: "#AR-4809",
    ts: new Date(2026, 8, 6, 15, 0).getTime(),
    st: "wait",
    amount: 458.75,
  },
  {
    n: "Iker Zabala",
    m: "iker@holon.io",
    id: "#AR-4808",
    ts: new Date(2026, 8, 6, 8, 40).getTime(),
    st: "ok",
    amount: 1330.0,
  },
];

/* Estado del pedido → clase del badge + texto */
export const BADGE: Record<OrderStatus, readonly [string, string]> = {
  ok: ["tag-success", "Pagado"],
  wait: ["tint-3", "Pendiente"],
  fail: ["tag-error", "Fallido"],
};

export const fmtAmount = (v: number): string =>
  v.toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/* Iniciales de un nombre, para el avatar */
export const initials = (name: string): string =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("");
