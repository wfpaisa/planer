/**
 * La guía de bienvenida: si toca enseñarla y si está abierta ahora mismo.
 *
 * Es una preferencia de quien construye, no un dato de la aplicación, así que
 * vive en el navegador --como el tema o el tamaño de letra-- y no en el
 * servidor: se abre sola la primera vez que se entra a una aplicación, y
 * después se vuelve a pedir desde el botón de ayuda del encabezado.
 *
 * Lo guardado es la version vista, no un "si". Cuando el recorrido cambie lo
 * suficiente como para merecer otra vuelta, sube `GUIDE_VERSION` y la guía
 * vuelve a salir una vez a todo el mundo.
 */

const KEY = "plane-guia";

/** La version del recorrido. Subirla lo vuelve a enseñar una vez. */
export const GUIDE_VERSION = 1;

/** Si ya se vio esta version. Sin memoria del navegador, nunca se dio por vista. */
function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === String(GUIDE_VERSION);
  } catch {
    // Sin memoria, la guía sale una vez por pestana y no se puede hacer más.
    return false;
  }
}

function remember(value: boolean): void {
  try {
    if (value) localStorage.setItem(KEY, String(GUIDE_VERSION));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin memoria del navegador la eleccion dura lo que dure la pestana */
  }
}

let open = $state(false);
let pending = $state(!seen());

export const guide = {
  /** Si el recorrido está abierto. Lo dibuja `GuideTour`, montado en `App`. */
  get open(): boolean {
    return open;
  },
  /** Abrirla a mano, desde el botón de ayuda del encabezado. */
  show(): void {
    open = true;
  },
  /** Abrirla al entrar a una aplicación, solo si todavía no se ha visto. */
  showOnce(): void {
    if (pending) open = true;
  },
  /**
   * Cerrarla, y darla por vista.
   *
   * Cerrar cuenta igual que terminar a propósito: quien la corta a la mitad no
   * quiere encontrarsela otra vez en la siguiente aplicación. Para volver a
   * verla esta el botón de ayuda del encabezado.
   */
  close(): void {
    open = false;
    if (pending) {
      pending = false;
      remember(true);
    }
  },
};
