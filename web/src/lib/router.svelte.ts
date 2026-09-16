/**
 * El router del panel.
 *
 * Escrito en casa, y no tomado de una libreria, por tres razones que se ven
 * mejor juntas: hay cinco rutas de primer nivel y dos anidadas, la guardia de
 * sesion tiene que esperar a que se sepa si hay sesion --no antes--, y el
 * constructor abre sus ajustes y su vista previa como capas encima de la ruta
 * que ya estaba. Eso ultimo es la "ubicacion de fondo", y casi ningun router
 * pequeno lo hace.
 *
 * La ubicacion vive en el estado del historial, asi que sobrevive a ir y
 * volver con los botones del navegador. Ver `navigate`.
 */

/** Lo que se guarda en el historial junto a cada direccion. */
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
 * Es de solo lectura a proposito --se cambia con `navigate`-- y por eso son
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
  current = read();
});

/** Ir a otra direccion. Sin recargar: el historial se mueve y la vista con el. */
export function navigate(
  to: string,
  options: { replace?: boolean; state?: RouteState | null } = {},
): void {
  const state = options.state ?? null;
  if (options.replace) window.history.replaceState(state, "", to);
  else window.history.pushState(state, "", to);
  current = read();
}

/**
 * Un enlace que no recarga la pagina.
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
 * Compara un patron con una direccion.
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
  /** El patron, contado desde la raiz del router: `/a/:appId/*`. */
  path: string;
  component: RouteComponent;
  /** Hace falta sesion. La guardia la aplica `Router.svelte`. */
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
