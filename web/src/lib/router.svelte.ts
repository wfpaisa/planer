/**
 * El router del panel.
 *
 * Escrito en casa, y no tomado de una libreria, por tres razones que se ven
 * mejor juntas: hay cinco rutas de primer nivel y dos anidadas, la guardia de
 * sesión tiene que esperar a que se sepa si hay sesión --no antes--, y el
 * constructor abre sus ajustes y su vista previa como capas encima de la ruta
 * que ya estaba. Eso ultimo es la "ubicacion de fondo", y casi ningún router
 * pequeno lo hace.
 *
 * La ubicacion vive en el estado del historial, así que sobrevive a ir y
 * volver con los botones del navegador. Ver `navigate`.
 */

import { tick } from "svelte";

/** Lo que se guarda en el historial junto a cada dirección. */
export interface RouteState {
  /**
   * La ruta que se estaba mirando cuando se abrio esta encima.
   *
   * Con esto, `/a/xyz/ajustes` no borra la pantalla de debajo: se dibuja lo
   * que dice `background` y los ajustes van encima, en su propia capa.
   */
  background?: { pathname: string; search: string };
}

export interface RouteLocation {
  pathname: string;
  search: string;
  hash: string;
  state: RouteState | null;
}

export type RouteParams = Record<string, string>;

/**
 * De que lado viene lo que se abre, cuando quien navega lo sabe: `1` si lo
 * nuevo esta a la derecha de lo que hay --la pestana siguiente-- y `-1` si
 * esta a la izquierda. `0`, que es lo normal, no dice nada y deja el fundido
 * de siempre.
 */
export type Direction = -1 | 0 | 1;

/**
 * La mitad del constructor en la que cae una dirección: `a/<app>/app` o
 * `a/<app>/datos`. Fuera del constructor, `null`.
 */
function mitad(pathname: string): string | null {
  const t = pathname.split("/").filter(Boolean);
  return t[0] === "a" && t.length >= 3 ? `${t[0]}/${t[1]}/${t[2]}` : null;
}

/**
 * Si dos direcciones son la misma mitad del constructor con otra cosa abierta
 * dentro: otra página, otra tabla.
 *
 * Eso no es cambiar de pantalla. La barra de arriba, el sidebar y la mitad
 * marcada siguen donde estaban, y lo unico que cambia es el lienzo: fundir la
 * pantalla entera para eso hace parpadear todo lo que NO cambio. Se cambia de
 * página muchas veces seguidas mientras se construye, y ahi el efecto estorba.
 */
function dentroDeLaMisma(destino: string, origen: string): boolean {
  const a = mitad(destino);
  return a !== null && a === mitad(origen);
}

function read(): RouteLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: (window.history.state ?? null) as RouteState | null,
  };
}

let current = $state<RouteLocation>(read());

/**
 * Donde se esta. Se lee como un objeto normal y es reactivo: quien lo lea
 * dentro de un `$derived` o de una plantilla se vuelve a calcular al navegar.
 *
 * Es de solo lectura a propósito --se cambia con `navigate`-- y por eso son
 * captadores: una runa reasignada no se puede exportar tal cual.
 */
export const location = {
  get pathname() {
    return current.pathname;
  },
  get search() {
    return current.search;
  },
  get hash() {
    return current.hash;
  },
  get state() {
    return current.state;
  },
};

window.addEventListener("popstate", () => {
  // Ir y volver con los botones del navegador es un cambio de pantalla como
  // cualquier otro, y se cruza igual.
  const capa = Boolean(current.state?.background) || Boolean(window.history.state?.background);
  const dentro = dentroDeLaMisma(window.location.pathname, current.pathname);
  if (capa || dentro) current = read();
  else cruzar(() => (current = read()));
});

/*
 * El cambio de pantalla se cruza con una View Transition: el navegador
 * fotografia lo que hay, deja que Svelte redibuje y funde las dos fotos. Lo
 * que se ve --el fundido, y que la barra de arriba y el sidebar se queden
 * quietos porque llevan `view-transition-name`-- esta en
 * `styles/animations.css`; aqui solo se dispara.
 *
 * No en todas las navegaciones. Las capas que se abren encima --los ajustes
 * del constructor, la vista previa-- ya tienen su propia entrada, la del
 * modal, y fotografiar la pantalla entera para eso seria animar dos veces lo
 * mismo. Se reconocen por la ubicacion de fondo: si la hay a un lado o al
 * otro, es una capa y no un cambio de pantalla.
 */
function cruzar(cambio: () => void, dir: Direction = 0): void {
  const puede =
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!puede) {
    cambio();
    return;
  }
  /*
   * Hacia donde va el cambio, para que lo que se desplace lo haga por el lado
   * que le toca: una pestana a la derecha entra por la derecha y la de la
   * izquierda por la izquierda, que es lo que hace que el gesto se lea como
   * moverse por una fila y no como una pantalla nueva. Lo escribe la raiz del
   * documento --`styles/animations.css` lo lee de ahi-- y se borra al acabar.
   */
  const raiz = document.documentElement;
  if (dir !== 0) raiz.dataset.moDir = dir > 0 ? "forward" : "back";
  const cruce = document.startViewTransition(async () => {
    cambio();
    // Sin esperar al siguiente latido, la foto nueva se saca antes de que
    // Svelte haya redibujado: se cruzaria la pantalla vieja consigo misma.
    await tick();
  });
  /*
   * Saltarse el cruce no es un error. El navegador lo hace solo cuando el
   * documento no se esta dibujando --otra pestana delante, la ventana
   * escondida-- o cuando llega otra navegacion encima, y entonces `ready` se
   * rechaza. La pantalla cambia igual, que es lo que importa; sin este
   * `catch` la promesa rechazada acabaria en la consola como un fallo.
   */
  cruce.ready.catch(() => {});
  // El `catch` va ANTES del `finally`: las dos promesas del cruce se rechazan
  // cuando se lo salta, y una promesa rechazada que nadie mira acaba en la
  // consola como un fallo que no lo es.
  void cruce.finished
    .catch(() => {})
    .finally(() => {
      delete raiz.dataset.moDir;
    });
}

/** Ir a otra dirección. Sin recargar: el historial se mueve y la vista con el. */
export function navigate(
  to: string,
  options: { replace?: boolean; state?: RouteState | null; dir?: Direction } = {},
): void {
  const state = options.state ?? null;
  const capa = Boolean(state?.background) || Boolean(current.state?.background);
  const destino = to.split(/[?#]/)[0];
  const mismo = destino === current.pathname;
  // Cambiar de página o de tabla dentro del constructor no es cambio de
  // pantalla; ver `dentroDeLaMisma`.
  const dentro = dentroDeLaMisma(destino, current.pathname);
  const paso = () => {
    if (options.replace) window.history.replaceState(state, "", to);
    else window.history.pushState(state, "", to);
    current = read();
  };
  if (capa || mismo || dentro) paso();
  else cruzar(paso, options.dir ?? 0);
}

/**
 * Un enlace que no recarga la página.
 *
 * `<a href="/a/1" use:link>` o, para abrir algo encima de lo que ya se ve,
 * `<a href="/a/1/ajustes" use:link={{ state: { background } }}>`.
 *
 * Se respetan las teclas: con control, con la rueda o con `target` puesto el
 * navegador hace lo suyo, que es abrir en otra pestana.
 */
export function link(
  node: HTMLAnchorElement,
  options: { replace?: boolean; state?: RouteState | null } = {},
) {
  let opts = options;
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (node.target && node.target !== "_self") return;
    const href = node.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("//")) return;
    event.preventDefault();
    navigate(href, opts);
  };
  node.addEventListener("click", onClick);
  return {
    update(next: { replace?: boolean; state?: RouteState | null } = {}) {
      opts = next;
    },
    destroy() {
      node.removeEventListener("click", onClick);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Emparejar rutas                                                     */
/* ------------------------------------------------------------------ */

const segments = (path: string) => path.split("/").filter(Boolean);

/**
 * Compara un patron con una dirección.
 *
 * Entiende dos cosas y ninguna mas: `:nombre` toma un tramo, y `*` al final
 * toma lo que quede. Devuelve `null` si no encaja.
 */
export function matchPath(
  pattern: string,
  pathname: string,
): { params: RouteParams; rest: string } | null {
  const want = segments(pattern);
  const have = segments(pathname);
  const params: RouteParams = {};

  for (let i = 0; i < want.length; i++) {
    const piece = want[i];
    if (piece === "*") return { params, rest: `/${have.slice(i).join("/")}` };
    const value = have[i];
    if (value === undefined) return null;
    if (piece.startsWith(":")) params[piece.slice(1)] = decodeURIComponent(value);
    else if (piece !== value) return null;
  }

  return have.length === want.length ? { params, rest: "/" } : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada ruta dibuja un componente con sus propias props.
export type RouteComponent = any;

export interface RouteDef {
  /** El patron, contado desde la raíz del router: `/a/:appId/*`. */
  path: string;
  component: RouteComponent;
  /** Hace falta sesión. La guardia la aplica `Router.svelte`. */
  guarded?: boolean;
}

export interface RouteMatch {
  route: RouteDef;
  params: RouteParams;
  /** Lo que se comio el `*`, para el router de dentro. */
  rest: string;
}

/** La primera ruta que encaje, en el orden en que estan escritas. */
export function matchRoutes(routes: RouteDef[], pathname: string): RouteMatch | null {
  for (const route of routes) {
    const hit = matchPath(route.path, pathname);
    if (hit) return { route, params: hit.params, rest: hit.rest };
  }
  return null;
}
