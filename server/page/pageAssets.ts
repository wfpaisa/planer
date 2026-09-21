/**
 * Los archivos que Planer pone en cada pagina, y las lineas que los traen.
 *
 * Un bloque de HTML lleva el puente pegado dentro. Una pagina no: lleva sus
 * referencias, cada una con su comentario, y los archivos se sirven aparte.
 * Asi el codigo que ve el constructor se lee de un vistazo, una mejora del
 * puente llega a todas las paginas de todas las aplicaciones sin editarlas, y
 * el navegador guarda los archivos una vez para todas.
 *
 * Los estilos y el puente los lleva toda pagina. Las graficas no: son ciento y
 * pico kilobytes que solo hacen falta donde hay algo que dibujar, asi que esa
 * referencia solo se pone --y se repone-- en las paginas que la usan.
 */
import { BRIDGE_PATH, CHARTS_PATH, STYLES_PATH } from "../../shared/htmlContract.ts";
import { ICON_FONT_URL } from "../../shared/icons.ts";
import { BRIDGE_SCRIPT } from "../html/htmlBridge.ts";
import { CHART_ADAPTER, CHARTS_REF, USES_CHARTS } from "../html/htmlCharts.ts";
import { PAGE_STYLES } from "./pageStyles.ts";

/*
 * Rutas estables. No llevan huella: la version nueva llega sin editar nada.
 * Salen de `shared/htmlContract.ts`, que es donde las nombra tambien el texto
 * que lee la IA y de donde las toma el panel para incrustarlas.
 */
export { BRIDGE_PATH, CHARTS_PATH, STYLES_PATH };

/**
 * El archivo de estilos: las mismas hojas que viste el panel, enteras.
 * Ver `pageStyles.ts` para por que van completas y no resumidas.
 */
export const STYLES_FILE = `/*
 * Estilos de Planer.
 *
 * Es la hoja del panel al completo: los tokens, las paletas, el catalogo de
 * componentes y las utilidades. La paleta de la aplicacion y el claro/oscuro
 * llegan como data-palette y data-theme en <html>, y los pone el puente.
 */
${PAGE_STYLES}`;

/** El archivo del puente: las mismas ordenes que expone `window.plane`. */
export const BRIDGE_FILE = `/*
 * Puente de Planer: los datos, el tema y quien esta mirando, en window.plane.
 */
${BRIDGE_SCRIPT}`;

/**
 * La libreria de graficas, tal cual viene del paquete. Se sirve desde aqui y
 * no desde un CDN: una pagina de una aplicacion no puede depender de que un
 * servidor de otro responda, ni de que le cambien la version debajo.
 */
const CHART_LIB = await Bun.file(
  new URL("./chart.umd.min.js", import.meta.resolve("chart.js")),
).text();

/** El archivo de graficas: la libreria y encima el aspecto de la casa. */
export const CHARTS_FILE = `/*
 * Graficas de Planer: Chart.js y, encima, plane.grafica con los colores, las
 * medidas y el aspecto de la plataforma.
 */
${CHART_LIB}
${CHART_ADAPTER}`;

/* ------------------------------------------------------------------ */
/* Las dos lineas                                                       */
/* ------------------------------------------------------------------ */

/**
 * Cada referencia, con el comentario que dice para que sirve.
 *
 * `usa` decide si a esta pagina le hace falta. Las que no lo llevan van en
 * todas; las graficas solo donde se dibuja algo.
 */
const REFS = {
  estilos: {
    find: /\/plane\/estilos\.css/i,
    line:
      `<!-- Estilos de Planer: los componentes, los colores y las medidas de la casa -->\n` +
      `<link rel="stylesheet" href="${STYLES_PATH}">`,
  },
  puente: {
    find: /\/plane\/puente\.js/i,
    line:
      `<!-- Puente de Planer: los datos y quien esta mirando, en window.plane -->\n` +
      `<script src="${BRIDGE_PATH}"></script>`,
  },
  iconos: {
    /*
     * La fuente de iconos, que ahora sirve Planer. Las paginas guardadas de
     * cuando se pedia al CDN llevan esa direccion dentro; `stripCdnIcons` se
     * la quita, y asi aqui se ve que falta y entra la de casa.
     */
    find: /\/iconos\/iconos\.css/i,
    line:
      `<!-- Iconos de Planer: escribe <i class="hgi-stroke hgi-nombre"></i> -->\n` +
      `<link rel="stylesheet" href="${ICON_FONT_URL}">`,
  },
  graficas: {
    find: /\/plane\/graficas\.js/i,
    // Se pierde el guion y las graficas dejan de dibujarse sin que nada avise:
    // por eso se repone en cuanto el documento nombra una.
    usa: USES_CHARTS,
    line: CHARTS_REF,
  },
} as const;

export type PageRef = keyof typeof REFS;

/**
 * Huella de lo que Planer pone en una pagina, para que el navegador revalide al
 * cambiarlo. Cuenta los archivos y tambien las lineas que los traen: cambiar
 * una referencia --anadir la fuente de iconos, por ejemplo-- no toca ningun
 * archivo, y sin esto la pagina seguiria sirviendose de la cache sin ella.
 *
 * Se declara despues de `REFS` porque las lee.
 */
export const ASSETS_TAG = new Bun.CryptoHasher("sha256")
  .update(
    STYLES_FILE +
      BRIDGE_FILE +
      CHARTS_FILE +
      Object.values(REFS)
        .map((r) => r.line)
        .join(""),
  )
  .digest("hex")
  .slice(0, 12);

/**
 * Lo que quedo pegado dentro cuando esto era un bloque. Ya no hace falta: lo
 * mismo llega ahora por las dos referencias, y dejarlo duplicaria el puente.
 */
function stripInline(content: string): string {
  return content
    .replace(/<style\s[^>]*data-plane="base"[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\s[^>]*data-plane="base"[^>]*>/gi, "")
    .replace(/<script\s[^>]*data-plane="puente"[^>]*>[\s\S]*?<\/script>/gi, "");
}

/**
 * Quita la linea que pedia la fuente de iconos al CDN, con su comentario.
 *
 * Es lo que llevan dentro las paginas guardadas antes de que Planer sirviera
 * la fuente. Quitada, `injectPageRefs` ve que falta, pone la de casa y lo
 * cuenta como repuesto en vez de cambiarlo a escondidas.
 */
function stripCdnIcons(content: string): string {
  return content.replace(
    /(?:<!-- Iconos de Planer:[\s\S]*?-->\s*)?<link\b[^>]*hugeicons\.com[^>]*>\s*/gi,
    "",
  );
}

/** Mete un trozo justo despues de la apertura de `<head>`, o se lo inventa. */
function intoHead(content: string, block: string): string {
  const headOpen = /<head[^>]*>/i.exec(content);
  if (headOpen) {
    const at = headOpen.index + headOpen[0].length;
    return `${content.slice(0, at)}\n${block}\n${content.slice(at)}`;
  }

  const htmlOpen = /<html[^>]*>/i.exec(content);
  if (htmlOpen) {
    const at = htmlOpen.index + htmlOpen[0].length;
    return `${content.slice(0, at)}\n<head>\n${block}\n</head>${content.slice(at)}`;
  }

  // Un trozo suelto de HTML: se le arma el documento alrededor.
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n${block}\n</head>\n<body>\n${content}\n</body>\n</html>`;
}

/**
 * Mete un trozo detras del guion del puente.
 *
 * Las graficas se cuelgan de `window.plane`, que es cosa del puente. Los dos
 * archivos se apanan si les toca al reves, pero un documento se lee mucho
 * mejor si el orden en que estan escritos es el orden en que hacen falta.
 */
function afterBridge(content: string, block: string): string {
  const bridge = /<script[^>]*\/plane\/puente\.js[^>]*>\s*<\/script>/i.exec(content);
  if (!bridge) return intoHead(content, block);
  const at = bridge.index + bridge[0].length;
  return `${content.slice(0, at)}\n${block}${content.slice(at)}`;
}

/**
 * Deja el documento con las referencias que le corresponden. Devuelve cuales
 * tuvo que reponer, para que el panel lo pueda avisar en vez de cambiarlo a
 * escondidas.
 */
export function injectPageRefs(content: string): { content: string; restored: PageRef[] } {
  let next = stripCdnIcons(stripInline(content));

  const missing = (Object.keys(REFS) as PageRef[]).filter((name) => {
    const ref = REFS[name];
    if ("usa" in ref && !ref.usa.test(next)) return false;
    return !ref.find.test(next);
  });

  // Las graficas van detras del puente; el resto, al principio de la cabeza.
  const primeras = missing.filter((name) => name !== "graficas");
  if (primeras.length) {
    next = intoHead(next, primeras.map((name) => REFS[name].line).join("\n"));
  }
  if (missing.includes("graficas")) next = afterBridge(next, REFS.graficas.line);

  return { content: next, restored: missing };
}

/** Como se nombra cada referencia cuando hay que contar que se repuso. */
export const REF_NAMES: Record<PageRef, string> = {
  estilos: "la hoja de estilos",
  puente: "el guion de datos",
  iconos: "la fuente de iconos",
  graficas: "el guion de graficas",
};

/* ------------------------------------------------------------------ */
/* Servir la pagina                                                     */
/* ------------------------------------------------------------------ */

const escapeAttr = (value: string) => value.replace(/"/g, "&quot;");

/**
 * El documento tal como se dibuja: lo guardado, mas lo que solo tiene sentido
 * al servirlo --de donde cuelgan las direcciones y el ancho de la pantalla--.
 * Las dos referencias ya viven dentro del documento; si faltaran, se reponen
 * aqui tambien para que una pagina vieja no se quede sin puente.
 */
export function wrapPage(content: string, origin: string): string {
  const { content: withRefs } = injectPageRefs(content);
  return intoHead(
    withRefs,
    `<base href="${escapeAttr(origin)}/">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  );
}
