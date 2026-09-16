/**
 * La revision de estilo de una pagina.
 *
 * `revisar_errores` dibuja la pagina y trae lo que solto la consola. Eso coge
 * lo que falla; no coge lo que se ve mal. Una pagina puede dibujarse limpia y
 * aun asi haberse escrito su propio boton con un azul a mano, apuntar a una
 * variable que no existe --que no falla: se queda sin valor y el hueco
 * desaparece sin avisar-- o poner el color de relleno de la marca como letra,
 * que es lo unico que arruina una pantalla entera.
 *
 * Esto lee el HTML y lo dice. Sin navegador, asi que funciona siempre: aunque
 * no haya nadie mirando, aunque la peticion venga de fuera del panel.
 *
 * Los mensajes van en ingles porque los lee el modelo, como todo lo que se le
 * pasa (ver `shared/htmlContract.ts`). Lo que el modelo escribe sigue siendo
 * espanol.
 *
 * La regla al escribir una comprobacion nueva: **ninguna puede saltar sobre
 * una pagina bien escrita**. Un aviso falso se paga caro -- el modelo lo
 * arregla, rompe algo por el camino y gasta una ronda. Por eso aqui no hay
 * heuristicas de "esto parece una tarjeta hecha a mano": solo cosas que o son
 * ciertas o no lo son.
 */
import { PAGE_STYLES } from "./pageStyles.ts";

/** Lo que se encontro, con lo justo para poder arreglarlo. */
export interface StyleFinding {
  /** El nombre corto de la comprobacion, para poder agruparlas. */
  regla: string;
  /** Que pasa y que hay que hacer, dicho para quien escribio el HTML. */
  mensaje: string;
  /** El trozo que lo dispara, recortado. Sin esto no se sabe donde mirar. */
  donde: string;
}

/** Cuantos avisos de una misma regla se devuelven antes de resumir. */
const MAX_POR_REGLA = 4;

/* ------------------------------------------------------------------ */
/* Lo que la hoja de la casa declara                                    */
/* ------------------------------------------------------------------ */

/**
 * Todas las variables que la hoja servida declara, sacadas de la hoja misma.
 *
 * Se calcula y no se escribe a mano a proposito: es la lista contra la que se
 * decide si un `var(--algo)` existe, y una lista escrita aparte se quedaria
 * vieja el dia que alguien anada un token. Aqui no puede.
 */
export const KNOWN_VARS: ReadonlySet<string> = new Set(
  [...PAGE_STYLES.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1].toLowerCase()),
);

/**
 * Las clases que la hoja define, tambien sacadas de la hoja.
 *
 * Sirve para lo contrario que `KNOWN_VARS`: para saber si una clase escrita en
 * el HTML es del catalogo o es de la pagina. Una clase de la pagina no tiene
 * nada de malo -- lo que se mira es si hay piezas del catalogo sin usar.
 */
export const KNOWN_CLASSES: ReadonlySet<string> = new Set(
  [...PAGE_STYLES.matchAll(/\.(-?[_a-z][\w-]*)/gi)].map((m) => m[1]),
);

/* ------------------------------------------------------------------ */
/* Trocear el documento                                                 */
/* ------------------------------------------------------------------ */

/** El CSS del documento: lo de los `<style>` y lo de cada `style=""`. */
function cssOf(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) out.push(m[1]);
  for (const m of html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) out.push(`x{${m[1]}}`);
  return out;
}

/** Un bloque de declaraciones: lo que hay entre llaves, con su selector. */
interface Block {
  selector: string;
  body: string;
}

/**
 * Los bloques de una hoja, sin entrar en los anidados.
 *
 * No es un parser de CSS y no pretende serlo: parte por llaves y se queda con
 * el ultimo nivel, que es donde estan las declaraciones. Un `@media` con
 * reglas dentro sale como varios bloques, que es justo lo que hace falta.
 */
function blocksOf(css: string): Block[] {
  const out: Block[] = [];
  const re = /([^{}]*)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const body = m[2].trim();
    if (body) out.push({ selector: m[1].trim().split("\n").pop()?.trim() ?? "", body });
  }
  return out;
}

/** Las declaraciones de un bloque, ya partidas en propiedad y valor. */
function declsOf(body: string): { prop: string; value: string }[] {
  const out: { prop: string; value: string }[] = [];
  for (const chunk of body.split(";")) {
    const at = chunk.indexOf(":");
    if (at < 0) continue;
    const prop = chunk.slice(0, at).trim().toLowerCase();
    const value = chunk.slice(at + 1).trim();
    // Una propiedad propia (`--mia: ...`) declara, no consume: su valor se
    // revisa igual, pero no cuenta como "color a mano" de un `background`.
    if (prop && value) out.push({ prop, value });
  }
  return out;
}

/** Recorta un trozo para poder ensenarlo sin llenar la respuesta. */
const snip = (text: string, max = 90) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

/* ------------------------------------------------------------------ */
/* Las comprobaciones                                                   */
/* ------------------------------------------------------------------ */

/**
 * Un color escrito a mano.
 *
 * Se mira el VALOR de cada declaracion, nunca el selector: `#lista` es un
 * identificador y no un color, y buscar `#` en el texto suelto los confundiria.
 */
const HEX = /#[0-9a-f]{3,8}\b/i;
const FUNC_COLOR = /\b(?:rgba?|hsla?|hwb|lab|lch)\s*\(/i;
/** Los nombres de color que de verdad aparecen escritos. No hacen falta 148. */
const NAMED =
  /(?:^|[\s,(])(?:white|black|red|blue|green|yellow|orange|purple|pink|gray|grey|silver|gold|navy|teal|lime|cyan|magenta|brown|beige|ivory|salmon|coral|crimson|indigo|violet|olive|maroon|aqua|fuchsia)(?:$|[\s,)])/i;

/** Las propiedades cuyo valor es un color y por tanto se revisa. */
const COLOR_PROPS =
  /^(?:color|background|background-color|border(?:-[a-z]+)?-color|border|border-[a-z]+|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color|column-rule-color|--[a-z0-9-]+)$/;

function checkColors(css: string[], out: StyleFinding[]): void {
  for (const sheet of css) {
    for (const block of blocksOf(sheet)) {
      for (const { prop, value } of declsOf(block.body)) {
        if (!COLOR_PROPS.test(prop)) continue;
        // `oklch()` y `color-mix()` son los que usa la casa; un color a mano
        // dentro de un color-mix sigue siendo un color a mano, asi que no se
        // perdona el valor entero, solo se busca la forma escrita a pelo.
        if (!HEX.test(value) && !FUNC_COLOR.test(value) && !NAMED.test(value)) continue;
        out.push({
          regla: "hard-coded-colour",
          mensaje:
            "A colour written by hand does not follow the app's palette, and stays the same in dark mode. Use the house variables (--surface-*, --ink*, --line*, --color-primary/secondary) or, if it has to mean something, the vivid palette (--vivid-<name> with its --vivid-<name>-ink).",
          donde: snip(`${block.selector} { ${prop}: ${value} }`),
        });
      }
    }
  }
}

/**
 * Una variable que no existe.
 *
 * Es la que mas cuesta encontrar a ojo: no falla, no avisa y no se ve. La
 * propiedad se queda sin valor, el hueco desaparece y la pantalla queda
 * descuadrada sin que nada lo diga.
 */
function checkVars(html: string, css: string[], out: StyleFinding[]): void {
  // Lo que el propio documento declara vale, claro: una pagina puede tener
  // sus variables. Se recogen antes de juzgar ningun uso.
  const own = new Set<string>();
  for (const sheet of css) {
    for (const m of sheet.matchAll(/(--[a-z0-9-]+)\s*:/gi)) own.add(m[1].toLowerCase());
  }
  // Y las que deja el puente en la raiz desde JavaScript.
  for (const m of html.matchAll(/setProperty\(\s*["'](--[a-z0-9-]+)["']/gi)) {
    own.add(m[1].toLowerCase());
  }

  const seen = new Set<string>();
  for (const sheet of css) {
    for (const m of sheet.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/gi)) {
      const name = m[1].toLowerCase();
      // Con valor de respaldo --`var(--x, 1rem)`-- no hay hueco que desaparezca.
      if (m[2] === ",") continue;
      if (own.has(name) || KNOWN_VARS.has(name) || seen.has(name)) continue;
      seen.add(name);
      out.push({
        regla: "unknown-variable",
        mensaje: `var(${name}) is not a house variable and the page does not declare it either. A property pointing at a variable that does not exist ends up with no value at all: the gap vanishes and nothing warns you. Use one from the contract, or write the value.`,
        donde: `var(${name})`,
      });
    }
  }
}

/** Los rellenos de marca: los que traen tinta propia y no se pueden leer. */
const FILL_VARS = /var\(\s*--(?:color-primary|color-secondary|accent|palette-1)\s*\)/i;
const VIVID_FILL = /var\(\s*--vivid-([a-z]+)\s*\)/i;

/**
 * El color de relleno usado como letra.
 *
 * Es el error que arruina una pantalla entera y el mas facil de cometer: el
 * hexadecimal de la empresa puede ser un amarillo, y un titulo amarillo sobre
 * papel blanco no se lee. Para eso estan las variantes `-text`.
 */
function checkFillAsInk(css: string[], out: StyleFinding[]): void {
  for (const sheet of css) {
    for (const block of blocksOf(sheet)) {
      for (const { prop, value } of declsOf(block.body)) {
        if (prop !== "color") continue;
        if (FILL_VARS.test(value)) {
          out.push({
            regla: "fill-used-as-ink",
            mensaje:
              "That variable is the brand colour as it was chosen, meant to fill with. As letters over a surface it may be unreadable --the brand can be a yellow. Use --color-primary-text or --color-secondary-text, which are the same hue already taken to a lightness that contrasts.",
            donde: snip(`${block.selector} { color: ${value} }`),
          });
          continue;
        }
        const vivid = VIVID_FILL.exec(value);
        if (vivid) {
          out.push({
            regla: "fill-used-as-ink",
            mensaje: `The vivid palette fills, it does not letter: var(--vivid-${vivid[1]}) as text over a surface does not have the contrast to be read. Use it as a background and put var(--vivid-${vivid[1]}-ink) on top.`,
            donde: snip(`${block.selector} { color: ${value} }`),
          });
        }
      }
    }
  }
}

/**
 * Un relleno solido sin la tinta que le toca.
 *
 * Cada relleno de la casa trae su propia tinta calculada --blanca sobre una
 * marca oscura, negra sobre una clara-- y se voltea sola el dia que la empresa
 * cambia de color. Sin ella, encima del relleno corre el color heredado.
 */
const INK_FOR: Record<string, string> = {
  "--color-primary": "--color-primary-content",
  "--color-secondary": "--color-secondary-content",
  "--accent": "--accent-text",
};

function checkFillWithoutInk(css: string[], out: StyleFinding[]): void {
  for (const sheet of css) {
    for (const block of blocksOf(sheet)) {
      const decls = declsOf(block.body);
      const hasColor = decls.some((d) => d.prop === "color");
      if (hasColor) continue;
      for (const { prop, value } of decls) {
        if (prop !== "background" && prop !== "background-color") continue;
        const fill = /var\(\s*(--color-primary|--color-secondary|--accent)\s*\)/i.exec(value);
        const vivid = VIVID_FILL.exec(value);
        if (!fill && !vivid) continue;
        const ink = fill ? INK_FOR[fill[1].toLowerCase()] : `--vivid-${vivid?.[1]}-ink`;
        out.push({
          regla: "fill-without-ink",
          mensaje: `A solid fill always carries the ink that belongs to it. Add color: var(${ink}) to this rule, so the text on top stays readable when the colour changes or the mode flips.`,
          donde: snip(`${block.selector} { ${prop}: ${value} }`),
        });
        break;
      }
    }
  }
}

/**
 * Piezas del catalogo escritas a pelo.
 *
 * La hoja viste una etiqueta desnuda para que nada salga roto (ver
 * `styles/page.css`), pero el vestido bueno es el de la clase: con ella vienen
 * los tamanos, los estados y el foco. Esto no es un fallo, es una pieza sin
 * estrenar, y por eso el mensaje lo dice asi.
 */
const CATALOG_FOR: { tag: string; clase: string; que: string }[] = [
  { tag: "button", clase: "btn", que: "the button of the house, with its sizes and states" },
  { tag: "table", clase: "table", que: "the house table, inside a .table-card" },
  { tag: "select", clase: "field-control", que: "the house field" },
  { tag: "textarea", clase: "field-control", que: "the house field" },
];

function checkBareElements(html: string, out: StyleFinding[]): void {
  for (const { tag, clase, que } of CATALOG_FOR) {
    const re = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
    let bare = 0;
    let sample = "";
    for (const m of html.matchAll(re)) {
      if (/\sclass\s*=/i.test(m[1] ?? "")) continue;
      bare++;
      if (!sample) sample = snip(m[0], 60);
    }
    if (!bare) continue;
    out.push({
      regla: "catalogue-piece-unused",
      mensaje: `${bare} <${tag}> without a class. Write class="${clase}": it is ${que}, and it is already in the stylesheet the page loads.`,
      donde: sample,
    });
  }

  // Un <input> se mira aparte: la casilla y el interruptor tienen su propio
  // marcado (`.choice`) y ahi el input va desnudo a proposito.
  let bareInputs = 0;
  let sample = "";
  for (const m of html.matchAll(/<input(\s[^>]*)?>/gi)) {
    const attrs = m[1] ?? "";
    if (/\sclass\s*=/i.test(attrs)) continue;
    if (/type\s*=\s*["']?(?:checkbox|radio|range|hidden|submit|button)/i.test(attrs)) continue;
    bareInputs++;
    if (!sample) sample = snip(m[0], 60);
  }
  if (bareInputs) {
    out.push({
      regla: "catalogue-piece-unused",
      mensaje: `${bareInputs} <input> without a class. Inside a .field it needs nothing; loose --a search box, a cell-- write class="field-control".`,
      donde: sample,
    });
  }
}

/**
 * El pie de la tabla escrito fuera de la tabla.
 *
 * `.table-foot` es el pie de un `<table>`, y su sitio es el `<tfoot>`, en una
 * celda que cruza todas las columnas. Colgado como `<div>` detras de
 * `</table>` se ve casi igual, pero deja de ser parte de la tabla: no lo lee
 * quien navega con lector, y en pantalla estrecha se queda fuera del scroll
 * horizontal. Es cierto o no lo es --o el pie cuelga de un `<tfoot>` abierto,
 * o no cuelga--, asi que no puede saltar sobre una pagina bien escrita.
 */
function checkTableFoot(html: string, out: StyleFinding[]): void {
  for (const m of html.matchAll(/<[a-z]+\s[^>]*class\s*=\s*["'][^"']*\btable-foot\b/gi)) {
    const antes = html.slice(0, m.index);
    const abre = antes.toLowerCase().lastIndexOf("<tfoot");
    const cierra = antes.toLowerCase().lastIndexOf("</tfoot");
    if (abre !== -1 && abre > cierra) continue;
    out.push({
      regla: "table-foot-outside-tfoot",
      mensaje:
        'A .table-foot outside the table. It is the table\'s footer, so it goes inside <tfoot>, in a cell spanning every column: <tfoot><tr><td colspan="N"><div class="table-foot">...</div></td></tr></tfoot>. Hung as a <div> after </table> it looks the same but stops being part of the table.',
      donde: snip(m[0], 60),
    });
  }
}

/** Iconos dibujados a mano. La fuente ya esta cargada en el documento. */
function checkIcons(html: string, out: StyleFinding[]): void {
  const svgs = [...html.matchAll(/<svg[^>]*>/gi)];
  if (svgs.length) {
    out.push({
      regla: "hand-drawn-icon",
      mensaje: `${svgs.length} <svg> in the page. The document already loads the icon font: an icon is <i class="hgi-stroke hgi-<name>"></i>, which takes the colour and the size of its line on its own. Charts are the exception --those are a <canvas> drawn by plane.grafica.`,
      donde: snip(svgs[0][0], 60),
    });
  }

  // Los emojis se cuelan como icono y se dibujan distinto en cada sistema.
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  // Sin el selector de variacion (U+FE0F): nunca aparece solo, y como parte
  // de una clase de caracteres es lo que la vuelve ambigua.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.exec(text);
  if (emoji) {
    out.push({
      regla: "emoji",
      mensaje:
        "An emoji is drawn differently on every system, does not take the theme's colour and turns any screen into a draft. Use the icon font.",
      donde: snip(text.slice(Math.max(0, emoji.index - 30), emoji.index + 30), 60),
    });
  }
}

/* ------------------------------------------------------------------ */
/* La revision                                                          */
/* ------------------------------------------------------------------ */

/**
 * Revisa el HTML de una pagina contra el sistema de la casa.
 *
 * Devuelve la lista tal cual, ya recortada: como mucho `MAX_POR_REGLA` de cada
 * clase de aviso, porque veinte veces el mismo fallo no dice mas que cuatro y
 * llena la respuesta que lee el modelo.
 */
export function auditPageHtml(html: string): StyleFinding[] {
  if (!html.trim()) return [];
  const css = cssOf(html);
  const found: StyleFinding[] = [];

  checkColors(css, found);
  checkVars(html, css, found);
  checkFillAsInk(css, found);
  checkFillWithoutInk(css, found);
  checkBareElements(html, found);
  checkTableFoot(html, found);
  checkIcons(html, found);

  const count = new Map<string, number>();
  const out: StyleFinding[] = [];
  for (const finding of found) {
    const n = (count.get(finding.regla) ?? 0) + 1;
    count.set(finding.regla, n);
    if (n <= MAX_POR_REGLA) out.push(finding);
  }
  for (const [regla, n] of count) {
    if (n <= MAX_POR_REGLA) continue;
    out.push({
      regla,
      mensaje: `And ${n - MAX_POR_REGLA} more of the same. Fix them all, not just the ones listed.`,
      donde: "",
    });
  }
  return out;
}

/** Como se resume la revision en el paso que ve quien construye. */
export function auditSummary(findings: StyleFinding[]): string {
  if (!findings.length) return "Estilo: sigue el sistema";
  const n = findings.filter((f) => f.donde).length;
  return `Estilo: ${n} ${n === 1 ? "aviso" : "avisos"}`;
}
