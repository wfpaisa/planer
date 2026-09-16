/**
 * Si el sidebar de una aplicacion se queda fijado o flotando.
 *
 * Es una preferencia de quien mira, no del que hizo la aplicacion, y se
 * recuerda por aplicacion: cada una tiene su forma de trabajarse. Vive aparte
 * del componente porque lo deciden sus dos padres --la escena de la pagina y la
 * aplicacion publicada-- y el sidebar solo recibe el resultado.
 */

const pinKey = (appId: string) => `plane_sidebar_pin_${appId}`;

export interface SidebarPin {
  readonly pinned: boolean;
  toggle: () => void;
}

/**
 * Empieza fijado salvo que se haya soltado a proposito: al abrir, la lista de
 * paginas se ve, y quien quiera el documento entero la suelta.
 */
export function sidebarPin(appId: () => string): SidebarPin {
  let pinned = $state(remembered(appId()));

  // Cambiar de aplicacion trae la preferencia de la nueva, no la de la vieja.
  let last = appId();
  $effect(() => {
    const id = appId();
    if (id === last) return;
    last = id;
    pinned = remembered(id);
  });

  $effect(() => {
    try {
      localStorage.setItem(pinKey(appId()), pinned ? "1" : "0");
    } catch {
      /* sin memoria del navegador, vuelve a empezar anclado */
    }
  });

  return {
    get pinned() {
      return pinned;
    },
    toggle() {
      pinned = !pinned;
    },
  };
}

function remembered(appId: string): boolean {
  try {
    return localStorage.getItem(pinKey(appId)) !== "0";
  } catch {
    return true;
  }
}
