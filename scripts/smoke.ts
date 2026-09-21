/**
 * Prueba de extremo a extremo contra un servidor ya levantado.
 * Uso:  bun run scripts/smoke.ts
 */
import { buildFilter, resolveSource, SourceError } from "../shared/htmlSources.ts";
import { loginFor, PEOPLE_ACCOUNT_FIELD, PEOPLE_TABLE } from "../shared/people.ts";
import {
  type AiConfigView,
  type AppPerson,
  NEEDS_SESSION,
  type TableRecord,
} from "../shared/types.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@planer.local";
const PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "planer-admin-1234";

let token = "";
let failures = 0;

function check(label: string, condition: unknown) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FALLA ${label}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", token);
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return data as T;
}

console.log("\n1. Entrar como constructor");
const auth = await call<{ token: string; record: { id: string } }>(
  "/pb/api/collections/builders/auth-with-password",
  { method: "POST", body: JSON.stringify({ identity: EMAIL, password: PASSWORD }) },
);
token = auth.token;
check("sesion iniciada", !!token);

console.log("\n2. Crear aplicacion");
const app = await call<{ id: string; slug: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: `Directorio de empleados ${Date.now()}` }),
});
check("app creada", !!app.id);

console.log("\n3. Crear tabla con columnas de varios tipos");
const table = await call<{
  id: string;
  dataCollection: string;
  fields: { id?: string; name: string }[];
}>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Empleados",
    fields: [
      { name: "nombre", label: "Nombre", type: "text", required: true },
      { name: "correo", label: "Correo", type: "email" },
      { name: "area", label: "Area", type: "select", options: ["Diseno", "Ventas", "Soporte"] },
      { name: "ingreso", label: "Ingreso", type: "date" },
      { name: "activo", label: "Activo", type: "bool" },
    ],
  }),
});
check("tabla creada", !!table.id);
check("5 columnas", table.fields.length === 5);
check(
  "las columnas tienen id",
  table.fields.every((f) => "id" in f),
);

console.log("\n4. Guardar y leer filas");
await call(`/pb/api/collections/${table.dataCollection}/records`, {
  method: "POST",
  body: JSON.stringify({
    nombre: "Jane Smith",
    correo: "jane@example.com",
    area: "Diseno",
    activo: true,
  }),
});
const rows = await call<{ totalItems: number; items: { nombre: string }[] }>(
  `/pb/api/collections/${table.dataCollection}/records?perPage=10`,
);
check("una fila guardada", rows.totalItems === 1);
check("el dato se lee igual", rows.items[0]?.nombre === "Jane Smith");

console.log("\n5. Anadir una columna sin perder datos");
const grown = await call<{ fields: { name: string }[] }>(`/api/tables/${table.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: [...table.fields, { name: "telefono", label: "Telefono", type: "text" }],
  }),
});
check("6 columnas", grown.fields.length === 6);
const after = await call<{ items: { nombre: string }[] }>(
  `/pb/api/collections/${table.dataCollection}/records?perPage=10`,
);
check("la fila sigue ahi", after.items[0]?.nombre === "Jane Smith");

console.log("\n6. Renombrar una columna conserva su contenido");
const renamed = await call<{ fields: { id?: string; name: string; label: string }[] }>(
  `/api/tables/${table.id}`,
  {
    method: "PATCH",
    body: JSON.stringify({
      fields: grown.fields.map((f) =>
        f.name === "correo" ? { ...f, name: "email_contacto", label: "Email de contacto" } : f,
      ),
    }),
  },
);
check(
  "la columna cambio de nombre",
  renamed.fields.some((f) => f.name === "email_contacto"),
);
const kept = await call<{ items: Record<string, unknown>[] }>(
  `/pb/api/collections/${table.dataCollection}/records?perPage=10`,
);
check("el dato viajo al nuevo nombre", kept.items[0]?.email_contacto === "jane@example.com");

console.log("\n7. Borrar una columna");
const shrunk = await call<{ fields: { id?: string; name: string; label: string }[] }>(
  `/api/tables/${table.id}`,
  {
    method: "PATCH",
    body: JSON.stringify({ fields: renamed.fields.filter((f) => f.name !== "telefono") }),
  },
);
check("quedan 5 columnas", shrunk.fields.length === 5);
check("la columna ya no esta", !shrunk.fields.some((f) => f.name === "telefono"));

console.log("\n8. App sin publicar no se ve");
const hidden = await fetch(`${BASE}/api/public/${app.slug}`);
check("responde 404", hidden.status === 404);

console.log("\n9. Publicar como privada: pide login");
await call(`/api/apps/${app.id}`, { method: "PATCH", body: JSON.stringify({ published: true }) });
const gated = await fetch(`${BASE}/api/public/${app.slug}`).then((r) => r.json());
check("pide identificarse", gated.requiresAuth === true);
check("muestra el nombre para la pantalla de acceso", !!gated.app?.name);

console.log("\n10. Publicar como publica: entra cualquiera");
await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ visibility: "public" }),
});
const open = await fetch(`${BASE}/api/public/${app.slug}`).then((r) => r.json());
check("devuelve el contenido", Array.isArray(open.pages) && Array.isArray(open.tables));
check(
  "trae la pagina de inicio",
  open.pages.some((p: { isHome: boolean }) => p.isHome),
);

// La base ya no le sirve datos a nadie que no sea el constructor, ni siquiera
// en una app abierta: quien mira los pide por la pagina y el servidor decide.
const anon = await fetch(`${BASE}/pb/api/collections/${table.dataCollection}/records`).then(
  (r) => r.json() as Promise<{ items?: unknown[] }>,
);
check("la base no le sirve datos a quien no ha entrado", !anon.items?.length);

console.log("\n11. Historial: lo que se edita no sale hasta publicar");

type Versions = {
  versions: { id: string; number: number; live: boolean; kind: string; pinned: boolean }[];
  hasChanges: boolean;
  liveVersion: string;
};
const publish = () =>
  call<{ version: { id: string } }>(`/api/apps/${app.id}/publicar`, {
    method: "POST",
    body: "{}",
  });
const versionsOf = () => call<Versions>(`/api/apps/${app.id}/versiones`);
const publicPages = () =>
  fetch(`${BASE}/api/public/${app.slug}`)
    .then((r) => r.json() as Promise<{ pages: { slug: string }[] }>)
    .then((b) => b.pages.map((p) => p.slug));

const primeras = await versionsOf();
check("publicar dejo una version en el historial", primeras.versions.length >= 1);
check(
  "y esa version es la que esta en vivo",
  primeras.versions.some((v) => v.live),
);

// Una pagina nueva sin publicar: el enlace publico no debe enterarse.
const borrador = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Sin publicar",
    slug: "sin-publicar",
    icon: "FileText",
    order: 9,
    isHome: false,
  }),
});
check(
  "el enlace publico no muestra lo que no se publico",
  !(await publicPages()).includes("sin-publicar"),
);
check("y el panel avisa de que hay cambios", (await versionsOf()).hasChanges);

await publish();
check("al publicar si aparece", (await publicPages()).includes("sin-publicar"));
check("y deja de haber cambios pendientes", !(await versionsOf()).hasChanges);

// Volver atras: la pagina nueva se va del borrador, pero el enlace publico
// sigue mostrando lo ultimo publicado hasta que se publique otra vez.
const historial = await versionsOf();
const anterior = historial.versions.find((v) => !v.live && v.kind === "publish");
check("hay una version anterior a la que volver", !!anterior);

await call(`/api/apps/${app.id}/versiones/${anterior?.id}/restaurar`, {
  method: "POST",
  body: "{}",
});
const paginasTrasVolver = await call<{ items: { slug: string }[] }>(
  `/pb/api/collections/pages/records?filter=${encodeURIComponent(`app="${app.id}"`)}`,
);
check(
  "restaurar quita del borrador lo que no estaba",
  !paginasTrasVolver.items.some((p) => p.slug === "sin-publicar"),
);
check("y el enlace publico no cambia solo", (await publicPages()).includes("sin-publicar"));

const conVivo = await versionsOf();
const enVivo = conVivo.versions.find((v) => v.live);
const noSeBorra = await fetch(`${BASE}/api/apps/${app.id}/versiones/${enVivo?.id}`, {
  method: "DELETE",
  headers: { authorization: token },
});
check("la version publicada no se puede borrar", noSeBorra.status === 400);

const borrable = conVivo.versions.find((v) => !v.live && !v.pinned);
if (borrable) {
  await call(`/api/apps/${app.id}/versiones/${borrable.id}`, { method: "DELETE" });
  check(
    "una version que no esta en vivo si se borra",
    !(await versionsOf()).versions.some((v) => v.id === borrable.id),
  );
}

await publish();
await call(`/pb/api/collections/pages/records/${borrador.id}`, { method: "DELETE" }).catch(
  () => {},
);

console.log("\n12. Una pagina es un documento HTML");

/** El HTML de una pagina, tal como lo guardaria el editor de codigo. */
const guardarHtml = (pageId: string, content: string, sources?: unknown) =>
  call<{ doc: string; sources: { tableId: string }[]; repuesto: string[]; aviso: string }>(
    `/api/apps/${app.id}/paginas/${pageId}/html`,
    { method: "PUT", body: JSON.stringify({ content, ...(sources ? { sources } : {}) }) },
  );

const paginaDoc = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Listado",
    slug: "listado",
    icon: "FileText",
    order: 8,
    isHome: false,
  }),
});

const columnaArea = shrunk.fields.find((f) => f.name === "area");
const declaradas = [
  {
    name: "equipo",
    tableId: table.id,
    fields: { area: columnaArea?.id ?? "" },
  },
];

const guardada = await guardarHtml(
  paginaDoc.id,
  `<!doctype html><html><head><title>Listado</title></head><body><h1>Listado</h1></body></html>`,
  declaradas,
);
check("guardar la pagina devuelve la huella de su documento", guardada.doc.length === 64);
check("le faltaban las tres referencias y se repusieron", guardada.repuesto.length === 3);
check("y se avisa en vez de cambiarlo a escondidas", guardada.aviso.length > 0);
check("la pagina declara la tabla que puede pedir", guardada.sources[0]?.tableId === table.id);

const servidaPagina = await fetch(`${BASE}/api/apps/${app.id}/paginas/${paginaDoc.id}/html`, {
  headers: { authorization: token },
});
const textoPagina = await servidaPagina.text();
check("la pagina se sirve con la hoja de estilos", textoPagina.includes("/plane/estilos.css"));
check("y con el guion del puente", textoPagina.includes("/plane/puente.js"));
check("y con la fuente de iconos", textoPagina.includes("/plane/iconos.css"));
check("cada referencia lleva su comentario", textoPagina.includes("<!-- Puente de Planer:"));
check("y no lleva el puente pegado dentro", !textoPagina.includes("function enMemoria"));

const crudo = await fetch(`${BASE}/api/apps/${app.id}/paginas/${paginaDoc.id}/html/crudo`, {
  headers: { authorization: token },
}).then((r) => r.text());
check("lo que se edita ya trae las referencias", crudo.includes("/plane/puente.js"));
check(
  "y no crece al volver a guardarlo",
  (await guardarHtml(paginaDoc.id, crudo)).doc === guardada.doc,
);

const sinReferencias = await guardarHtml(
  paginaDoc.id,
  crudo.replace(/<link[^>]*plane\/estilos\.css[^>]*>/i, ""),
);
check("si se borra una referencia, vuelve a ponerse", sinReferencias.repuesto.includes("estilos"));

const paginaSinSesion = await fetch(`${BASE}/api/apps/${app.id}/paginas/${paginaDoc.id}/html`);
check("sin sesion no se sirve la pagina", paginaSinSesion.status === 401);

// Renombrar: la pagina declara la columna por su id, asi que no se entera.
const areaRenombrada = await call<{ fields: { id?: string; name: string; label: string }[] }>(
  `/api/tables/${table.id}`,
  {
    method: "PATCH",
    body: JSON.stringify({
      fields: shrunk.fields.map((f) =>
        f.name === "area" ? { ...f, name: "departamento", label: "Departamento" } : f,
      ),
    }),
  },
);
check(
  "la columna se renombro",
  areaRenombrada.fields.some((f) => f.name === "departamento"),
);

const trasRenombrar = await call<{ doc: string; sources: { fields: Record<string, string> }[] }>(
  `/pb/api/collections/pages/records/${paginaDoc.id}`,
);
check(
  "renombrar una columna no toca el manifiesto de la pagina",
  trasRenombrar.sources[0]?.fields.area === columnaArea?.id,
);
check("ni su documento", trasRenombrar.doc === sinReferencias.doc);

// Borrar la columna: la pagina la sigue declarando, y el puente lo notara.
await call(`/api/tables/${table.id}`, {
  method: "PATCH",
  body: JSON.stringify({ fields: areaRenombrada.fields.filter((f) => f.name !== "departamento") }),
});
const tablaSinArea = await call<TableRecord>(`/pb/api/collections/tables/records/${table.id}`);
check(
  "la columna borrada ya no existe en la tabla",
  !tablaSinArea.fields.some((f) => f.id === columnaArea?.id),
);

await call(`/pb/api/collections/pages/records/${paginaDoc.id}`, { method: "DELETE" });

console.log("\n13. Invitar a una persona");
const invited = await call<{ password?: string }>(`/api/apps/${app.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: `test-${Date.now()}@example.com` }),
});
check("se genero una clave", !!invited.password);

console.log("\n14. Una persona invitada entra; una ajena no");
await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ visibility: "private" }),
});

const invitedEmail = `dentro-${Date.now()}@example.com`;
const inside = await call<{ password?: string }>(`/api/apps/${app.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: invitedEmail }),
});

// Una segunda app con su propio invitado, para comprobar que no se cruzan.
const other = await call<{ id: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: `Otra app ${Date.now()}` }),
});
const outsideEmail = `fuera-${Date.now()}@example.com`;
const outside = await call<{ password?: string }>(`/api/apps/${other.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: outsideEmail }),
});

// La cuenta es de una aplicacion, asi que lo que se identifica lleva delante
// cual. Ver `loginFor` en `shared/people.ts`.
const memberToken = async (appId: string, email: string, password?: string) => {
  const res = await fetch(`${BASE}/pb/api/collections/members/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: loginFor(appId, email), password }),
  });
  const data = await res.json();
  return data.token as string | undefined;
};

const insideToken = await memberToken(app.id, invitedEmail, inside.password);
const outsideToken = await memberToken(other.id, outsideEmail, outside.password);
check("la persona invitada puede identificarse", !!insideToken);

/*
 * Los datos de una app se piden por su pagina, no a la base: el permiso lo
 * aplica el servidor. La base quedo cerrada a todo el que no sea el
 * constructor, asi que preguntarle a ella directamente no devuelve nada.
 */
const paginaDatos = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Equipo",
    slug: "equipo",
    icon: "FileText",
    order: 2,
    isHome: false,
    roles: [],
  }),
});
await call(`/api/apps/${app.id}/paginas/${paginaDatos.id}/html`, {
  method: "PUT",
  body: JSON.stringify({
    content: "<!doctype html><html><body><h1>Equipo</h1></body></html>",
    sources: [
      {
        name: "equipo",
        tableId: table.id,
        fields: Object.fromEntries(shrunk.fields.map((f) => [f.name, f.id ?? ""])),
      },
    ],
  }),
});

/** Una orden de datos de una pagina, con la sesion de quien pregunta. */
const pedirDatos = async (
  pageId: string,
  fuente: string,
  t: string | undefined,
  op = "listar",
  args: unknown[] = [{ limite: 100 }],
) => {
  const headers = new Headers({ "content-type": "application/json" });
  if (t) headers.set("authorization", t);
  const res = await fetch(`${BASE}/api/apps/${app.id}/paginas/${pageId}/datos`, {
    method: "POST",
    headers,
    body: JSON.stringify({ op, args: [fuente, ...args] }),
  });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    body: (text ? JSON.parse(text) : {}) as {
      filas?: Record<string, unknown>[];
      total?: number;
      id?: string;
      /** Que clase de error es, cuando la orden se rechaza. */
      codigo?: string;
    },
  };
};

const readAs = (t?: string) => pedirDatos(paginaDatos.id, "equipo", t);

// La aplicacion acaba de pasar a requerir iniciar sesion: esa frontera tapa a
// todas sus paginas, incluida esta, que esta abierta a Todos.
const anonRead = await readAs();
check("sin cuenta no se ven los datos", anonRead.status === 401);

const insideRead = await readAs(insideToken);
check("la persona invitada ve los datos", insideRead.body.filas?.length === 1);

const outsideRead = await readAs(outsideToken);
check("una persona de otra app no ve nada", (outsideRead.body.filas?.length ?? 0) === 0);

const porLaBase = await fetch(`${BASE}/pb/api/collections/${table.dataCollection}/records`, {
  headers: insideToken ? { authorization: insideToken } : {},
}).then((r) => r.json() as Promise<{ items?: unknown[] }>);
check("y preguntandole a la base directamente no recibe nada", !porLaBase.items?.length);

const bundleAsOutsider = await fetch(`${BASE}/api/public/${app.slug}`, {
  headers: outsideToken ? { authorization: outsideToken } : {},
});
check("una persona de otra app no abre la aplicacion", bundleAsOutsider.status === 403);

await call(`/api/apps/${other.id}`, { method: "DELETE" });

console.log("\n15. Quien abre una pagina alcanza todas sus filas");
type Invite = { access: { member: string }; password?: string };
const invite = (email: string, roles: string[] = []) =>
  call<Invite>(`/api/apps/${app.id}/members`, {
    method: "POST",
    body: JSON.stringify({ email, roles }),
  });

const conductorAEmail = `conductor-a-${Date.now()}@example.com`;
const conductorBEmail = `conductor-b-${Date.now()}@example.com`;
const jefeEmail = `jefe-${Date.now()}@example.com`;
const conductorA = await invite(conductorAEmail);
const conductorB = await invite(conductorBEmail);
const jefe = await invite(jefeEmail);

/*
 * Apuntar a una persona es apuntar a su fila en la tabla de personas: no hay un
 * tipo aparte, y lo que se guarda es el id de esa fila y no el de su cuenta.
 */
const tablasDeLaApp = await call<{ items: TableRecord[] }>(
  `/pb/api/collections/tables/records?perPage=200&filter=${encodeURIComponent(`app="${app.id}"`)}`,
);
const tablaPersonas = tablasDeLaApp.items.find((t) => t.name === PEOPLE_TABLE);
if (!tablaPersonas) throw new Error("la aplicacion tiene que tener su tabla de personas");

const invitadosDeLaApp = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
/** La fila de personas de una cuenta invitada, que es con lo que se enlaza. */
const filaDe = (memberId: string) => invitadosDeLaApp.find((p) => p.id === memberId)?.fila ?? "";

const excesos = await call<{
  id: string;
  dataCollection: string;
  fields: { id?: string; name: string; label: string }[];
}>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Excesos",
    fields: [
      {
        name: "conductor",
        label: "Conductor",
        type: "relation",
        relationTableId: tablaPersonas.id,
        displayField: PEOPLE_ACCOUNT_FIELD,
      },
      { name: "placa", label: "Placa", type: "text" },
    ],
  }),
});

for (const [member, placa] of [
  [conductorA.access.member, "AAA111"],
  [conductorB.access.member, "BBB222"],
]) {
  await call(`/pb/api/collections/${excesos.dataCollection}/records`, {
    method: "POST",
    body: JSON.stringify({ conductor: filaDe(member), placa }),
  });
}

const aToken = await memberToken(app.id, conductorAEmail, conductorA.password);
const bToken = await memberToken(app.id, conductorBEmail, conductorB.password);
const jefeToken = await memberToken(app.id, jefeEmail, jefe.password);

/*
 * Las filas ya no se reparten por quien pregunta: quien puede abrir la pagina
 * alcanza todas las de las tablas que esa pagina declara. Se comprueba por
 * donde se usa de verdad, la ruta de datos de una pagina.
 */
const declararExcesos = async () => {
  const vivas = await call<TableRecord>(`/pb/api/collections/tables/records/${excesos.id}`);
  await call(`/api/apps/${app.id}/paginas/${paginaDatos.id}/html`, {
    method: "PUT",
    body: JSON.stringify({
      content: "<!doctype html><html><body><h1>Equipo</h1></body></html>",
      sources: [
        {
          name: "equipo",
          tableId: table.id,
          fields: Object.fromEntries(shrunk.fields.map((f) => [f.name, f.id ?? ""])),
        },
        {
          name: "excesos",
          tableId: excesos.id,
          fields: Object.fromEntries((vivas.fields ?? []).map((f) => [f.name, f.id ?? ""])),
        },
      ],
    }),
  });
};
await declararExcesos();

const verExcesos = async (t?: string) => {
  const res = await pedirDatos(paginaDatos.id, "excesos", t);
  return { items: (res.body.filas ?? []) as { placa: string }[], ok: res.ok };
};

const verA = await verExcesos(aToken);
check("cada persona alcanza las dos filas", verA.items.length === 2);

const verB = await verExcesos(bToken);
check("la otra tambien", verB.items.length === 2);

const verJefe = await verExcesos(jefeToken);
check("y quien no aparece en ninguna, igual", verJefe.items.length === 2);

const verAnonimo = await verExcesos();
check("sin cuenta no, porque la aplicacion exige entrar", verAnonimo.items.length === 0);

/*
 * La otra frontera, la de escribir, solo se ve en una aplicacion publica: en
 * una que exige entrar, quien llega sin cuenta se queda antes, en la puerta. Se
 * abre un momento para probarla y se vuelve a cerrar.
 */
console.log("\n15b. Guardar exige una cuenta iniciada");
const conVisibilidad = (visibility: "public" | "private") =>
  call(`/api/apps/${app.id}`, { method: "PATCH", body: JSON.stringify({ visibility }) });

await conVisibilidad("public");
const leerSinCuenta = await verExcesos();
check("en una aplicacion publica, sin cuenta se lee", leerSinCuenta.items.length === 2);

const guardarSinCuenta = await pedirDatos(paginaDatos.id, "excesos", undefined, "crear", [
  { conductor: conductorAEmail, placa: "ZZZ999" },
]);
check("pero no se guarda", !guardarSinCuenta.ok);
check("y se dice con un codigo propio", guardarSinCuenta.body.codigo === NEEDS_SESSION);
check("la fila no se creo", (await verExcesos()).items.length === 2);
await conVisibilidad("private");

const propia = await pedirDatos(paginaDatos.id, "excesos", aToken, "crear", [
  { conductor: conductorAEmail, placa: "AAA222" },
]);
check("con cuenta si", propia.ok);

const ajena = await pedirDatos(paginaDatos.id, "excesos", aToken, "crear", [
  { conductor: conductorBEmail, placa: "CCC333" },
]);
check("y se puede guardar a nombre de otro: las filas no son de nadie", ajena.ok);

const personas = await fetch(`${BASE}/api/public/${app.slug}/personas`, {
  headers: aToken ? { authorization: aToken } : {},
}).then((r) => r.json() as Promise<{ id: string }[]>);
check("la app publicada conoce a sus personas", personas.length >= 3);

const personasAnonimo = await fetch(`${BASE}/api/public/${app.slug}/personas`);
check("sin cuenta no se conoce a nadie", personasAnonimo.status === 401);

const renombrada = await call<{ fields: { id?: string; name: string; label: string }[] }>(
  `/api/tables/${excesos.id}`,
  {
    method: "PATCH",
    body: JSON.stringify({
      fields: excesos.fields.map((f) =>
        f.name === "conductor" ? { ...f, name: "responsable", label: "Responsable" } : f,
      ),
    }),
  },
);
check(
  "una columna de persona se renombra sin soltar las reglas de la tabla",
  renombrada.fields.some((f) => f.name === "responsable"),
);
await declararExcesos();
check("y las filas siguen llegando enteras", (await verExcesos(aToken)).items.length === 4);

const sinColumna = await call<{ fields: { name: string }[] }>(`/api/tables/${excesos.id}`, {
  method: "PATCH",
  body: JSON.stringify({ fields: renombrada.fields.filter((f) => f.name !== "responsable") }),
});
check("y borrarla no rompe la tabla", !sinColumna.fields.some((f) => f.name === "responsable"));
await declararExcesos();
check("ni deja de entregar sus filas", (await verExcesos(bToken)).items.length === 4);

console.log("\n16. Roles propios y paginas que solo ven algunos");
await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ roles: ["Conductor", "Supervisor", "  ", "CONDUCTOR"] }),
});
const conRoles = await call<{ roles: string[] }>(`/pb/api/collections/apps/records/${app.id}`);
check(
  "los roles se guardan normalizados, sin repetidos ni vacios",
  conRoles.roles.filter((r) => r !== "admin").join() === "conductor,supervisor",
);
check("y admin sigue estando aunque no se mande", conRoles.roles.includes("admin"));

const accesoDe = async (memberId: string) => {
  const res = await call<{ items: { id: string }[] }>(
    `/pb/api/collections/app_access/records?filter=${encodeURIComponent(
      `app="${app.id}" && member="${memberId}"`,
    )}`,
  );
  return res.items[0].id;
};

const darRoles = (accessId: string, roles: string[]) =>
  call(`/api/members/${accessId}`, { method: "PATCH", body: JSON.stringify({ roles }) });

await darRoles(await accesoDe(conductorA.access.member), ["conductor"]);
await darRoles(await accesoDe(jefe.access.member), ["conductor", "supervisor"]);

/** Una pagina con su HTML dentro, limitada a los roles que se le pasen. */
const nuevaPagina = async (name: string, slug: string, roles: string[]) => {
  const creada = await call<{ id: string }>("/pb/api/collections/pages/records", {
    method: "POST",
    body: JSON.stringify({
      app: app.id,
      name,
      slug,
      icon: "FileText",
      order: 5,
      isHome: false,
      roles,
    }),
  });
  await call(`/api/apps/${app.id}/paginas/${creada.id}/html`, {
    method: "PUT",
    body: JSON.stringify({
      content: `<!doctype html><html><body><h1>${name}</h1></body></html>`,
    }),
  });
  return creada;
};

const paginaFlota = await nuevaPagina("Flota", "flota", ["supervisor"]);
const paginaExcesos = await nuevaPagina("Mis excesos", "mis-excesos", []);

const bundle = (t?: string) =>
  fetch(`${BASE}/api/public/${app.slug}`, { headers: t ? { authorization: t } : {} }).then(
    (r) => r.json() as Promise<{ pages: { id: string; slug: string }[] }>,
  );

/** El HTML de una pagina publicada, con la sesion que se le pase. */
const paginaPublica = (pageId: string, t?: string) =>
  fetch(`${BASE}/api/public/${app.slug}/paginas/${pageId}/html`, {
    headers: t ? { authorization: t } : {},
  });

// El enlace publico sirve lo publicado, asi que las paginas nuevas salen
// despues de publicar.
await publish();
const comoConductor = await bundle(aToken);
check(
  "el conductor no recibe la pagina de la flota",
  !comoConductor.pages.some((p) => p.slug === "flota"),
);
check(
  "pero si la suya",
  comoConductor.pages.some((p) => p.slug === "mis-excesos"),
);
const comoJefe = await bundle(jefeToken);
check(
  "el supervisor si recibe la pagina de la flota",
  comoJefe.pages.some((p) => p.slug === "flota"),
);

// El sidebar es solo el aviso: quien manda es el servidor. Pedir el HTML a
// mano tiene que dar lo mismo que no verla en la lista.
check(
  "el supervisor recibe el HTML de la pagina de la flota",
  (await paginaPublica(paginaFlota.id, jefeToken)).status === 200,
);
check(
  "el conductor no recibe el HTML de esa pagina, aunque la pida a mano",
  (await paginaPublica(paginaFlota.id, aToken)).status === 403,
);
check("sin cuenta tampoco: se pide entrar", (await paginaPublica(paginaFlota.id)).status === 401);
check(
  "y la pagina abierta a cualquiera si llega",
  (await paginaPublica(paginaExcesos.id, aToken)).status === 200,
);

await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ roles: ["conductor"] }),
});
const trasQuitar = await call<{ roles?: string[] }>(
  `/pb/api/collections/pages/records/${paginaFlota.id}`,
);
check("al borrar un rol deja de nombrarse en las paginas", (trasQuitar.roles ?? []).length === 0);
await publish();
const conductorTrasQuitar = await bundle(aToken);
check(
  "y esa pagina vuelve a verla cualquiera",
  conductorTrasQuitar.pages.some((p) => p.slug === "flota"),
);

console.log("\n17. Los ajustes de IA nunca devuelven ninguna clave");
const aiConfig = await call<AiConfigView>("/api/ai/config");
check("responde la configuracion", Array.isArray(aiConfig.providers));
check("no viaja ninguna clave al navegador", !JSON.stringify(aiConfig).includes("apiKey"));
check(
  "informa si cada servidor tiene clave",
  aiConfig.providers.every((p) => typeof p.hasKey === "boolean"),
);
check(
  "dice con que sale una peticion que no elige",
  typeof aiConfig.fallback.thinking === "string",
);

const aiSinSesion = await fetch(`${BASE}/api/ai/config`);
check("sin sesion no se puede consultar", aiSinSesion.status === 401);

console.log("\n18. El documento de una pagina, servido con el puente");

const htmlFuente = `<!doctype html>
<html><head><style>:root {
  --bg: #101010; --panel: #1c1c1c; --texto: #ffffff; --linea: #333333; --marca: #e5a50a;
}</style></head>
<body>
<h1>Inventario</h1>
<script>
var equipos = [
  { codigo: "BIO-001", nombre: "Turbina", estado: "Operativo", meses: 6 },
  { codigo: "BIO-002", nombre: "Compresor", estado: "En mantenimiento", meses: 12 }
];
function guardar(datos) { localStorage.setItem("inv", JSON.stringify(datos)); }
</script>
</body></html>`;

/*
 * Un HTML entra por la pagina que va a tenerlo --que es la unica puerta desde
 * que se retiro la varita-- y lo que devuelve es su huella. De ahi en adelante
 * el documento se pide por esa huella.
 */
const paginaFuente = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Inventario",
    slug: "inventario",
    icon: "FileText",
    order: 8,
    isHome: false,
  }),
});
const guardado = await call<{ doc: string }>(
  `/api/apps/${app.id}/paginas/${paginaFuente.id}/html`,
  { method: "PUT", body: JSON.stringify({ content: htmlFuente }) },
);
check("guardar el HTML devuelve la huella del documento", guardado.doc.length === 64);

const mismoDoc = await call<{ doc: string }>(
  `/api/apps/${app.id}/paginas/${paginaFuente.id}/html`,
  { method: "PUT", body: JSON.stringify({ content: htmlFuente }) },
);
check("el mismo contenido comparte huella", mismoDoc.doc === guardado.doc);

/*
 * El HTML de una pagina tambien se pide por huella. Es lo que necesita la
 * vista previa de una version: la fotografia guarda la huella de entonces, y
 * pedir por la pagina traeria siempre el borrador.
 */
// Publicar primero: la version es la que sostiene el documento cuando la
// pagina deja de nombrarlo.
await publish();
await call(`/api/apps/${app.id}/paginas/${paginaFuente.id}/html`, {
  method: "PUT",
  body: JSON.stringify({
    content: "<!doctype html><html><body><h1>Inventario nuevo</h1></body></html>",
  }),
});
const ahora = await fetch(`${BASE}/api/apps/${app.id}/paginas/${paginaFuente.id}/html`, {
  headers: { authorization: token },
}).then((r) => r.text());
check("pedir por la pagina trae lo que tiene ahora", ahora.includes("<h1>Inventario nuevo</h1>"));

const porHuella = await fetch(
  `${BASE}/api/apps/${app.id}/paginas/${paginaFuente.id}/html/${guardado.doc}`,
  { headers: { authorization: token } },
);
const textoPorHuella = await porHuella.text();
check(
  "pedir por huella trae lo que tenia entonces",
  textoPorHuella.includes("<h1>Inventario</h1>"),
);
check("y llega envuelto como una pagina", textoPorHuella.includes("/plane/puente.js"));

const huellaInventada = await fetch(
  `${BASE}/api/apps/${app.id}/paginas/${paginaFuente.id}/html/${"0".repeat(64)}`,
  { headers: { authorization: token } },
);
check("una huella que no existe no se sirve", huellaInventada.status === 404);

// Se deja como estaba: lo que sigue cuenta con que la pagina nombra `guardado`.
await call(`/api/apps/${app.id}/paginas/${paginaFuente.id}/html`, {
  method: "PUT",
  body: JSON.stringify({ content: htmlFuente }),
});

const servido2 = await fetch(`${BASE}/api/apps/${app.id}/html/${guardado.doc}`, {
  headers: { authorization: token },
});
const servidoTexto = await servido2.text();
check("el documento se sirve envuelto con el puente", servidoTexto.includes("window.plane"));
check("y conserva lo que trajo", servidoTexto.includes("<h1>Inventario</h1>"));
check("el puente sustituye el almacenamiento del navegador", servidoTexto.includes("enMemoria"));

const sinSesion = await fetch(`${BASE}/api/apps/${app.id}/html/${guardado.doc}`);
check("sin sesion no se sirve el documento", sinSesion.status === 401);

// La marca junta la huella del contenido y la del puente. Sin la segunda,
// una correccion del puente no llegaria a ningun documento ya guardado.
const marca = servido2.headers.get("etag") ?? "";
check("la marca incluye la huella del contenido", marca.includes(guardado.doc));
check("y tambien la del puente", marca.replace(guardado.doc, "").length > 3);
check(
  "el documento se revalida en vez de guardarse para siempre",
  !/immutable/.test(servido2.headers.get("cache-control") ?? ""),
);

const revalidado = await fetch(`${BASE}/api/apps/${app.id}/html/${guardado.doc}`, {
  headers: { authorization: token, "if-none-match": marca },
});
check("si no cambio nada, no se vuelve a mandar el cuerpo", revalidado.status === 304);

/*
 * Un archivo hecho para vivir suelto: comprueba su sesion y se va a su
 * pantalla de acceso si no la encuentra. Dentro del marco el almacenamiento
 * arranca vacio, asi que se iria siempre.
 */
const htmlConGuardia = `<!doctype html>
<html><head></head><body>
<h1>Panel</h1>
<a href="/salir">Salir</a>
<script>
var RAIZ = "https://ejemplo.invalid";
var token = localStorage.getItem("tk");
if (!token) { location.href = RAIZ; }
</script>
</body></html>`;

/*
 * En otra pagina, no encima de la anterior: guardar sobre una pagina retira el
 * documento que dejaba de nombrar, y el de arriba todavia hace falta.
 */
const paginaGuardia = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Guardia",
    slug: "guardia",
    icon: "FileText",
    order: 9,
    isHome: false,
  }),
});
const guardia = await call<{ doc: string }>(
  `/api/apps/${app.id}/paginas/${paginaGuardia.id}/html`,
  { method: "PUT", body: JSON.stringify({ content: htmlConGuardia }) },
);
const servidoGuardia = await fetch(`${BASE}/api/apps/${app.id}/html/${guardia.doc}`, {
  headers: { authorization: token },
});
const guardiaTexto = await servidoGuardia.text();
check("un contenido que se va se sigue sirviendo entero", guardiaTexto.includes("<h1>Panel</h1>"));
check(
  "y llega con la vuelta atras puesta: el puente avisa al salir",
  guardiaTexto.includes('plane: "nav"') && guardiaTexto.includes("pagehide"),
);
check(
  "los enlaces que sacan del documento se paran dentro del marco",
  guardiaTexto.includes('avisarSalida("bloqueado"'),
);

const grande = await fetch(`${BASE}/api/apps/${app.id}/paginas/${paginaGuardia.id}/html`, {
  method: "PUT",
  headers: { "content-type": "application/json", authorization: token },
  body: JSON.stringify({ content: "x".repeat(2_100_000) }),
});
check("un archivo demasiado grande se rechaza", grande.status === 400);

const contrato = await call<{ text: string }>(`/api/apps/${app.id}/html/contrato`, {
  method: "POST",
  body: JSON.stringify({ tableIds: [table.id] }),
});
check("el contrato describe las ordenes de datos", contrato.text.includes("plane.listar"));
check(
  "y nombra la tabla elegida",
  contrato.text.includes(table.dataCollection.split("_").pop() ?? ""),
);

const contratoVacio = await call<{ text: string }>(`/api/apps/${app.id}/html/contrato`, {
  method: "POST",
  body: JSON.stringify({ tableIds: [] }),
});
check(
  "sin tablas elegidas sigue trayendo los colores",
  contratoVacio.text.includes("--surface-card"),
);
// El contrato va en ingles y la pantalla que sale de el, en espanol: si esa
// regla se cae, las paginas empiezan a salir con los titulos en ingles.
check(
  "y va en ingles pidiendo que lo escrito salga en espanol",
  contratoVacio.text.includes("Everything you produce is written in Spanish"),
);

// Las dos paginas de arriba ya cumplieron. Se borran --borrar una pagina no
// retira su documento-- para que lo que sigue mida lo que quiere medir: un
// documento vive mientras alguien lo nombre, y a partir de aqui solo lo nombra
// el tablero.
for (const id of [paginaFuente.id, paginaGuardia.id]) {
  await call(`/pb/api/collections/pages/records/${id}`, { method: "DELETE" });
}

const paginaHtml = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Tablero",
    slug: "tablero",
    icon: "FileText",
    order: 9,
    isHome: false,
    // La pagina guarda la huella, nunca el contenido: asi el historial no
    // engorda y el paquete publico no arrastra el archivo entero.
    doc: guardado.doc,
    sources: [
      {
        name: "equipos",
        tableId: table.id,
        fields: { nombre: table.fields.find((f) => f.name === "nombre")?.id ?? "" },
      },
    ],
  }),
});
await publish();

const conTablero = await bundle(jefeToken);
const tablero = conTablero.pages.find((p) => p.slug === "tablero") as { doc?: string } | undefined;
check("el paquete publico lleva la huella", tablero?.doc === guardado.doc);
check("y no lleva el contenido", !JSON.stringify(conTablero).includes("<h1>Inventario</h1>"));

// La app es privada a estas alturas: el HTML de la pagina sigue las mismas
// reglas que el paquete, ni mas abiertas ni mas cerradas.
const tableroServido = await paginaPublica(paginaHtml.id, jefeToken);
check("quien tiene acceso a la app recibe la pagina", tableroServido.status === 200);
check(
  "y llega con las referencias puestas",
  (await tableroServido.text()).includes("/plane/puente.js"),
);
check("sin cuenta no se recibe la pagina", (await paginaPublica(paginaHtml.id)).status === 401);

// Renombrar una columna: la pagina la declara por su id, asi que no se entera.
const antesDeRenombrar = table.fields.find((f) => f.name === "nombre");
await call(`/api/tables/${table.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: (
      await call<{ fields: { id?: string; name: string; label: string }[] }>(
        `/pb/api/collections/tables/records/${table.id}`,
      )
    ).fields.map((f) => (f.id === antesDeRenombrar?.id ? { ...f, name: "titulo" } : f)),
  }),
});
const trasRenombrarHtml = await call<{ sources?: { fields: Record<string, string> }[] }>(
  `/pb/api/collections/pages/records/${paginaHtml.id}`,
);
check(
  "renombrar una columna no toca el manifiesto",
  trasRenombrarHtml.sources?.[0].fields.nombre === antesDeRenombrar?.id,
);

// Lo que una pagina puede pedir se decide antes de tocar la base. Se prueba
// la misma pieza que usa el puente, no una copia.
const tablaViva = await call<TableRecord>(`/pb/api/collections/tables/records/${table.id}`);
const fuentes = [
  {
    name: "equipos",
    tableId: table.id,
    fields: { titulo: tablaViva.fields.find((f) => f.name === "titulo")?.id ?? "" },
  },
];

check(
  "una fuente no declarada se rechaza",
  (() => {
    try {
      resolveSource(fuentes, [tablaViva], "sueldos");
      return false;
    } catch (err) {
      return err instanceof SourceError;
    }
  })(),
);

const resuelta = resolveSource(fuentes, [tablaViva], "equipos");
check(
  "una columna no declarada se rechaza",
  (() => {
    try {
      buildFilter(resuelta, { filtro: { salario: 100 } });
      return false;
    } catch (err) {
      return err instanceof SourceError;
    }
  })(),
);
check(
  "el filtro se compone con la columna de verdad",
  buildFilter(resuelta, { filtro: { titulo: "Ana" } }) === 'titulo = "Ana"',
);

// Una tabla que declara una columna de persona no reparte nada: quien puede
// abrir la pagina alcanza todas sus filas, y salen con el nombre que la pagina
// declaro para cada columna.
const partes = await call<{
  id: string;
  dataCollection: string;
  fields: { id?: string; name: string }[];
}>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Partes",
    fields: [
      {
        name: "autor",
        label: "Autor",
        type: "relation",
        relationTableId: tablaPersonas.id,
        displayField: PEOPLE_ACCOUNT_FIELD,
      },
      { name: "detalle", label: "Detalle", type: "text" },
    ],
  }),
});
for (const [member, detalle] of [
  [conductorA.access.member, "parte de A"],
  [conductorB.access.member, "parte de B"],
]) {
  await call(`/pb/api/collections/${partes.dataCollection}/records`, {
    method: "POST",
    body: JSON.stringify({ autor: filaDe(member), detalle }),
  });
}

await call(`/api/apps/${app.id}/paginas/${paginaDatos.id}/html`, {
  method: "PUT",
  body: JSON.stringify({
    content: "<!doctype html><html><body><h1>Equipo</h1></body></html>",
    sources: [
      {
        name: "partes",
        tableId: partes.id,
        fields: { detalle: partes.fields.find((f) => f.name === "detalle")?.id ?? "" },
      },
    ],
  }),
});
const pedido = await pedirDatos(paginaDatos.id, "partes", aToken);
check("desde una pagina se alcanzan todas las filas", pedido.body.filas?.length === 2);
check(
  "y salen solo con la columna que declaro la pagina",
  pedido.body.filas?.[0] !== undefined && !("autor" in pedido.body.filas[0]),
);

// El documento se conserva mientras alguien lo nombre, y desaparece cuando
// deja de nombrarlo nadie.
await call(`/pb/api/collections/pages/records/${paginaHtml.id}`, {
  method: "PATCH",
  body: JSON.stringify({ doc: "" }),
});
await publish();

// Mientras una version vieja lo nombre, el documento se conserva.
const conVersionesViejas = await fetch(`${BASE}/api/apps/${app.id}/html/${guardado.doc}`, {
  headers: { authorization: token },
});
check("una version antigua conserva su documento", conVersionesViejas.status === 200);

const versionesAntesDelRecorte = await versionsOf();
for (const v of versionesAntesDelRecorte.versions.filter((x) => !x.live)) {
  await fetch(`${BASE}/api/apps/${app.id}/versiones/${v.id}`, {
    method: "DELETE",
    headers: { authorization: token },
  });
}
const trasRecorte = await fetch(`${BASE}/api/apps/${app.id}/html/${guardado.doc}`, {
  headers: { authorization: token },
});
check("un documento que ya no nombra nadie se elimina", trasRecorte.status === 404);

console.log("\n18b. Borrar una pagina se lleva sus conversaciones y su constancia");

/*
 * La limpieza no la hace ninguna ruta: la hacen las relaciones en cascada de
 * `ai_chats.page` y `ai_debug.page`. Por eso se borra la pagina por donde la
 * borra el panel --directo contra la base-- y se mira si lo suyo se fue con
 * ella.
 *
 * Hace falta una peticion de verdad para que haya algo que borrar, asi que sin
 * servidor de IA conectado no hay nada que comprobar aqui.
 */
if (!aiConfig.enabled) {
  console.log("  --   sin servidor de IA conectado: no hay conversaciones que crear");
} else {
  const efimera = await call<{ id: string }>("/pb/api/collections/pages/records", {
    method: "POST",
    body: JSON.stringify({
      app: app.id,
      name: "Se va a borrar",
      slug: "se-va-a-borrar",
      icon: "file-01",
      order: 90,
      isHome: false,
    }),
  });

  // Se consume el hilo de avisos hasta el final: la conversacion se guarda al
  // cerrar el turno, no al empezarlo.
  const hilo = await fetch(`${BASE}/api/apps/${app.id}/paginas/${efimera.id}/ia`, {
    method: "POST",
    headers: { authorization: token, "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Pon un título que diga Hola." }),
  });
  await hilo.text();

  const antes = await call<{ id: string }[]>(
    `/api/apps/${app.id}/conversaciones?pagina=${efimera.id}`,
  );
  const constancia = await call<{ id: string } | null>(
    `/api/apps/${app.id}/paginas/${efimera.id}/ia/depuracion`,
  );
  check("la pagina tiene su conversacion", antes.length > 0);
  check("y su constancia de depuracion", !!constancia);

  await call(`/pb/api/collections/pages/records/${efimera.id}`, { method: "DELETE" });

  const despues = await call<{ id: string }[]>(
    `/api/apps/${app.id}/conversaciones?pagina=${efimera.id}`,
  );
  const sinConstancia = await call<{ id: string } | null>(
    `/api/apps/${app.id}/paginas/${efimera.id}/ia/depuracion`,
  );
  check("borrar la pagina se llevo sus conversaciones", despues.length === 0);
  check("y su constancia de depuracion", sinConstancia === null);
}

console.log("\n19. Borrar la aplicacion");
await call(`/api/apps/${app.id}`, { method: "DELETE" });
const gone = await fetch(`${BASE}/pb/api/collections/${table.dataCollection}/records`);
check("la tabla de datos desaparecio", gone.status === 404);

console.log(failures === 0 ? "\nTodo bien.\n" : `\n${failures} comprobaciones fallaron.\n`);
process.exit(failures === 0 ? 0 : 1);
