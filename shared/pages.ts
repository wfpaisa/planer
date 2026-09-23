/**
 * Quien puede abrir una página.
 *
 * Se decide en dos sitios que no se repiten: la aplicación dice si es publica o
 * si requiere iniciar sesión, y cada página dice que roles pueden abrirla.
 *
 * La lista de roles vacía es lo que la pantalla enseña como `Todos`: la abre
 * cualquiera que alcance la aplicación. Con uno o mas roles marcados la página
 * exige sesión iniciada y uno de ellos, aunque la aplicación sea publica. No
 * hay un estado guardado de `Todos`, así que no hay dos estados que puedan
 * discrepar. Ver `design.md` D2.
 *
 * Entre los dos hay un tercer estado: la lista con `admin` y nada mas, que es
 * "solo quien construye". Se llega apagando `Todos` sin marcar ningún rol, y es
 * lo que deja una página a medias fuera de la vista de todo el mundo sin tener
 * que borrarla. `admin` no se marca a mano en ningún caso: lo pone
 * `withPageAdmin` en cuanto la página deja de ser de todos.
 */
import { DEFAULT_ICON, iconName } from "./icons.ts";
import { ADMIN_ROLE } from "./people.ts";
import type { PageRecord } from "./types.ts";

/** Lo minimo que hace falta saber de una página para decidir quien la abre. */
export type PageGate = Pick<PageRecord, "roles">;

/**
 * La lista de roles de una página limitada, con `admin` siempre delante.
 *
 * Quien construye mira sus propias páginas con el rol `admin` --es donde
 * arranca la vista previa-- y una página limitada que no lo nombre lo deja
 * fuera de su propia aplicación. Por eso en la pantalla `admin` sale marcado y
 * no se puede desmarcar, y por eso lo que se guarda dice lo mismo que lo que
 * se ve.
 *
 * La lista vacía se queda vacía: no hay estado guardado de `Todos`, y anadirle
 * `admin` la convertiria en "solo quien construye", que es otro estado --uno
 * que se pide apagando `Todos`, no pasando por aquí--.
 */
export function withPageAdmin(roles: string[]): string[] {
  if (!roles.length) return [];
  return [ADMIN_ROLE, ...roles.filter((r) => r !== ADMIN_ROLE)];
}

/** Si la página limita quien la abre a ciertos roles. */
export function pageIsLimited(page: PageGate): boolean {
  return (page.roles ?? []).length > 0;
}

/**
 * Si no la abre nadie mas que quien construye: `admin` y ningún rol mas.
 *
 * Es el estado que la pantalla enseña con `Todos` apagado y sin roles marcados.
 * Se pregunta aparte de `pageIsLimited` porque se cuenta distinto: ahi no hay
 * roles que enumerar, hay una página que todavía no se le ha ensenado a nadie.
 */
export function pageIsAdminOnly(page: PageGate): boolean {
  const roles = page.roles ?? [];
  return roles.length > 0 && roles.every((r) => r === ADMIN_ROLE);
}

/**
 * Si quien mira puede abrir la página. `viewer` es `null` cuando entro sin
 * sesión; sus `roles` son los que tiene en esta aplicación.
 *
 * La exigencia de sesión de la aplicación no se mira aquí: es una frontera que
 * tapa a todas sus páginas por igual y se comprueba antes, donde se sabe que
 * aplicación es. Ver `runPageData` y `publicBundle`.
 */
export function canOpenPage(page: PageGate, viewer: { roles: string[] } | null): boolean {
  const roles = page.roles ?? [];
  if (!roles.length) return true;
  if (!viewer) return false;
  return roles.some((r) => viewer.roles.includes(r));
}

/** Por que no se puede abrir: por falta de sesión o por falta de rol. */
export function pageDenial(page: PageGate, viewer: { roles: string[] } | null): "auth" | "role" {
  return !viewer && pageIsLimited(page) ? "auth" : "role";
}

/* ------------------------------------------------------------------ */
/* El nombre de la página                                               */
/* ------------------------------------------------------------------ */

/** Lo mas largo que puede ser un nombre de página puesto por la IA. */
export const PAGE_NAME_MAX = 32;

/**
 * El nombre con el que nace una página recien creada.
 *
 * Es un nombre de relleno --dice el número de página, no de que va-- y por eso
 * se reconoce: mientras siga puesto, la IA puede cambiarlo por uno que cuente
 * lo que se le pidio construir.
 */
export function defaultPageName(order: number): string {
  return `Página ${order + 1}`;
}

/**
 * Si la página todavía se llama como nacio.
 *
 * Solo entonces se le cambia el nombre solo: uno puesto a mano es una decision
 * de quien construye y no se toca, aunque la página se reescriba entera.
 */
export function isDefaultPageName(name: string | undefined | null): boolean {
  return /^p[áa]gina\s+\d+$/i.test((name ?? "").trim());
}

/**
 * Deja un nombre de página en condiciones de guardarse, o `null` si lo que
 * llego no sirve.
 *
 * Se recorta a una línea, se le quitan las comillas con las que un modelo suele
 * envolverlo y se corta por palabra: un nombre largo no cabe en el sidebar, y
 * cortarlo a media palabra se lee peor que cortarlo antes.
 */
export function cleanPageName(value: unknown): string | null {
  const flat = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .trim();
  if (!flat || isDefaultPageName(flat)) return null;
  if (flat.length <= PAGE_NAME_MAX) return flat;

  const cut = flat.slice(0, PAGE_NAME_MAX);
  const space = cut.lastIndexOf(" ");
  return (space > 12 ? cut.slice(0, space) : cut).trim();
}

/* ------------------------------------------------------------------ */
/* El icono de la página                                              */
/* ------------------------------------------------------------------ */

/**
 * El icono con el que nace una página recien creada.
 *
 * Es relleno igual que el nombre --un archivo generico no dice de que va la
 * pantalla-- y por eso se reconoce: mientras siga puesto, la IA puede cambiarlo
 * por uno que hable de lo que la página tiene dentro.
 */
export const DEFAULT_PAGE_ICON = "file-01";

/**
 * Si la página todavía lleva el icono con el que nacio.
 *
 * Uno elegido a mano en el selector es una decision de quien construye y no se
 * toca, igual que el nombre. Una página sin icono guardado cuenta como recien
 * nacida: no hay nada que perder.
 */
export function isDefaultPageIcon(icon: string | undefined | null): boolean {
  const flat = (icon ?? "").trim();
  return !flat || flat === DEFAULT_PAGE_ICON;
}

/**
 * Deja un icono de página en condiciones de guardarse, o `null` si lo que llego
 * no sirve.
 *
 * Lo que no este en la fuente se descarta en vez de caer en el icono por
 * defecto: un nombre inventado no da error --dibuja un hueco-- y guardarlo
 * convertido en otro icono cualquiera seria elegir por el modelo. Si no se
 * reconoce, la página se queda con el que tenia.
 */
export function cleanPageIcon(value: unknown): string | null {
  const flat = String(value ?? "")
    .trim()
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .replace(/^hgi-/, "")
    .trim();
  if (!flat) return null;

  const name = iconName(flat);
  /* `iconName` devuelve el icono por defecto ante un nombre que no existe: eso
     es lo que se descarta aquí, salvo que el nombre pedido sea justo ese. */
  if (name === DEFAULT_ICON && flat !== DEFAULT_ICON) return null;
  return name;
}
