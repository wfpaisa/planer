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
import { ICON_FONT_URL, SUBSET_FONT_URL } from "@shared/icons";

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
  if (iconCss) out = out.replace(icons, () => `<style data-plane="iconos">${iconCss}</style>`);
  if (css) out = out.replace(styles, () => `<style data-plane="estilos">${css}</style>`);
  if (js) out = out.replace(bridge, () => `<script data-plane="puente">${safeScript(js)}</script>`);
  if (chartsJs)
    out = out.replace(
      charts,
      () => `<script data-plane="graficas">${safeScript(chartsJs)}</script>`,
    );
  return out;
}
