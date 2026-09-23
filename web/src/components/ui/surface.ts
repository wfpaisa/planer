/**
 * El vestido de lo que flota encima del panel.
 *
 * Un diálogo, un panel que se abre desde el encabezado o el cajon de una fila:
 * por dentro son cosas distintas, pero por fuera tienen que ser la misma
 * tarjeta. Antes cada uno traia su borde, su esquina y su línea --unos con
 * `border-base-200`, otros con `base-300`, unos redondeados mas que otros-- y
 * se notaba. El vestido vive en `styles/global.css` (clases `plane-card-*`) y
 * aquí solo estan sus nombres, para que todos se lo pongan igual.
 */
export const surface = {
  /** La tarjeta: borde, esquina, fondo y sombra. */
  card: "plane-card",
  /** El documento oscurecido de detras. */
  backdrop: "plane-backdrop",
  /** La fila de arriba, la del título. */
  head: "plane-card-head",
  /** El cuerpo, cuando lo enmarca el propio panel. */
  body: "plane-card-body",
  /** La fila de abajo, la de los botones. */
  foot: "plane-card-foot",
  title: "plane-card-title",
  description: "plane-card-description",
} as const;
