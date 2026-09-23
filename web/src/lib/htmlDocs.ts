/**
 * De donde saca el panel el HTML de una página.
 *
 * El marco aislado no tiene origen propio, así que no puede pedir el
 * documento por su cuenta: lo pide el panel con la sesión que corresponda y
 * se lo entrega ya cargado. Como cada documento se identifica por su huella,
 * nunca cambia, y basta con pedirlo una vez.
 */
import { pb, pbApp } from "./pb";
import { inlinePlaneAssets } from "./planeAssets";

export type DocLoader = (hash: string) => Promise<string>;

const cache = new Map<string, Promise<string>>();

/**
 * `dentro`: el documento va a dibujarse en el marco, así que los archivos de
 * Planer se le ponen dentro --el marco no tiene origen con el que pedirlos, ver
 * `planeAssets.ts`--. Sin esto el código se sirve tal como se guardo, que es
 * lo que necesita el editor.
 */
function fetchDoc(url: string, token?: string, key = url, dentro = false): Promise<string> {
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = token;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.error ?? "No se pudo cargar el contenido");
    }
    const html = await res.text();
    return dentro ? inlinePlaneAssets(html) : html;
  })();

  // Un fallo no se guarda: la proxima vez se vuelve a intentar.
  pending.catch(() => cache.delete(key));
  cache.set(key, pending);
  return pending;
}

/**
 * Un bloque suelto por su huella, con la sesión del constructor: lo que monta
 * la sonda de la IA. Va al marco, así que también lleva los archivos dentro
 * --el bloque que sirve el servidor trae el puente pegado, pero los estilos y
 * la fuente de iconos los trae como referencia, y esas no las alcanza un
 * origen opaco--.
 */
export const appDocLoader =
  (appId: string): DocLoader =>
  (hash) =>
    fetchDoc(
      `/api/apps/${appId}/html/${hash}`,
      pb.authStore.token,
      `bloque:${appId}:${hash}`,
      true,
    );

/*
 * El HTML de una página se pide por la página, no por su huella: lo que se
 * sirve lleva dentro las dos referencias inyectadas, que no forman parte del
 * documento guardado. La huella sigue haciendo falta para la memoria: cuando
 * cambia, hay que volver a pedirlo.
 */

/** El HTML de una página, con la sesión del constructor. */
export const appPageLoader =
  (appId: string, pageId: string): DocLoader =>
  (hash) =>
    fetchDoc(
      `/api/apps/${appId}/paginas/${pageId}/html`,
      pb.authStore.token,
      `app:${appId}:${pageId}:${hash}`,
      true,
    );

/**
 * Para la vista previa: por huella, no por página.
 *
 * Pedir por página siempre trae el borrador, que es justo lo que no se quiere
 * al mirar una versión guardada. La fotografia trae la huella de entonces y se
 * pide esa; el borrador también pasa por aquí, con la huella que tiene ahora.
 */
export const previewPageLoader =
  (appId: string, pageId: string): DocLoader =>
  (hash) =>
    fetchDoc(
      `/api/apps/${appId}/paginas/${pageId}/html/${hash}`,
      pb.authStore.token,
      `vista:${appId}:${pageId}:${hash}`,
      true,
    );

/** El HTML tal como se guardo, que es lo que edita el constructor. */
export const rawPageLoader =
  (appId: string, pageId: string): DocLoader =>
  (hash) =>
    fetchDoc(
      `/api/apps/${appId}/paginas/${pageId}/html/crudo`,
      pb.authStore.token,
      `crudo:${appId}:${pageId}:${hash}`,
    );

/** El HTML de una página publicada, con la sesión de quien la esta usando. */
export const publicPageLoader =
  (slug: string, pageId: string): DocLoader =>
  (hash) =>
    fetchDoc(
      `/api/public/${encodeURIComponent(slug)}/paginas/${pageId}/html`,
      pbApp.authStore.token,
      `pub:${slug}:${pageId}:${hash}`,
      true,
    );
