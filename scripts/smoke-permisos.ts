/**
 * Que quien no puede abrir una pagina no reciba sus datos, y que sin cuenta no
 * se escriba.
 * Uso:  bun run scripts/smoke-permisos.ts
 *
 * Esta bateria no es un extra del cambio: es lo unico que distingue "creo que
 * el permiso funciona" de "esta demostrado". El reparto de filas por rol se
 * retiro, asi que aqui ya no se comprueba que un rol no alcance la fila de otro
 * --el sistema no lo promete-- sino lo que si promete: la frontera de la
 * aplicacion, la de cada pagina, y la sesion al escribir.
 *
 * Se prueba por la puerta de verdad --la ruta de datos de una pagina, con la
 * sesion de cada persona-- y no llamando a las funciones que deciden. Una
 * comprobacion que llamara a `canOpenPage` demostraria que esa funcion hace lo
 * que dice, no que nadie recibe lo que no le toca.
 */
import { loginFor, PEOPLE_ACCOUNT_FIELD, PEOPLE_TABLE } from "../shared/people.ts";
import { type AppPerson, NEEDS_SESSION, type TableRecord } from "../shared/types.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@planer.local";
const PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "planer-admin-1234";
const CLAVE = "prueba-12345";

let token = "";
let failures = 0;

function check(label: string, condition: unknown) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FALLA ${label}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}, auth = token): Promise<T> {
  const headers = new Headers(init.headers);
  if (auth) headers.set("authorization", auth);
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

const records = (collection: string, id = "") =>
  `/pb/api/collections/${collection}/records${id ? `/${id}` : ""}`;

/* ------------------------------------------------------------------ */
/* Montar el escenario                                                  */
/* ------------------------------------------------------------------ */

console.log("\n1. Entrar y crear la aplicacion");
const auth = await call<{ token: string }>("/pb/api/collections/builders/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
});
token = auth.token;

const app = await call<{ id: string; slug: string; roles: string[] }>("/api/apps", {
  method: "POST",
  // Publica: la frontera de la aplicacion se prueba aparte, encendiendola.
  body: JSON.stringify({ name: `Clinica ${Date.now()}`, visibility: "public" }),
});
check("app creada", !!app.id);
check("y nace con el rol admin, sin que nadie lo escriba", (app.roles ?? []).includes("admin"));

console.log("\n2. Los roles se normalizan al guardarlos");
const conRoles = await call<{ roles: string[] }>(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ roles: ["Jefe de Zona", "JEFE DE ZONA", "Odontólogo", "Conductor"] }),
});
check(
  "minusculas, sin tildes y con guiones",
  conRoles.roles.includes("jefe-de-zona") && conRoles.roles.includes("odontologo"),
);
check(
  "dos nombres que se normalizan igual son uno solo",
  conRoles.roles.filter((r) => r === "jefe-de-zona").length === 1,
);
check("y admin sigue estando, sin haberlo mandado", conRoles.roles.includes("admin"));

console.log("\n3. Las personas");
/** Invita a alguien, le da roles y devuelve su id y su sesion. */
async function persona(email: string, roles: string[]) {
  const added = await call<{ access: { id: string; member: string } }>(
    `/api/apps/${app.id}/members`,
    { method: "POST", body: JSON.stringify({ email, password: CLAVE, roles }) },
  );
  const signed = await call<{ token: string }>("/pb/api/collections/members/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: loginFor(app.id, email), password: CLAVE }),
  });
  return { id: added.access.member, token: signed.token, email };
}

const stamp = Date.now();
const ana = await persona(`ana${stamp}@test.com`, ["odontologo"]);
const beto = await persona(`beto${stamp}@test.com`, ["conductor"]);
check("dos personas invitadas", !!ana.id && !!beto.id);

// Una columna que apunta a personas guarda el id de su fila en la tabla de
// personas, no el de su cuenta. Ver `design.md` D1.
const invitados = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
const filaDe = (memberId: string) => invitados.find((p) => p.id === memberId)?.fila ?? "";

console.log("\n4. Dos tablas");
const tablasDeLaApp = await call<{ items: TableRecord[] }>(
  `/pb/api/collections/tables/records?perPage=200&filter=${encodeURIComponent(`app="${app.id}"`)}`,
);
const tablaPersonas = tablasDeLaApp.items.find((t) => t.name === PEOPLE_TABLE);
if (!tablaPersonas) throw new Error("la aplicacion tiene que tener su tabla de personas");

const agendas = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Agendas",
    fields: [
      { name: "paciente", label: "Paciente", type: "text" },
      {
        name: "odontologo",
        label: "Odontologo",
        type: "relation",
        relationTableId: tablaPersonas.id,
        displayField: PEOPLE_ACCOUNT_FIELD,
      },
    ],
  }),
});
const avisos = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Avisos",
    fields: [{ name: "texto", label: "Texto", type: "text" }],
  }),
});
check("dos tablas creadas", !!agendas.id && !!avisos.id);

/** El manifiesto de una tabla: todas sus columnas, con el nombre que ya tienen. */
const fuente = (table: TableRecord) => ({
  name: table.name,
  tableId: table.id,
  fields: Object.fromEntries((table.fields ?? []).map((f) => [f.name, f.id ?? ""])),
});

console.log("\n5. Dos paginas: una abierta a Todos y otra limitada a un rol");
/** Crea una pagina con su HTML y su manifiesto. */
async function pagina(name: string, slug: string, roles: string[], isHome = false) {
  const page = await call<{ id: string }>(records("pages"), {
    method: "POST",
    body: JSON.stringify({ app: app.id, name, slug, icon: "FileText", order: 1, isHome, roles }),
  });
  await call(`/api/apps/${app.id}/paginas/${page.id}/html`, {
    method: "PUT",
    body: JSON.stringify({
      content: `<!doctype html><html><body><h1>${name}</h1></body></html>`,
      sources: [fuente(agendas), fuente(avisos)],
    }),
  });
  return page;
}

const abierta = await pagina("Panel", "panel", [], true);
const limitada = await pagina("Agenda", "agenda", ["odontologo"]);
check("las dos paginas existen", !!abierta.id && !!limitada.id);

/** Una orden de datos, con la sesion de quien pregunta. */
async function orden<T>(
  who: { token: string } | null,
  page: { id: string },
  op: string,
  args: unknown[],
  extra: Record<string, unknown> = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers = new Headers({ "content-type": "application/json" });
  if (who) headers.set("authorization", who.token);
  const res = await fetch(`${BASE}/api/apps/${app.id}/paginas/${page.id}/datos`, {
    method: "POST",
    headers,
    body: JSON.stringify({ op, args, ...extra }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: (text ? JSON.parse(text) : null) as T };
}

type Lista = { filas: Record<string, unknown>[]; total: number };

console.log("\n6. Sembrar las filas, cada una de alguien distinto");
const sembrar = async (table: TableRecord, values: Record<string, unknown>) =>
  await call<{ id: string }>(records(table.dataCollection), {
    method: "POST",
    body: JSON.stringify(values),
  });

const deAna = await sembrar(agendas, {
  paciente: "Paciente de Ana",
  odontologo: filaDe(ana.id),
});
await sembrar(agendas, { paciente: "Paciente de Beto", odontologo: filaDe(beto.id) });
await sembrar(agendas, { paciente: "Sin dueno" });
await sembrar(avisos, { texto: "Aviso general" });
check("tres agendas y un aviso", !!deAna.id);

/* ------------------------------------------------------------------ */
/* Quien abre cada pagina                                               */
/* ------------------------------------------------------------------ */

console.log("\n7. Una pagina abierta a Todos, en una aplicacion publica");
const anonAbierta = await orden<Lista>(null, abierta, "listar", [agendas.name, { limite: 100 }]);
check("alguien sin cuenta la abre y recibe sus filas", anonAbierta.ok);
check(
  "todas ellas: el servidor no recorta por quien pregunta",
  anonAbierta.data.filas.length === 3,
);
check("y el total las cuenta todas", anonAbierta.data.total === 3);

const betoAbierta = await orden<Lista>(beto, abierta, "listar", [agendas.name, { limite: 100 }]);
check(
  "quien tiene otro rol tambien la abre, y alcanza las mismas tres",
  betoAbierta.ok && betoAbierta.data.filas.length === 3,
);

const filaAjena = await orden(null, abierta, "obtener", [agendas.name, deAna.id]);
check("una fila de otra persona se entrega: las filas ya no son de nadie", filaAjena.ok);

console.log("\n8. Una pagina limitada a un rol");
const anaLimitada = await orden<Lista>(ana, limitada, "listar", [agendas.name, { limite: 100 }]);
check("quien tiene el rol marcado la abre", anaLimitada.ok);

const betoLimitada = await orden(beto, limitada, "listar", [agendas.name, {}]);
check("quien no lo tiene no recibe nada", betoLimitada.status === 403);

const anonLimitada = await orden(null, limitada, "listar", [agendas.name, {}]);
check(
  "y quien llega sin cuenta tampoco, aunque la aplicacion sea publica",
  anonLimitada.status === 403,
);

console.log("\n9. Una tabla que la pagina no declara");
const otraPagina = await call<{ id: string }>(records("pages"), {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Vacia",
    slug: "vacia",
    icon: "FileText",
    order: 2,
    roles: [],
  }),
});
await call(`/api/apps/${app.id}/paginas/${otraPagina.id}/html`, {
  method: "PUT",
  body: JSON.stringify({
    content: "<!doctype html><html><body></body></html>",
    sources: [fuente(avisos)],
  }),
});
const fueraDelManifiesto = await orden(ana, otraPagina, "listar", [agendas.name, {}]);
check("se rechaza la orden", !fueraDelManifiesto.ok);

/* ------------------------------------------------------------------ */
/* Guardar exige una cuenta iniciada                                    */
/* ------------------------------------------------------------------ */

console.log("\n10. Sin sesion se lee, pero no se escribe");
const leerSinSesion = await orden<Lista>(null, abierta, "listar", [avisos.name, {}]);
check("leer sin cuenta funciona", leerSinSesion.ok && leerSinSesion.data.filas.length === 1);

const crearSinSesion = await orden<{ error: string; codigo?: string }>(null, abierta, "crear", [
  avisos.name,
  { texto: "De un anonimo" },
]);
check("crear sin cuenta se rechaza", !crearSinSesion.ok);
check(
  "con su codigo propio, para que la plataforma ponga el aviso",
  crearSinSesion.data.codigo === NEEDS_SESSION,
);
check("y con un mensaje que la pagina puede capturar", !!crearSinSesion.data.error);

const trasElIntento = await orden<Lista>(null, abierta, "listar", [avisos.name, {}]);
check("la fila no se creo", trasElIntento.data.filas.length === 1);

const borrarSinSesion = await orden(null, abierta, "borrar", [agendas.name, deAna.id]);
check("borrar sin cuenta tambien se rechaza", !borrarSinSesion.ok);

console.log("\n11. Con sesion se escribe");
const crearConSesion = await orden<{ id: string }>(beto, abierta, "crear", [
  avisos.name,
  { texto: "De Beto" },
]);
check("una persona invitada guarda", crearConSesion.ok);

const crearComoDueno = await orden<{ id: string }>({ token }, abierta, "crear", [
  avisos.name,
  { texto: "Del constructor" },
]);
check("y quien construye tambien, con su sesion de constructor", crearComoDueno.ok);

/*
 * Una cuenta es de una sola aplicacion. La de otra trae sesion valida y no
 * esta invitada aqui: de una pagina abierta lee lo mismo que quien llega sin
 * cuenta, pero guardar no, o la sesion de cualquier invitado de cualquier
 * aplicacion de la instalacion escribiria en las tablas de esta.
 */
const otraApp = await call<{ id: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: `Otra ${stamp}`, visibility: "private" }),
});
const correoAjeno = `carlos${stamp}@test.com`;
await call(`/api/apps/${otraApp.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: correoAjeno, password: CLAVE, roles: [] }),
});
const ajena = await call<{ token: string }>("/pb/api/collections/members/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: loginFor(otraApp.id, correoAjeno), password: CLAVE }),
});

const leerDesdeOtra = await orden<Lista>(ajena, abierta, "listar", [avisos.name, {}]);
check("una sesion de otra aplicacion lee lo que esta abierto a todos", leerDesdeOtra.ok);

const crearDesdeOtra = await orden(ajena, abierta, "crear", [
  avisos.name,
  { texto: "De otra aplicacion" },
]);
check("pero no guarda aqui", crearDesdeOtra.status === 403);

/* ------------------------------------------------------------------ */
/* La aplicacion que exige iniciar sesion                               */
/* ------------------------------------------------------------------ */

console.log("\n12. La aplicacion pasa a requerir iniciar sesion");
await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ visibility: "private" }),
});

const anonPrivada = await orden(null, abierta, "listar", [agendas.name, {}]);
check("sin cuenta ya no se abre ni la pagina de Todos", anonPrivada.status === 401);

const anaPrivada = await orden<Lista>(ana, abierta, "listar", [agendas.name, { limite: 100 }]);
check("quien esta invitado sigue entrando", anaPrivada.ok);

await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ visibility: "public" }),
});

/* ------------------------------------------------------------------ */
/* Ver la pagina como otro                                              */
/* ------------------------------------------------------------------ */

console.log("\n13. Mirar como un rol, como una persona, sin rol y sin sesion");
const comoOdontologo = await orden<Lista>({ token }, limitada, "listar", [agendas.name, {}], {
  rol: "odontologo",
});
check("como un rol que la pagina admite, se abre", comoOdontologo.ok);

const comoConductor = await orden({ token }, limitada, "listar", [agendas.name, {}], {
  rol: "conductor",
});
check("como un rol que no, se ve lo que veria ese rol: no se abre", comoConductor.status === 403);

const comoAna = await orden<Lista>({ token }, limitada, "listar", [agendas.name, {}], {
  rol: "odontologo",
  persona: ana.id,
});
check("como una persona concreta, tambien se abre", comoAna.ok);

const guardandoComoRol = await orden({ token }, abierta, "crear", [
  avisos.name,
  { texto: "Mirando como odontologo" },
]);
check("y guardar sigue funcionando: la sesion de constructor cuenta", guardandoComoRol.ok);

const sinSesion = await orden({ token }, limitada, "listar", [agendas.name, {}], {
  sinSesion: true,
});
check("mirando sin sesion, una pagina limitada no se abre", sinSesion.status === 403);

const sinSesionAbierta = await orden<Lista>(
  { token },
  abierta,
  "listar",
  [agendas.name, { limite: 100 }],
  { sinSesion: true },
);
check("y una abierta a Todos si", sinSesionAbierta.ok);

const sinRol = await orden({ token }, limitada, "listar", [agendas.name, {}], { sinRol: true });
check("mirando sin ningun rol, una pagina limitada tampoco se abre", sinRol.status === 403);

const sinRolAbierta = await orden<Lista>(
  { token },
  abierta,
  "listar",
  [agendas.name, { limite: 100 }],
  { sinRol: true },
);
check("y una abierta a Todos si: es lo que ve un invitado recien nombrado", sinRolAbierta.ok);

const guardarSinRol = await orden(
  { token },
  abierta,
  "crear",
  [avisos.name, { texto: "Mirando sin rol" }],
  { sinRol: true },
);
check("y guardar sigue funcionando: hay sesion, aunque no haya rol", guardarSinRol.ok);

const guardarSinSesion = await orden<{ codigo?: string }>(
  { token },
  abierta,
  "crear",
  [avisos.name, { texto: "No deberia entrar" }],
  { sinSesion: true },
);
check(
  "pero guardar desde ahi se rechaza como a cualquiera sin cuenta",
  guardarSinSesion.data.codigo === NEEDS_SESSION,
);

const rolInventado = await orden({ token }, abierta, "listar", [agendas.name, {}], {
  rol: "portero",
});
check("un rol que no existe se rechaza", rolInventado.status === 400);

const ajenoMirandoComoOtro = await orden(beto, abierta, "listar", [agendas.name, {}], {
  rol: "odontologo",
});
check("y solo el dueno puede pedir mirar como otro", ajenoMirandoComoOtro.status === 403);

/* ------------------------------------------------------------------ */
/* Quitar un rol de la aplicacion                                       */
/* ------------------------------------------------------------------ */

console.log("\n14. Quitar un rol lo desmarca donde estuviera");
await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ roles: ["conductor", "jefe-de-zona"] }),
});
const tras = await call<{ roles: string[] }>(records("pages", limitada.id));
check("la pagina que lo tenia marcado se queda sin el", !(tras.roles ?? []).includes("odontologo"));
check("y al quedarse sin ninguno vuelve a abrirse a todos", (tras.roles ?? []).length === 0);

const appTras = await call<{ roles: string[] }>(records("apps", app.id));
check("admin no se puede quitar", (appTras.roles ?? []).includes("admin"));

/* ------------------------------------------------------------------ */
/* El camino completo, ya publicado                                     */
/* ------------------------------------------------------------------ */

console.log("\n15. Publicada, todo sigue igual");
await call(`/api/apps/${app.id}/publicar`, { method: "POST", body: JSON.stringify({}) });
const publicada = await call<{ app: { published: boolean }; pages: { id: string }[] }>(
  `/api/public/${app.slug}`,
  {},
  ana.token,
);
check("la aplicacion se publico", publicada.app.published);

const anaPublicada = await orden<Lista>(ana, abierta, "listar", [agendas.name, { limite: 100 }]);
check("y la pagina sigue entregando sus filas", anaPublicada.ok);
check("todas ellas", anaPublicada.data.filas.length === 3);

console.log("\n16. Limpiar");
await call(`/api/apps/${app.id}`, { method: "DELETE" });
await call(`/api/apps/${otraApp.id}`, { method: "DELETE" });
check("app borrada", true);

console.log(failures ? `\n${failures} fallas\n` : "\nTodo bien.\n");
process.exit(failures ? 1 : 0);
