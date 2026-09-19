/**
 * La apariencia de una aplicacion.
 *
 * Es la paleta y el tamano de letra, no el modo: claro u oscuro lo elige quien
 * mira la pagina (ver `web/src/lib/pageMode.svelte.ts`).
 *
 *   palette   el id de una de las 46 de `web/src/styles/palettes.css`,
 *             `custom` para el color a mano, o null para la paleta de
 *             partida de `theme.css` (la de Planer).
 *   color     un hexadecimal, solo cuando palette es `custom`.
 *   fontScale cuanto crece la letra de la aplicacion (1 = normal).
 *
 * El hexadecimal se guarda tal cual porque es lo que una empresa tiene a mano
 * de su manual de marca; lo que se dibuja no es ese color crudo sino la
 * derivacion que hace `palettes.css` (acento, serie de datos), medida
 * para contrastar en claro y en oscuro.
 */
import { CUSTOM_PALETTE, isPaletteId } from "./palettes.ts";

/** La apariencia elegida por quien construye una aplicacion. */
export interface AppTheme {
  /** Id de palettes.css, `custom`, o null = la paleta de partida. */
  palette: string | null;
  /** Hexadecimal, solo cuando palette === "custom". */
  color?: string;
  /** 0.8-1.6; 1 = el tamano normal. */
  fontScale?: number;
}

/**
 * El azul de partida, en hexadecimal: el mismo `--accent` de `:root` en
 * `theme.css` (`oklch(60% 0.3 256)`). De aqui arranca quien abre el
 * color a mano sin haber elegido nada todavia -- para que la muestra de
 * "Por defecto" y el campo del hexadecimal coincidan en vez de saltar a un
 * morado que no tiene que ver con la paleta de partida.
 */
export const DEFAULT_BRAND_COLOR = "#007EFF";

/** Lo admitido como `fontScale`, con el paso del deslizador. */
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.6;
export const FONT_SCALE_STEP = 0.05;
/** El tamano por defecto: el normal del navegador. */
export const FONT_SCALE_DEFAULT = 1;

/** Un hexadecimal de seis digitos, con almohadilla. Nada mas se guarda. */
export const isBrandColor = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/**
 * Deja lo escrito en forma de color: acepta tres digitos (`#abc`) y el
 * hexadecimal sin almohadilla, que es como se copia de casi cualquier sitio.
 * Devuelve `null` si no hay color que sacar.
 */
export function parseBrandColor(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  }
  return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toLowerCase()}` : null;
}

function fontScaleOf(raw: unknown): number | undefined {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.round(value * 100) / 100;
  if (rounded < FONT_SCALE_MIN || rounded > FONT_SCALE_MAX) return undefined;
  return rounded === FONT_SCALE_DEFAULT ? undefined : rounded;
}

/**
 * La apariencia de una aplicacion, ya desbrozada. Lo guardado con los
 * formatos de antes se lee sin perder nada:
 *
 *   `{ primary, secondary }` en hex  la marca de dos colores; el principal
 *                                    pasa a ser la paleta personalizada.
 *   `{ theme: "dracula" }`           un nombre del catalogo de la libreria
 *                                    de antes; no trae color y se lee como
 *                                    la paleta de partida.
 */
export function normalizePalette(raw: unknown): AppTheme {
  if (!raw || typeof raw !== "object") return { palette: null };
  const value = raw as Record<string, unknown>;

  // `custom` sin color valido no es nada: esa paleta necesita su --palette-1.
  const customOk = value.palette === CUSTOM_PALETTE && isBrandColor(value.color);
  const theme: AppTheme = { palette: null };

  if (customOk) {
    theme.palette = CUSTOM_PALETTE;
    theme.color = (value.color as string).toLowerCase();
  } else if (isPaletteId(value.palette)) {
    theme.palette = value.palette;
  } else if (isBrandColor(value.primary)) {
    // La marca de dos colores de antes: el principal sigue mandando.
    theme.palette = CUSTOM_PALETTE;
    theme.color = value.primary.toLowerCase();
  }

  // El tamano de letra es el otro mando y va suelto: con la paleta de
  // partida puesta --palette: null-- tambien se guarda.
  const fontScale = fontScaleOf(value.fontScale);
  if (fontScale !== undefined) theme.fontScale = fontScale;

  return theme;
}
