/**
 * La tabla de personas vista desde la cuadricula.
 *
 * Dos de sus columnas no estan en la coleccion que la cuadricula lee: el correo
 * vive en la cuenta --que es de esta aplicacion-- y los roles en el enlace con
 * ella. Aqui se juntan al pintar y se reparten al guardar, que es lo que deja
 * que la cuadricula, el panel lateral y el exportar sigan siendo los de
 * cualquier tabla. Ver `shared/people.ts` para el porque del reparto.
 */
import { MEMBER_FIELD, normalizeRoles, PEOPLE_NAME_FIELD } from "@shared/people";
import type { FieldDef, SystemFieldKind, TableRecord } from "@shared/types";

import type { Row } from "./cellValues";
import { api, del, errorMessage, patch, pb, post } from "./pb";

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
}): Promise<Row> {
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

    await post(`/api/apps/${appId}/members`, {
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
    return { ...saved, cuenta: person.cuenta, roles: person.roles };
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
    ...saved,
    cuenta: "cuenta" in system ? String(system.cuenta ?? "") : (person?.cuenta ?? ""),
    roles: "roles" in system ? (system.roles ?? []) : (person?.roles ?? []),
  };
}

/* ------------------------------------------------------------------ */
/* Escribir por la cuenta en bloque                                     */
/* ------------------------------------------------------------------ */

/** Lo que una escritura en bloque le cambia a una persona. */
export interface PersonPatch {
  /** La fila de la grilla: por ella se llega a su cuenta y a su enlace. */
  row: Row;
  /** El correo nuevo, tal como venia en la celda. */
  cuenta?: string;
  /** Los roles nuevos, tal como venian en la celda. */
  roles?: string[];
}

/** Como le fue a lo que se escribio por la cuenta. */
export interface PeopleBulkReport {
  /** Celdas que llegaron a la cuenta o al enlace. */
  cells: number;
  /** Personas cuyo cambio no entro. */
  failed: number;
  /** Lo que quedo fuera, y por que. */
  notes: string[];
}

/**
 * Cuantas personas se mandan a la vez.
 *
 * Cada una es una peticion aparte --su correo esta en la cuenta y sus roles en
 * el enlace con la aplicacion, y esa puerta no tiene lote-- asi que pegar una
 * columna sobre doscientas personas son doscientas peticiones. De a una serian
 * doscientas esperas seguidas; todas de golpe ahogarian al servidor. De cuatro
 * en cuatro va rapido y no se le va de las manos.
 */
const AT_ONCE = 4;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** "a", "b" y "c". */
const lista = (items: string[]): string =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;

/**
 * Escribe el correo y los roles de varias personas a la vez.
 *
 * Es lo que hace que pegar y vaciar alcancen a esas dos columnas. Lo que no
 * cabe en un lote se resuelve aqui: una peticion por persona, en tandas, y un
 * parte de lo que no entro.
 *
 * Lo que se puede saber sin preguntar se comprueba antes de escribir nada, que
 * es lo que separa un pegado de doscientas respuestas de error: un correo que
 * ya es de otra persona de esta aplicacion, el mismo correo dos veces en lo
 * pegado, un rol que la aplicacion no tiene. Lo que solo sabe la base --una
 * forma de correo que no acepta-- lo dice ella, y se cuenta como fila que no
 * entro.
 */
export async function savePeopleColumns(opts: {
  appId: string;
  table: TableRecord;
  overlay: Map<string, PersonOverlay>;
  /** Las filas que se estan viendo. Solo para nombrar a quien ya tiene un correo. */
  rows: Row[];
  patches: PersonPatch[];
}): Promise<PeopleBulkReport> {
  const { appId, table, overlay, rows, patches } = opts;
  const notes: string[] = [];
  const account = table.fields.find((f) => f.system === "cuenta");
  const rolesField = table.fields.find((f) => f.system === "roles");
  // Las opciones de la columna de roles son los roles de la aplicacion: los
  // pone `withRoleOptions` al leer las tablas.
  const known = rolesField?.options ?? [];

  /** Quien tiene ya cada correo en esta aplicacion. */
  const holder = new Map<string, PersonOverlay>();
  for (const person of overlay.values()) {
    if (person.cuenta) holder.set(person.cuenta, person);
  }

  /** Como nombrar a alguien en un aviso: lo que dice su fila, o su correo. */
  const nameOf = (person: PersonOverlay): string => {
    const row = rows.find((r) => String(r[MEMBER_FIELD] ?? "") === person.member);
    return String(row?.[PEOPLE_NAME_FIELD] ?? "").trim() || person.cuenta;
  };

  const jobs: { row: Row; values: Record<string, unknown>; kinds: SystemFieldKind[] }[] = [];
  /** Los correos que esta misma escritura reparte: el mismo no se da dos veces. */
  const taken = new Set<string>();
  const clashes: string[] = [];
  const twice = new Set<string>();
  const unknown = new Set<string>();
  let badMail = 0;
  let badRoles = 0;
  let stray = 0;

  for (const patch of patches) {
    const person = overlay.get(String(patch.row[MEMBER_FIELD] ?? ""));
    if (!person) {
      stray++;
      continue;
    }
    const values: Record<string, unknown> = {};
    const kinds: SystemFieldKind[] = [];

    if (account && patch.cuenta !== undefined) {
      const mail = patch.cuenta.trim().toLowerCase();
      const other = holder.get(mail);
      if (mail === person.cuenta) {
        // El que ya tenia: no hay nada que escribir, y no es un choque consigo
        // misma. Copiar la columna y pegarla encima no cambia nada.
      } else if (!mail.includes("@")) {
        // La misma exigencia que pone el servidor al recibirlo. Lo que pase de
        // aqui y la base no acepte lo dice ella, y se cuenta como no entro.
        badMail++;
      } else if (other) {
        clashes.push(`"${mail}" ya es el correo de ${nameOf(other)}`);
      } else if (taken.has(mail)) {
        twice.add(mail);
      } else {
        taken.add(mail);
        values[account.name] = mail;
        kinds.push("cuenta");
      }
    }

    if (rolesField && patch.roles !== undefined) {
      const wanted = normalizeRoles(patch.roles);
      const fuera = wanted.filter((role) => !known.includes(role));
      if (fuera.length) {
        /*
         * Un rol que la aplicacion no tiene deja la celda como estaba, entera.
         * El servidor descarta en silencio lo que no esta declarado, asi que
         * escribir solo el resto guardaria media celda sin decirlo. Crearlo
         * tampoco: los roles se nombran a mano --o importando la nomina, que
         * pregunta antes-- y un nombre de mas en una hoja de calculo no es
         * forma de decidir quien entra a que pantalla.
         */
        for (const role of fuera) unknown.add(role);
        badRoles++;
      } else if (wanted.join(" ") !== person.roles.join(" ")) {
        values[rolesField.name] = wanted;
        kinds.push("roles");
      }
    }

    if (kinds.length === 0) continue;
    jobs.push({ row: patch.row, values, kinds });
  }

  /** Lo que dijo el servidor, agrupado: cuarenta filas con el mismo motivo son un aviso. */
  const failures = new Map<string, number>();
  let cells = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i += AT_ONCE) {
    const tanda = jobs.slice(i, i + AT_ONCE);
    const done = await Promise.allSettled(
      tanda.map((job) =>
        savePersonRow({ appId, table, overlay, row: job.row, values: job.values }),
      ),
    );
    done.forEach((result, n) => {
      const job = tanda[n];
      if (result.status === "fulfilled") {
        cells += job.kinds.length;
        return;
      }
      failed++;
      const said = errorMessage(result.reason);
      failures.set(said, (failures.get(said) ?? 0) + 1);
    });
  }

  const label = (kind: SystemFieldKind) =>
    table.fields.find((f) => f.system === kind)?.label ?? kind;

  if (clashes.length) {
    // Unos cuantos con nombre y el resto contados: el aviso tiene que caber en
    // la pantalla, y con tres ya se ve de que va.
    const shown = clashes.slice(0, 3).join("; ");
    const rest =
      clashes.length > 3 ? `, y ${plural(clashes.length - 3, "correo más", "correos más")}` : "";
    const una = clashes.length === 1;
    notes.push(
      `${shown}${rest}. ${una ? "Esa fila se dejó" : "Esas filas se dejaron"} como ${una ? "estaba" : "estaban"}: dos personas de una aplicación no comparten correo.`,
    );
  }
  if (twice.size) {
    const una = twice.size === 1;
    notes.push(
      `${lista([...twice].slice(0, 3).map((mail) => `"${mail}"`))} ${una ? "viene" : "vienen"} más de una vez en lo pegado: se escribió en la primera fila y en las demás se dejó el correo como estaba.`,
    );
  }
  if (badMail) {
    const una = badMail === 1;
    notes.push(
      `${plural(badMail, "celda", "celdas")} de ${label("cuenta")} no ${una ? "traía un correo y se dejó" : "traían un correo y se dejaron"} como ${una ? "estaba" : "estaban"}.`,
    );
  }
  if (badRoles) {
    const names = lista([...unknown].slice(0, 4).map((role) => `"${role}"`));
    const uno = unknown.size === 1;
    const una = badRoles === 1;
    notes.push(
      `${uno ? `El rol ${names} no existe` : `Los roles ${names} no existen`} en esta aplicación: ${plural(badRoles, "celda", "celdas")} de ${label("roles")} se ${una ? "dejó" : "dejaron"} como ${una ? "estaba" : "estaban"}. Los roles se crean desde su propia columna, en "Gestionar roles".`,
    );
  }
  if (stray) {
    notes.push(
      `${plural(stray, "fila no tiene", "filas no tienen")} cuenta invitada, así que su ${label("cuenta")} y sus ${label("roles")} se quedaron como estaban.`,
    );
  }
  for (const [said, n] of failures) {
    const dicho = said.endsWith(".") ? said : `${said}.`;
    notes.push(n === 1 ? dicho : `${dicho} (${plural(n, "fila", "filas")})`);
  }

  return { cells, failed, notes };
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
