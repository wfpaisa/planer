/**
 * Quien pregunta, resuelto desde su sesión, y las personas invitadas a una
 * aplicación.
 *
 * Vive en `server/` y no en `shared/` a propósito: quien mira se decide donde
 * estan los datos y donde esta la sesión, nunca en el navegador.
 *
 * Aquí ya no se reparte nada por filas: quien puede abrir una página alcanza
 * todas las filas de las tablas que esa página declara. Lo único que separa
 * leer de escribir es la sesión, y eso se comprueba en `server/page/pageData.ts`.
 */
import { normalizeRole } from "../shared/people.ts";
import type { AppPerson, AppRecord } from "../shared/types.ts";
import { HttpError, type Identity, isPrincipal, optionalBuilder, optionalMember } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { firstRecord, listRecords, updateRecord } from "./pb.ts";
import { withOwnColumns } from "./peopleTable.ts";

/**
 * Quien pregunta, resuelto desde su sesión.
 *
 * Los roles salen de `app_access`, nunca de la petición. Es la razon de que
 * exista este tipo: mientras los roles viajen dentro de un objeto que solo se
 * construye aquí, no hay ninguna via por la que el navegador los proponga.
 */
export interface Viewer {
  /**
   * Id de la cuenta. Vacío: no hay una identidad concreta detras.
   *
   * Es aparte de tener sesión: el constructor mirando su página como un rol
   * tiene sesión y no es nadie en particular, que es justo lo que se quiere
   * probar. Ver `asViewer`.
   */
  id: string;
  /** Ha iniciado sesión. Es lo que exigen las tres ordenes que escriben. */
  signedIn: boolean;
  /** Es el constructor de la aplicación. */
  isOwner: boolean;
  /**
   * Esta invitado a esta aplicación.
   *
   * Es aparte de tener sesión: la cuenta con la que se entra es de una sola
   * aplicación, así que una sesión de otra llega aquí sin invitacion ninguna.
   */
  invited: boolean;
  /** Roles que le dio el constructor dentro de esta aplicación. */
  roles: string[];
}

/**
 * Este usuario del panel construye la aplicación: es su dueño, se la asignaron
 * o es la cuenta principal, que las ve todas. Es la misma pregunta que hacen
 * las reglas de PocketBase (`server/bootstrap.ts`), aquí para lo que pasa por
 * la API.
 */
export function buildsApp(app: Pick<AppRecord, "owner" | "editors">, builder: Identity): boolean {
  return (
    app.owner === builder.id || (app.editors ?? []).includes(builder.id) || isPrincipal(builder)
  );
}

const ANON: Viewer = { id: "", signedIn: false, isOwner: false, invited: false, roles: [] };

/**
 * Quien pregunta, a partir de la sesión de la petición.
 *
 * No mira el cuerpo ni las cabeceras de la petición mas que para leer la sesión:
 * una petición que diga traer el rol de administrador no cambia nada de esto.
 */
export async function resolveViewer(req: Request, app: AppRecord): Promise<Viewer> {
  // Las dos sesiones son colecciones distintas: el panel entra como constructor
  // y las aplicaciones publicadas, como invitado. Un mismo token no vale para
  // las dos, así que hay que probar por las dos puertas; sin esto el
  // constructor probando su propia página llegaria aquí como si fuera nadie.
  const builder = await optionalBuilder(req);
  if (builder) {
    if (!buildsApp(app, builder))
      throw new HttpError(403, "No tienes permiso para esta aplicación");
    return { id: builder.id, signedIn: true, isOwner: true, invited: true, roles: [] };
  }

  const member = await optionalMember(req);
  if (!member) return ANON;
  // La cuenta es de una aplicación y de ninguna otra: una sesión de otra no
  // llega ni a preguntar por el enlace. El enlace lo diria igual --no puede
  // existir para una cuenta ajena-- pero decirlo aquí deja escrito el limite.
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
 * No amplia nunca: deja de ser el dueno a propósito, y con el se va todo lo que
 * el dueno alcanza por serlo.
 *
 * - Sin rol y sin persona: tiene sesión y ningún rol, que es como entra quien
 *   acaba de ser invitado y todavía no le nombraron uno.
 * - Con rol y sin persona: tiene ese rol y ninguna identidad concreta.
 * - Con rol y persona: es esa persona, con su identificador y sus roles reales.
 *   Es lo que permite probar una pantalla que enseña "lo mio".
 * - Sin sesión: es nadie, y ve lo que veria alguien que llega sin cuenta.
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
  // Sin persona hay sesión y no hay identidad: el constructor sigue teniendo su
  // sesión de constructor --por eso escribe-- y la página no tiene a nadie
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
 * Las personas invitadas a esta aplicación.
 *
 * Sale del enlace y no de la lista de cuentas aunque ahora las cuentas ya sean
 * de una sola aplicación: el enlace es el que dice los roles, y seguir
 * leyendolo deja una sola respuesta a "quien esta aquí".
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
 * enlace, que es donde de verdad viven los roles. Vive aquí y no en la ruta que
 * la llama porque hay mas de una --la pantalla de personas y la IA-- y los
 * roles tienen que tener un solo sitio donde escribirse.
 *
 * Los roles que la aplicación ya no define se descartan: nombrar uno que no
 * existe no da acceso a nada y deja basura en el enlace.
 */
export async function setPersonAccess(opts: {
  appId: string;
  memberId: string;
  roles?: string[];
  /** Los roles que define la aplicación. Lo que no este aquí no se guarda. */
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
