/**
 * Los dos modos con los que se pinta la interfaz: claro y oscuro.
 *
 * Antes esta lista traia los treinta y cinco temas de daisyUI y el color de
 * una aplicación se elegia entre ellos. Ya no: el modo es una cosa (lo elige
 * quien mira, en el panel y en la página publicada) y el color de marca es
 * otra (lo elige quien construye, en `shared/brand.ts`).
 *
 * Los nombres son los mismos que llevan los bloques de cada tema en
 * `web/src/styles/theme.css`, porque van tal cual al atributo `data-theme`
 * del documento.
 */

export const THEME_NAMES = ["light", "dark"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

/** Con que modo se muestra lo que nunca eligio uno. */
export const DEFAULT_THEME: ThemeName = "light";

export const isThemeName = (v: unknown): v is ThemeName =>
  typeof v === "string" && (THEME_NAMES as readonly string[]).includes(v);
