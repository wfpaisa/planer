/**
 * Verificacion de los tokens que envia el navegador.
 * El panel entra como "builder"; las apps publicadas, como "member".
 */
import { INTERNAL } from "./config.ts";
import { pb } from "./pb.ts";

export interface Identity {
  id: string;
  email: string;
  name: string;
  collection: "builders" | "members";
  /**
   * La aplicación de la que es esta cuenta. Vacía en un constructor, que no es
   * de ninguna. Ver `ensureScopedAccounts` en `server/bootstrap.ts`.
   */
  app: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /**
     * Que clase de error es, cuando el mensaje no basta para distinguirlo.
     * Viaja hasta el navegador junto al mensaje. Ver `NEEDS_SESSION`.
     */
    public code?: string,
  ) {
    super(message);
  }
}

const cache = new Map<string, { identity: Identity; at: number }>();
const TTL = 60_000;

export function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

async function verify(token: string, collection: "builders" | "members"): Promise<Identity> {
  const key = `${collection}:${token}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.identity;

  const res = await pb<{
    record: { id: string; email?: string; cuenta?: string; app?: string; name?: string };
  }>(`/api/collections/${collection}/auth-refresh`, {
    method: "POST",
    headers: { authorization: token },
  }).catch(() => null);

  if (!res?.record) throw new HttpError(401, "Sesión no válida");

  const identity: Identity = {
    id: res.record.id,
    // En una cuenta de aplicación el correo esta en `cuenta`; el constructor
    // sigue teniendolo donde siempre.
    email: res.record.cuenta || res.record.email || "",
    name: res.record.name ?? "",
    collection,
    app: res.record.app ?? "",
  };
  cache.set(key, { identity, at: Date.now() });
  return identity;
}

/** Exige una sesión de constructor. */
export async function requireBuilder(req: Request): Promise<Identity> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "Falta la sesión");
  return verify(token, INTERNAL.builders);
}

/** Devuelve la sesión de un usuario de app publicada, o null si no hay. */
export async function optionalMember(req: Request): Promise<Identity | null> {
  const token = bearer(req);
  if (!token) return null;
  return verify(token, INTERNAL.members).catch(() => null);
}

/** Devuelve la sesión de constructor, o null si no hay o no es valida. */
export async function optionalBuilder(req: Request): Promise<Identity | null> {
  const token = bearer(req);
  if (!token) return null;
  return verify(token, INTERNAL.builders).catch(() => null);
}

export function forgetToken(token: string) {
  for (const key of cache.keys()) if (key.endsWith(`:${token}`)) cache.delete(key);
}
