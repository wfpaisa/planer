/**
 * Quien pregunta, resuelto desde su sesion, y las personas invitadas a una
 * aplicacion.
 *
 * Vive en `server/` y no en `shared/` a proposito: quien mira se decide donde
 * estan los datos y donde esta la sesion, nunca en el navegador.
 *
 * Aqui ya no se reparte nada por filas: quien puede abrir una pagina alcanza
 * todas las filas de las tablas que esa pagina declara. Lo unico que separa
 * leer de escribir es la sesion, y eso se comprueba en `server/pageData.ts`.
 */
import { normalizeRole } from "../shared/people.ts";
import type { AppPerson, AppRecord } from "../shared/types.ts";
import { HttpError, optionalBuilder, optionalMember } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { firstRecord, listRecords, updateRecord } from "./pb.ts";
import { withOwnColumns } from "./peopleTable.ts";

/**
 * Quien pregunta, resuelto desde su sesion.
 *
 * Los roles salen de `app_access`, nunca de la peticion. Es la razon de que
 * exista este tipo: mientras los roles viajen dentro de un objeto que solo se
 * construye aqui, no hay ninguna via por la que el navegador los proponga.
 */
export interface Viewer {
  /**
   * Id de la cuenta. Vacio: no hay una identidad concreta detras.
   *
   * Es aparte de tener sesion: el constructor mirando su pagina como un rol
   * tiene sesion y no es nadie en particular, que es justo lo que se quiere
   * probar. Ver `asViewer`.
   */
  id: string;
  /** Ha iniciado sesion. Es lo que exigen las tres ordenes que escriben. */
  signedIn: boolean;
  /** Es el constructor de la aplicacion. */
  isOwner: boolean;
  /**
   * Esta invitado a esta aplicacion.
   *
   * Es aparte de tener sesion: la cuenta con la que se entra es de una sola
   * aplicacion, asi que una sesion de otra llega aqui sin invitacion ninguna.
   */
  invited: boolean;
  /** Roles que le dio el constructor dentro de esta aplicacion. */
  roles: string[];
}

const ANON: Viewer = { id: "", signedIn: false, isOwner: false, invited: false, roles: [] };

/**
 * Quien pregunta, a partir de la sesion de la peticion.
 *
 * No mira el cuerpo ni las cabeceras de la peticion mas que para leer la sesion:
 * una peticion que diga traer el rol de administrador no cambia nada de esto.
 */
export async function resolveViewer(req: Request, app: AppRecord): Promise<Viewer> {
  // Las dos sesiones son colecciones distintas: el panel entra como constructor
  // y las aplicaciones publicadas, como invitado. Un mismo token no vale para
  // las dos, asi que hay que probar por las dos puertas; sin esto el
  // constructor probando su propia pagina llegaria aqui como si fuera nadie.
  const builder = await optionalBuilder(req);
  if (builder) {
    if (builder.id !== app.owner) throw new HttpError(403, "Esta aplicación no es tuya");
    return { id: builder.id, signedIn: true, isOwner: true, invited: true, roles: [] };
  }

  const member = await optionalMember(req);
  if (!member) return ANON;
  // La cuenta es de una aplicacion y de ninguna otra: una sesion de otra no
  // llega ni a preguntar por el enlace. El enlace lo diria igual --no puede
  // existir para una cuenta ajena-- pero decirlo aqui deja escrito el limite.
  if (member.app && member.app !== app.id) {
    return { id: member.id, signedIn: true, isOwner: false, invited: false, roles: [] };
  }

  const access = await firstRecord<{ roles?: string[] }>(
    INTERNAL.access,
    `app = "${quote(app.id)}" && member = "${quote(member.id)}"`,
  );
  if (!access) return { id: member.id, signedIn: true, isOwner: false, invited: false, roles: [] };

  return {
    id: member.id,
    signedIn: true,
    isOwner: false,
    invited: true,
    roles: Array.isArray(access.roles) ? access.roles : [],
  };
}

/**
 * Quien mira, compuesto para la vista previa del constructor.
 *
 * No amplia nunca: deja de ser el dueno a proposito, y con el se va todo lo que
 * el dueno alcanza por serlo.
 *
 * - Sin rol y sin persona: tiene sesion y ningun rol, que es como entra quien
 *   acaba de ser invitado y todavia no le nombraron uno.
 * - Con rol y sin persona: tiene ese rol y ninguna identidad concreta.
 * - Con rol y persona: es esa persona, con su identificador y sus roles reales.
 *   Es lo que permite probar una pantalla que ensena "lo mio".
 * - Sin sesion: es nadie, y ve lo que veria alguien que llega sin cuenta.
 *
 * Quien puede pedirlo se comprueba donde se recibe. Ver `design.md` D5.
 */
export function asViewer(opts: {
  role?: string;
  person?: AppPerson | null;
  sinSesion?: boolean;
}): Viewer {
  if (opts.sinSesion) return ANON;
  const person = opts.person ?? null;
  if (person) {
    // Los roles son los suyos de verdad, no el que se eligio en el selector:
    // el selector solo ofrece personas que ya tienen ese rol, y quedarse con
    // uno solo escondaria las pantallas que ve por los otros.
    return {
      id: person.id,
      signedIn: true,
      isOwner: false,
      invited: true,
      roles: [...person.roles],
    };
  }
  // Sin persona hay sesion y no hay identidad: el constructor sigue teniendo su
  // sesion de constructor --por eso escribe-- y la pagina no tiene a nadie
  // concreto que ensenar cuando pregunta por "lo mio".
  return {
    id: "",
    signedIn: true,
    isOwner: false,
    invited: true,
    roles: opts.role ? [opts.role] : [],
  };
}

/**
 * Las personas invitadas a esta aplicacion.
 *
 * Sale del enlace y no de la lista de cuentas aunque ahora las cuentas ya sean
 * de una sola aplicacion: el enlace es el que dice los roles, y seguir
 * leyendolo deja una sola respuesta a "quien esta aqui".
 */
export async function peopleOf(appId: string): Promise<AppPerson[]> {
  const res = await listRecords<{
    roles?: string[];
    expand?: { member?: { id: string; name?: string; cuenta?: string } };
  }>(INTERNAL.access, {
    filter: `app = "${quote(appId)}"`,
    expand: "member",
    perPage: 200,
    sort: "-created",
  });

  const base = res.items
    .map((row) => {
      const member = row.expand?.member;
      if (!member) return null;
      return {
        id: member.id,
        name: member.name || (member.cuenta ?? "").split("@")[0],
        email: member.cuenta ?? "",
        roles: Array.isArray(row.roles) ? row.roles : [],
      };
    })
    .filter((p): p is AppPerson => p !== null);

  return await withOwnColumns(appId, base);
}

/** Una persona invitada, por su cuenta. `null` si no esta invitada. */
export async function personOf(appId: string, memberId: string): Promise<AppPerson | null> {
  const people = await peopleOf(appId);
  return people.find((p) => p.id === memberId) ?? null;
}

/**
 * Cambia los roles de una persona invitada.
 *
 * Es la escritura que hace pareja con `peopleOf`: las dos leen y escriben el
 * enlace, que es donde de verdad viven los roles. Vive aqui y no en la ruta que
 * la llama porque hay mas de una --la pantalla de personas y la IA-- y los
 * roles tienen que tener un solo sitio donde escribirse.
 *
 * Los roles que la aplicacion ya no define se descartan: nombrar uno que no
 * existe no da acceso a nada y deja basura en el enlace.
 */
export async function setPersonAccess(opts: {
  appId: string;
  memberId: string;
  roles?: string[];
  /** Los roles que define la aplicacion. Lo que no este aqui no se guarda. */
  appRoles?: string[];
}): Promise<AppPerson> {
  const link = await firstRecord<{ id: string }>(
    INTERNAL.access,
    `app = "${quote(opts.appId)}" && member = "${quote(opts.memberId)}"`,
  );
  if (!link) throw new HttpError(404, "Esa persona no está invitada a esta aplicación");

  if (opts.roles) {
    const allowed = opts.appRoles;
    const roles = [
      ...new Set(
        opts.roles
          .map((role) => normalizeRole(role))
          .filter((role) => role && (!allowed || allowed.includes(role))),
      ),
    ];
    await updateRecord(INTERNAL.access, link.id, { roles });
  }

  const person = await personOf(opts.appId, opts.memberId);
  if (!person) throw new HttpError(404, "Esa persona no está invitada a esta aplicación");
  return person;
}

/**
 * El error de una fila que no se encuentra.
 *
 * Dice que no existe y no que es de otro: la diferencia entre las dos respuestas
 * es, para quien va probando identificadores, la confirmacion de que esa fila
 * existe.
 */
export function notFound(): HttpError {
  return new HttpError(404, "Ese registro no existe");
}
