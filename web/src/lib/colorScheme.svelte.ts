/**
 * El esquema de color del panel, al dia.
 *
 * Cambia cuando cambia el tema elegido --lo escribe `theme.svelte.ts` en el
 * `data-theme` del documento-- y, si nadie eligio, cuando cambia lo que pide
 * el sistema. Lo unico que lo mira es Monaco, que necesita un nombre de tema
 * suyo y no entiende de variables CSS.
 *
 * Vive en su propio modulo y no dentro de `planeDarkTheme.ts` porque ese es
 * un archivo de datos --colores y reglas-- que tambien lee el editor de solo
 * lectura; aqui esta lo unico que hace falta vigilar.
 */
import { resolvedScheme } from "./planeDarkTheme";

let scheme = $state<"light" | "dark">(resolvedScheme());

/*
 * El observador y el `matchMedia` viven fuera de todo componente: el esquema
 * es uno solo para la pestana entera. `$effect.root` es lo que deja tener un
 * efecto sin arbol encima.
 */
$effect.root(() => {
  const check = () => {
    scheme = resolvedScheme();
  };
  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", check);
});

export const colorScheme = {
  get value(): "light" | "dark" {
    return scheme;
  },
};
