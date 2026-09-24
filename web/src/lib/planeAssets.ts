/**
 * Los archivos de Planer, incrustados en el documento antes de entrar al marco.
 *
 * Una página no los lleva dentro: lleva sus referencias (`shared/
 * htmlContract.ts`), y así el código que ve el constructor se lee de un
 * vistazo y una mejora del puente llega a todas las páginas sin editarlas.
 *
 * Pedirlos, en cambio, no puede hacerlo la página. El marco es un `srcdoc`
 * sin `allow-same-origin`: su origen es `null`, y desde ahi el navegador no
 * alcanza el servidor --en local lo bloquea de plano, por ser una dirección
 * de red privada pedida desde un origen opaco--. Sin puente no hay tema, ni
 * datos, ni nada: la página sale en Times New Roman y con los huecos vacios.
 *
 * Así que los pide el panel, que si tiene origen, y los pone dentro. El
 * navegador guarda cada archivo una sola vez --misma ruta estable, mismo
 * ETag-- y lo que crece es solo el texto del `srcdoc`.
 *
 * Los iconos entraron aquí después, y por lo mismo. Mientras la fuente era la
 * del CDN no hacia falta: `use.hugeicons.com` es una dirección publica que
 * responde con CORS, y una hoja así si la alcanza un origen opaco. Al traerla
 * a casa --`/iconos/iconos.css`, misma maquina que el panel-- dejo de
 * alcanzarla, y todas las páginas ya escritas se quedaron con los iconos en
 * blanco. Lo que se les pega no es la fuente entera, que son 1,2 MB de texto
 * en cada marco, sino el subconjunto de `comunes.css`: ver `SUBSET_FONT_URL`
 * en `shared/icons.ts`.
 */
import { BRIDGE_PATH, CHARTS_PATH, STYLES_PATH } from "@shared/htmlContract";
import { ICON_NAME_SET } from "@shared/iconNames";
import { FULL_FONT_FILE, ICON_FONT_URL, SUBSET_FONT_URL, SUBSET_ICONS } from "@shared/icons";

/** Cada archivo se pide una vez por sesión del panel. */
const files = new Map<string, Promise<string>>();

function file(path: string): Promise<string> {
  const cached = files.get(path);
  if (cached) return cached;
  const pending = fetch(path).then((res) => {
    if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
    return res.text();
  });
  // Un fallo no se guarda: la proxima página lo vuelve a intentar.
  pending.catch(() => files.delete(path));
  files.set(path, pending);
  return pending;
}

/*
 * LOS ICONOS FUERA DEL SUBCONJUNTO
 *
 * El subconjunto pegado dibuja los nombres más comunes al instante. Una página
 * puede usar cualquiera de los 6228: para esos se pegan solo sus reglas
 * --unas líneas por icono, leídas de la hoja completa-- y la fuente entera
 * llega aparte, en binario y por mensaje, porque el marco no puede pedirla. Se
 * registra con otro nombre de familia y va primero: mientras llega, lo que el
 * subconjunto sabe dibujar ya se ve.
 */
const FULL_FAMILY = "hugeicons-completa";
const SUBSET_SET = new Set(SUBSET_ICONS);

/** Nombre → punto de código, leído una vez de la hoja completa. */
let glyphs: Promise<Map<string, string>> | null = null;
function glyphMap(): Promise<Map<string, string>> {
  glyphs ??= file(ICON_FONT_URL).then((css) => {
    const map = new Map<string, string>();
    for (const match of css.matchAll(
      /\.hgi-stroke\.hgi-([a-z0-9-]+)::before\s*\{\s*content:\s*"\\([0-9a-f]+)"/g,
    ))
      map.set(match[1], match[2]);
    return map;
  });
  glyphs.catch(() => (glyphs = null));
  return glyphs;
}

/**
 * Los iconos que la página nombra y el subconjunto no trae: los que van como
 * clase (`hgi-nombre`) y los que van como texto entre comillas --un mapa de
 * estado a icono, por ejemplo--. Un nombre armado a trozos no se ve, y por eso
 * el contrato pide escribirlos enteros.
 */
function extraIcons(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/hgi-([a-z0-9-]+)/g)) found.add(match[1]);
  for (const match of html.matchAll(/["'`]([a-z0-9-]+)["'`]/g)) found.add(match[1]);
  return [...found].filter((name) => ICON_NAME_SET.has(name) && !SUBSET_SET.has(name));
}

/** La fuente entera, en binario, pedida una sola vez. */
let fullFont: Promise<ArrayBuffer> | null = null;
function fontBytes(): Promise<ArrayBuffer> {
  fullFont ??= fetch(FULL_FONT_FILE).then((res) => {
    if (!res.ok) throw new Error(`No se pudo cargar ${FULL_FONT_FILE}`);
    return res.arrayBuffer();
  });
  fullFont.catch(() => (fullFont = null));
  return fullFont;
}

/*
 * Las letras de la casa --Inter y Reddit Mono--, las mismas del panel.
 *
 * El marco no puede pedirlas: su origen es nulo y `/fuentes/` le queda tan
 * lejos como le quedaba la fuente de iconos. Sin esto una página se veia con
 * la letra del sistema aunque su hoja dijera Inter, y el panel y lo publicado
 * no parecian la misma casa. Llegan igual que la fuente de iconos entera: el
 * marco las pide por mensaje y las registra con `FontFace`.
 */
const LETTERS = [
  { familia: "Inter", peso: "100 900", archivo: "/fuentes/inter.woff2" },
  { familia: "Reddit Mono", peso: "200 900", archivo: "/fuentes/reddit-mono.woff2" },
] as const;

type Letter = { familia: string; peso: string; fuente: ArrayBuffer };

/** Las letras en binario, pedidas una sola vez. */
let letters: Promise<Letter[]> | null = null;
function letterBytes(): Promise<Letter[]> {
  letters ??= Promise.all(
    LETTERS.map(async ({ familia, peso, archivo }) => {
      const res = await fetch(archivo);
      if (!res.ok) throw new Error(`No se pudo cargar ${archivo}`);
      return { familia, peso, fuente: await res.arrayBuffer() };
    }),
  );
  letters.catch(() => (letters = null));
  return letters;
}

/*
 * Un solo oyente para todos los marcos: la previsualización, la sonda de la
 * IA y la conversión pasan por aquí, así que cualquiera que pida una fuente la
 * recibe. Son públicas; no hay nada que proteger en quién las pide.
 */
let listening = false;
function serveFonts(): void {
  if (listening) return;
  listening = true;
  window.addEventListener("message", (event) => {
    const source = event.source as Window | null;
    if (!source) return;
    if (event.data?.plane === "iconos-fuente") {
      void fontBytes()
        .then((fuente) => source.postMessage({ plane: "iconos-fuente", fuente }, "*"))
        .catch(() => {});
    } else if (event.data?.plane === "letras") {
      void letterBytes()
        .then((letras) => source.postMessage({ plane: "letras", letras }, "*"))
        .catch(() => {});
    }
  });
}

/** Las reglas de los iconos extra y lo que pide la fuente desde el marco. */
async function extraIconsCss(html: string): Promise<string> {
  const names = extraIcons(html);
  if (!names.length) return "";
  const map = await glyphMap().catch(() => new Map<string, string>());
  const rules = names
    .filter((name) => map.has(name))
    .map((name) => `.hgi-stroke.hgi-${name}::before{content:"\\${map.get(name)}"}`);
  if (!rules.length) return "";
  serveFonts();
  return `.hgi-stroke{font-family:"${FULL_FAMILY}","hugeicons-stroke-rounded"!important}${rules.join("")}`;
}

/** Lo que corre dentro del marco: pide la fuente y la registra al llegar. */
const FONT_REQUEST = `(function(){addEventListener("message",function(e){var d=e.data;if(!d||d.plane!=="iconos-fuente"||!d.fuente||e.source!==parent)return;new FontFace("${FULL_FAMILY}",d.fuente).load().then(function(f){document.fonts.add(f)}).catch(function(){})});parent.postMessage({plane:"iconos-fuente"},"*")})()`;

/** Lo que corre dentro del marco: pide las letras de la casa y las registra. */
const LETTER_REQUEST = `(function(){addEventListener("message",function(e){var d=e.data;if(!d||d.plane!=="letras"||!d.letras||e.source!==parent)return;d.letras.forEach(function(l){new FontFace(l.familia,l.fuente,{weight:l.peso,display:"swap"}).load().then(function(f){document.fonts.add(f)}).catch(function(){})})});parent.postMessage({plane:"letras"},"*")})()`;

/**
 * La referencia, tal como la escribio `server/page/pageAssets.ts` o la propia
 * página. Se reconoce por la ruta, no por la línea entera: el documento pudo
 * escribirla con la dirección absoluta, con comillas simples o con atributos
 * de mas.
 */
function refPattern(path: string, tag: "link" | "script"): RegExp {
  const route = path.replace(/[/.]/g, "\\$&");
  return tag === "link"
    ? new RegExp(`<link\\b[^>]*href=["'][^"']*${route}["'][^>]*>`, "gi")
    : new RegExp(`<script\\b[^>]*src=["'][^"']*${route}["'][^>]*>\\s*</script>`, "gi");
}

/**
 * Un `</script` dentro del código cerraria la etiqueta que lo envuelve. El
 * parser mira el texto crudo, así que hay que partirlo; para el motor de
 * JavaScript la barra escapada no cambia nada.
 */
function safeScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

/**
 * El mismo documento con los archivos de Planer dentro. Lo que no tenga
 * referencia se queda igual: las gráficas solo van donde se dibuja algo.
 */
export async function inlinePlaneAssets(html: string): Promise<string> {
  const styles = refPattern(STYLES_PATH, "link");
  const bridge = refPattern(BRIDGE_PATH, "script");
  const charts = refPattern(CHARTS_PATH, "script");
  const icons = refPattern(ICON_FONT_URL, "link");

  const [css, js, chartsJs, iconCss] = await Promise.all([
    styles.test(html) ? file(STYLES_PATH) : null,
    bridge.test(html) ? file(BRIDGE_PATH) : null,
    charts.test(html) ? file(CHARTS_PATH) : null,
    icons.test(html) ? file(SUBSET_FONT_URL) : null,
  ]);
  // `test` sobre una expresion global deja el cursor donde encontro: hay que
  // devolverlo al principio antes de reemplazar.
  styles.lastIndex = 0;
  bridge.lastIndex = 0;
  charts.lastIndex = 0;
  icons.lastIndex = 0;

  /* El reemplazo va como función a propósito: un `$&` o un `$'` sueltos en el
     código del archivo cambiarian de significado dentro de un texto de
     reemplazo, y aquí lo que entra tiene que salir tal cual. */
  let out = html;
  /* Los iconos, antes que los estilos: la hoja de la casa da por puesta la
     familia de la fuente, y así el orden del documento dice el mismo orden en
     que hacen falta. */
  if (iconCss) {
    const extra = await extraIconsCss(html);
    const request = extra ? `<script data-plane="iconos-completos">${FONT_REQUEST}</script>` : "";
    out = out.replace(
      icons,
      () => `<style data-plane="iconos">${iconCss}${extra}</style>${request}`,
    );
  }
  /* Con la hoja de la casa van sus letras: la hoja dice Inter, y sin ellas el
     marco caeria en la del sistema. */
  if (css) {
    serveFonts();
    out = out.replace(
      styles,
      () =>
        `<style data-plane="estilos">${css}</style><script data-plane="letras">${LETTER_REQUEST}</script>`,
    );
  }
  if (js) out = out.replace(bridge, () => `<script data-plane="puente">${safeScript(js)}</script>`);
  if (chartsJs)
    out = out.replace(
      charts,
      () => `<script data-plane="graficas">${safeScript(chartsJs)}</script>`,
    );
  return out;
}
