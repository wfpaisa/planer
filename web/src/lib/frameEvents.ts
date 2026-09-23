/**
 * Los avisos que manda el marco de una página cuando algo se arrastra encima.
 *
 * Dentro del marco vive otro documento, así que el arrastre no llega a la
 * ventana del panel por su cuenta: el puente lo cuenta con estos dos eventos.
 * Viven aparte de `HtmlFrame` para que el constructor pueda escucharlos sin
 * importar el marco entero.
 */
export const FRAME_DRAG = "plane:arrastre";
export const FRAME_DROP = "plane:soltar";
