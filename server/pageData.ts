/**
 * Las seis ordenes de datos de una pagina publicada, resueltas en el servidor.
 *
 * El navegador no habla con la base: pasa por aqui. Lo que este archivo decide
 * es quien pregunta --desde su sesion, nunca desde la peticion-- y si puede
 * abrir la pagina desde la que pregunta.
 *
 * Ya no reparte filas. Quien puede abrir una pagina alcanza todas las filas de
 * las tablas que esa pagina declara, y el total que acompana a una lista las
 * cuenta todas. Lo que se le muestra de ellas lo decide el HTML de la pagina.
 *
 * Lo que si esta acotado es cuantas filas viajan de una vez: `listar` tiene
 * techo (`MAX_LIST_ROWS`), lo dice en su respuesta, y para contar sin traerse nada
 * esta `contar`. Sin esa pareja, una pagina que contaba lo que recibio contaba
 * el techo en vez de la tabla, y el numero corto parecia el bueno.
 *
 * El orden de las comprobaciones no es casual. Primero la aplicacion --si exige
 * cuenta, sin ella no hay nada mas que hablar--, luego la pagina, luego la
 * sesion al escribir, y por ultimo la fuente declarada: el documento solo pide
 * lo que su manifiesto nombra.
 */
import {
  buildFilter,
  buildSort,
  DEFAULT_LIST_ROWS,
  expandOf,
  MAX_LIST_ROWS,
  type Resolved,
  resolveSource,
  SourceError,
  toLogicalRow,
  toRealValues,
} from "../shared/htmlSources.ts";
import { canOpenPage } from "../shared/pages.ts";
import { isPeopleTable } from "../shared/people.ts";
import {
  type Lookup,
  matchValues,
  relationCellValues,
  relationTarget,
} from "../shared/relations.ts";
import type { AccessOp, AppRecord } from "../shared/types.ts";
import {
  NEEDS_SESSION,
  orphanFieldName,
  type PageRecord,
  type TableRecord,
} from "../shared/types.ts";
import { asViewer, notFound, peopleOf, personOf, resolveViewer, type Viewer } from "./access.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { createRecord, deleteRecord, firstRecord, listRecords, updateRecord } from "./pb.ts";
import { parkReferences } from "./rowDelete.ts";

const OPS: AccessOp[] = ["listar", "contar", "obtener", "crear", "actualizar", "borrar"];

/** Las tres ordenes que dejan rastro, y que por eso exigen cuenta iniciada. */
const WRITE_OPS: AccessOp[] = ["crear", "actualizar", "borrar"];

function isOp(value: unknown): value is AccessOp {
  return typeof value === "string" && OPS.includes(value as AccessOp);
}

/** Lo que hace falta de la base para emparejar por llave. */
function lookupOf(appId: string, tables: TableRecord[]): Lookup {
  return {
    find: async (collection, filter) => {
      // Una coleccion que no es de esta aplicacion no se consulta: el que
      // empareja llega desde el documento y solo nombra lo que su manifiesto
      // resolvio, pero comprobarlo aqui deja escrito el limite.
      if (!tables.some((t) => t.dataCollection === collection)) return [];
      const res = await listRecords<Record<string, unknown>>(collection, {
        filter,
        perPage: 200,
        skipTotal: 1,
      });
      return res.items;
    },
    people: () => peopleOf(appId),
  };
}

/**
 * Las columnas de relacion de unos valores que llegan del documento, ya
 * resueltas: el id de quien encontro dueno y el corralito de quien no.
 *
 * El documento escribe la llave --una cedula, un correo-- y nunca el id.
 */
async function resolveRelations(
  resolved: Resolved,
  values: Record<string, unknown>,
  lookup: Lookup,
  tables: TableRecord[],
): Promise<Record<string, unknown>> {
  const out = { ...values };
  for (const rel of resolved.relations.values()) {
    const orphan = orphanFieldName(rel.field.name);
    if (!(orphan in out)) continue;
    const raw = String(out[orphan] ?? "").trim();
    const target = relationTarget(rel.field, tables);
    if (!target) continue;

    const matches = raw ? await matchValues(target, [raw], lookup) : new Map();
    const match = matches.get(raw) ?? { id: "", value: raw };

    delete out[orphan];
    Object.assign(out, relationCellValues(rel.field, match));
  }
  return out;
}

/** La fila tal como esta guardada. */
async function readRow(
  resolved: Resolved,
  id: string,
  expand: string,
): Promise<Record<string, unknown>> {
  if (!id) throw notFound();
  const row = await firstRecord<Record<string, unknown>>(
    resolved.table.dataCollection,
    `id = "${quote(id)}"`,
    { expand },
  );
  if (!row) throw notFound();
  return row;
}

/**
 * El error de guardar sin cuenta iniciada.
 *
 * Lleva codigo propio para que el puente lo distinga del resto y ponga el aviso
 * de iniciar sesion sin que el HTML de la pagina participe. Sigue siendo un
 * error que la pagina puede capturar si quiere hacer algo mejor. Ver
 * `design.md` D4.
 */
function needsSession(): HttpError {
  return new HttpError(401, "Inicia sesión para guardar.", NEEDS_SESSION);
}

/**
 * Resuelve una orden de datos de una pagina.
 *
 * `appId` y `pageId` vienen de la ruta; el rol de la vista previa, la persona y
 * las marcas de mirar sin rol y sin sesion, del cuerpo.
 */
export async function runPageData(req: Request, appId: string, pageId: string): Promise<Response> {
  const app = await firstRecord<AppRecord>(INTERNAL.apps, `id = "${quote(appId)}"`);
  if (!app) throw new HttpError(404, "Esta aplicación no existe");

  const page = await firstRecord<PageRecord>(
    INTERNAL.pages,
    `id = "${quote(pageId)}" && app = "${quote(app.id)}"`,
  );
  if (!page) throw new HttpError(404, "Esta página no existe");

  const input = (await req.json().catch(() => ({}))) as {
    op?: unknown;
    args?: unknown;
    rol?: unknown;
    persona?: unknown;
    sinSesion?: unknown;
    sinRol?: unknown;
    fuentes?: unknown;
  };
  if (!isOp(input.op)) throw new HttpError(400, `La orden "${String(input.op)}" no existe.`);
  const args = Array.isArray(input.args) ? input.args : [];

  let viewer = await resolveViewer(req, app);
  // Se guarda antes de mirar como otro: componer a quien mira deja de ser el
  // dueno a proposito, y el borrador que se esta probando sigue siendo suyo.
  const isBuilder = viewer.isOwner;

  viewer = await previewViewer(viewer, app, input);

  /*
   * En una aplicacion que requiere iniciar sesion hay que estar invitado, no
   * solo tener sesion. La sesion de un invitado vale para todas las
   * aplicaciones donde le invitaron, y sin esta comprobacion la de cualquiera
   * abriria los datos de todas las demas.
   */
  if (app.visibility === "private") {
    if (!viewer.signedIn) throw new HttpError(401, "Entra para ver esta página");
    if (!viewer.invited) throw new HttpError(403, "Tu cuenta no tiene acceso a esta aplicación");
  }
  if (!canOpenPage(page, viewer.signedIn ? { roles: viewer.roles } : null)) {
    throw new HttpError(403, "No puedes abrir esta página");
  }

  // Guardar exige una cuenta iniciada, sea cual sea el nivel de acceso de la
  // pagina. Leer no la exige: una pagina abierta a `Todos` entrega sus datos a
  // quien llegue sin cuenta.
  //
  // Y la cuenta tiene que ser de esta aplicacion. Una cuenta es de una sola
  // (ver `resolveViewer`), asi que sin esto la sesion de cualquier invitado de
  // cualquier otra aplicacion de la instalacion escribiria en las tablas de
  // toda aplicacion abierta. Quien entra por la puerta de esta la tiene: para
  // el no cambia nada.
  if (WRITE_OPS.includes(input.op)) {
    if (!viewer.signedIn) throw needsSession();
    if (!viewer.invited) throw new HttpError(403, "Tu cuenta no tiene acceso a esta aplicación");
  }

  const tables = await appTables(app.id);

  /*
   * El manifiesto contra el que se comprueba la fuente es el de la pagina
   * guardada. La unica excepcion es el dueno de la aplicacion probando un
   * documento que todavia no ha guardado: ahi el manifiesto de verdad es el que
   * trae delante, y aceptarselo no le da nada que guardar la pagina no le diera
   * un segundo despues. A cualquier otro se le ignora lo que mande.
   */
  const draft =
    isBuilder && Array.isArray(input.fuentes) ? (input.fuentes as PageRecord["sources"]) : null;
  const resolved = resolveSource(draft ?? page.sources ?? [], tables, args[0]);

  const expand = expandOf(resolved);
  const collection = resolved.table.dataCollection;
  // Una relacion a la tabla de personas trae la fila por el expand, pero no el
  // correo ni los roles: esos estan en la lista de invitados y se superponen.
  // Ver `relationCell` en `shared/htmlSources.ts`.
  const people = [...resolved.relations.values()].some((rel) => isPeopleTable(rel.target))
    ? await peopleOf(app.id)
    : [];

  switch (input.op) {
    case "listar": {
      const opts = (args[1] ?? {}) as Record<string, unknown>;
      const limite = Math.min(Math.max(Number(opts.limite) || DEFAULT_LIST_ROWS, 1), MAX_LIST_ROWS);
      const pagina = Math.max(Number(opts.pagina) || 1, 1);
      const res = await listRecords<Record<string, unknown>>(collection, {
        filter: buildFilter(resolved, opts),
        sort: buildSort(resolved, opts.orden),
        expand,
        page: pagina,
        perPage: limite,
      });
      return json({
        filas: res.items.map((item) => toLogicalRow(resolved, item, people)),
        total: res.totalItems,
        pagina: res.page,
        paginas: res.totalPages,
        /*
         * Cuantas filas se sirvieron de verdad por pagina.
         *
         * Va en la respuesta porque el techo se aplicaba en silencio: quien
         * pedia 500 recibia 200 y nada le decia que le habian recortado, asi
         * que contar lo recibido daba un numero corto que parecia el bueno.
         * Con esto, una pagina puede ver que pidio mas de lo que cabe.
         */
        limite,
        recortado: limite < (Number(opts.limite) || 0),
      });
    }

    /*
     * Cuantas filas cumplen algo, sin traerse ninguna.
     *
     * Es la unica forma honesta de contar: `listar` tiene techo, y contar lo
     * que `listar` devuelve cuenta el techo, no la tabla. Acepta el mismo
     * filtro y la misma busqueda para que la cifra sea de lo mismo que la
     * lista de al lado.
     */
    case "contar": {
      const opts = (args[1] ?? {}) as Record<string, unknown>;
      const res = await listRecords<Record<string, unknown>>(collection, {
        filter: buildFilter(resolved, opts),
        // Ni una fila: lo unico que se quiere es el recuento que trae la
        // respuesta, y las filas costarian el viaje entero para tirarlas.
        perPage: 1,
        fields: "id",
      });
      return json({ total: res.totalItems });
    }

    case "obtener": {
      const row = await readRow(resolved, String(args[1] ?? ""), expand);
      return json(toLogicalRow(resolved, row, people));
    }

    case "crear": {
      const lookup = lookupOf(app.id, tables);
      const values = await resolveRelations(
        resolved,
        toRealValues(resolved, args[1]),
        lookup,
        tables,
      );
      const created = await createRecord<Record<string, unknown>>(collection, values);
      const row = await firstRecord<Record<string, unknown>>(
        collection,
        `id = "${quote(String(created.id ?? ""))}"`,
        { expand },
      );
      return json(toLogicalRow(resolved, row ?? created, people));
    }

    case "actualizar": {
      const id = String(args[1] ?? "");
      const before = await readRow(resolved, id, expand);

      const lookup = lookupOf(app.id, tables);
      const values = await resolveRelations(
        resolved,
        toRealValues(resolved, args[2]),
        lookup,
        tables,
      );

      await updateRecord(collection, id, values);
      const row = await firstRecord<Record<string, unknown>>(collection, `id = "${quote(id)}"`, {
        expand,
      });
      return json(toLogicalRow(resolved, row ?? before, people));
    }

    case "borrar": {
      const id = String(args[1] ?? "");
      await readRow(resolved, id, expand);
      // Lo que las filas de otras tablas ensenaban de esta pasa a su corralito
      // antes de que el enlace se pierda, si su columna conserva el valor. Es
      // la misma regla por los tres caminos que borran. Ver `server/rowDelete.ts`.
      await parkReferences(app.id, resolved.table, [id]);
      await deleteRecord(collection, id);
      return json({ ok: true });
    }
  }
}

/**
 * Quien mira, cuando el dueno de la aplicacion esta probando la pagina como
 * otro.
 *
 * Las cuatro cosas --rol, persona y las marcas de mirar sin rol y sin sesion--
 * solo se le atienden a el, y ninguna amplia lo que ya alcanza. A cualquier
 * otro se le ignora lo que mande. Ver `design.md` D5.
 *
 * `sinRol` hace falta aparte: mirar sin ningun rol y sin persona no manda nada
 * mas, y sin la marca esta peticion se leeria como la de quien no esta
 * mirando como otro --y contestaria con lo que alcanza el dueno, que es todo--.
 */
async function previewViewer(
  viewer: Viewer,
  app: AppRecord,
  input: { rol?: unknown; persona?: unknown; sinSesion?: unknown; sinRol?: unknown },
): Promise<Viewer> {
  const rol = typeof input.rol === "string" ? input.rol.trim() : "";
  const persona = typeof input.persona === "string" ? input.persona.trim() : "";
  const sinSesion = input.sinSesion === true;
  const sinRol = input.sinRol === true;
  if (!rol && !persona && !sinSesion && !sinRol) return viewer;

  if (!viewer.isOwner) throw new HttpError(403, "Solo el dueño de la aplicación puede hacer eso");
  if (rol && !(app.roles ?? []).includes(rol)) {
    throw new HttpError(400, `El rol "${rol}" no existe en esta aplicación`);
  }

  // Mirar sin sesion es mirar como nadie: la persona y el rol no pintan nada
  // ahi, porque quien llega sin cuenta no tiene ni una ni el otro.
  if (sinSesion) return asViewer({ sinSesion: true });

  const person = persona ? await personOf(app.id, persona) : null;
  if (persona && !person) {
    throw new HttpError(404, "Esa persona no está invitada a esta aplicación");
  }
  // Mirar sin rol es mirar con sesion y sin ninguno: si ademas se eligio
  // persona, los roles que valen son los suyos de verdad --que es lo que hace
  // `asViewer`--, y sin persona no queda ningun rol que dar.
  return asViewer({ role: sinRol ? "" : rol, person });
}

/** Las tablas de una aplicacion, tal como las ve el servidor. */
async function appTables(appId: string): Promise<TableRecord[]> {
  const res = await listRecords<TableRecord>(INTERNAL.tables, {
    filter: `app = "${quote(appId)}"`,
    perPage: 200,
    sort: "order",
    skipTotal: 1,
  });
  return res.items;
}

const json = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/** Un `SourceError` es culpa del documento, no del servidor. */
export function isSourceError(err: unknown): err is SourceError {
  return err instanceof SourceError;
}
