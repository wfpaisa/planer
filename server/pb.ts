/**
 * Cliente de PocketBase con permisos de administrador.
 * Solo vive en el servidor: el navegador nunca ve estas credenciales.
 */
import { config } from "./config.ts";

export class PbError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

let token = "";
let tokenAt = 0;
/** El token de superusuario dura mucho; lo renovamos cada 30 minutos por seguridad. */
const TOKEN_TTL = 30 * 60 * 1000;

async function authenticate(): Promise<string> {
  const res = await fetch(`${config.pbUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: config.adminEmail, password: config.adminPassword }),
  });
  if (!res.ok) {
    throw new PbError(
      res.status,
      `No se pudo entrar como administrador de PocketBase`,
      await res.text(),
    );
  }
  const body = (await res.json()) as { token: string };
  token = body.token;
  tokenAt = Date.now();
  return token;
}

export async function adminToken(force = false): Promise<string> {
  if (force || !token || Date.now() - tokenAt > TOKEN_TTL) return authenticate();
  return token;
}

export function resetToken() {
  token = "";
}

/**
 * Pregunta a PocketBase si el token de administrador sigue vivo.
 * Si otro proceso reescribio la cuenta, el token deja de valer en silencio.
 */
async function tokenStillValid(): Promise<boolean> {
  if (!token) return false;
  const res = await fetch(`${config.pbUrl}/api/collections/_superusers/auth-refresh`, {
    method: "POST",
    headers: { authorization: token },
  }).catch(() => null);
  return res?.ok === true;
}

/** Aplana los errores de validacion de PocketBase en frases legibles. */
function flatten(node: unknown, path = ""): string[] {
  if (!node || typeof node !== "object") return [];
  const entry = node as Record<string, unknown>;
  if (typeof entry.message === "string") return [`[${path}] ${entry.message}`];
  return Object.entries(entry).flatMap(([key, value]) =>
    flatten(value, path ? `${path}.${key}` : key),
  );
}

/** Llamada autenticada a la API de PocketBase. Reintenta una vez si el token expiro. */
export async function pb<T = unknown>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
  retry = true,
): Promise<T> {
  const { query, ...rest } = init;
  let url = `${config.pbUrl}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers = new Headers(rest.headers);
  // Si quien llama trae su propio token (por ejemplo, para validarlo), se respeta.
  if (!headers.has("authorization")) headers.set("authorization", await adminToken());
  // Un formulario pone su propio tipo, con la frontera dentro: escribirlo aqui
  // dejaria el cuerpo ilegible para PocketBase. Todo lo demas es JSON.
  const form = rest.body instanceof FormData;
  if (rest.body && !form && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(url, { ...rest, headers });

  // Cuando el token de administrador deja de valer, PocketBase no siempre
  // responde 401: a veces trata la peticion como anonima y la rechazan las
  // reglas de acceso (400 o 403). Por eso comprobamos el token y reintentamos.
  const usedOurToken = !new Headers(rest.headers).has("authorization");
  if (retry && usedOurToken && [400, 401, 403].includes(res.status)) {
    if (!(await tokenStillValid())) {
      resetToken();
      return pb<T>(path, init, false);
    }
  }
  if (!res.ok) {
    let data: unknown;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    const base =
      (data as { message?: string })?.message ?? `PocketBase respondio ${res.status} en ${path}`;
    const detail = flatten((data as { data?: unknown })?.data)
      .slice(0, 5)
      .join("; ");
    throw new PbError(res.status, detail ? `${base} ${detail}` : base, data);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Colecciones                                                          */
/* ------------------------------------------------------------------ */

export interface PbField {
  id?: string;
  name: string;
  type: string;
  required?: boolean;
  hidden?: boolean;
  presentable?: boolean;
  system?: boolean;
  [key: string]: unknown;
}

export interface PbCollection {
  id: string;
  name: string;
  type: "base" | "auth" | "view";
  fields: PbField[];
  indexes?: string[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  [key: string]: unknown;
}

export async function listCollections(): Promise<PbCollection[]> {
  const res = await pb<{ items: PbCollection[] }>("/api/collections", {
    query: { perPage: 500, skipTotal: 1 },
  });
  return res.items;
}

export async function getCollection(nameOrId: string): Promise<PbCollection | null> {
  try {
    return await pb<PbCollection>(`/api/collections/${encodeURIComponent(nameOrId)}`);
  } catch (err) {
    if (err instanceof PbError && err.status === 404) return null;
    throw err;
  }
}

export function createCollection(body: Partial<PbCollection>): Promise<PbCollection> {
  return pb<PbCollection>("/api/collections", { method: "POST", body: JSON.stringify(body) });
}

export function updateCollection(
  nameOrId: string,
  body: Partial<PbCollection>,
): Promise<PbCollection> {
  return pb<PbCollection>(`/api/collections/${encodeURIComponent(nameOrId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteCollection(nameOrId: string): Promise<void> {
  return pb<void>(`/api/collections/${encodeURIComponent(nameOrId)}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Registros                                                            */
/* ------------------------------------------------------------------ */

export interface PbList<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export function listRecords<T = Record<string, unknown>>(
  collection: string,
  query: Record<string, string | number | undefined> = {},
): Promise<PbList<T>> {
  return pb<PbList<T>>(`/api/collections/${encodeURIComponent(collection)}/records`, { query });
}

export async function firstRecord<T = Record<string, unknown>>(
  collection: string,
  filter: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T | null> {
  const res = await listRecords<T>(collection, { ...query, filter, perPage: 1, skipTotal: 1 });
  return res.items[0] ?? null;
}

/**
 * La ruta de un registro, con las dos piezas codificadas.
 *
 * El id se codifica igual que la coleccion, y por la misma razon: llega de
 * fuera --el que manda una pagina al guardar una fila-- y sin codificar, un
 * `../` suyo sube un tramo de la ruta. La direccion se normaliza antes de
 * salir, asi que la peticion terminaria en otro punto de la API, con el token
 * de administrador puesto.
 */
const recordPath = (collection: string, id: string) =>
  `/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`;

export function createRecord<T = Record<string, unknown>>(
  collection: string,
  body: unknown,
): Promise<T> {
  return pb<T>(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateRecord<T = Record<string, unknown>>(
  collection: string,
  id: string,
  body: unknown,
): Promise<T> {
  return pb<T>(recordPath(collection, id), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteRecord(collection: string, id: string): Promise<void> {
  return pb<void>(recordPath(collection, id), { method: "DELETE" });
}

/**
 * Crea un registro mandando un formulario, que es la unica forma de escribir un
 * campo de archivo: un campo de archivo no cabe en JSON.
 */
export function createRecordForm<T = Record<string, unknown>>(
  collection: string,
  form: FormData,
): Promise<T> {
  return pb<T>(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: "POST",
    body: form,
  });
}

/* ------------------------------------------------------------------ */
/* Archivos                                                             */
/* ------------------------------------------------------------------ */

/*
 * Los archivos de un campo protegido no se sirven por su direccion a secas:
 * hay que pedir antes una llave de lectura. Dura poco --dos minutos de
 * fabrica-- asi que se guarda un rato y se pide otra cuando caduca, en vez de
 * una por cada lectura.
 */
let fileKey = "";
let fileKeyAt = 0;
const FILE_KEY_TTL = 60 * 1000;

async function fileToken(): Promise<string> {
  if (fileKey && Date.now() - fileKeyAt < FILE_KEY_TTL) return fileKey;
  const res = await pb<{ token: string }>("/api/files/token", { method: "POST" });
  fileKey = res.token;
  fileKeyAt = Date.now();
  return fileKey;
}

/** El contenido de un campo de archivo, en bytes. */
export async function readFileField(
  collection: string,
  recordId: string,
  filename: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const path =
    `/api/files/${encodeURIComponent(collection)}` +
    `/${encodeURIComponent(recordId)}/${encodeURIComponent(filename)}`;

  const fetchWith = async (token: string) =>
    fetch(`${config.pbUrl}${path}?token=${encodeURIComponent(token)}`);

  let res = await fetchWith(await fileToken());
  // La llave pudo caducar entre pedirla y usarla: se pide una nueva y se
  // reintenta una sola vez.
  if (!res.ok && [400, 401, 403, 404].includes(res.status)) {
    fileKey = "";
    res = await fetchWith(await fileToken());
  }
  if (!res.ok) {
    throw new PbError(res.status, `No se pudo leer el archivo guardado (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
