/**
 * La capa de la vista previa, para quien no la dibuja.
 *
 * Guarda dos cosas: que se esta mirando --el borrador o una versión-- y si la
 * tarjeta de los cambios se aparto para dejarlo ver.
 *
 * Lo de apartarla hace falta porque los cambios se dibujan al final del cuerpo
 * y la vista previa dentro del árbol del editor, así que con las dos abiertas
 * la tarjeta queda siempre delante y tapa justo lo que se acaba de pedir ver.
 * Apartarla no es cerrarla: sigue montada, con su lista cargada y su
 * desplazamiento donde estaba, y vuelve entera desde el botón de la cinta.
 *
 * Y lo que se esta mirando se guarda aquí porque la lista de versiones no lo
 * puede leer de la ruta: se dibuja debajo de la capa, y ahi la ubicacion que ve
 * es la del fondo. El editor, que si ve la ruta de verdad, lo apunta aquí en
 * cuanto cambia; la lista lo lee para senalar la fila que se esta mirando.
 *
 * Vive fuera del árbol porque quien lo escribe y quien lo lee estan en ramas
 * distintas, sin nada en comun mas que el editor entero. Es el mismo caso que
 * `pagePicker.svelte.ts`.
 */

let aside = $state(false);
/** `borrador`, el id de una versión, o vacío si no hay capa abierta. */
let source = $state("");

export const preview = {
  /**
   * Si hay una tarjeta apartada: para la que se aparta, y para la cinta que
   * ofrece traerla de vuelta.
   */
  get aside(): boolean {
    return aside;
  },
  /** Que se esta mirando ahora mismo, para senalarlo donde haga falta. */
  get source(): string {
    return source;
  },
};

/** Apartar la tarjeta para ver lo que hay debajo, o traerla de vuelta. */
export function setPanelAside(next: boolean): void {
  aside = next;
}

/**
 * Lo apunta el editor, que es el único que ve la ruta. Al cerrarse la capa
 * llega vacío y nada queda apartado: sin capa delante no hay nada que tapar.
 */
export function setPreviewSource(next: string): void {
  if (source === next) return;
  source = next;
  if (!next) aside = false;
}
