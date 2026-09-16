/**
 * Crea las colecciones internas de la plataforma la primera vez que arranca.
 * Es idempotente: si ya existen, no toca nada.
 */
import { firstTextField } from "../shared/htmlSources.ts";
import {
  ADMIN_ROLE,
  isPeopleTable,
  loginFor,
  MAX_ROLES,
  MEMBER_FIELD,
  MIN_PASSWORD,
  newPassword,
  normalizeRole,
  PEOPLE_ACCOUNT_FIELD,
} from "../shared/people.ts";
import {
  type AppRecord,
  type FieldDef,
  isRelationField,
  orphanFieldName,
  type PageRecord,
  type TableRecord,
} from "../shared/types.ts";
import { config, INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { readDoc } from "./htmlDocs.ts";
import {
  createCollection,
  createRecord,
  deleteRecord,
  firstRecord,
  getCollection,
  listRecords,
  pb,
  type PbCollection,
  type PbField,
  updateCollection,
  updateRecord,
} from "./pb.ts";
import { ensurePeopleTable, peopleTableFor } from "./peopleTable.ts";
import { syncAppRules, updateDataCollection } from "./schema.ts";

let scaffolds: Record<string, PbCollection> | null = null;

async function scaffold(type: "base" | "auth"): Promise<PbCollection> {
  scaffolds ??= await pb<Record<string, PbCollection>>("/api/collections/meta/scaffolds");
  const tpl = scaffolds[type];
  if (!tpl) throw new Error(`PocketBase no devolvio la plantilla "${type}"`);
  return structuredClone(tpl);
}

const timestamps: PbField[] = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

/**
 * Las plantillas de PocketBase traen indices con nombre fijo y sin tabla.
 * Si se usan tal cual, la segunda coleccion choca con la primera.
 */
function fixIndexes(indexes: string[] | undefined, collection: string): string[] {
  return (indexes ?? []).map((sql) =>
    sql
      .replace(/INDEX\s+`([^`]+)`/i, (_, idx: string) => `INDEX \`${idx}_${collection}\``)
      .replace(/\sON\s+``/i, ` ON \`${collection}\``),
  );
}

/** Las reglas de acceso de una coleccion, todas escritas en este archivo. */
const RULES = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"] as const;

async function ensure(
  name: string,
  type: "base" | "auth",
  build: (base: PbCollection) => Partial<PbCollection>,
): Promise<PbCollection> {
  const base = await scaffold(type);
  const spec = build(base);
  const existing = await getCollection(name);

  // Si la coleccion ya existe, le sumamos las columnas nuevas y le ponemos al
  // dia las reglas de acceso. Asi una version posterior no obliga a empezar de
  // cero, y una regla que cambia aqui llega tambien a las instalaciones que ya
  // estaban andando.
  if (existing) {
    const patch: Partial<PbCollection> = {};
    const changed: string[] = [];

    const missing = (spec.fields ?? []).filter(
      (field) => !existing.fields.some((current) => current.name === field.name),
    );
    if (missing.length) {
      patch.fields = [...existing.fields, ...missing];
      changed.push(...missing.map((f) => f.name));
    }

    for (const rule of RULES) {
      if (!(rule in spec)) continue;
      if ((spec[rule] ?? null) === (existing[rule] ?? null)) continue;
      patch[rule] = spec[rule] ?? null;
      changed.push(rule);
    }

    if (!changed.length) return existing;
    const updated = await updateCollection(name, patch);
    console.log(`  ~ coleccion "${name}": ${changed.join(", ")}`);
    return updated;
  }

  const body = { ...base, ...spec, name, type };
  body.indexes = fixIndexes(body.indexes ?? base.indexes, name);
  delete (body as { id?: string }).id;
  const created = await createCollection(body);
  console.log(`  + coleccion "${name}"`);
  return created;
}

/**
 * Le pone al dia a una coleccion de cuentas el minimo de la clave.
 *
 * PocketBase lo guarda en la propia columna --y su plantilla trae ocho-- asi
 * que decirlo solo en `shared/people.ts` no bastaria: la base rechazaria por su
 * cuenta una clave mas corta, con un mensaje en ingles y sin que nadie mas se
 * entere. `ensure` no sirve para esto: suma columnas que faltan, no cambia las
 * que ya estan.
 */
async function ensurePasswordMin(collection: PbCollection): Promise<void> {
  const field = collection.fields.find((f) => f.type === "password");
  if (!field || field.min === MIN_PASSWORD) return;
  await updateCollection(collection.name, {
    fields: collection.fields.map((f) => (f.type === "password" ? { ...f, min: MIN_PASSWORD } : f)),
  });
  console.log(`  ~ coleccion "${collection.name}": minimo de la clave ${MIN_PASSWORD}`);
}

/**
 * Le da a cada cuenta la aplicacion de la que es, y solo esa.
 *
 * Antes de este cambio la lista de cuentas era una sola para toda la
 * plataforma: quien entraba en una aplicacion lo hacia con el mismo correo y la
 * misma clave en cualquier otra donde le hubieran invitado, ponerle clave nueva
 * desde una se la cambiaba en todas, y una cuenta seguia viva aunque ya no
 * tuviera aplicacion ninguna. Ahora cada aplicacion tiene las suyas: el mismo
 * correo puede estar invitado en dos, y en cada una es otra cuenta con otra
 * clave.
 *
 * PocketBase no deja repetir el correo dentro de una coleccion de cuentas --su
 * indice unico lo repone aunque se le quite-- asi que el correo se guarda en
 * `cuenta` y la columna `email` se deja vacia, que es donde ese indice no
 * estorba. Lo que PocketBase compara al entrar es `login`, que lleva delante la
 * aplicacion. Ver `loginFor` en `shared/people.ts`.
 */
async function ensureScopedAccounts(collection: PbCollection, appsId: string): Promise<void> {
  const nuevos: PbField[] = [
    // Sin aplicacion no hay cuenta: borrar la aplicacion se lleva las suyas.
    // No es obligatoria porque las que quedaron sin ninguna al migrar se
    // aparcan asi, sin poder entrar en ningun sitio.
    { name: "app", type: "relation", collectionId: appsId, cascadeDelete: true, maxSelect: 1 },
    // El correo de verdad. Vive aqui y no en `email` por el indice de arriba.
    { name: "cuenta", type: "text", max: 160 },
    // Lo que se compara al entrar. Vacio: esta cuenta ya no abre nada.
    { name: "login", type: "text", max: 220 },
  ];

  const indices = [
    "CREATE UNIQUE INDEX `idx_members_login` ON `members` (`login`) WHERE `login` != ''",
    "CREATE UNIQUE INDEX `idx_members_app_cuenta` ON `members` (`app`, `cuenta`) WHERE `cuenta` != ''",
  ];

  const faltan = nuevos.filter((f) => !collection.fields.some((c) => c.name === f.name));
  const actuales = collection.indexes ?? [];
  const identity = (collection.passwordAuth as { identityFields?: string[] } | undefined)
    ?.identityFields;
  const emailField = collection.fields.find((f) => f.name === "email");

  if (faltan.length || indices.some((i) => !actuales.includes(i)) || identity?.[0] !== "login") {
    await updateCollection(collection.name, {
      fields: [
        // La columna `email` se queda vacia de aqui en adelante, asi que deja
        // de ser obligatoria. Si siguiera siendolo no se podria guardar
        // ninguna cuenta.
        ...collection.fields.map((f) => (f === emailField ? { ...f, required: false } : f)),
        ...faltan,
      ],
      indexes: [...actuales, ...indices.filter((i) => !actuales.includes(i))],
      passwordAuth: { enabled: true, identityFields: ["login"] },
    });
    console.log(`  ~ coleccion "${collection.name}": cuentas por aplicacion`);
  }

  await moveAccountsIntoApps();
}

/**
 * Reparte las cuentas de antes entre las aplicaciones donde estaban invitadas.
 *
 * Una cuenta con el correo todavia en `email` es una que no ha pasado por aqui.
 * Segun a cuantas aplicaciones alcanzaba:
 *
 * - a ninguna: se aparca. Conserva su correo y su clave pero se queda sin
 *   `login`, que es tanto como decir que no abre nada. No se borra: borrar
 *   cuentas es cosa de quien construye, no del arranque.
 * - a una: es suya, y ya esta.
 * - a varias: la primera se queda con la cuenta y para cada una de las demas se
 *   abre una cuenta nueva en su aplicacion, con clave nueva --la anterior no se
 *   puede copiar, y es mejor asi-- que se escribe en la consola para que quien
 *   construye la reparta. Es la unica parte que no se puede hacer sola.
 */
async function moveAccountsIntoApps(): Promise<void> {
  const pendientes = await listRecords<{ id: string; email?: string; name?: string }>(
    INTERNAL.members,
    { filter: 'email != ""', perPage: 500, skipTotal: 1 },
  ).catch(() => null);
  if (!pendientes?.items.length) return;

  let aparcadas = 0;
  for (const cuenta of pendientes.items) {
    const email = (cuenta.email ?? "").trim().toLowerCase();
    const accesos = await listRecords<{ id: string; app: string }>(INTERNAL.access, {
      filter: `member = "${quote(cuenta.id)}"`,
      perPage: 200,
      skipTotal: 1,
    }).catch(() => null);
    const items = accesos?.items ?? [];

    if (!items.length) {
      await updateRecord(INTERNAL.members, cuenta.id, { cuenta: email, email: "", login: "" });
      aparcadas++;
      continue;
    }

    const [primero, ...resto] = items;
    await updateRecord(INTERNAL.members, cuenta.id, {
      cuenta: email,
      email: "",
      app: primero.app,
      login: loginFor(primero.app, email),
    });

    for (const acceso of resto) {
      const password = newPassword();
      const copia = await createRecord<{ id: string }>(INTERNAL.members, {
        app: acceso.app,
        cuenta: email,
        login: loginFor(acceso.app, email),
        name: cuenta.name ?? email.split("@")[0],
        password,
        passwordConfirm: password,
        verified: true,
      });
      await updateRecord(INTERNAL.access, acceso.id, { member: copia.id });
      await repointPersonRow(acceso.app, cuenta.id, copia.id);
      console.log(`  ! clave nueva de ${email} en la aplicacion ${acceso.app}: ${password}`);
    }
  }

  console.log(`  ~ ${pendientes.items.length} cuenta(s) repartidas por aplicacion`);
  if (aparcadas) {
    console.log(`    ${aparcadas} sin aplicacion ninguna: aparcadas, ya no pueden entrar`);
  }
}

/** Le pasa la fila de personas de una aplicacion a la cuenta que la sustituye. */
async function repointPersonRow(appId: string, from: string, to: string): Promise<void> {
  const table = await peopleTableFor(appId);
  if (!table) return;
  const row = await firstRecord<{ id: string }>(
    table.dataCollection,
    `member = "${quote(from)}"`,
  ).catch(() => null);
  if (row) await updateRecord(table.dataCollection, row.id, { member: to }).catch(() => {});
}

export async function bootstrap() {
  // --- Constructores: quienes arman las aplicaciones ---------------------
  const builders = await ensure(INTERNAL.builders, "auth", (base) => ({
    fields: [
      ...base.fields,
      { name: "name", type: "text", max: 120 },
      {
        name: "avatar",
        type: "file",
        maxSelect: 1,
        maxSize: 2_000_000,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      },
    ],
    listRule: "id = @request.auth.id",
    viewRule: "id = @request.auth.id",
    createRule: null,
    updateRule: "id = @request.auth.id",
    deleteRule: null,
  }));

  // --- Miembros: quienes usan las apps publicadas ------------------------
  const members = await ensure(INTERNAL.members, "auth", (base) => ({
    fields: [
      ...base.fields,
      { name: "name", type: "text", max: 120 },
      {
        name: "avatar",
        type: "file",
        maxSelect: 1,
        maxSize: 2_000_000,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
    ],
    listRule: null,
    viewRule: "id = @request.auth.id",
    createRule: null,
    /*
     * Una cuenta no se escribe a si misma.
     *
     * Las reglas de PocketBase son por registro y no por columna: una que
     * dijera "soy yo" dejaria reescribir tambien `cuenta`, `login`, `app` y
     * `verified`, que son las que dicen quien es esta persona y en que
     * aplicacion. No abre ninguna puerta --el acceso lo decide `app_access`--
     * pero deja a alguien poner el correo de otro en su cuenta y a la tabla de
     * personas diciendo lo que ya no es.
     *
     * Cerrarla no quita nada: nada en el panel ni en una aplicacion publicada
     * escribe aqui desde la sesion de quien entro. Lo que si cambia --el
     * correo, el nombre, la clave-- pasa por la API de la plataforma, que
     * comprueba que la aplicacion es de quien la pide y escribe con el token
     * de administrador, al que las reglas no se le aplican. Ver `updateMember`
     * y `resetMemberPassword` en `server/routes.ts`.
     *
     * El precio es que no hay "cambiar mi clave" para quien usa una
     * aplicacion: hoy tampoco lo habia. Cuando lo haya, es una ruta mas de la
     * plataforma --que exigira la clave anterior-- y no esta regla abierta.
     */
    updateRule: null,
    deleteRule: null,
  }));

  // La clave de quien usa una aplicacion publicada la pone quien la construye,
  // y a mano: seis caracteres. Ver `MIN_PASSWORD`.
  await ensurePasswordMin(members);

  // --- Aplicaciones ------------------------------------------------------
  const apps = await ensure(INTERNAL.apps, "base", (base) => ({
    fields: [
      ...base.fields,
      { name: "name", type: "text", required: true, max: 120 },
      { name: "slug", type: "text", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { name: "icon", type: "text", max: 40 },
      {
        name: "visibility",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["private", "public"],
      },
      { name: "published", type: "bool" },
      {
        name: "owner",
        type: "relation",
        required: true,
        collectionId: builders.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "theme", type: "json", maxSize: 50_000 },
      // Roles con nombre propio: deciden que paginas ve cada persona.
      { name: "roles", type: "json", maxSize: 20_000 },
      // Id de la version que ve el publico. Es texto y no una relacion porque
      // "apps" se crea antes que "app_versions" y no puede apuntarle todavia.
      { name: "liveVersion", type: "text", max: 40 },
      // La conversacion con la IA que quedo abierta, en la pagina que sea: hay
      // una sola en toda la aplicacion. Es texto y no una relacion por lo mismo
      // que la version: "apps" se crea antes que "ai_chats". Una conversacion
      // que ya no existe se lee como ninguna.
      { name: "openChat", type: "text", max: 40 },
      // Avisos informativos: arreglos que el sistema hizo solo.
      { name: "notices", type: "json", maxSize: 100_000 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_apps_slug` ON `apps` (`slug`)"],
    listRule: "owner = @request.auth.id",
    viewRule: "owner = @request.auth.id",
    createRule: '@request.auth.collectionName = "builders" && owner = @request.auth.id',
    updateRule: "owner = @request.auth.id",
    deleteRule: "owner = @request.auth.id",
  }));

  const ownedByMe = "app.owner = @request.auth.id";

  // --- Tablas (presentacion; los datos viven en colecciones propias) -----
  await ensure(INTERNAL.tables, "base", (base) => ({
    fields: [
      ...base.fields,
      {
        name: "app",
        type: "relation",
        required: true,
        collectionId: apps.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "name", type: "text", required: true, max: 60, pattern: "^[a-z][a-z0-9_]*$" },
      { name: "label", type: "text", required: true, max: 120 },
      { name: "dataCollection", type: "text", required: true, max: 120 },
      { name: "order", type: "number" },
      { name: "fields", type: "json", maxSize: 500_000 },
      { name: "meta", type: "json", maxSize: 200_000 },
      // Valores sin dueno que el constructor dio por buenos, por columna.
      // Dejan de contar en el recuento de filas sin enlace.
      { name: "acceptedOrphans", type: "json", maxSize: 200_000 },
      // Tabla que sostiene la plataforma: no se borra y trae columnas
      // intocables. Hoy solo la de personas.
      { name: "system", type: "bool" },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_tables_app_name` ON `tables` (`app`, `name`)"],
    listRule: ownedByMe,
    viewRule: ownedByMe,
    createRule: ownedByMe,
    updateRule: ownedByMe,
    deleteRule: ownedByMe,
  }));

  // --- Paginas -----------------------------------------------------------
  const pages = await ensure(INTERNAL.pages, "base", (base) => ({
    fields: [
      ...base.fields,
      {
        name: "app",
        type: "relation",
        required: true,
        collectionId: apps.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "name", type: "text", required: true, max: 120 },
      { name: "slug", type: "text", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { name: "icon", type: "text", max: 40 },
      { name: "order", type: "number" },
      { name: "isHome", type: "bool" },
      // No es una pagina: agrupa a las de alrededor en el sidebar con un texto.
      { name: "separator", type: "bool" },
      // Bloques de las paginas de antes de que una pagina fuera un documento.
      // No se escribe nunca: se conserva para poder convertirlas.
      { name: "blocks", type: "json", maxSize: 2_000_000 },
      // Huella del documento HTML de la pagina. El contenido vive en html_docs.
      { name: "doc", type: "text", max: 64 },
      // Tablas que puede pedir ese HTML, con la traduccion de sus columnas.
      { name: "sources", type: "json", maxSize: 200_000 },
      // Roles que pueden abrir la pagina. Vacio: la abre cualquiera. No hay un
      // segundo campo que diga el nivel: la lista vacia es `Todos`.
      { name: "roles", type: "json", maxSize: 20_000 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_pages_app_slug` ON `pages` (`app`, `slug`)"],
    listRule: ownedByMe,
    viewRule: ownedByMe,
    createRule: ownedByMe,
    updateRule: ownedByMe,
    // La pagina de inicio no se borra: una aplicacion siempre tiene una. La
    // regla lo impide en la base, no solo en el panel.
    deleteRule: `${ownedByMe} && isHome != true`,
  }));

  // --- Accesos a apps publicadas ----------------------------------------
  await ensure(INTERNAL.access, "base", (base) => ({
    fields: [
      ...base.fields,
      {
        name: "app",
        type: "relation",
        required: true,
        collectionId: apps.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "member",
        type: "relation",
        required: true,
        collectionId: members.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      // Los roles con los que ve las pantallas. Lo que puede hacer con los
      // datos ya no se declara por persona: guardar exige cuenta iniciada y
      // nada mas. La columna `role` que lo decia se queda en las instalaciones
      // que ya la tienen, sin leerse ni escribirse. Ver `design.md` D8.
      { name: "roles", type: "json", maxSize: 20_000 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_access_app_member` ON `app_access` (`app`, `member`)"],
    listRule: ownedByMe,
    viewRule: ownedByMe,
    createRule: ownedByMe,
    updateRule: ownedByMe,
    deleteRule: ownedByMe,
  }));

  // --- Historial de versiones del diseno ---------------------------------
  // Cada registro es una fotografia completa del diseno de una app. Solo el
  // servidor entra: el panel las pide por la API para poder resolver autores
  // y podar las viejas en el mismo sitio.
  await ensure(INTERNAL.versions, "base", (base) => ({
    fields: [
      ...base.fields,
      {
        name: "app",
        type: "relation",
        required: true,
        collectionId: apps.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "number", type: "number", required: true },
      { name: "label", type: "text", max: 120 },
      { name: "kind", type: "select", required: true, maxSelect: 1, values: ["publish", "manual"] },
      { name: "hash", type: "text", max: 64 },
      { name: "pinned", type: "bool" },
      {
        name: "author",
        type: "relation",
        collectionId: builders.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      { name: "snapshot", type: "json", maxSize: 3_000_000 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_versions_app_number` ON `app_versions` (`app`, `number`)"],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }));

  // --- Documentos HTML de las paginas ------------------------------------
  // El contenido no viaja dentro de la pagina: se guarda aqui una sola vez,
  // identificado por su huella. Asi treinta versiones del mismo diseno no
  // guardan treinta copias, y el paquete publico solo lleva la huella.
  await ensure(INTERNAL.htmlDocs, "base", (base) => ({
    fields: [
      ...base.fields,
      {
        name: "app",
        type: "relation",
        required: true,
        collectionId: apps.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "hash", type: "text", required: true, max: 64 },
      { name: "content", type: "text", max: 4_000_000 },
      { name: "bytes", type: "number" },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_html_docs_app_hash` ON `html_docs` (`app`, `hash`)"],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }));

  // --- Conversaciones con la inteligencia artificial ---------------------
  // Pertenecen a la pagina donde se hicieron: la lista de una pagina ensena
  // solo las suyas, y por eso `page` es una relacion en cascada --borrar la
  // pagina se lleva sus conversaciones, que ya no serian alcanzables--.
  await ensure(INTERNAL.chats, "base", (base) => ({
    fields: [
      ...base.fields,
      {
        name: "app",
        type: "relation",
        required: true,
        collectionId: apps.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "page",
        type: "relation",
        required: true,
        collectionId: pages.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "title", type: "text", max: 200 },
      { name: "messages", type: "json", maxSize: 2_000_000 },
      {
        name: "author",
        type: "relation",
        collectionId: builders.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      ...timestamps,
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }));

  await migrateChatsToPageRelation(pages.id);

  // --- Registro de depuracion de la IA -----------------------------------
  // Una fila por pagina, la de su ultima peticion, sobrescrita en cada una.
  // No es historial: es lo que hace falta para entender despues un fallo que
  // no se puede reproducir. Solo el servidor entra.
  await ensure(INTERNAL.aiDebug, "base", (base) => ({
    fields: [
      ...base.fields,
      {
        name: "app",
        type: "relation",
        required: true,
        collectionId: apps.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "page",
        type: "relation",
        required: true,
        collectionId: pages.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "prompt", type: "text", max: 100_000 },
      // Lo que se le mando al modelo, tal cual. Lleva el HTML entero de la
      // pagina, asi que es con diferencia lo mas grande que se guarda aqui.
      { name: "context", type: "text", max: 2_000_000 },
      { name: "reasoning", type: "text", max: 500_000 },
      { name: "answer", type: "text", max: 500_000 },
      { name: "model", type: "text", max: 200 },
      /** Cuanto tardo la peticion, en milisegundos. */
      { name: "ms", type: "number" },
      // El contexto no cabia entero y va recortado.
      { name: "truncated", type: "bool" },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_ai_debug_page` ON `ai_debug` (`page`)"],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }));

  // --- Ajustes de la instalacion (servidor de IA) ------------------------
  // Solo el servidor entra aqui: guarda claves que el navegador no debe ver.
  await ensure(INTERNAL.settings, "base", (base) => ({
    fields: [
      ...base.fields,
      { name: "key", type: "text", required: true, max: 60 },
      { name: "value", type: "json", maxSize: 100_000 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_settings_key` ON `settings` (`key`)"],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }));

  // Va antes que las tablas de personas: reparte las cuentas entre sus
  // aplicaciones, y las filas se sincronizan despues con el reparto ya hecho.
  await ensureScopedAccounts(members, apps.id);

  // La tabla de personas va primero: es la tabla destino a la que apuntan las
  // columnas que la conversion de abajo recrea, y sin ella no hay a donde
  // apuntar. Y la conversion va antes que cualquier otra cosa que lea columnas,
  // para que nada se encuentre un tipo que ya no existe.
  await ensurePeopleTables();
  await convertPersonColumns();

  await fillRelationDisplayFields();
  await relaxRequiredRelations();
  await closeDataCollections();
  await relaxRetiredLevel();
  await migrateToRoleModel();

  // --- Primer constructor, con las mismas credenciales del .env ----------
  const existing = await firstRecord(INTERNAL.builders, `email = "${quote(config.adminEmail)}"`);
  if (!existing) {
    await createRecord(INTERNAL.builders, {
      email: config.adminEmail,
      password: config.adminPassword,
      passwordConfirm: config.adminPassword,
      name: "Administrador",
      verified: true,
      emailVisibility: true,
    });
    console.log(`  + constructor "${config.adminEmail}"`);
  }
}

/**
 * El tipo que se retiro. Ya no esta en `FieldType`, asi que aqui se compara
 * contra la cadena tal como quedo guardada en la ficha de la tabla.
 */
const OLD_PERSON_TYPE = "person";

/**
 * Convierte las columnas de tipo persona en relaciones a la tabla de personas.
 *
 * El tipo desaparecio y con el su ancla: una columna de persona guardaba el id
 * de la cuenta y una de relacion guarda el id de la fila del destino. Cambiar
 * el tipo a secas no vale --cambiar a que coleccion apunta una relacion obliga
 * a recrear la columna, y recrearla la deja vacia-- asi que hay que leer los
 * enlaces antes, traducirlos y volver a escribirlos.
 *
 * Se puede sin perder nada porque la correspondencia cuenta <-> fila es uno a
 * uno: la sostiene el indice unico de `member`. Ver `design.md` D2.
 *
 * Una celda cuya cuenta ya no esta invitada no tiene fila a la que apuntar: su
 * valor pasa al corralito de la columna, que es lo que este cambio establece
 * para todo lo demas. Se ve, se busca y se vuelve a enlazar si esa persona
 * vuelve.
 *
 * Es idempotente y silenciosa: una aplicacion sin columnas de ese tipo no paga
 * ninguna consulta mas que la lista de tablas, que el arranque ya lee.
 */
export async function convertPersonColumns(): Promise<void> {
  const tables = await listRecords<TableRecord>(INTERNAL.tables, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!tables) return;

  const pending = tables.items.filter((t) =>
    (t.fields ?? []).some((f) => String(f.type) === OLD_PERSON_TYPE),
  );
  if (!pending.length) return;

  let touched = 0;
  for (const table of pending) {
    const people = tables.items.find((t) => t.app === table.app && isPeopleTable(t));
    // Sin tabla de personas no hay destino. El siguiente arranque la encuentra
    // ya creada y la conversion corre entonces.
    if (!people) continue;
    if (await convertTable(table, people)) touched++;
  }

  if (touched) {
    const cuantas = touched === 1 ? "1 tabla" : `${touched} tablas`;
    console.log(`  ~ ${cuantas} con columnas de persona convertidas a relacion`);
  }
}

/** Las filas de la tabla de personas, por la cuenta que cada una nombra. */
async function personRowsByMember(people: TableRecord): Promise<Map<string, string>> {
  const rows = await listRecords<Record<string, unknown>>(people.dataCollection, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  return new Map(
    (rows?.items ?? []).map((r) => [String(r[MEMBER_FIELD] ?? ""), String(r.id ?? "")]),
  );
}

async function convertTable(table: TableRecord, people: TableRecord): Promise<boolean> {
  const columns = (table.fields ?? []).filter((f) => String(f.type) === OLD_PERSON_TYPE);
  const byMember = await personRowsByMember(people);

  /*
   * Lo que cada fila tenia, leido entero antes de tocar nada: la columna se
   * quita y se vuelve a poner, y eso se lleva por delante tanto el enlace como
   * el valor sin dueno que hubiera al lado. Aqui quedan los dos, para
   * reescribirlos despues.
   */
  const before = new Map<string, Map<string, { enlace: unknown; sinEnlace: string }>>();
  for (const field of columns) {
    const orphan = orphanFieldName(field.name);
    const rows = await listRecords<Record<string, unknown>>(table.dataCollection, {
      perPage: 500,
      skipTotal: 1,
    }).catch(() => null);
    if (!rows) return false;
    const values = new Map<string, { enlace: unknown; sinEnlace: string }>();
    for (const row of rows.items) {
      const enlace = row[field.name];
      const sinEnlace = String(row[orphan] ?? "");
      if (!enlace && !sinEnlace) continue;
      values.set(String(row.id ?? ""), { enlace, sinEnlace });
    }
    before.set(field.name, values);
  }

  /*
   * En dos pasos, y no en uno: PocketBase reconoce una columna por su nombre
   * ademas de por su id, asi que mandarla ya apuntando a otra coleccion lo
   * rechaza con "The relation collection cannot be changed" aunque se le suelte
   * el id. Primero desaparece y despues nace apuntando a la tabla de personas.
   */
  const sinColumnas = (table.fields ?? []).filter(
    (f) => String(f.type) !== OLD_PERSON_TYPE,
  ) as FieldDef[];
  const quitada = await updateDataCollection({
    dataCollection: table.dataCollection,
    fields: sinColumnas,
  }).catch(() => null);
  if (!quitada) return false;

  const fields: FieldDef[] = (table.fields ?? []).map((f) =>
    String(f.type) === OLD_PERSON_TYPE
      ? {
          ...f,
          id: undefined,
          type: "relation" as const,
          relationTableId: people.id,
          // Lo que ensenaba se conserva tal cual; sin declararlo, el correo,
          // que es lo que una columna de persona ensenaba por defecto.
          displayField: f.displayField || PEOPLE_ACCOUNT_FIELD,
          detailField: f.detailField ?? PEOPLE_ACCOUNT_FIELD,
        }
      : f,
  );

  const applied = await updateDataCollection({
    dataCollection: table.dataCollection,
    fields,
  }).catch(() => null);
  if (!applied) return false;
  await updateRecord(INTERNAL.tables, table.id, { fields: applied.fields }).catch(() => {});

  for (const field of columns) {
    await writeNewAnchors(table, field, before.get(field.name) ?? new Map(), byMember);
  }
  return true;
}

/**
 * Reescribe el ancla de cada fila: del id de la cuenta al de su fila.
 *
 * Lo que no encuentra fila es de alguien que ya no esta invitado. Su valor se
 * conserva en el corralito de la columna --el correo de esa cuenta, que es lo
 * que la celda ensenaba-- para que la fila no quede a la vez sin enlace y sin
 * valor. Lo que ya estaba en el corralito antes de convertir vuelve tal cual.
 *
 * Una columna que admite varias no tiene corralito, asi que ahi solo se
 * conserva lo que si traduce.
 */
async function writeNewAnchors(
  table: TableRecord,
  field: FieldDef,
  before: Map<string, { enlace: unknown; sinEnlace: string }>,
  byMember: Map<string, string>,
): Promise<void> {
  const orphan = orphanFieldName(field.name);
  const multiple = field.multiple === true;

  for (const [rowId, { enlace, sinEnlace }] of before) {
    const members = (Array.isArray(enlace) ? enlace : [enlace])
      .map((v) => String(v ?? ""))
      .filter(Boolean);
    const filas = members.map((m) => byMember.get(m) ?? "").filter(Boolean);

    if (filas.length) {
      const value = multiple ? filas : filas[0];
      const body = multiple ? { [field.name]: value } : { [field.name]: value, [orphan]: "" };
      await updateRecord(table.dataCollection, rowId, body).catch(() => {});
      continue;
    }

    if (multiple) continue;
    const value = sinEnlace || (await accountEmail(members[0] ?? ""));
    if (!value) continue;
    await updateRecord(table.dataCollection, rowId, {
      [field.name]: "",
      [orphan]: value,
    }).catch(() => {});
  }
}

/** El correo de una cuenta que ya no esta invitada, si la cuenta sigue ahi. */
async function accountEmail(memberId: string): Promise<string> {
  if (!memberId) return "";
  const account = await firstRecord<Record<string, unknown>>(
    INTERNAL.members,
    `id = "${quote(memberId)}"`,
  ).catch(() => null);
  return String(account?.[PEOPLE_ACCOUNT_FIELD] ?? "");
}

/**
 * Deja escrito que ensena cada columna de relacion que venia de antes.
 *
 * Hasta este cambio no se declaraba: la grilla cogia la primera columna de
 * texto del registro enlazado. Se escribe eso mismo, para que lo que ve el
 * usuario no cambie de un dia para otro por haber actualizado.
 *
 * Corre una sola vez de verdad: en cuanto una columna tiene su `displayField`
 * no se vuelve a tocar.
 */
async function fillRelationDisplayFields() {
  const tables = await listRecords<TableRecord>(INTERNAL.tables, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!tables) return;

  const byId = new Map(tables.items.map((t) => [t.id, t]));
  let touched = 0;

  for (const table of tables.items) {
    let changed = false;
    const fields = (table.fields ?? []).map((field) => {
      if (!isRelationField(field) || field.displayField) return field;
      const display = firstTextField(byId.get(field.relationTableId ?? "") ?? null);
      if (!display) return field;
      changed = true;
      return { ...field, displayField: display };
    });

    if (!changed) continue;
    await updateRecord(INTERNAL.tables, table.id, { fields }).catch(() => {});
    touched++;
  }

  if (touched) console.log(`  ~ ${touched} tablas con relaciones que ya dicen que ensenan`);
}

/**
 * Deja que la mitad del id de una relacion pueda quedar vacia en la base.
 *
 * Una columna de relacion son dos columnas reales, y marcar la columna como
 * obligatoria marcaba tambien la del id. Con eso, una celda cuyo valor no
 * corresponde a ningun registro no se podia guardar: es justo la que deja el
 * id vacio y escribe el valor en la otra. Una columna obligatoria no admitia
 * una cedula nueva al importar, y quitar a una persona invitada no podia
 * conservar la suya.
 *
 * Lo obligatorio sigue siendo la celda, y lo exige el panel antes de guardar.
 * Aqui solo se afloja lo que la base tenia de mas en las tablas que ya
 * existian; las que se creen despues nacen bien. Ver `toPbFields` en
 * `server/schema.ts`.
 */
async function relaxRequiredRelations() {
  const tables = await listRecords<TableRecord>(INTERNAL.tables, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!tables) return;

  let touched = 0;
  for (const table of tables.items) {
    const names = new Set(
      (table.fields ?? [])
        .filter((f) => isRelationField(f) && f.multiple !== true)
        .map((f) => f.name),
    );
    if (names.size === 0) continue;

    const collection = await getCollection(table.dataCollection);
    if (!collection) continue;
    if (!collection.fields.some((f) => names.has(f.name) && f.required)) continue;

    await updateCollection(collection.name, {
      fields: collection.fields.map((f) =>
        names.has(f.name) && f.required ? { ...f, required: false } : f,
      ),
    }).catch(() => {});
    touched++;
  }

  if (touched) console.log(`  ~ ${touched} tablas donde una relacion sin enlace ya cabe`);
}

/**
 * Cierra a los invitados las tablas de datos que venian de antes.
 *
 * Las reglas de una tabla las escribia `accessRules`, que ahora devuelve otra
 * cosa: la logica de roles se mudo al servidor. Las tablas ya creadas conservan
 * las reglas viejas hasta que alguien las toque, y mientras tanto un invitado
 * seguiria alcanzando la base por su cuenta. Se reescriben todas aqui.
 *
 * Solo cambia quien puede pedir las filas; ninguna fila se toca. Es el unico
 * paso de este cambio que no se deshace solo: la vuelta atras es reponer
 * `legacyAccessRules`, que se conserva en `server/schema.ts` para eso.
 */
/**
 * Le da su tabla de personas a las aplicaciones que ya existian, vacia.
 *
 * Nadie lo nota: la tabla nace con las tres columnas del sistema, que son las
 * mismas tres cosas que la pantalla de personas y roles ya ensenaba. Lo que
 * cambia es que a partir de aqui se le pueden anadir columnas propias.
 */
async function ensurePeopleTables() {
  const apps = await listRecords<{ id: string; slug: string; visibility: "private" | "public" }>(
    INTERNAL.apps,
    { perPage: 500, skipTotal: 1 },
  ).catch(() => null);
  if (!apps) return;

  let touched = 0;
  for (const app of apps.items) {
    const table = await ensurePeopleTable(app).catch(() => null);
    if (table) touched++;
  }

  if (touched) console.log(`  ~ ${touched} aplicaciones con su tabla de personas`);
}

async function closeDataCollections() {
  const apps = await listRecords<{ id: string; visibility: "private" | "public" }>(INTERNAL.apps, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!apps) return;

  let touched = 0;
  for (const app of apps.items) {
    await syncAppRules(app.id).catch(() => {});
    touched++;
  }

  if (touched) console.log(`  ~ ${touched} aplicaciones con sus datos cerrados al navegador`);
}

/**
 * Suelta la columna que decia el nivel de una persona, sin borrarla.
 *
 * El nivel se retiro: lo que una persona puede hacer con los datos ya no se
 * declara por persona. La columna se queda donde esta --volver atras es
 * reponer codigo, no recuperar datos-- pero venia declarada como obligatoria, y
 * una columna obligatoria que nadie escribe rechazaria cada invitacion nueva.
 *
 * `ensure` no sirve para esto: suma columnas que faltan, no cambia las que ya
 * estan. Ver `design.md` D8.
 */
async function relaxRetiredLevel(): Promise<void> {
  const collection = await getCollection(INTERNAL.access);
  const field = collection?.fields.find((f) => f.name === "role");
  if (!collection || !field || !field.required) return;
  await updateCollection(INTERNAL.access, {
    fields: collection.fields.map((f) => (f.name === "role" ? { ...f, required: false } : f)),
  });
  console.log(`  ~ coleccion "${INTERNAL.access}": el nivel deja de ser obligatorio`);
}

/**
 * Ata cada conversacion a su pagina de verdad.
 *
 * `ai_chats.page` nacio como texto suelto para que borrar una pagina no se
 * llevara la conversacion por delante. Ahora la conversacion pertenece a la
 * pagina --la lista de una pagina ensena solo las suyas-- y una conversacion
 * de una pagina borrada no se alcanza desde ningun sitio.
 *
 * Antes de tocar la columna hay que borrar esas conversaciones: una relacion
 * no acepta un valor que no apunta a nada. `pageName` se va con ellas: existia
 * para nombrar justamente esas.
 *
 * PocketBase no le cambia el tipo a una columna que ya existe --lo rechaza con
 * "Field type cannot be changed"-- asi que la de texto se quita y se pone una
 * de relacion en su lugar. Quitarla se lleva sus valores, de modo que se
 * anotan antes y se reponen despues; y nace sin ser obligatoria, porque entre
 * ponerla y rellenarla las filas la tendrian vacia.
 *
 * `ensure` no sirve para esto: suma columnas que faltan, no cambia ni quita
 * las que ya estan. Es idempotente: la segunda vuelta no encuentra nada.
 */
async function migrateChatsToPageRelation(pagesId: string): Promise<void> {
  const collection = await getCollection(INTERNAL.chats);
  if (!collection) return;

  const isText = collection.fields.find((f) => f.name === "page")?.type === "text";
  const hasPageName = collection.fields.some((f) => f.name === "pageName");
  if (!isText && !hasPageName) return;

  if (!isText) {
    // La relacion ya estaba: solo quedaba quitar el nombre de la pagina.
    await updateCollection(INTERNAL.chats, {
      fields: collection.fields.filter((f) => f.name !== "pageName"),
    });
    console.log(`  ~ coleccion "${INTERNAL.chats}": sin el nombre de la pagina`);
    return;
  }

  // 1. Fuera las conversaciones cuya pagina ya no existe.
  const alive = new Set((await allRecords(INTERNAL.pages)).map((r) => r.id));
  const chats = await allRecords<{ page?: string }>(INTERNAL.chats, "id,page");
  const orphans = chats.filter((chat) => !chat.page || !alive.has(chat.page));
  for (const chat of orphans) await deleteRecord(INTERNAL.chats, chat.id).catch(() => {});
  if (orphans.length) {
    console.log(`  ~ ${orphans.length} conversaciones de paginas que ya no existen, borradas`);
  }

  // 2. Fuera la columna de texto --y la del nombre, que se iba con ella--.
  await updateCollection(INTERNAL.chats, {
    fields: collection.fields.filter((f) => f.name !== "page" && f.name !== "pageName"),
  });

  // 3. Y en su lugar la relacion, todavia sin exigir.
  const bare = await getCollection(INTERNAL.chats);
  await updateCollection(INTERNAL.chats, {
    fields: [
      ...(bare?.fields ?? []),
      {
        name: "page",
        type: "relation",
        required: false,
        collectionId: pagesId,
        cascadeDelete: true,
        maxSelect: 1,
      },
    ],
  });

  // 4. Cada conversacion vuelve a su pagina.
  for (const chat of chats) {
    if (!chat.page || !alive.has(chat.page)) continue;
    await updateRecord(INTERNAL.chats, chat.id, { page: chat.page }).catch(() => {});
  }

  // 5. Ahora que ninguna la tiene vacia, se exige.
  const filled = await getCollection(INTERNAL.chats);
  await updateCollection(INTERNAL.chats, {
    fields: (filled?.fields ?? []).map((f) => (f.name === "page" ? { ...f, required: true } : f)),
  });
  console.log(`  ~ coleccion "${INTERNAL.chats}": la conversacion es de su pagina`);
}

/** Todos los registros de una coleccion, pagina a pagina. */
async function allRecords<T = unknown>(
  collection: string,
  fields = "id",
): Promise<(T & { id: string })[]> {
  const out: (T & { id: string })[] = [];
  for (let page = 1; ; page++) {
    const res = await listRecords<T & { id: string }>(collection, {
      page,
      perPage: 500,
      skipTotal: 1,
      fields,
    });
    out.push(...res.items);
    if (res.items.length < 500) return out;
  }
}

/**
 * Pasa cada aplicacion al modelo de roles nuevo.
 *
 * Tres cosas, en este orden y por aplicacion:
 *
 * 1. Normalizar los roles, fundiendo los que colisionen, y reescribir con los
 *    nombres nuevos las referencias en personas y en paginas.
 * 2. Anadir `admin`, que toda aplicacion define.
 * 3. Traducir quien abre cada pagina: `anyone` --y las que no tenian nivel
 *    guardado-- quedan con la lista vacia; `signed` queda con todos los roles
 *    de la aplicacion marcados, nunca vacia; `roles` conserva los suyos.
 *
 * Nada de esto amplia el acceso de nadie: una aplicacion privada sigue
 * exigiendo cuenta, y ninguna pagina pasa a abrirse a mas gente de la que la
 * abria. Es idempotente: la segunda vuelta no encuentra nada que escribir.
 * Ver `design.md` -- Migration Plan.
 */
async function migrateToRoleModel(): Promise<void> {
  const apps = await listRecords<AppRecord>(INTERNAL.apps, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!apps) return;

  let touched = 0;
  for (const app of apps.items) {
    if (await migrateApp(app)) touched++;
  }

  if (touched) console.log(`  ~ ${touched} aplicaciones pasadas al modelo de roles`);
}

/** Devuelve si hubo algo que escribir. */
async function migrateApp(app: AppRecord): Promise<boolean> {
  const before = Array.isArray(app.roles) ? app.roles : [];

  // El nombre normalizado de cada rol escrito, para reescribir lo que lo
  // nombra. Dos que colisionen apuntan al mismo, que es lo que los funde.
  const renamed = new Map<string, string>();
  const roles: string[] = [];
  for (const raw of before) {
    const role = normalizeRole(raw);
    if (!role) continue;
    renamed.set(String(raw), role);
    if (!roles.includes(role)) roles.push(role);
  }
  if (!roles.includes(ADMIN_ROLE)) roles.unshift(ADMIN_ROLE);
  const appRoles = roles.slice(0, MAX_ROLES);

  /** Lo que nombra un rol, con el nombre nuevo y sin repetidos ni huerfanos. */
  const follow = (names: unknown): string[] => {
    const list = Array.isArray(names) ? names : [];
    const out: string[] = [];
    for (const raw of list) {
      const role = renamed.get(String(raw)) ?? normalizeRole(raw);
      if (role && appRoles.includes(role) && !out.includes(role)) out.push(role);
    }
    return out;
  };

  const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

  let wrote = false;

  if (!same(before.map(String), appRoles)) {
    await updateRecord(INTERNAL.apps, app.id, { roles: appRoles });
    wrote = true;
  }

  const access = await listRecords<{ id: string; roles?: string[] }>(INTERNAL.access, {
    filter: `app = "${quote(app.id)}"`,
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  for (const row of access?.items ?? []) {
    const next = follow(row.roles);
    if (same((row.roles ?? []).map(String), next)) continue;
    await updateRecord(INTERNAL.access, row.id, { roles: next });
    wrote = true;
  }

  const pages = await listRecords<PageRecord & { access?: string }>(INTERNAL.pages, {
    filter: `app = "${quote(app.id)}"`,
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);

  for (const page of pages?.items ?? []) {
    const kept = follow(page.roles);
    /*
     * `signed` no tiene equivalente exacto: exigia cuenta y ningun rol. Se
     * traduce a todos los roles marcados y nunca a la lista vacia. Alguien sin
     * ningun rol puede perder el acceso, y eso se arregla dandole uno; abrir la
     * pagina a cualquiera no se arregla, porque lo que se vio ya se vio.
     */
    const next =
      page.access === "signed"
        ? [...appRoles]
        : page.access === "anyone"
          ? []
          : page.access === "roles"
            ? kept
            : // Sin nivel guardado se deduce de los roles, que es la regla que ya
              // regia antes de que existiera el campo: con roles marcados era
              // "solo esos", sin ellos la abria cualquiera.
              kept;

    if (same((page.roles ?? []).map(String), next)) continue;
    await updateRecord(INTERNAL.pages, page.id, { roles: next });
    wrote = true;
  }

  await warnRenamedRolesInDocs(app, pages?.items ?? [], renamed);

  return wrote;
}

/**
 * Avisa de los nombres de rol escritos dentro del HTML de una pagina que hayan
 * cambiado al normalizar.
 *
 * No toca el documento: solo el HTML sabe que pretendia ensenar, y reescribirlo
 * a ciegas puede romper mas de lo que arregla. Una pagina que compara contra
 * `"Jefe de Zona"` deja de encontrar a nadie, y eso hay que decirlo.
 */
async function warnRenamedRolesInDocs(
  app: AppRecord,
  pages: PageRecord[],
  renamed: Map<string, string>,
): Promise<void> {
  const changed = [...renamed].filter(([antes, ahora]) => antes !== ahora);
  if (!changed.length) return;

  for (const page of pages) {
    if (!page.doc) continue;
    const html = await readDoc(app.id, page.doc).catch(() => null);
    if (!html) continue;
    const found = changed.filter(([antes]) => html.includes(antes));
    if (!found.length) continue;
    const detail = found.map(([antes, ahora]) => `"${antes}" ahora es "${ahora}"`).join(", ");
    console.log(
      `  ! "${app.name}" / "${page.name}": el HTML nombra roles que cambiaron de nombre (${detail}). El documento no se toco.`,
    );
  }
}
