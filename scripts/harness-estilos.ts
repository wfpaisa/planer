/**
 * El banco de pruebas del sistema de estilos de una página.
 *
 * Uso:  bun run harness
 *
 * No hace falta servidor ni navegador: todo lo que comprueba se puede leer del
 * código, y por eso puede correr en cada cambio.
 *
 * Hay tres cosas que tienen que decir lo mismo y viven en tres sitios:
 *
 *   1. `web/src/styles/*`      lo que de verdad existe
 *   2. `shared/htmlContract.ts` lo que se le promete al modelo
 *   3. `server/html/htmlAudit.ts`   lo que se le reprocha cuando se sale
 *
 * Separarse es fácil y no avisa. Si el contrato enseña `class="tabla"` y en el
 * catálogo la clase se llama `.table`, el modelo escribe una página sin
 * vestir y nadie se entera hasta verla. Si la revision reprocha una variable
 * que si existe, el modelo la quita y rompe la pantalla para callar un aviso
 * falso. Esto ata los tres.
 *
 * Y una cuarta: la revision tiene que saltar con lo que esta mal y callarse
 * con lo que esta bien. Un aviso falso cuesta una ronda entera --el modelo lo
 * arregla y estropea algo por el camino-- así que los casos buenos pesan aquí
 * tanto como los malos.
 */
import { auditPageHtml, KNOWN_CLASSES, KNOWN_VARS } from "../server/html/htmlAudit.ts";
import { PAGE_STYLES } from "../server/page/pageStyles.ts";
import {
  buildHtmlContract,
  buildHtmlDocs,
  htmlGuide,
  SPACE_VARS,
  TEXT_VARS,
  THEME_VARS,
} from "../shared/htmlContract.ts";
import { ICON_NAME_SET } from "../shared/iconNames.ts";
import { PAGE_ICONS, SUBSET_ICONS } from "../shared/icons.ts";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok    ${name}`);
    return;
  }
  failed++;
  console.log(`  FALLA ${name}${detail ? `\n        ${detail}` : ""}`);
}

/* ------------------------------------------------------------------ */
/* 1. Lo que el contrato enseña, ¿existe?                               */
/* ------------------------------------------------------------------ */

const contract = [
  buildHtmlDocs(),
  buildHtmlContract({ tables: [], profile: "compact" }),
  ...["estilos", "datos", "graficas", "bloques", "iconos"].map((topic) => htmlGuide(topic)),
].join("\n");

console.log("\nEl contrato contra el catalogo");

/*
 * Las clases que el contrato escribe dentro de un `class="..."`. Solo esas: el
 * texto también nombra clases en prosa (`.table-wrap`), y ahi un nombre suelto
 * puede ser cualquier cosa. Lo que se comprueba es lo copiable.
 */
const taught = new Set<string>();
for (const m of contract.matchAll(/class="([^"]+)"/g)) {
  for (const token of m[1].split(/\s+/)) {
    if (token) taught.add(token);
  }
}

/**
 * Las que no salen de la hoja de componentes y no tienen por que estar ahi:
 * los iconos, que son la fuente, y los modificadores que el catálogo declara
 * anidados (`&.sm`, `&.info`) y por eso no aparecen como clase de primer nivel.
 */
const OWN =
  /^(?:icon(?:-[\w-]+)?|tint-\d+|b-(?:success|warning|error|wait)|num|sm|round|error|done|active|info|ok|warn|danger|left|right|wide)$/;
/**
 * Las que el contrato inventa como ejemplo de "una clase tuya, descriptiva".
 * Van en espanol porque eso es justo lo que el contrato pide para ellas, y es
 * lo que las distingue de las del catálogo, que estan en ingles.
 */
const EXAMPLES = /^(?:lista-|tarjeta-|cabecera|caja-|pantalla-|mi-)/;

const missing = [...taught].filter(
  (name) => !KNOWN_CLASSES.has(name) && !OWN.test(name) && !EXAMPLES.test(name),
);
check(
  "toda clase que el contrato ensena existe en la hoja",
  missing.length === 0,
  missing.length ? `sin definir: ${missing.join(", ")}` : "",
);

/*
 * Y al reves para las variables: el contrato promete tres listas de nombres
 * --THEME_VARS, SPACE_VARS, TEXT_VARS-- y las promete por escrito, en una
 * tabla que el modelo lee como cerrada. Si una deja de declararse, lo que el
 * modelo escriba con ella se queda sin valor y el hueco desaparece.
 */
const promised = [...THEME_VARS, ...SPACE_VARS, ...TEXT_VARS];
const undeclared = promised.filter((name) => !KNOWN_VARS.has(name.toLowerCase()));
check(
  "toda variable que el contrato promete se declara en la hoja",
  undeclared.length === 0,
  undeclared.length ? `sin declarar: ${undeclared.join(", ")}` : "",
);

/* ------------------------------------------------------------------ */
/* 2. La hoja, ¿llega entera?                                           */
/* ------------------------------------------------------------------ */

console.log("\nLa hoja que recibe una pagina");

check("trae el catalogo de componentes", PAGE_STYLES.includes(".btn-primary"));
check("trae las paletas", PAGE_STYLES.includes('[data-palette="lava"]'));
check("trae los nombres del contrato", PAGE_STYLES.includes("--surface-card:"));
check("trae la paleta viva", PAGE_STYLES.includes("--vivid-teal:"));
check("trae la capa de pagina", PAGE_STYLES.includes(".plane-tarjeta"));
/*
 * El contrato le dice al modelo que esconda con `hidden`. El navegador lo
 * esconde con el peso de una etiqueta, así que cualquier pieza del catálogo
 * con `display` propio --`.card` es `display: flex`-- lo anula y la sección se
 * queda a la vista sin que nada avise. Que la hoja lo remate es lo que hace
 * cierta esa frase; ver `web/src/styles/page.css`.
 */
check(
  "hace que `hidden` gane al display del catalogo",
  /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/i.test(PAGE_STYLES),
  "sin esto una .card con hidden se sigue viendo",
);
check(
  "no se cuela ningun @import sin resolver",
  !/@import/.test(PAGE_STYLES),
  "un @import relativo no resuelve desde /plane/estilos.css",
);

/* ------------------------------------------------------------------ */
/* 3. La revision, ¿acierta?                                            */
/* ------------------------------------------------------------------ */

console.log("\nLa revision de estilo");

/** Una página escrita como dice el contrato. No puede saltar nada. */
const BUENA = `<!doctype html>
<html><head>
<link rel="stylesheet" href="/plane/estilos.css">
<style>
  .pantalla-pedidos { display: grid; gap: var(--space-6); padding: var(--space-8); }
  .cabecera-pedidos h1 { color: var(--color-primary-text); }
  .banda-total { background: var(--color-primary); color: var(--color-primary-content); }
  .etiqueta-pagado { background: var(--vivid-green); color: var(--vivid-green-ink); }
  .suave { background: color-mix(in oklab, var(--vivid-teal) 14%, var(--surface-card)); color: var(--ink); }
  .hueco { gap: var(--space-7, 1.75rem); }
</style>
</head><body>
  <div class="pantalla-pedidos">
    <header class="cabecera-pedidos"><h1>Pedidos</h1><p>Lo que hay abierto hoy.</p></header>
    <section class="hero">
      <h1 class="hero-title">Pedidos del mes</h1>
      <p class="hero-sub">Lo abierto, lo entregado y lo que ya pasó de fecha.</p>
      <div class="hero-actions">
        <button class="btn btn-primary"><i class="icon icon-add-01"></i>Nuevo pedido</button>
        <button class="btn">Ver atrasados</button>
      </div>
    </section>
    <div class="table-card card"><div class="table-wrap">
      <table class="table"><thead><tr><th>Cliente</th><th class="num">Total</th></tr></thead>
      <tbody><tr><td>Lucía Marín</td><td class="num">184,20 €</td></tr></tbody>
      <tfoot><tr><td colspan="2"><div class="table-foot"><span class="pg-info">248 pedidos</span></div></td></tr></tfoot></table>
    </div></div>
    <button class="btn btn-primary"><i class="icon icon-add-01"></i>Nuevo pedido</button>
    <label class="choice"><input type="checkbox"><i class="choice-box ico-nudge icon icon-tick-02"></i><span>Solo pagados</span></label>
    <input class="field-control sm" type="search" placeholder="Buscar">
  </div>
</body></html>`;

const limpia = auditPageHtml(BUENA);
check(
  "una pagina bien escrita no dispara ningun aviso",
  limpia.length === 0,
  limpia.map((f) => `${f.regla}: ${f.donde}`).join("\n        "),
);

/** Cada caso malo, con la regla que le tiene que saltar. */
const MALAS: { nombre: string; regla: string; html: string }[] = [
  {
    nombre: "el pie de la tabla colgado fuera del <table>",
    regla: "table-foot-outside-tfoot",
    html: `<div class="table-card card"><div class="table-wrap"><table class="table"><tbody><tr><td>Lucía Marín</td></tr></tbody></table></div><div class="table-foot"><span class="pg-info">248 pedidos</span></div></div>`,
  },
  {
    nombre: "un color a mano",
    regla: "hard-coded-colour",
    html: `<style>.caja { background: #f3f4f6; }</style>`,
  },
  {
    nombre: "un color con nombre",
    regla: "hard-coded-colour",
    html: `<style>.caja { border: 1px solid white; }</style>`,
  },
  {
    nombre: "un rgba inventado",
    regla: "hard-coded-colour",
    html: `<style>.caja { color: rgba(0,0,0,.6); }</style>`,
  },
  {
    nombre: "una variable que no existe",
    regla: "unknown-variable",
    html: `<style>.caja { gap: var(--space-7); }</style>`,
  },
  {
    nombre: "el relleno de marca como letra",
    regla: "fill-used-as-ink",
    html: `<style>.titulo { color: var(--color-primary); }</style>`,
  },
  {
    nombre: "un color vivo como letra",
    regla: "fill-used-as-ink",
    html: `<style>.dato { color: var(--vivid-amber); }</style>`,
  },
  {
    nombre: "un relleno sin su tinta",
    regla: "fill-without-ink",
    html: `<style>.banda { background: var(--color-secondary); padding: 1rem; }</style>`,
  },
  {
    nombre: "la tinta del papel dentro de la banda de portada",
    regla: "ink-on-the-brand-band",
    html: `<style>.hero .dato { color: var(--ink-soft); }</style>`,
  },
  {
    nombre: "una parte de la banda con la tinta del papel",
    regla: "ink-on-the-brand-band",
    html: `<style>.hero-sub { color: var(--text-secondary); }</style>`,
  },
  {
    nombre: "la banda repintada con una superficie",
    regla: "hero-repainted",
    html: `<style>.hero { background: var(--surface-card); padding: 2rem; }</style>`,
  },
  {
    nombre: "un boton sin clase",
    regla: "catalogue-piece-unused",
    html: `<button>Guardar</button>`,
  },
  {
    nombre: "una tabla sin clase",
    regla: "catalogue-piece-unused",
    html: `<table><tr><td>x</td></tr></table>`,
  },
  {
    nombre: "un icono dibujado a mano",
    regla: "hand-drawn-icon",
    html: `<svg viewBox="0 0 16 16"><path d="M0 0"/></svg>`,
  },
  { nombre: "un emoji", regla: "emoji", html: `<p>Listo ✅</p>` },
  {
    nombre: "el contenido directo dentro de una tarjeta",
    regla: "card-without-body",
    html: `<article class="tarjeta-servicio card"><h3>Limpieza</h3><p>Controles periódicos.</p></article>`,
  },
  {
    nombre: "la banda sin su aire de abajo",
    regla: "hero-box-changed",
    html: `<style>.hero { max-width: 74rem; margin: 0 auto; padding: var(--space-12) var(--space-8) 0; }</style>`,
  },
];

for (const caso of MALAS) {
  const found = auditPageHtml(caso.html);
  check(
    `salta con ${caso.nombre}`,
    found.some((f) => f.regla === caso.regla),
    found.length ? `saltaron otras: ${found.map((f) => f.regla).join(", ")}` : "no salto ninguna",
  );
}

/** Lo que NO puede saltar, aunque se le parezca. */
const CALLA: { nombre: string; html: string }[] = [
  {
    nombre: "un identificador que empieza por almohadilla",
    html: `<style>#lista-pedidos { gap: var(--space-4); }</style>`,
  },
  {
    nombre: "una variable con valor de respaldo",
    html: `<style>.caja { gap: var(--space-7, 1.75rem); }</style>`,
  },
  {
    nombre: "una variable que la propia pagina declara",
    html: `<style>:root { --mia: 2rem; } .caja { gap: var(--mia); }</style>`,
  },
  {
    nombre: "transparent y currentColor",
    html: `<style>.caja { background: transparent; border-color: currentColor; }</style>`,
  },
  { nombre: "un canvas de grafica", html: `<canvas id="ventas"></canvas>` },
  {
    nombre: "una clase de la pagina que empieza como la banda",
    html: `<style>.hero-banner { color: var(--ink); background: var(--surface-card); }</style>`,
  },
  {
    nombre: "la banda repintada, pero con su tinta",
    html: `<style>.hero { background: var(--surface-card); color: var(--ink); }</style>`,
  },
  {
    nombre: "una tarjeta con su cuerpo, tras un comentario",
    html: `<div class="tarjeta-total card">\n  <!-- total -->\n  <div class="card-body"><p>12</p></div></div>`,
  },
  {
    nombre: "una tarjeta con una clase propia que le da aire",
    html: `<style>.tarjeta-nota { padding: var(--space-5); }</style><div class="tarjeta-nota card"><p>Nota</p></div>`,
  },
  {
    nombre: "un indicador, que trae su propio aire",
    html: `<article class="card kpi"><div class="kpi-head"><span class="kpi-label">Ventas</span></div></article>`,
  },
  {
    nombre: "una parte de la banda con su propia medida",
    html: `<style>.hero-sub { max-width: 60ch; }</style>`,
  },
  {
    nombre: "una casilla dentro de su choice",
    html: `<label class="choice"><input type="checkbox"><i class="choice-box"></i></label>`,
  },
];

for (const caso of CALLA) {
  const found = auditPageHtml(caso.html);
  check(
    `calla con ${caso.nombre}`,
    found.length === 0,
    found.map((f) => `${f.regla}: ${f.donde}`).join("\n        "),
  );
}

/* ------------------------------------------------------------------ */
/* 4. Los iconos, ¿estan donde se dibujan?                              */
/* ------------------------------------------------------------------ */

/*
 * La cuarta pareja que se separa sin avisar. Un icono que el modelo nombra y
 * la fuente no tiene sale como un hueco en blanco: ni error, ni aviso, ni
 * nada que mirar. Y son dos saltos --la lista contra la fuente, y la lista
 * contra el subconjunto que va dentro del marco-- porque anadir un nombre a
 * `PAGE_ICONS` y no volver a recortar la fuente deja la página bien en su
 * dirección y en blanco en la vista previa, que es el peor sitio para
 * enterarse.
 */
console.log("\nLos iconos");

const sugeridos = PAGE_ICONS.flatMap((g) => g.names);
const inventados = sugeridos.filter((n) => !ICON_NAME_SET.has(n));
check(
  "cada icono sugerido al modelo existe en la fuente",
  inventados.length === 0,
  inventados.join(", "),
);

const repetidos = sugeridos.filter((n, i) => sugeridos.indexOf(n) !== i);
check("y ninguno esta dos veces", repetidos.length === 0, repetidos.join(", "));

const comunes = await Bun.file("web/public/iconos/comunes.css").text();
const recortados = new Set(
  [...comunes.matchAll(/\.icon\.icon-([a-z0-9-]+)::before/g)].map((m) => m[1]),
);
const sinRecortar = SUBSET_ICONS.filter((n) => !recortados.has(n));
check(
  "y el subconjunto del marco los lleva todos",
  sinRecortar.length === 0,
  sinRecortar.length
    ? `faltan ${sinRecortar.join(", ")}: vuelve a correr \`bun run iconos:subconjunto\``
    : "",
);
check("el subconjunto lleva la fuente pegada dentro", comunes.includes("data:font/woff2;base64,"));

console.log(failed ? `\n${failed} comprobacion(es) fallando\n` : "\nTodo en su sitio\n");
process.exit(failed ? 1 : 0);
