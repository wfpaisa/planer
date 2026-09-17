/**
 * La hoja de estilos que recibe el HTML de una pagina.
 *
 * Es la MISMA que viste el panel, servida entera: los tokens y el reset, las
 * 46 paletas, el catalogo de componentes, las utilidades de disposicion, los
 * nombres de siempre y los del contrato. No es una copia ni un resumen -- se
 * leen los archivos de `web/src/styles/` tal cual, asi que una pagina no
 * puede quedarse con una version vieja del catalogo, y un componente se ve
 * igual en el constructor y en lo publicado.
 *
 * Antes aqui habia una hoja aparte, pequena, escrita a mano (`BASE_CSS`), y el
 * panel le mandaba sesenta colores ya resueltos. Cada pieza --un boton, una
 * tarjeta, una tabla-- se la escribia la inteligencia artificial desde cero en
 * cada pagina, con lo que ninguna se parecia del todo a la anterior. Ahora la
 * pieza ya existe y lo que se le pide es que la use.
 *
 * Los colores no viajan resueltos: viajan como `data-theme` y `data-palette`
 * en la raiz del documento (los pone el puente, ver `htmlBridge.ts`), y es la
 * pagina la que deriva. Asi hay un solo sitio donde esta escrito que
 * `--accent` sale de `--palette-1`, y no dos que se puedan separar.
 */

/**
 * Las hojas, en el orden en que se cargan en el panel (`styles/global.css`).
 * El orden importa: los modificadores del catalogo ganan por orden de fuente,
 * y compat y contract derivan de lo que declaran las dos primeras.
 */
const SHEETS = [
  "theme.css",
  "palettes.css",
  "components.css",
  "layout.css",
  "compat.css",
  "contract.css",
  // Solo dentro de una pagina: ver su cabecera.
  "page.css",
] as const;

const read = (name: string) =>
  Bun.file(new URL(`../../web/src/styles/${name}`, import.meta.url)).text();

const parts = await Promise.all(SHEETS.map(read));

/** Las hojas pegadas, cada una con su nombre delante para poder ubicarse. */
export const PAGE_STYLES = SHEETS.map(
  (name, i) => `/* ---------- ${name} ---------- */\n${parts[i]}`,
).join("\n");
