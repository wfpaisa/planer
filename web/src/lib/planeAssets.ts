/**
 * Los archivos de Planer, incrustados en el documento antes de entrar al marco.
 *
 * Una pagina no los lleva dentro: lleva sus tres referencias (`shared/
 * htmlContract.ts`), y asi el codigo que ve el constructor se lee de un
 * vistazo y una mejora del puente llega a todas las paginas sin editarlas.
 *
 * Pedirlos, en cambio, no puede hacerlo la pagina. El marco es un `srcdoc`
 * sin `allow-same-origin`: su origen es `null`, y desde ahi el navegador no
 * alcanza el servidor --en local lo bloquea de plano, por ser una direccion
 * de red privada pedida desde un origen opaco--. Sin puente no hay tema, ni
 * datos, ni nada: la pagina sale en Times New Roman y con los huecos vacios.
 *
 * Asi que los pide el panel, que si tiene origen, y los pone dentro. El
 * navegador guarda cada archivo una sola vez --misma ruta estable, mismo
 * ETag-- y lo que crece es solo el texto del `srcdoc`.
 */
import { BRIDGE_PATH, CHARTS_PATH, STYLES_PATH } from "@shared/htmlContract";

/** Cada archivo se pide una vez por sesion del panel. */
const files = new Map<string, Promise<string>>();

function file(path: string): Promise<string> {
  const cached = files.get(path);
  if (cached) return cached;
  const pending = fetch(path).then((res) => {
    if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
    return res.text();
  });
  // Un fallo no se guarda: la proxima pagina lo vuelve a intentar.
  pending.catch(() => files.delete(path));
  files.set(path, pending);
  return pending;
}

/**
 * La referencia, tal como la escribio `server/page/pageAssets.ts` o la propia
 * pagina. Se reconoce por la ruta, no por la linea entera: el documento pudo
 * escribirla con la direccion absoluta, con comillas simples o con atributos
 * de mas.
 */
function refPattern(path: string, tag: "link" | "script"): RegExp {
  const route = path.replace(/[/.]/g, "\\$&");
  return tag === "link"
    ? new RegExp(`<link\\b[^>]*href=["'][^"']*${route}["'][^>]*>`, "gi")
    : new RegExp(`<script\\b[^>]*src=["'][^"']*${route}["'][^>]*>\\s*</script>`, "gi");
}

/**
 * Un `</script` dentro del codigo cerraria la etiqueta que lo envuelve. El
 * parser mira el texto crudo, asi que hay que partirlo; para el motor de
 * JavaScript la barra escapada no cambia nada.
 */
function safeScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

/**
 * El mismo documento con los archivos de Planer dentro. Lo que no tenga
 * referencia se queda igual: las graficas solo van donde se dibuja algo.
 */
export async function inlinePlaneAssets(html: string): Promise<string> {
  const styles = refPattern(STYLES_PATH, "link");
  const bridge = refPattern(BRIDGE_PATH, "script");
  const charts = refPattern(CHARTS_PATH, "script");

  const [css, js, chartsJs] = await Promise.all([
    styles.test(html) ? file(STYLES_PATH) : null,
    bridge.test(html) ? file(BRIDGE_PATH) : null,
    charts.test(html) ? file(CHARTS_PATH) : null,
  ]);
  // `test` sobre una expresion global deja el cursor donde encontro: hay que
  // devolverlo al principio antes de reemplazar.
  styles.lastIndex = 0;
  bridge.lastIndex = 0;
  charts.lastIndex = 0;

  /* El reemplazo va como funcion a proposito: un `$&` o un `$'` sueltos en el
     codigo del archivo cambiarian de significado dentro de un texto de
     reemplazo, y aqui lo que entra tiene que salir tal cual. */
  let out = html;
  if (css) out = out.replace(styles, () => `<style data-plane="estilos">${css}</style>`);
  if (js) out = out.replace(bridge, () => `<script data-plane="puente">${safeScript(js)}</script>`);
  if (chartsJs)
    out = out.replace(
      charts,
      () => `<script data-plane="graficas">${safeScript(chartsJs)}</script>`,
    );
  return out;
}
