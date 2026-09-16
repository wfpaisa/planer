/**
 * Juntar clases CSS descartando lo que no sea una cadena.
 *
 * Vive aparte de `components/ui` porque no dibuja nada: la usan los iconos, las
 * celdas y casi todos los componentes, y tenerla en `ui` obligaba a que
 * `lib/icons` y `components/ui` se importaran mutuamente.
 */
export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");
