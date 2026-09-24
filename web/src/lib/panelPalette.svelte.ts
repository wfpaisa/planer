/**
 * La paleta con la que se pinta el panel, elegida por cada usuario.
 *
 * Es la misma elección que la de una aplicación (`{ palette, color? }`, ver
 * `shared/brand.ts`) pero sin tamaño de letra, que el panel tiene aparte
 * (`fontSize.svelte.ts`). Se guarda en la cuenta (`builders.palette`), así que
 * sigue a la persona de un navegador a otro; la escribe ella misma sobre su
 * registro, como el nombre.
 *
 * Va en `<html>`, que es donde está `data-theme`: `palettes.css` deriva con
 * `light-dark()` y necesita los dos en el mismo elemento. Lo que lleva su
 * propia paleta --el icono de una aplicación, la vista de una página-- la
 * declara en su elemento y no se entera de esta.
 *
 * Una copia queda en este navegador (`plane-panel-palette`) solo para pintar
 * antes de cargar: la lee el guion de `index.html`, y así el panel no aparece
 * un instante con el color de partida.
 */
import { CUSTOM_PALETTE } from "@shared/palettes";
import type { AppTheme } from "@shared/types";

import { appBrand } from "./appTheme";
import { pb } from "./pb";
import { location } from "./router.svelte";
import { session } from "./session.svelte";

const KEY = "plane-panel-palette";

/** La paleta del panel, sin el tamaño de letra: ese mando es otro. */
function clean(theme?: AppTheme | null): AppTheme {
  const { palette, color } = appBrand(theme);
  return color ? { palette, color } : { palette };
}

function cached(): AppTheme {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return { palette: null };
  }
}

let fallback = cached();
/** Lo que se está probando en los ajustes antes de guardar. */
let preview = $state<AppTheme | null>(null);

/* Con sesión manda la cuenta; sin ella (la pantalla de entrar) la última que
   se vio en este navegador. */
const saved = () => (session.me ? clean(session.me.palette) : fallback);

/** Una aplicación publicada no es el panel: ahí no se pone ninguna. */
const published = () => /^\/p(\/|$)/.test(location.pathname);
const shown = (): AppTheme => (published() ? { palette: null } : (preview ?? saved()));

$effect.root(() => {
  $effect(() => {
    const root = document.documentElement;
    const { palette, color } = shown();
    if (palette) root.dataset.palette = palette;
    else delete root.dataset.palette;
    // `custom` va con su color en línea; cualquier otra lo retira, porque en
    // línea gana a lo que diga su `data-palette`.
    if (palette === CUSTOM_PALETTE && color) root.style.setProperty("--palette-1", color);
    else root.style.removeProperty("--palette-1");
  });

  $effect(() => {
    if (!session.me) return;
    fallback = saved();
    localStorage.setItem(KEY, JSON.stringify(fallback));
  });
});

export const panelPalette = {
  /** La guardada en la cuenta. */
  get value(): AppTheme {
    return saved();
  },
  /** Pinta el panel con otra sin guardarla; `null` vuelve a la guardada. */
  preview(theme: AppTheme | null) {
    preview = theme ? clean(theme) : null;
  },
  /**
   * La guarda en la cuenta. El SDK actualiza la sesión con el registro que
   * devuelve, y de ahí la lee `session.me`: no hace falta apuntarla aparte.
   */
  async save(theme: AppTheme): Promise<void> {
    const me = session.me;
    if (!me) return;
    await pb.collection("builders").update(me.id, { palette: clean(theme) });
    preview = null;
  },
};
