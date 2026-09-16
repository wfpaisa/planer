/**
 * Quien puede abrir una pagina.
 *
 * Se decide en dos sitios que no se repiten: la aplicacion dice si es publica o
 * si requiere iniciar sesion, y cada pagina dice que roles pueden abrirla.
 *
 * La lista de roles vacia es lo que la pantalla ensena como `Todos`: la abre
 * cualquiera que alcance la aplicacion. Con uno o mas roles marcados la pagina
 * exige sesion iniciada y uno de ellos, aunque la aplicacion sea publica. No
 * hay un estado guardado de `Todos`, asi que no hay dos estados que puedan
 * discrepar. Ver `design.md` D2.
 *
 * Entre los dos hay un tercer estado: la lista con `admin` y nada mas, que es
 * "solo quien construye". Se llega apagando `Todos` sin marcar ningun rol, y es
 * lo que deja una pagina a medias fuera de la vista de todo el mundo sin tener
 * que borrarla. `admin` no se marca a mano en ningun caso: lo pone
 * `withPageAdmin` en cuanto la pagina deja de ser de todos.
 */
import { ADMIN_ROLE } from "./people.ts";
import type { PageRecord } from "./types.ts";

/** Lo minimo que hace falta saber de una pagina para decidir quien la abre. */
export type PageGate = Pick<PageRecord, "roles">;

/**
 * La lista de roles de una pagina limitada, con `admin` siempre delante.
 *
 * Quien construye mira sus propias paginas con el rol `admin` --es donde
 * arranca la vista previa-- y una pagina limitada que no lo nombre lo deja
 * fuera de su propia aplicacion. Por eso en la pantalla `admin` sale marcado y
 * no se puede desmarcar, y por eso lo que se guarda dice lo mismo que lo que
 * se ve.
 *
 * La lista vacia se queda vacia: no hay estado guardado de `Todos`, y anadirle
 * `admin` la convertiria en "solo quien construye", que es otro estado --uno
 * que se pide apagando `Todos`, no pasando por aqui--.
 */
export function withPageAdmin(roles: string[]): string[] {
  if (!roles.length) return [];
  return [ADMIN_ROLE, ...roles.filter((r) => r !== ADMIN_ROLE)];
}

/** Si la pagina limita quien la abre a ciertos roles. */
export function pageIsLimited(page: PageGate): boolean {
  return (page.roles ?? []).length > 0;
}

/**
 * Si no la abre nadie mas que quien construye: `admin` y ningun rol mas.
 *
 * Es el estado que la pantalla ensena con `Todos` apagado y sin roles marcados.
 * Se pregunta aparte de `pageIsLimited` porque se cuenta distinto: ahi no hay
 * roles que enumerar, hay una pagina que todavia no se le ha ensenado a nadie.
 */
export function pageIsAdminOnly(page: PageGate): boolean {
  const roles = page.roles ?? [];
  return roles.length > 0 && roles.every((r) => r === ADMIN_ROLE);
}

/**
 * Si quien mira puede abrir la pagina. `viewer` es `null` cuando entro sin
 * sesion; sus `roles` son los que tiene en esta aplicacion.
 *
 * La exigencia de sesion de la aplicacion no se mira aqui: es una frontera que
 * tapa a todas sus paginas por igual y se comprueba antes, donde se sabe que
 * aplicacion es. Ver `runPageData` y `publicBundle`.
 */
export function canOpenPage(page: PageGate, viewer: { roles: string[] } | null): boolean {
  const roles = page.roles ?? [];
  if (!roles.length) return true;
  if (!viewer) return false;
  return roles.some((r) => viewer.roles.includes(r));
}

/** Por que no se puede abrir: por falta de sesion o por falta de rol. */
export function pageDenial(page: PageGate, viewer: { roles: string[] } | null): "auth" | "role" {
  return !viewer && pageIsLimited(page) ? "auth" : "role";
}
