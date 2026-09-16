/**
 * Importar la tabla de personas.
 *
 * Tiene ruta propia y no pasa por la escritura en lote del navegador, y no es
 * un capricho: una fila de personas no se puede crear escribiendo en la
 * coleccion de la aplicacion. Necesita una cuenta detras --que el navegador no
 * puede consultar-- y un enlace con esta. Solo el servidor ve las tres cosas a
 * la vez.
 *
 * De aqui sale tambien lo que hay que decir antes de guardar: cuantas personas
 * ya estan y cuantas cuentas se crearian. Dar de alta a doscientos empleados
 * desde el Excel de nomina es medio producto para una empresa, y tambien es lo
 * que convierte un dedazo en doscientas personas fantasma. Por eso se cuenta
 * primero y por eso crear cuentas hay que pedirlo a mano en cada importacion.
 */
import { loginFor, MAX_ROLES, MEMBER_FIELD, newPassword, normalizeRole } from "../shared/people.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { createRecord, firstRecord, updateRecord } from "./pb.ts";
import { peopleTableFor } from "./peopleTable.ts";

/** Una fila del archivo, ya repartida entre lo del sistema y lo propio. */
export interface PeopleImportRow {
  /** El correo. Es lo que identifica a la persona. */
  cuenta: string;
  roles?: string[];
  /** Clave para el alta masiva. No se guarda en ningun sitio de donde se relea. */
  password?: string;
  /** Las columnas propias de la aplicacion, por nombre tecnico. */
  propias?: Record<string, unknown>;
}

/** Lo que se dice antes de guardar y lo que se informa despues. */
export interface PeopleImportReport {
  /** Filas cuya persona ya tiene cuenta. */
  existen: number;
  /** Cuentas que se crearian, o que se crearon. */
  seCrearan: number;
  /** Filas dejadas fuera por no tener cuenta sin haberlo pedido. */
  fuera: number;
  /** Filas sin un correo utilizable. */
  sinCorreo: number;
  /** Los correos dejados fuera, para poder decir cuales. */
  fueraCorreos: string[];
  /**
   * Los correos que ya tienen cuenta aqui, para poder senalar sus filas.
   *
   * Van todos y no unos cuantos como `fueraCorreos`: con esto la
   * previsualizacion tine las filas que se van a actualizar, y una lista
   * recortada dejaria sin color justo las que no cupieron. Quien decide cual es
   * cual es este bucle --el mismo que cuenta-- y no el navegador por su cuenta:
   * la lista de invitados que el panel tiene cargada puede no ser la misma, y
   * entonces el color decia una cosa y el recuento de encima, otra.
   */
  existenCorreos: string[];
  /**
   * Los roles que nombra el archivo y la aplicacion todavia no tenia.
   *
   * Se crean al importar. Antes se caian en silencio --el rol que ya existia
   * entraba y el que no, no-- y la columna de roles quedaba a medias sin que
   * nada lo dijera. Se cuentan aqui para poder decirlo antes de guardar.
   */
  rolesNuevos: string[];
  /**
   * Las claves de las cuentas que se acaban de crear, una sola vez.
   *
   * Viajan en la respuesta y no se guardan: es el mismo trato que al invitar a
   * una persona suelta. Quien importa las copia ahora o le pone otra despues.
   */
  claves: { cuenta: string; clave: string }[];
}

/**
 * Importa filas de personas, o solo cuenta lo que pasaria.
 *
 * Con `soloContar` no se escribe absolutamente nada: es lo que responde a
 * "cuantas cuentas se van a crear" antes de que exista la primera.
 */
export async function importPeople(opts: {
  appId: string;
  roles: string[];
  rows: PeopleImportRow[];
  /** Crear las cuentas que falten. Falso: esas filas se quedan fuera. */
  crearCuentas: boolean;
  soloContar: boolean;
}): Promise<PeopleImportReport> {
  const table = await peopleTableFor(opts.appId);
  const report: PeopleImportReport = {
    existen: 0,
    seCrearan: 0,
    fuera: 0,
    sinCorreo: 0,
    fueraCorreos: [],
    existenCorreos: [],
    rolesNuevos: [],
    claves: [],
  };
  if (!table) return report;

  /*
   * Los roles que nombra el archivo y la aplicacion no tiene se crean antes de
   * escribir nada: `writeRow` guarda solo los declarados, asi que si se
   * crearan despues la primera importacion perderia justo los que la traian.
   *
   * Solo cuentan las filas con un correo utilizable: son las unicas que pueden
   * llegar a escribirse. Y solo caben hasta el tope de la aplicacion; lo que
   * pase de ahi se queda fuera, igual que al nombrarlos a mano.
   */
  const named = new Set<string>();
  for (const row of opts.rows) {
    if (!String(row.cuenta ?? "").includes("@")) continue;
    for (const raw of row.roles ?? []) {
      // Normalizado ya aqui: es el nombre con el que se va a guardar, y
      // compararlo sin normalizar crearia un rol nuevo por cada forma de
      // escribir el mismo. Ver `normalizeRole`.
      const name = normalizeRole(raw);
      if (name && !opts.roles.includes(name)) named.add(name);
    }
  }
  report.rolesNuevos = [...named].slice(0, Math.max(MAX_ROLES - opts.roles.length, 0));

  const roles = [...opts.roles, ...report.rolesNuevos];
  if (!opts.soloContar && report.rolesNuevos.length) {
    await updateRecord(INTERNAL.apps, opts.appId, { roles });
  }

  for (const row of opts.rows) {
    const email = String(row.cuenta ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@")) {
      report.sinCorreo++;
      continue;
    }

    // Dentro de esta aplicacion. Que el correo tenga cuenta en otra no cuenta
    // como que ya esta: alli es otra cuenta, con otra clave.
    const account = await firstRecord<{ id: string }>(
      INTERNAL.members,
      `app = "${quote(opts.appId)}" && cuenta = "${quote(email)}"`,
    );

    if (!account) {
      if (!opts.crearCuentas) {
        report.fuera++;
        // Se guardan unos cuantos y no todos: el aviso tiene que caber en la
        // pantalla, y con veinte ya se entiende cuales son.
        if (report.fueraCorreos.length < 20) report.fueraCorreos.push(email);
        continue;
      }
      report.seCrearan++;
      if (opts.soloContar) continue;

      const password = String(row.password ?? "").trim() || newPassword();
      const created = await createRecord<{ id: string }>(INTERNAL.members, {
        app: opts.appId,
        cuenta: email,
        login: loginFor(opts.appId, email),
        password,
        passwordConfirm: password,
        name: email.split("@")[0],
        verified: true,
      });
      // Solo se devuelve la que invento el sistema: si el archivo traia clave,
      // quien importa ya la tiene y repetirla aqui la esparce sin motivo.
      if (!String(row.password ?? "").trim()) {
        report.claves.push({ cuenta: email, clave: password });
      }
      await writeRow({ ...opts, roles, table: table.dataCollection, memberId: created.id, row });
      continue;
    }

    report.existen++;
    report.existenCorreos.push(email);
    if (opts.soloContar) continue;
    await writeRow({ ...opts, roles, table: table.dataCollection, memberId: account.id, row });
  }

  return report;
}

/**
 * Deja escrito lo de una persona, cada cosa donde vive.
 *
 * Los roles en el enlace con la aplicacion; las columnas propias en la
 * coleccion de la aplicacion. Reconocer a quien ya esta y actualizarlo, en
 * vez de duplicarlo, es solo consecuencia de buscar por correo antes de nada.
 */
async function writeRow(opts: {
  appId: string;
  roles: string[];
  table: string;
  memberId: string;
  row: PeopleImportRow;
}): Promise<void> {
  // Se normaliza igual que al reunirlos arriba: si no, "Conductor" del archivo
  // no encontraria al `conductor` que se acaba de crear con ese mismo nombre.
  const roles = Array.isArray(opts.row.roles)
    ? opts.row.roles.map((r) => normalizeRole(r)).filter((r) => opts.roles.includes(r))
    : undefined;

  const existing = await firstRecord<{ id: string }>(
    INTERNAL.access,
    `app = "${quote(opts.appId)}" && member = "${quote(opts.memberId)}"`,
  );

  if (existing) {
    if (roles !== undefined) await updateRecord(INTERNAL.access, existing.id, { roles });
  } else {
    await createRecord(INTERNAL.access, {
      app: opts.appId,
      member: opts.memberId,
      roles: roles ?? [],
    });
  }

  const own = opts.row.propias ?? {};
  const current = await firstRecord<{ id: string }>(
    opts.table,
    `${MEMBER_FIELD} = "${quote(opts.memberId)}"`,
  ).catch(() => null);

  if (current) {
    if (Object.keys(own).length) await updateRecord(opts.table, current.id, own);
  } else {
    await createRecord(opts.table, { [MEMBER_FIELD]: opts.memberId, ...own });
  }
}
