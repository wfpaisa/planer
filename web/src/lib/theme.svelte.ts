import { DEFAULT_THEME, isThemeName, type ThemeName } from "@shared/themes";

const KEY = "plane-theme";

/**
 * Lo que ya estaba guardado. Lo que no es "light" ni "dark" se ignora --por
 * ejemplo el nombre de alguno de los temas de daisyUI que se podian elegir
 * antes-- y se devuelve `null`: sin eleccion propia, manda lo que pida el
 * sistema.
 */
function saved(): ThemeName | null {
  const value = localStorage.getItem(KEY);
  return isThemeName(value) ? value : null;
}

const media = matchMedia("(prefers-color-scheme: dark)");

let chosen = $state<ThemeName | null>(saved());
/* Sin eleccion propia manda el sistema, y el sistema cambia solo. */
let systemDark = $state(media.matches);
media.addEventListener("change", (e) => {
  systemDark = e.matches;
});

const resolved = () => chosen ?? (systemDark ? "dark" : DEFAULT_THEME);

/*
 * El `data-theme` esta siempre puesto, tambien cuando nadie ha elegido: es lo
 * que mira `brand.css` para saber si el color de una aplicacion se recorta
 * contra papel claro u oscuro, y lo que mira `form.css` para vestir los
 * campos. El mismo calculo lo hace el guion de `index.html` antes de pintar,
 * para que no haya parpadeo.
 *
 * Va en un `$effect.root` porque esto no vive dentro de ningun componente:
 * dura lo que dure la pestana.
 */
$effect.root(() => {
  $effect(() => {
    document.documentElement.dataset.theme = resolved();
    if (chosen) localStorage.setItem(KEY, chosen);
    else localStorage.removeItem(KEY);
  });
});

/** El modo con el que se pinta el panel: claro u oscuro. */
export const theme = {
  get name(): ThemeName {
    return resolved();
  },
  set(name: ThemeName) {
    chosen = name;
  },
};
