import type { ThemeName } from "@shared/themes";

const modeKey = (appId: string) => `plane-app-mode:${appId}`;

const media = matchMedia("(prefers-color-scheme: dark)");

/**
 * Claro u oscuro en una aplicacion publicada.
 *
 * Lo elige quien mira, no quien construye: la marca es del constructor, el modo
 * es de quien tiene la pantalla delante. Mientras nadie elija manda lo que pida
 * el sistema, y en cuanto alguien elige queda guardado para esa aplicacion en
 * ese navegador.
 */
export function pageMode(appId: () => string) {
  let chosen = $state<ThemeName | null>(null);
  let system = $state<ThemeName>(media.matches ? "dark" : "light");

  $effect(() => {
    const check = () => {
      system = media.matches ? "dark" : "light";
    };
    media.addEventListener("change", check);
    return () => media.removeEventListener("change", check);
  });

  $effect(() => {
    const saved = localStorage.getItem(modeKey(appId()));
    chosen = saved === "dark" || saved === "light" ? saved : null;
  });

  return {
    get mode(): ThemeName {
      return chosen ?? system;
    },
    get chosen(): ThemeName | null {
      return chosen;
    },
    set(next: ThemeName | null) {
      chosen = next;
      if (next) localStorage.setItem(modeKey(appId()), next);
      else localStorage.removeItem(modeKey(appId()));
    },
  };
}
