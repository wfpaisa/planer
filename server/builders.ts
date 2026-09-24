/**
 * Los usuarios del panel: quienes construyen aplicaciones.
 *
 * Solo la cuenta principal (la del `.env`) los ve y los gestiona. Crear una
 * cuenta, cambiarle el nombre o la clave y repartirle aplicaciones pasa por
 * aquí, con el token de administrador de PocketBase: la colección `builders`
 * no deja a nadie leer otra cuenta que la suya. La principal no sale en la
 * lista: no se edita desde el panel, sino en el `.env`.
 *
 * Una aplicación asignada se trabaja como la propia --tablas, páginas, datos,
 * personas, publicar--, pero no se borra: eso queda para quien la creó. Ver
 * `buildsApp` en `server/access.ts` y las reglas en `server/bootstrap.ts`.
 */
import {
  type AppRecord,
  type BuilderAccount,
  type BuildersView,
  MIN_BUILDER_PASSWORD,
} from "../shared/types.ts";
import { HttpError, isPrincipal, requirePrincipal } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { createRecord, deleteRecord, firstRecord, listRecords, updateRecord } from "./pb.ts";

interface BuilderRow {
  id: string;
  email: string;
  name?: string;
}

type AppRow = Pick<AppRecord, "id" | "name" | "slug" | "icon" | "theme" | "owner" | "editors">;

const json = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "El cuerpo de la petición no es JSON válido");
  }
}

/** La fila es la cuenta principal. */
const principalRow = (row: Pick<BuilderRow, "email">) =>
  isPrincipal({ email: row.email, collection: INTERNAL.builders });

async function allApps(): Promise<AppRow[]> {
  const list = await listRecords<AppRow>(INTERNAL.apps, {
    perPage: 1000,
    skipTotal: 1,
    sort: "name",
    fields: "id,name,slug,icon,theme,owner,editors",
  });
  return list.items;
}

async function builderRow(id: string): Promise<BuilderRow> {
  const row = await firstRecord<BuilderRow>(INTERNAL.builders, `id = "${quote(id)}"`);
  // La principal no se gestiona desde aquí: para esta API no existe.
  if (!row || principalRow(row)) throw new HttpError(404, "El usuario no existe");
  return row;
}

async function view(): Promise<BuildersView> {
  const [rows, apps] = await Promise.all([
    // Sin `sort`: la colección nació sin fechas y ordenar por una que no existe
    // es un error. Se ordena abajo.
    listRecords<BuilderRow>(INTERNAL.builders, { perPage: 500, skipTotal: 1 }),
    allApps(),
  ]);
  const builders: BuilderAccount[] = rows.items
    .filter((row) => !principalRow(row))
    .map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name ?? "",
      owned: apps.filter((app) => app.owner === row.id).map((app) => app.id),
      assigned: apps.filter((app) => (app.editors ?? []).includes(row.id)).map((app) => app.id),
    }));
  // Por nombre, o por correo si no lo tienen.
  const label = (b: BuilderAccount) => (b.name || b.email).toLocaleLowerCase("es");
  builders.sort((a, b) => label(a).localeCompare(label(b), "es"));
  return {
    builders,
    apps: apps.map(({ id, name, slug, icon, theme, owner }) => ({
      id,
      name,
      slug,
      icon,
      theme,
      owner,
    })),
  };
}

function cleanEmail(value: unknown): string {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new HttpError(400, "Correo no válido");
  return email;
}

function cleanName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .slice(0, 120);
}

function checkPassword(value: unknown): string {
  const password = String(value ?? "");
  if (password.length < MIN_BUILDER_PASSWORD) {
    throw new HttpError(
      400,
      `La contraseña debe tener al menos ${MIN_BUILDER_PASSWORD} caracteres`,
    );
  }
  return password;
}

async function emailTaken(email: string, except = ""): Promise<boolean> {
  const row = await firstRecord<BuilderRow>(
    INTERNAL.builders,
    `email = "${quote(email)}"${except ? ` && id != "${quote(except)}"` : ""}`,
  ).catch(() => null);
  return !!row;
}

/**
 * Deja al usuario con exactamente estas aplicaciones asignadas.
 *
 * Las suyas no cuentan: ya entra en ellas por ser el dueño, y apuntarlo
 * además como asignado no cambiaría nada.
 */
async function assignApps(builderId: string, wanted: unknown): Promise<void> {
  if (!Array.isArray(wanted)) return;
  const ids = new Set(wanted.filter((id): id is string => typeof id === "string"));
  for (const app of await allApps()) {
    const editors = app.editors ?? [];
    const has = editors.includes(builderId);
    const should = ids.has(app.id) && app.owner !== builderId;
    if (has === should) continue;
    await updateRecord(INTERNAL.apps, app.id, {
      editors: should ? [...editors, builderId] : editors.filter((id) => id !== builderId),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Rutas                                                                */
/* ------------------------------------------------------------------ */

export async function listBuilders(req: Request) {
  await requirePrincipal(req);
  return json(await view());
}

export async function createBuilder(req: Request) {
  await requirePrincipal(req);
  const input = await body<{
    email?: string;
    name?: string;
    password?: string;
    apps?: string[];
  }>(req);

  const email = cleanEmail(input.email);
  const password = checkPassword(input.password);
  if (await emailTaken(email)) throw new HttpError(409, "Ya hay un usuario con ese correo");

  const created = await createRecord<BuilderRow>(INTERNAL.builders, {
    email,
    name: cleanName(input.name) || email.split("@")[0],
    password,
    passwordConfirm: password,
    verified: true,
    emailVisibility: true,
  });
  await assignApps(created.id, input.apps);
  return json(await view(), 201);
}

export async function updateBuilder(req: Request, id: string) {
  await requirePrincipal(req);
  const row = await builderRow(id);
  const input = await body<{
    email?: string;
    name?: string;
    password?: string;
    apps?: string[];
  }>(req);

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = cleanName(input.name);
  if (input.email !== undefined) {
    const email = cleanEmail(input.email);
    if (email !== row.email.toLowerCase()) {
      if (await emailTaken(email, row.id)) {
        throw new HttpError(409, "Ya hay un usuario con ese correo");
      }
      patch.email = email;
    }
  }
  if (input.password) {
    const password = checkPassword(input.password);
    patch.password = password;
    patch.passwordConfirm = password;
  }
  if (Object.keys(patch).length) await updateRecord(INTERNAL.builders, row.id, patch);
  await assignApps(row.id, input.apps);
  return json(await view());
}

/**
 * Borra un usuario. Sus aplicaciones no se van con él: pasan a quien lo borra.
 *
 * La relación `owner` está en cascada, así que borrar la cuenta sin más se
 * llevaría sus aplicaciones --y dejaría sus tablas de datos huérfanas en
 * PocketBase, que no cuelgan de ninguna relación--.
 */
export async function deleteBuilder(req: Request, id: string) {
  const me = await requirePrincipal(req);
  const row = await builderRow(id);

  for (const app of await allApps()) {
    if (app.owner !== row.id) continue;
    await updateRecord(INTERNAL.apps, app.id, {
      owner: me.id,
      editors: (app.editors ?? []).filter((editor) => editor !== me.id && editor !== row.id),
    });
  }
  await deleteRecord(INTERNAL.builders, row.id);
  return json(await view());
}
