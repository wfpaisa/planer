/**
 * La tarjeta de publicar, para quien no la dibuja.
 *
 * La dibuja el encabezado --es donde vive el boton de publicar-- pero tambien
 * la abre el candado de la barra de direccion, que cuenta quien puede entrar y
 * esta en otra rama del arbol: la escena de la pagina. Sin nada en comun mas
 * que el editor entero, el estado vive fuera, como el de la vista previa (ver
 * `previewPanel.svelte.ts`).
 */

let open = $state(false);

export const publishCard = {
  /** Si la tarjeta se esta dibujando ahora mismo. */
  get open(): boolean {
    return open;
  },
};

/** Traerla, este como este. Para quien la quiere abierta, no alternada. */
export function openPublish(): void {
  open = true;
}

export function closePublish(): void {
  open = false;
}

/** Traerla o cerrarla. Es lo que hace el boton de publicar del encabezado. */
export function togglePublish(): void {
  open = !open;
}
