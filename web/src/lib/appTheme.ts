/**
 * La apariencia de una aplicación, llevada al DOM.
 *
 * Lo guardado es la eleccion (`shared/brand.ts`: id de paleta, color a mano,
 * tamaño de letra). Lo que se pinta son los atributos que la activan:
 * `palettes.css` hace el resto, derivando acento y serie de datos de los
 * cuatro colores de la paleta (los tintes no: son fijos, de theme.css). El único punto donde el color pasa por
 * JavaScript es el personalizado, que viaja como `--palette-1` en línea.
 *
 * El `data-palette` va **en el mismo elemento que `data-theme`**:
 * `palettes.css` deriva con `light-dark()`, que lee el `color-scheme` del
 * elemento donde se declara, y los tokens del puente (`compat.css`) se
 * calculan ahi mismo -- solo así una app ve su paleta y no la del panel.
 */
import { normalizePalette } from "@shared/brand";
import { CUSTOM_PALETTE } from "@shared/palettes";
import type { AppTheme } from "@shared/types";

/**
 * La apariencia de una aplicación, ya desbrozada: lo guardado con los
 * formatos de antes --la marca de dos colores, o el nombre de un tema de la
 * libreria vieja-- se lee sin perder el color elegido.
 */
export function appBrand(theme?: AppTheme | null) {
  return normalizePalette(theme);
}

/**
 * Atributo y estilo que activan la paleta de una app en un elemento.
 *
 * `fontScale: false` deja fuera el tamaño de letra: lo piden las piezas del
 * panel que llevan el color de una aplicación pero no son la aplicación --el
 * icono en la lista, en el sidebar--, donde el texto es del panel y crecerlo
 * ahi descuadraria el cromo.
 */
export function paletteAttrs(
  theme?: AppTheme | null,
  { fontScale = true }: { fontScale?: boolean } = {},
): {
  "data-palette"?: string;
  style?: string;
} {
  const brand = appBrand(theme);
  const decls: string[] = [];
  if (brand.palette === CUSTOM_PALETTE && brand.color) {
    decls.push(`--palette-1: ${brand.color}`);
  }
  if (fontScale && brand.fontScale !== undefined) {
    // El rem se resuelve contra la raíz, así que el tamaño propio de la app
    // no puede ir a <html>: el contenedor lo declara y lo de dentro escala
    // por herencia. Es lo que hace la referencia con la raíz, un nivel abajo.
    decls.push(`--font-scale: ${brand.fontScale}`, "font-size: calc(1rem * var(--font-scale))");
  }
  // Los dos mandos son independientes: una app puede quedarse con la paleta
  // de partida --sin data-palette, manda theme.css-- y aun así crecer la
  // letra, o al reves.
  return {
    "data-palette": brand.palette ?? undefined,
    style: decls.length ? `${decls.join("; ")};` : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Colores de etiqueta                                                  */
/* ------------------------------------------------------------------ */

/**
 * Los diez tintes del sistema con los que se reparten las etiquetas. Son las
 * clases de `styles/components.css`, no colores sueltos: cada una lleva su
 * fondo y su tinta ya medidos para contrastar. No dependen de la paleta del
 * contenedor --son los mismos diez colores en cualquier app y en los dos
 * temas-- porque lo que distinguen es la categoria, no la marca.
 */
const TAG_TONES = [
  "tint-1",
  "tint-2",
  "tint-3",
  "tint-4",
  "tint-5",
  "tint-6",
  "tint-7",
  "tint-8",
  "tint-9",
  "tint-10",
] as const;

/** El mismo texto recibe siempre el mismo tinte. */
export function colorFor(value: string): (typeof TAG_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return TAG_TONES[hash % TAG_TONES.length];
}
