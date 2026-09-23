/**
 * Lo que da forma a una aplicación antes de guardarla: su enlace, su paleta y
 * sus roles.
 *
 * Vive aparte de `server/routes.ts` porque una aplicación ya no nace por un
 * solo camino: la crea quien pulsa "Nueva aplicación", y también la crea
 * importar un archivo `.planer` o duplicar una que ya existe. Los tres tienen
 * que dar exactamente el mismo resultado --el mismo enlace único, la misma
 * paleta saneada, los mismos roles-- y con una copia en cada camino el dia que
 * uno cambie los otros dos se quedan atras sin que nada avise.
 */
import { normalizePalette } from "../shared/brand.ts";
import { ADMIN_ROLE, MAX_ROLES, normalizeRole } from "../shared/people.ts";
import type { AppTheme } from "../shared/types.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { firstRecord } from "./pb.ts";
import { slugify } from "./schema.ts";

/**
 * El enlace público de una aplicación, sacado de su nombre.
 *
 * Nadie lo escribe: se genera al crearla y se vuelve a generar cuando le
 * cambian el nombre. Si ya lo tiene otra, se le añade un número hasta que este
 * libre. `skipId` es la propia aplicación al renombrarse: sin el, una que ya
 * ocupa "tienda" se encontraria a si misma y saldria de aquí como "tienda-2".
 */
export async function uniqueSlug(base: string, skipId?: string): Promise<string> {
  const root = slugify(base, "app");
  const mine = skipId ? ` && id != "${quote(skipId)}"` : "";
  for (let i = 0; i < 200; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await firstRecord(INTERNAL.apps, `slug = "${quote(candidate)}"${mine}`);
    if (!hit) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/**
 * Solo se admite un id del catálogo de paletas (o `custom` con su
 * hexadecimal) y un tamaño de letra dentro del rango. La validacion entera
 * vive en `normalizePalette`, que también sabe leer lo guardado con los
 * formatos de antes.
 */
export function sanitizeTheme(input: unknown): AppTheme | null {
  if (!input || typeof input !== "object") return null;
  return normalizePalette(input);
}

/**
 * Deja una lista de roles limpia: normalizada, sin vacios, sin repetidos y con
 * tope. Con `allowed`, ademas descarta los que la aplicación ya no define.
 *
 * La normalizacion se aplica aquí y no solo en la pantalla: el campo la aplica
 * en cada pulsacion para que se vea el nombre tal como va a quedar, pero quien
 * llama a la ruta no tiene por que ser la pantalla. Dos nombres que se
 * normalicen al mismo son el mismo rol y se funden en uno. Ver `design.md` D6.
 */
export function sanitizeRoles(input: unknown, allowed?: string[]): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const name = normalizeRole(raw);
    if (!name) continue;
    if (allowed && !allowed.includes(name)) continue;
    out.add(name);
    if (out.size >= MAX_ROLES) break;
  }
  return [...out];
}

/**
 * Los roles de una aplicación, con `admin` siempre dentro.
 *
 * Va primero para que se lea antes que los que puso el constructor, y no se
 * puede quitar: la vista previa arranca en el, y quitarlo dejaria a
 * `pruneRoles` borrandolo de las páginas que lo tuvieran marcado. Ver
 * `design.md` D7.
 */
export function withAdminRole(roles: string[]): string[] {
  return roles.includes(ADMIN_ROLE) ? roles : [ADMIN_ROLE, ...roles].slice(0, MAX_ROLES);
}
