/**
 * La tabla de personas vista desde la cuadricula.
 *
 * Dos de sus columnas no estan en la coleccion que la cuadricula lee: el correo
 * vive en la cuenta --que es de esta aplicacion-- y los roles en el enlace con
 * ella. Aqui se juntan al pintar y se reparten al guardar, que es lo que deja
 * que la cuadricula, el panel lateral y el exportar sigan siendo los de
 * cualquier tabla. Ver `shared/people.ts` para el porque del reparto.
 */
import { MEMBER_FIELD } from "@shared/people";
import type { FieldDef, TableRecord } from "@shared/types";

import type { Row } from "./cellValues";
import { api, del, patch, pb, post } from "./pb";

/** Lo que se sabe de una persona fuera de la coleccion de la aplicacion. */
export interface PersonOverlay {
  /** Id del enlace persona-aplicacion. Es por donde se escriben los roles. */
  accessId: string;
  /** Id de la cuenta. Es lo que enlaza con la fila. */
  member: string;
  cuenta: string;
  nombre: string;
  roles: string[];
}

/** La forma en que el servidor devuelve un enlace persona-aplicacion. */
interface AccessRow {
  id: string;
  member: string;
  roles?: string[];
  expand?: { member?: { cuenta?: string; name?: string } };
}

/** Lo que la aplicacion sabe de cada persona fuera de su coleccion, por cuenta. */
export async function loadPeopleOverlay(appId: string): Promise<Map<string, PersonOverlay>> {
  const list = await api<AccessRow[]>(`/api/apps/${appId}/members`);
  return new Map(
    list.map((row) => [
      row.member,
      {
        accessId: row.id,
        member: row.member,
        cuenta: row.expand?.member?.cuenta ?? "",
        nombre: row.expand?.member?.name ?? "",
        roles: row.roles ?? [],
      },
    ]),
  );
}

/**
 * Pone las dos columnas del sistema encima de cada fila.
 *
 * Una fila cuya persona ya no esta invitada no deberia existir --el servidor la
 * recoge al quitar el acceso-- pero si aparece se queda sin esas dos columnas
 * en vez de desaparecer: es mas util verla vacia que no verla.
 */
export function mergeOverlay(rows: Row[], overlay: Map<string, PersonOverlay>): Row[] {
  return rows.map((row) => {
    const person = overlay.get(String(row[MEMBER_FIELD] ?? ""));
    if (!person) return row;
    return { ...row, cuenta: person.cuenta, roles: person.roles };
  });
}

/** Reparte los valores escritos entre lo que es del sistema y lo que es propio. */
function split(fields: FieldDef[], values: Record<string, unknown>) {
  const system: Record<string, unknown> = {};
  const own: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.name in values)) continue;
    if (field.system) system[field.system] = values[field.name];
    else own[field.name] = values[field.name];
  }
  return { system, own };
}

/** Una fila de personas ya guardada. */
export interface SavedPerson {
  row: Row;
  /**
   * La clave con la que entra, solo cuando la cuenta acaba de nacer.
   *
   * Viene tanto si se escribio a mano como si la invento el servidor, y en los
   * dos casos es la unica vez que se puede leer: no se guarda en ningun sitio
   * del que volver a sacarla. Ver `PasswordForm.svelte`.
   */
  password?: string;
}

/**
 * Guarda una fila de personas, cada dato por su camino.
 *
 * El correo y los roles van por la ruta que ya existia --el servidor decide
 * cual de las dos colecciones toca-- y las columnas propias van directas a la
 * coleccion de la aplicacion, como en cualquier tabla.
 *
 * Al crear, primero la persona: hasta que no existe su cuenta y su acceso no
 * hay fila donde poner lo demas.
 */
export async function savePersonRow(opts: {
  appId: string;
  table: TableRecord;
  overlay: Map<string, PersonOverlay>;
  /** La fila que se edita, o nada para una persona que todavia no esta invitada. */
  row: Row | null;
  values: Record<string, unknown>;
  /**
   * La clave con la que entrara, si se eligio una. Sin ella el servidor
   * inventa una, que es lo que hace desde siempre; no es un dato obligatorio
   * para dar de alta a nadie.
   */
  password?: string;
}): Promise<SavedPerson> {
  const { appId, table, overlay, row, values, password } = opts;
  const { system, own } = split(table.fields, values);

  if (!row) {
    /*
     * Lo que se escribio de ella viaja con el alta y no detras.
     *
     * La fila la crea el servidor, y una tabla de personas con una columna
     * obligatoria --una cedula, un legajo-- no deja crearla vacia para llenarla
     * despues: se quedaba sin fila, y lo que llegaba a la pantalla era el 404
     * de aqui abajo, al ir a buscar una fila que nunca existio.
     *
     * Solo lo que trae algo: una columna en blanco no hace falta para que la
     * fila nazca, y un vacio donde va un numero o una fecha no lo toma la base.
     * Lo demas se escribe igual un poco mas abajo, como siempre.
     */
    const campos: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(own)) {
      if (value !== undefined && value !== null && value !== "") campos[key] = value;
    }

    const alta = await post<{ password?: string }>(`/api/apps/${appId}/members`, {
      email: String(system.cuenta ?? "").trim(),
      roles: Array.isArray(system.roles) ? system.roles : [],
      password: password || undefined,
      campos,
    });
    // La fila la creo el servidor al invitar. Se busca por la cuenta para poder
    // dejarle encima las columnas propias que se escribieron a la vez.
    const fresh = await loadPeopleOverlay(appId);
    const person = [...fresh.values()].find(
      (p) =>
        p.cuenta ===
        String(system.cuenta ?? "")
          .trim()
          .toLowerCase(),
    );
    if (!person) throw new Error("La persona se invito pero su fila no aparece");
    const created = await pb
      .collection(table.dataCollection)
      .getFirstListItem<Row>(`${MEMBER_FIELD} = "${person.member}"`);
    const saved = Object.keys(own).length
      ? await pb.collection(table.dataCollection).update<Row>(created.id, own)
      : created;
    return {
      row: { ...saved, cuenta: person.cuenta, roles: person.roles },
      password: alta.password,
    };
  }

  const person = overlay.get(String(row[MEMBER_FIELD] ?? ""));
  if (person && Object.keys(system).length) {
    const body: Record<string, unknown> = {};
    if ("cuenta" in system) body.email = String(system.cuenta ?? "").trim();
    if ("roles" in system) body.roles = Array.isArray(system.roles) ? system.roles : [];
    await patch(`/api/members/${person.accessId}`, body);
  }

  const saved = Object.keys(own).length
    ? await pb.collection(table.dataCollection).update<Row>(row.id, own)
    : row;

  return {
    row: {
      ...saved,
      cuenta: "cuenta" in system ? String(system.cuenta ?? "") : (person?.cuenta ?? ""),
      roles: "roles" in system ? (system.roles ?? []) : (person?.roles ?? []),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Importar                                                             */
/* ------------------------------------------------------------------ */

/** Una fila del archivo, repartida entre lo del sistema y lo propio. */
export interface PeopleImportRow {
  cuenta: string;
  roles?: string[];
  password?: string;
  propias?: Record<string, unknown>;
}

/** Lo que el servidor dice que pasaria, o que paso. */
export interface PeopleImportReport {
  existen: number;
  seCrearan: number;
  fuera: number;
  sinCorreo: number;
  fueraCorreos: string[];
  /** Los correos que ya tienen cuenta aqui. Son las filas que se actualizan. */
  existenCorreos: string[];
  /** Los roles que nombra el archivo y la aplicacion no tenia. Se crean al importar. */
  rolesNuevos: string[];
  claves: { cuenta: string; clave: string }[];
}

/**
 * El nombre que puede traer la columna de la clave en un archivo de nomina.
 *
 * No es una columna de la tabla y no lo sera nunca: se reconoce aqui, se usa
 * para dar de alta y no se guarda. Ver `web/src/components/database/PasswordForm.svelte`.
 */
const PASSWORD_COLUMNS = ["clave", "contrasena", "contraseña", "password"];

/** Si una columna del archivo es la de la clave. */
export function isPasswordColumn(name: string): boolean {
  return PASSWORD_COLUMNS.includes(name.trim().toLowerCase());
}

/**
 * Reparte los cuerpos ya convertidos en filas de personas.
 *
 * Lo que la importacion normal escribiria en la coleccion se separa aqui: el
 * correo y los roles por un lado y las columnas propias por otro, que es el
 * mismo reparto que hace guardar una fila a mano.
 */
export function buildPeopleRows(
  fields: FieldDef[],
  bodies: Record<string, unknown>[],
): PeopleImportRow[] {
  return bodies.map((body) => {
    const out: PeopleImportRow = { cuenta: "", propias: {} };
    for (const field of fields) {
      if (!(field.name in body)) continue;
      const value = body[field.name];
      if (field.system === "cuenta") out.cuenta = String(value ?? "").trim();
      else if (field.system === "roles") {
        out.roles = Array.isArray(value)
          ? value.map(String)
          : String(value ?? "")
              .split(/\s*,\s*/)
              .filter(Boolean);
      } else if (out.propias) out.propias[field.name] = value;
    }
    // La clave puede venir en el archivo bajo cualquiera de sus nombres. No es
    // una columna, asi que se busca en el cuerpo crudo.
    for (const key of Object.keys(body)) {
      if (isPasswordColumn(key)) out.password = String(body[key] ?? "").trim();
    }
    return out;
  });
}

/** Cuenta lo que pasaria sin escribir nada. Es lo que se dice antes de guardar. */
export async function countPeopleImport(
  appId: string,
  rows: PeopleImportRow[],
  crearCuentas: boolean,
): Promise<PeopleImportReport> {
  return await post<PeopleImportReport>(`/api/apps/${appId}/personas/importar`, {
    rows,
    crearCuentas,
    soloContar: true,
  });
}

/** Importa de verdad. Solo crea cuentas si se pidio en esta misma llamada. */
export async function runPeopleImport(
  appId: string,
  rows: PeopleImportRow[],
  crearCuentas: boolean,
): Promise<PeopleImportReport> {
  return await post<PeopleImportReport>(`/api/apps/${appId}/personas/importar`, {
    rows,
    crearCuentas,
    soloContar: false,
  });
}

/**
 * Quitar una fila de personas es borrarle la cuenta de esta aplicacion.
 *
 * El servidor se lleva con el acceso lo que esta aplicacion sabia de ella y la
 * cuenta con la que entraba aqui. Si esta invitada en otra aplicacion, alli
 * tiene la suya y no se toca.
 */
export async function removePersonRow(
  row: Row,
  overlay: Map<string, PersonOverlay>,
): Promise<void> {
  const person = overlay.get(String(row[MEMBER_FIELD] ?? ""));
  if (!person) return;
  await del(`/api/members/${person.accessId}`);
}
