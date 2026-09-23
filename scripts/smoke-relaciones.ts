/**
 * Prueba de extremo a extremo de las relaciones por llave.
 * Uso:  bun run scripts/smoke-relaciones.ts
 *
 * Comprueba lo que no se puede comprobar leyendo el código: que una columna
 * definida ocupa de verdad dos columnas reales, que un valor que no encuentra
 * dueno no tumba la fila, y que corregir la llave en el destino se propaga sin
 * tocar las filas enlazadas.
 */
import { PEOPLE_ACCOUNT_FIELD, PEOPLE_TABLE } from "../shared/people.ts";
import {
  type Lookup,
  matchValues,
  relationCellValues,
  relationTarget,
} from "../shared/relations.ts";
import {
  type AppPerson,
  type AppRecord,
  orphanFieldName,
  type PageRecord,
  type TableRecord,
} from "../shared/types.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@planer.local";
const PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "planer-admin-1234";
/**
 * PocketBase, sin pasar por el proxy.
 *
 * El proxy `/pb/` solo deja pasar registros, sesiones y archivos: la sesión de
 * superusuario y los esquemas se piden a la base directamente, que es donde el
 * servidor también los pide. Ver `publicPbPath` en `server/index.ts`.
 */
const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";

let token = "";
let failures = 0;

function check(label: string, condition: unknown) {
  if (condition) console.log(`  ok   ${label}`);
  else {
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
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

const records = (collection: string, id = "") =>
  `/pb/api/collections/${collection}/records${id ? `/${id}` : ""}`;

console.log("\n1. Entrar y crear la aplicacion");
const auth = await call<{ token: string }>("/pb/api/collections/builders/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
});
token = auth.token;
const app = await call<{ id: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: `Transito ${Date.now()}` }),
});
check("app creada", !!app.id);

console.log("\n2. Tabla destino, con una columna que no se repite");
const conductores = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Conductores",
    fields: [
      { name: "documento", label: "Documento", type: "text", unique: true },
      { name: "nombre", label: "Nombre", type: "text" },
    ],
  }),
});
check("tabla destino creada", !!conductores.id);

console.log("\n3. La marca de unica llega a la base como indice");
// Se comprueba por su efecto y no leyendo el esquema: la definicion de una
// colección solo la lee un superusuario, y aquí hay una sesión de constructor.
await call(records(conductores.dataCollection), {
  method: "POST",
  body: JSON.stringify({ documento: "1098765432", nombre: "Ana Ruiz" }),
});
let rejected = false;
await call(records(conductores.dataCollection), {
  method: "POST",
  body: JSON.stringify({ documento: "1098765432", nombre: "Otro" }),
}).catch(() => {
  rejected = true;
});
check("la base rechaza el documento repetido", rejected);

console.log("\n4. Tabla con una columna de relacion que declara que ensena");
const multas = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Multas",
    fields: [
      { name: "acta", label: "Acta", type: "text" },
      { name: "exceso", label: "Exceso", type: "number" },
      {
        name: "conductor",
        label: "Conductor",
        type: "relation",
        relationTableId: conductores.id,
        displayField: "documento",
      },
    ],
  }),
});
// Las dos columnas reales se comprueban escribiendo en ellas: si la del valor
// sin dueno no existiera, PocketBase rechazaria el campo desconocido.
const prueba = await call<Record<string, unknown>>(records(multas.dataCollection), {
  method: "POST",
  body: JSON.stringify({ acta: "PRUEBA", [orphanFieldName("conductor")]: "0000" }),
});
check("la columna del valor sin dueno existe", prueba[orphanFieldName("conductor")] === "0000");
check("y la de la relacion tambien, vacia", prueba.conductor === "");
await call(records(multas.dataCollection, String(prueba.id)), { method: "DELETE" });

console.log("\n5. Emparejar un archivo: unos valores casan y otros no");
const lookup: Lookup = {
  find: async (collection, filter) => {
    const res = await call<{ items: Record<string, unknown>[] }>(
      `${records(collection)}?perPage=200&filter=${encodeURIComponent(filter)}`,
    );
    return res.items;
  },
  people: async () => [],
};

const tables = [conductores, multas];
const conductorField = multas.fields.find((f) => f.name === "conductor");
if (!conductorField) throw new Error("la columna de relacion no se creo");
const target = relationTarget(conductorField, tables);
if (!target) throw new Error("la columna de relacion no apunta a ninguna tabla");
check("la llave propuesta es la que ensena", target.key === "documento");

const archivo = [
  { acta: "A-1", exceso: 20, conductor: "1098765432" },
  { acta: "A-2", exceso: 35, conductor: "9999999999" },
  { acta: "A-3", exceso: 12, conductor: "9999999999" },
];
const matches = await matchValues(
  target,
  archivo.map((r) => r.conductor),
  lookup,
);
check("el documento que existe encontro registro", !!matches.get("1098765432")?.id);
check("el que no existe no encontro ninguno", !matches.get("9999999999")?.id);

console.log("\n6. Todas las filas entran, casen o no");
for (const fila of archivo) {
  const match = matches.get(fila.conductor) ?? { id: "", value: fila.conductor };
  await call(records(multas.dataCollection), {
    method: "POST",
    body: JSON.stringify({
      acta: fila.acta,
      exceso: fila.exceso,
      ...relationCellValues(conductorField, match),
    }),
  });
}
const guardadas = await call<{ items: Record<string, unknown>[]; totalItems: number }>(
  `${records(multas.dataCollection)}?perPage=50&expand=conductor`,
);
check("entraron las tres filas", guardadas.totalItems === 3);

const conEnlace = guardadas.items.filter((r) => r.conductor);
const sinEnlace = guardadas.items.filter((r) => !r.conductor);
check("una quedo enlazada", conEnlace.length === 1);
check("dos quedaron sin enlace", sinEnlace.length === 2);
check(
  "las de sin enlace conservan su valor a la vista",
  sinEnlace.every((r) => r[orphanFieldName("conductor")] === "9999999999"),
);
check(
  "y las dos columnas nunca estan llenas a la vez",
  guardadas.items.every((r) => !(r.conductor && r[orphanFieldName("conductor")])),
);

console.log("\n7. Agrupar por el valor cuadra con el total de la tabla");
const porValor = new Map<string, number>();
for (const fila of guardadas.items) {
  const expand = (fila.expand as Record<string, Record<string, unknown>> | undefined)?.conductor;
  const valor = expand
    ? String(expand.documento)
    : String(fila[orphanFieldName("conductor")] ?? "");
  porValor.set(valor, (porValor.get(valor) ?? 0) + 1);
}
const sumado = [...porValor.values()].reduce((a, b) => a + b, 0);
check("ninguna fila se cae del recuento", sumado === guardadas.totalItems);
check("los valores sin enlace suman con el suyo", porValor.get("9999999999") === 2);

console.log("\n8. Corregir la llave en el destino se propaga solo");
const conductor = await call<{ items: { id: string }[] }>(
  `${records(conductores.dataCollection)}?perPage=1`,
);
const conductorId = String(conductor.items[0]?.id ?? "");
await call(records(conductores.dataCollection, conductorId), {
  method: "PATCH",
  body: JSON.stringify({ documento: "1000000001" }),
});
const trasCorregir = await call<{ items: Record<string, unknown>[] }>(
  `${records(multas.dataCollection)}?perPage=50&expand=conductor&filter=${encodeURIComponent('acta = "A-1"')}`,
);
const expandido = (trasCorregir.items[0]?.expand as Record<string, Record<string, unknown>>)
  ?.conductor;
check("la fila enlazada ensena el valor corregido", expandido?.documento === "1000000001");
check("sin que nadie tocara la fila", trasCorregir.items[0]?.conductor === conductorId);

console.log("\n9. Crear el registro que faltaba enlaza sus filas de una vez");
const nuevo = await call<{ id: string }>(records(conductores.dataCollection), {
  method: "POST",
  body: JSON.stringify({ documento: "9999999999", nombre: "Luis Pena" }),
});
const esperando = await call<{ items: { id: string }[] }>(
  `${records(multas.dataCollection)}?perPage=50&filter=${encodeURIComponent(`${orphanFieldName("conductor")} = "9999999999"`)}`,
);
check("dos filas lo estaban esperando", esperando.items.length === 2);
for (const fila of esperando.items) {
  await call(records(multas.dataCollection, fila.id), {
    method: "PATCH",
    body: JSON.stringify({ conductor: nuevo.id, [orphanFieldName("conductor")]: "" }),
  });
}
const finales = await call<{ items: Record<string, unknown>[] }>(
  `${records(multas.dataCollection)}?perPage=50&expand=conductor`,
);
check(
  "ya no queda ninguna fila sin enlace",
  finales.items.every((r) => !r[orphanFieldName("conductor")]),
);
check(
  "y todas ensenan el documento de su conductor",
  finales.items.every(
    (r) => !!(r.expand as Record<string, Record<string, unknown>>)?.conductor?.documento,
  ),
);

console.log("\n10. Ida y vuelta: lo exportado vuelve a emparejarse");
const exportado = finales.items.map((r) => ({
  acta: String(r.acta),
  conductor: String(
    (r.expand as Record<string, Record<string, unknown>>)?.conductor?.documento ?? "",
  ),
}));
const reimportado = await matchValues(
  target,
  exportado.map((r) => r.conductor),
  lookup,
);
check(
  "cada valor exportado vuelve a encontrar su registro",
  exportado.every((r) => !!reimportado.get(r.conductor)?.id),
);

console.log("\n11. Una columna que apunta a personas se ancla a la fila, no a la cuenta");
/*
 * Es la diferencia que este cambio vino a borrar. Antes había dos anclas para
 * la misma persona --la fila del destino en una relación, la cuenta en una
 * columna de persona-- y la del medio decidia cosas que si se ven. Ahora hay
 * una: el id de la fila de la tabla de personas, como en cualquier relación.
 */
const invitado = await call<{ email: string }>(`/api/apps/${app.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: "pepito@test.com", name: "Pepito" }),
});
check("invitado creado", invitado.email === "pepito@test.com");

const appTables = await call<{ items: TableRecord[] }>(
  `/pb/api/collections/tables/records?perPage=200&filter=${encodeURIComponent(`app="${app.id}"`)}`,
);
const personas = appTables.items.find((t) => t.name === PEOPLE_TABLE);
if (!personas) throw new Error("la aplicacion tiene que tener su tabla de personas");
check("la tabla de personas esta entre las tablas de la aplicacion", !!personas.id);

const invitados = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
const pepito = invitados.find((p) => p.email === "pepito@test.com");
check("la lista de invitados lo trae", !!pepito);
check("y trae el id de su fila, que es con lo que se enlaza", !!pepito?.fila);

// La fila de personas de Pepito, leida de la colección de la tabla: es de donde
// tiene que salir el id que se guarda en la celda.
const filasPersonas = await call<{ items: Record<string, unknown>[] }>(
  `${records(personas.dataCollection)}?perPage=200`,
);
const filaPepito = filasPersonas.items.find((r) => String(r.id) === pepito?.fila);
check("esa fila existe de verdad en la tabla de personas", !!filaPepito);
check("y no es el id de la cuenta", pepito?.fila !== pepito?.id);

// La cédula de Pepito, para poder emparejar por una llave que no es el correo.
await call(records(personas.dataCollection, String(pepito?.fila ?? "")), {
  method: "PATCH",
  body: JSON.stringify({ nombre: "Pepito Perez" }),
});

const reportes = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Reportes",
    fields: [
      { name: "titulo", label: "Titulo", type: "text" },
      {
        name: "quien",
        label: "Quien",
        type: "relation",
        relationTableId: personas.id,
        displayField: PEOPLE_ACCOUNT_FIELD,
      },
    ],
  }),
});
await call(records(reportes.dataCollection), {
  method: "POST",
  body: JSON.stringify({ titulo: "R-1", quien: pepito?.fila }),
});
const conPersona = await call<{ items: Record<string, unknown>[] }>(
  `${records(reportes.dataCollection)}?perPage=10&expand=quien`,
);
const filaReporte = conPersona.items[0] ?? {};
check("la celda guarda el id de la fila de personas", filaReporte.quien === pepito?.fila);
check("y no el de la cuenta", filaReporte.quien !== pepito?.id);
check(
  "el registro enlazado viene con el expand de la base, como cualquier relacion",
  !!(filaReporte.expand as Record<string, Record<string, unknown>> | undefined)?.quien,
);

console.log("\n12. Dos tablas apuntando a personas por llaves distintas");
/*
 * Es el caso que tumbo el ancla a la cuenta: chequeos empareja por el correo y
 * excesos por el documento, y ninguna de las dos tiene delante el id de nadie.
 * Lo que las une a la persona es el valor.
 */
await call(`/api/tables/${personas.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: [
      ...personas.fields,
      { name: "documento", label: "Documento", type: "text", unique: true },
    ],
  }),
});
await call(records(personas.dataCollection, String(pepito?.fila ?? "")), {
  method: "PATCH",
  body: JSON.stringify({ documento: "80808080" }),
});

const conLlaves = (
  await call<{ items: TableRecord[] }>(
    `/pb/api/collections/tables/records?perPage=200&filter=${encodeURIComponent(
      `app="${app.id}"`,
    )}`,
  )
).items;
const personasConDoc = conLlaves.find((t) => t.name === PEOPLE_TABLE);
if (!personasConDoc) throw new Error("la tabla de personas no puede desaparecer");

const invitadosConDoc = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
const peopleLookup: Lookup = { ...lookup, people: async () => invitadosConDoc };

const porCorreo = relationTarget(
  {
    name: "quien",
    label: "Quien",
    type: "relation",
    relationTableId: personasConDoc.id,
    displayField: PEOPLE_ACCOUNT_FIELD,
  },
  conLlaves,
);
const porDocumento = relationTarget(
  {
    name: "responsable",
    label: "Responsable",
    type: "relation",
    relationTableId: personasConDoc.id,
    displayField: "documento",
  },
  conLlaves,
);
if (!porCorreo || !porDocumento) throw new Error("las dos columnas tienen destino");
check("una empareja por el correo", porCorreo.key === PEOPLE_ACCOUNT_FIELD);
check("y la otra por el documento", porDocumento.key === "documento");

const desdeCorreo = await matchValues(porCorreo, ["pepito@test.com"], peopleLookup);
const desdeDocumento = await matchValues(porDocumento, ["80808080"], peopleLookup);
check(
  "el correo encuentra su fila de personas",
  desdeCorreo.get("pepito@test.com")?.id === pepito?.fila,
);
check(
  "el documento encuentra la misma fila, por su propia llave",
  desdeDocumento.get("80808080")?.id === pepito?.fila,
);

const ajeno = await matchValues(porCorreo, ["ajeno@example.com"], {
  ...peopleLookup,
  // Nadie de fuera esta invitado aquí: no puede casar con ninguna fila.
  people: async () => [],
});
check("un correo de fuera no encuentra a nadie", !ajeno.get("ajeno@example.com")?.id);

console.log("\n13. Borrar lo apuntado conserva el valor, por los tres caminos");

/** Lo que una fila de multas dice de su conductor: enlace y valor sin dueno. */
async function multaDe(id: string) {
  const row = await call<Record<string, unknown>>(records(multas.dataCollection, id));
  return {
    enlace: String(row.conductor ?? ""),
    sinEnlace: String(row[orphanFieldName("conductor")] ?? ""),
  };
}

// Un conductor recien puesto y una multa suya, para no depender de lo anterior.
const aBorrar = await call<{ id: string }>(records(conductores.dataCollection), {
  method: "POST",
  body: JSON.stringify({ documento: "5150000", nombre: "Rosa Lima" }),
});
const suMulta = await call<{ id: string }>(records(multas.dataCollection), {
  method: "POST",
  body: JSON.stringify({ acta: "A-500", conductor: aBorrar.id }),
});

// Camino 1: la cuadricula, que ya no llama a la base sino al servidor.
await call(`/api/tables/${conductores.id}/filas/borrar`, {
  method: "POST",
  body: JSON.stringify({ ids: [aBorrar.id] }),
});
const trasCuadricula = await multaDe(suMulta.id);
check("la cuadricula: la fila sigue ahi y sin enlace", trasCuadricula.enlace === "");
check("y ensena el documento que ensenaba", trasCuadricula.sinEnlace === "5150000");

// Camino 2: la orden `borrar` de una página publicada.
const otro = await call<{ id: string }>(records(conductores.dataCollection), {
  method: "POST",
  body: JSON.stringify({ documento: "5160000", nombre: "Luis Paz" }),
});
const multaDelOtro = await call<{ id: string }>(records(multas.dataCollection), {
  method: "POST",
  body: JSON.stringify({ acta: "A-501", conductor: otro.id }),
});
const pagina = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Conductores",
    slug: "conductores",
    icon: "FileText",
    order: 1,
    isHome: false,
    roles: [],
  }),
});
const conductoresFrescos = await call<{ items: TableRecord[] }>(
  `/pb/api/collections/tables/records?perPage=200&filter=${encodeURIComponent(`app="${app.id}"`)}`,
);
const conductoresDef = conductoresFrescos.items.find((t) => t.id === conductores.id);
await call(`/api/apps/${app.id}/paginas/${pagina.id}/html`, {
  method: "PUT",
  body: JSON.stringify({
    content: "<!doctype html><html><body><h1>Conductores</h1></body></html>",
    sources: [
      {
        name: "conductores",
        tableId: conductores.id,
        fields: Object.fromEntries((conductoresDef?.fields ?? []).map((f) => [f.name, f.id ?? ""])),
      },
    ],
  }),
});
await call(`/api/apps/${app.id}/paginas/${pagina.id}/datos`, {
  method: "POST",
  body: JSON.stringify({ op: "borrar", args: ["conductores", otro.id] }),
});
const trasPagina = await multaDe(multaDelOtro.id);
check("una pagina publicada: la fila sigue ahi y sin enlace", trasPagina.enlace === "");
check("y ensena su documento", trasPagina.sinEnlace === "5160000");

// Camino 3: quitarle el acceso a una persona a la que apuntaban filas.
const turnos = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Turnos",
    fields: [
      { name: "dia", label: "Dia", type: "text" },
      {
        name: "quien",
        label: "Quien",
        type: "relation",
        relationTableId: personas.id,
        displayField: PEOPLE_ACCOUNT_FIELD,
      },
    ],
  }),
});
await call<{ email: string }>(`/api/apps/${app.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: "saliente@test.com", password: "clave-de-prueba", roles: [] }),
});
const conSaliente = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
const saliente = conSaliente.find((p) => p.email === "saliente@test.com");
const turno = await call<{ id: string }>(records(turnos.dataCollection), {
  method: "POST",
  body: JSON.stringify({ dia: "Lunes", quien: saliente?.fila ?? "" }),
});
const accesos = await call<{ items: { id: string; member: string }[] }>(
  `/pb/api/collections/app_access/records?filter=${encodeURIComponent(`app="${app.id}"`)}`,
);
const suAcceso = accesos.items.find((a) => a.member === saliente?.id);
await call(`/api/members/${suAcceso?.id ?? ""}`, { method: "DELETE" });
const trasQuitar = await call<Record<string, unknown>>(records(turnos.dataCollection, turno.id));
check("quitar el acceso: la fila sigue ahi y sin enlace", !trasQuitar.quien);
check(
  "y ensena el correo de quien se fue",
  String(trasQuitar[orphanFieldName("quien")] ?? "") === "saliente@test.com",
);

// Ninguna de las tres puede haber quedado con las dos columnas vacias.
const todasLasMultas = await call<{ items: Record<string, unknown>[] }>(
  `${records(multas.dataCollection)}?perPage=200`,
);
check(
  "ninguna fila quedo sin enlace y sin valor",
  todasLasMultas.items.every((r) => r.conductor || r[orphanFieldName("conductor")]),
);

console.log("\n14. La cascada se lleva las filas, y el aviso lo dice antes");
const anexos = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Anexos",
    fields: [
      { name: "folio", label: "Folio", type: "text" },
      {
        name: "conductor",
        label: "Conductor",
        type: "relation",
        relationTableId: conductores.id,
        displayField: "documento",
        onDelete: "cascade",
      },
    ],
  }),
});
const conCascada = await call<{ id: string }>(records(conductores.dataCollection), {
  method: "POST",
  body: JSON.stringify({ documento: "5170000", nombre: "Eva Sol" }),
});
for (const folio of ["F-1", "F-2"]) {
  await call(records(anexos.dataCollection), {
    method: "POST",
    body: JSON.stringify({ folio, conductor: conCascada.id }),
  });
}
// Y una multa suya, que conserva el valor: las dos conductas a la vez.
await call(records(multas.dataCollection), {
  method: "POST",
  body: JSON.stringify({ acta: "A-502", conductor: conCascada.id }),
});

const impacto = await call<{
  cascade: { table: string; rows: number }[];
  keep: { table: string; rows: number }[];
}>(`/api/tables/${conductores.id}/filas/impacto`, {
  method: "POST",
  body: JSON.stringify({ ids: [conCascada.id] }),
});
check(
  "el aviso cuenta las dos que se van",
  impacto.cascade.find((e) => e.table === "Anexos")?.rows === 2,
);
check("y la que se queda", impacto.keep.find((e) => e.table === "Multas")?.rows === 1);

await call(`/api/tables/${conductores.id}/filas/borrar`, {
  method: "POST",
  body: JSON.stringify({ ids: [conCascada.id] }),
});
const anexosTras = await call<{ items: unknown[] }>(
  `${records(anexos.dataCollection)}?perPage=200`,
);
check("las filas en cascada se fueron con el", anexosTras.items.length === 0);
const multaTras = await call<{ items: Record<string, unknown>[] }>(
  `${records(multas.dataCollection)}?filter=${encodeURIComponent('acta="A-502"')}`,
);
check(
  "y la que conserva el valor sigue ahi, con su documento",
  String(multaTras.items[0]?.[orphanFieldName("conductor")] ?? "") === "5170000",
);

console.log("\n15. Convertir una columna del tipo anterior");
const superRes = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
});
if (!superRes.ok) throw new Error(`superusuario -> ${superRes.status} ${await superRes.text()}`);
const superuser = (await superRes.json()) as { token: string };
/**
 * Una llamada con la sesión de superusuario, que es la única que toca esquemas.
 * Va a la base directamente: el proxy no deja pasar la API de esquemas.
 */
const asSuper = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("authorization", superuser.token);
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(`${PB}${path.replace(/^\/pb/, "")}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
};

// Una tabla con una columna que hoy ya no se puede crear: se monta a mano
// contra la base, que es como estan las de las aplicaciones de antes.
const viejas = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Visitas",
    fields: [
      { name: "motivo", label: "Motivo", type: "text" },
      { name: "quien", label: "Quien", type: "text" },
    ],
  }),
});
const miembros = await asSuper<{ id: string }>("/pb/api/collections/members");
const coleccion = await asSuper<{ id: string; fields: Record<string, unknown>[] }>(
  `/pb/api/collections/${viejas.dataCollection}`,
);
await asSuper(`/pb/api/collections/${coleccion.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: [
      ...coleccion.fields.filter((f) => f.name !== "quien"),
      {
        name: "quien",
        type: "relation",
        required: false,
        collectionId: miembros.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      { name: orphanFieldName("quien"), type: "text" },
    ],
  }),
});
await asSuper(`/pb/api/collections/tables/records/${viejas.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: (viejas.fields ?? []).map((f) =>
      f.name === "quien" ? { ...f, id: undefined, type: "person" } : f,
    ),
  }),
});

// Una fila de alguien invitado aquí, y otra de una cuenta que no lo esta.
const otraApp = await call<{ id: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: `Ajena ${Date.now()}` }),
});
await call(`/api/apps/${otraApp.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: "deotraapp@test.com", password: "clave-de-prueba", roles: [] }),
});
const ajenos = await call<AppPerson[]>(`/api/apps/${otraApp.id}/personas`);
const deOtraApp = ajenos.find((p) => p.email === "deotraapp@test.com");

const visitaPropia = await asSuper<{ id: string }>(records(viejas.dataCollection), {
  method: "POST",
  body: JSON.stringify({ motivo: "Revision", quien: pepito?.id ?? "" }),
});
const visitaAjena = await asSuper<{ id: string }>(records(viejas.dataCollection), {
  method: "POST",
  body: JSON.stringify({ motivo: "Entrega", quien: deOtraApp?.id ?? "" }),
});

const { convertPersonColumns } = await import("../server/bootstrap.ts");
await convertPersonColumns();

const trasConvertir = await asSuper<TableRecord>(`/pb/api/collections/tables/records/${viejas.id}`);
const columna = (trasConvertir.fields ?? []).find((f) => f.name === "quien");
check("la columna ya es una relacion", columna?.type === "relation");
check("y apunta a la tabla de personas", columna?.relationTableId === personas.id);

const propia = await asSuper<Record<string, unknown>>(
  records(viejas.dataCollection, visitaPropia.id),
);
check("la fila de quien sigue invitado apunta ahora a su fila", propia.quien === pepito?.fila);
check("y no al id de su cuenta", propia.quien !== pepito?.id);

const ajena = await asSuper<Record<string, unknown>>(
  records(viejas.dataCollection, visitaAjena.id),
);
check("la de una cuenta que no esta invitada se quedo sin enlace", !ajena.quien);
check(
  "conservando su correo a la vista",
  String(ajena[orphanFieldName("quien")] ?? "") === "deotraapp@test.com",
);

// Y una segunda pasada no vuelve a tocar nada.
await convertPersonColumns();
const otraVez = await asSuper<Record<string, unknown>>(
  records(viejas.dataCollection, visitaPropia.id),
);
check("correrla otra vez no cambia nada", otraVez.quien === pepito?.fila);

console.log("\n16. Los nombres con los que llega la sesion no valen de columna");
let rechazada = false;
await call(`/api/tables/${personas.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: [
      ...(personas.fields ?? []),
      { name: "correo", label: "Correo de contacto", type: "text" },
    ],
  }),
}).catch(() => {
  rechazada = true;
});
check("la tabla de personas rechaza una columna llamada correo", rechazada);
const conCorreo = await call<TableRecord>(`/api/tables/${conductores.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: [...(conductoresDef?.fields ?? []), { name: "correo", label: "Correo", type: "text" }],
  }),
});
check(
  "y otra tabla la acepta sin problema",
  (conCorreo.fields ?? []).some((f) => f.name === "correo"),
);

/* ------------------------------------------------------------------ */
/* El panel, corriendo contra este mismo servidor                        */
/* ------------------------------------------------------------------ */

/*
 * Lo que sigue no habla con la API a mano: llama a las funciones del panel.
 *
 * Reconocer a que tabla pertenece un archivo y enlazar lo que estaba esperando
 * son decisiones suyas --viven en `web/src/lib`-- y comprobarlas repitiendolas
 * aquí seria comprobar la copia. Se le cambia al cliente del panel la dirección
 * y la sesión, y de ahi en adelante es el mismo código que corre el navegador.
 */
const { pb } = await import("../web/src/lib/pb.ts");
pb.baseURL = `${BASE}/pb`;
pb.authStore.save(token, null);

/*
 * El panel pide a su servidor con rutas relativas, que un navegador resuelve
 * contra el origen de la página. Aquí no hay origen, así que se le da uno: es
 * lo mismo que se acaba de hacer con `pb.baseURL`, para el resto de la API.
 */
const fetchSinOrigen = globalThis.fetch;
globalThis.fetch = ((entrada: RequestInfo | URL, init?: RequestInit) =>
  fetchSinOrigen(
    typeof entrada === "string" && entrada.startsWith("/") ? `${BASE}${entrada}` : entrada,
    init,
  )) as typeof fetch;

const { matchingTable } = await import("../web/src/lib/dropFiles.ts");
const { exportName, rowsToCsv } = await import("../web/src/lib/tableExport.ts");
const { linkWaiting, waitingFor } = await import("../web/src/lib/orphans.ts");
const { guessPersonFields } = await import("../web/src/lib/personGuess.ts");
const { peopleImportNote } = await import("../web/src/lib/importPlan.ts");
const { isPeopleTable } = await import("../shared/people.ts");

/** Las tablas de la aplicación, recien leidas. */
const tablesNow = async (): Promise<TableRecord[]> =>
  (
    await call<{ items: TableRecord[] }>(
      `/pb/api/collections/tables/records?perPage=200&filter=${encodeURIComponent(`app="${app.id}"`)}`,
    )
  ).items;

/** Un archivo de los que se sueltan, armado aquí mismo. */
const csvFile = (name: string, lines: string[]): File =>
  new File([lines.join("\n")], name, { type: "text/csv" });

console.log("\n17. A que tabla pertenece un archivo soltado: las tres capas");

// Dos tablas con la misma etiqueta: la segunda se queda con otro nombre
// tecnico, que es justo lo que separa la capa del nombre en dos.
const multasA = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Multas",
    fields: [{ name: "codigo", label: "Codigo", type: "text" }],
  }),
});
const multasB = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Multas",
    fields: [{ name: "codigo", label: "Codigo", type: "text" }],
  }),
});
check("dos tablas pueden llamarse igual en pantalla", multasA.label === multasB.label);
check("y la base les da nombres tecnicos distintos", multasA.name !== multasB.name);

const tablasParaSoltar = await tablesNow();
const conductoresAhora = tablasParaSoltar.find((t) => t.id === conductores.id);
if (!conductoresAhora) throw new Error("la tabla de conductores tiene que seguir ahi");

// Capa 1: los identificadores mandan aunque el archivo se llame de otra cosa.
const filasConductores = (
  await call<{ items: Record<string, unknown>[] }>(
    `${records(conductores.dataCollection)}?perPage=5`,
  )
).items;
check("hay filas de conductores para exportar", filasConductores.length > 0);
const porIds = await matchingTable(
  tablasParaSoltar,
  csvFile("cualquier-cosa-2026-01-01.csv", [
    "id;documento",
    ...filasConductores.map((r) => `${String(r.id)};${String(r.documento ?? "")}`),
  ]),
);
check(
  "un archivo renombrado vuelve a su tabla por sus identificadores",
  porIds?.id === conductores.id,
);

// Capa 2: las columnas exactas, sin columna de identificadores.
const columnasExactas = (conductoresAhora.fields ?? []).map((f) => f.name);
const porColumnas = await matchingTable(
  tablasParaSoltar,
  csvFile("hoja-nueva.csv", [columnasExactas.join(";"), columnasExactas.map(() => "").join(";")]),
);
check(
  "un archivo con las columnas exactas de una tabla es de esa tabla",
  porColumnas?.id === conductores.id,
);

const porColumnasDeMas = await matchingTable(
  tablasParaSoltar,
  csvFile("hoja-nueva.csv", [[...columnasExactas, "sobra"].join(";"), ""]),
);
check("una columna de mas y esa capa ya no decide", porColumnasDeMas === null);

// Capa 3: el nombre tecnico, que es el único que distingue a las dos Multas.
const porNombreTecnico = await matchingTable(
  tablasParaSoltar,
  csvFile(`${multasB.name}.csv`, ["nada;de;nada", "1;2;3"]),
);
check("el nombre tecnico lleva el archivo a su tabla", porNombreTecnico?.id === multasB.id);

// Y el empate: la etiqueta que llevan dos tablas no decide nada.
const empate = await matchingTable(
  tablasParaSoltar,
  csvFile("Multas.csv", ["nada;de;nada", "1;2;3"]),
);
check("dos tablas con la misma etiqueta no eligen ninguna", empate === null);

console.log("\n18. La tabla de personas: exportarla y soltarla vuelve a ella");
const tablasConPersonas = await tablesNow();
const personasAhora = tablasConPersonas.find((t) => t.name === PEOPLE_TABLE);
if (!personasAhora) throw new Error("la tabla de personas tiene que seguir ahi");

check(
  "el archivo se llama como la tabla que se ve",
  exportName(personasAhora, "csv") === "personas-y-roles.csv",
);

const invitadosParaExportar = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
const filasPersonasAhora = (
  await call<{ items: Record<string, unknown>[] }>(
    `${records(personasAhora.dataCollection)}?perPage=200`,
  )
).items;
const csvPersonas = rowsToCsv(
  personasAhora.fields ?? [],
  filasPersonasAhora as never[],
  ";",
  invitadosParaExportar,
);
const antesDeSoltar = tablasConPersonas.length;
const idaYVuelta = await matchingTable(
  tablasConPersonas,
  new File([csvPersonas], exportName(personasAhora, "csv"), { type: "text/csv" }),
);
check(
  "el archivo exportado de personas vuelve a la tabla de personas",
  idaYVuelta?.id === personasAhora.id,
);
check("y se reconoce como la tabla de personas, no como una cualquiera", isPeopleTable(idaYVuelta));

// Y también por el nombre solo: un archivo suyo al que le quitaron todo menos
// una columna sigue siendo el de personas, que es lo que impide crear otra.
const soloPorNombre = await matchingTable(
  tablasConPersonas,
  csvFile("personas-y-roles.csv", ["correo", "quien@sea.com"]),
);
check(
  "el nombre del archivo exportado tambien lo lleva a su tabla",
  soloPorNombre?.id === personasAhora.id,
);
check("y ninguna de las dos vueltas creo una tabla", (await tablesNow()).length === antesDeSoltar);

console.log("\n19. Importar personas enlaza las filas que estaban esperando");
/*
 * Tres filas esperando, y solo una se enlaza: la otra lleva un valor que el
 * constructor ya dio por bueno, y la tercera un valor que tienen dos personas.
 */
await call(`/api/tables/${personasAhora.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    fields: [...(personasAhora.fields ?? []), { name: "codigo", label: "Codigo", type: "text" }],
  }),
});

const chequeos = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Chequeos",
    fields: [
      { name: "turno", label: "Turno", type: "text" },
      {
        name: "conductor",
        label: "Conductor",
        type: "relation",
        relationTableId: personasAhora.id,
        displayField: "documento",
      },
      {
        name: "auxiliar",
        label: "Auxiliar",
        type: "relation",
        relationTableId: personasAhora.id,
        displayField: "codigo",
      },
    ],
  }),
});

const esperaEnlazar = await call<{ id: string }>(records(chequeos.dataCollection), {
  method: "POST",
  body: JSON.stringify({ turno: "Manana", [orphanFieldName("conductor")]: "90909090" }),
});
const esperaAceptado = await call<{ id: string }>(records(chequeos.dataCollection), {
  method: "POST",
  body: JSON.stringify({ turno: "Tarde", [orphanFieldName("conductor")]: "12121212" }),
});
const esperaAmbiguo = await call<{ id: string }>(records(chequeos.dataCollection), {
  method: "POST",
  body: JSON.stringify({ turno: "Noche", [orphanFieldName("auxiliar")]: "ZZZ" }),
});
await call(`/api/tables/${chequeos.id}`, {
  method: "PATCH",
  body: JSON.stringify({ acceptedOrphans: { conductor: ["12121212"] } }),
});

// Las personas que el archivo habria traido: una con el documento que se
// esperaba, otra con el que ya se dio por bueno, y dos con el mismo código.
const nuevas: { email: string; documento?: string; codigo?: string }[] = [
  { email: "esperada@test.com", documento: "90909090" },
  { email: "aceptada@test.com", documento: "12121212" },
  { email: "gemela1@test.com", codigo: "ZZZ" },
  { email: "gemela2@test.com", codigo: "ZZZ" },
];
for (const persona of nuevas) {
  await call(`/api/apps/${app.id}/members`, {
    method: "POST",
    body: JSON.stringify({ email: persona.email, name: persona.email.split("@")[0] }),
  });
}
const invitadosTrasImportar = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
for (const persona of nuevas) {
  const fila = invitadosTrasImportar.find((p) => p.email === persona.email)?.fila ?? "";
  await call(records(personasAhora.dataCollection, fila), {
    method: "PATCH",
    body: JSON.stringify({ documento: persona.documento ?? "", codigo: persona.codigo ?? "" }),
  });
}
const invitadosAlDia = await call<AppPerson[]>(`/api/apps/${app.id}/personas`);
const personasFinal = (await tablesNow()).find((t) => t.name === PEOPLE_TABLE);
const chequeosFinal = (await tablesNow()).find((t) => t.id === chequeos.id);
if (!personasFinal || !chequeosFinal) throw new Error("las dos tablas tienen que seguir ahi");

const { personAsRow } = await import("../web/src/lib/orphans.ts");
const pendientes = await waitingFor({
  target: personasFinal,
  created: invitadosAlDia.map(personAsRow),
  tables: [chequeosFinal],
  people: invitadosAlDia,
});
check("solo una cosa quedo esperando", pendientes.length === 1);
check("y es el documento que nadie habia dado por bueno", pendientes[0]?.value === "90909090");

for (const item of pendientes) await linkWaiting(item);

const trasEnlazar = async (id: string) =>
  await call<Record<string, unknown>>(records(chequeos.dataCollection, id));
const enlazada = await trasEnlazar(esperaEnlazar.id);
const laEsperada = invitadosAlDia.find((p) => p.email === "esperada@test.com");
check("la fila que esperaba quedo enlazada a su persona", enlazada.conductor === laEsperada?.fila);
check("y ya no lleva el valor sin enlace", !String(enlazada[orphanFieldName("conductor")] ?? ""));

const aceptada = await trasEnlazar(esperaAceptado.id);
check(
  "un valor que se habia dado por bueno se queda como estaba",
  !aceptada.conductor && String(aceptada[orphanFieldName("conductor")] ?? "") === "12121212",
);
const ambigua = await trasEnlazar(esperaAmbiguo.id);
check(
  "un valor que llevan dos personas no enlaza a ninguna",
  !ambigua.auxiliar && String(ambigua[orphanFieldName("auxiliar")] ?? "") === "ZZZ",
);

// El parte: una frase por cifra, y la que es cero no dice nada.
const parte = peopleImportNote({
  saved: "Se importaron 4 personas, 4 con cuenta nueva.",
  linked: [{ table: "Chequeos", rows: 1 }],
  pending: [{ table: "Chequeos", rows: 2 }],
});
check("el parte cuenta las personas importadas", parte.includes("Se importaron 4 personas"));
check(
  "dice cuantas filas se enlazaron y de que tabla",
  parte.includes('Quedaron enlazadas 1 fila de "Chequeos"'),
);
check(
  "y cuantas siguen sin enlace y donde se ven",
  parte.includes('Siguen sin enlace 2 filas de "Chequeos"'),
);
const parteCorto = peopleImportNote({ saved: "Se importó 1 persona.", linked: [], pending: [] });
check("una cifra en cero no dice su frase", parteCorto === "Se importó 1 persona.");

console.log("\n20. Una columna de texto que resulta nombrar personas");
/*
 * Las filas llegaron antes que la gente: una columna de texto con documentos
 * escritos a mano, y después se invita a quien los lleva.
 */
const notas = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Notas",
    fields: [
      { name: "quien", label: "Quien", type: "text" },
      { name: "nivel", label: "Nivel", type: "text" },
    ],
  }),
});
for (const [quien, nivel] of [
  ["90909090", "alto"],
  ["12121212", "alto"],
]) {
  await call(records(notas.dataCollection), {
    method: "POST",
    body: JSON.stringify({ quien, nivel }),
  });
}
const notasFilas = (
  await call<{ items: Record<string, unknown>[] }>(`${records(notas.dataCollection)}?perPage=200`)
).items;
const candidatas = guessPersonFields({
  tables: [notas],
  all: await tablesNow(),
  rows: new Map([[notas.id, notasFilas]]),
  people: invitadosAlDia,
});
check(
  "la columna de documentos se propone",
  candidatas.some((c) => c.field.name === "quien"),
);
check(
  "y se propone por el documento, que es lo que casa",
  candidatas.find((c) => c.field.name === "quien")?.keys[0]?.key === "documento",
);
check(
  "la columna que no nombra a nadie no se propone",
  !candidatas.some((c) => c.field.name === "nivel"),
);

console.log("\n21. Las ordenes con las que la IA crea tablas y columnas");
/*
 * Se llaman las ordenes directamente, sin el modelo delante. Lo que hay que
 * comprobar es que crear una relación funciona y que un rechazo dice el paso
 * que falta; que el modelo acierte a pedirlo es otra cosa, y cuesta una
 * petición de verdad por cada intento.
 */
{
  const { runTool } = await import("../server/ai/aiPage/toolRuntime.ts");
  const appRec = await call<AppRecord>(records("apps", app.id));
  const paginaIa = await call<PageRecord>(records("pages"), {
    method: "POST",
    body: JSON.stringify({
      app: app.id,
      name: "Pantalla IA",
      slug: `ia-${Date.now()}`,
      icon: "FileText",
      order: 90,
      isHome: false,
    }),
  });

  const listarTablas = async () =>
    (
      await call<{ items: TableRecord[] }>(
        `${records("tables")}?filter=${encodeURIComponent(`app="${app.id}"`)}&perPage=200`,
      )
    ).items;

  const ctx = {
    app: appRec,
    page: paginaIa,
    tables: await listarTablas(),
    pages: [paginaIa],
    steps: [] as { tool: string; summary: string; ok: boolean }[],
    notices: [] as string[],
    pending: [] as unknown[],
    people: [] as AppPerson[],
    grants: [] as unknown[],
    changed: false,
    step: async () => {},
    probe: async () => null,
    probes: 0,
    question: null,
    reviewed: false,
  } as unknown as Parameters<typeof runTool>[2];

  const tabla = (nombre: string) => ctx.tables.find((t) => t.name === nombre);

  /* La marca de columna única deja de perderse por el camino. */
  const empleados = await runTool(
    "crear_tabla",
    {
      label: "Empleados IA",
      fields: [
        { label: "Cedula", type: "text", unique: true },
        { label: "Nombre", type: "text" },
      ],
    },
    ctx,
  );
  const empleadosTabla = tabla(String(JSON.parse(empleados).nombre ?? ""));
  check("la tabla que pidio la IA se creo", !!empleadosTabla);
  check(
    "y la columna que marco quedo marcada",
    empleadosTabla?.fields.find((f) => f.name === "cedula")?.unique === true,
  );

  // La marca no es solo un dato guardado: la base tiene que rechazar el
  // segundo valor igual, que es para lo que sirve una llave.
  await call(records(empleadosTabla?.dataCollection ?? ""), {
    method: "POST",
    body: JSON.stringify({ cedula: "111", nombre: "Uno" }),
  });
  const repetida = await fetch(`${BASE}${records(empleadosTabla?.dataCollection ?? "")}`, {
    method: "POST",
    headers: { authorization: token, "content-type": "application/json" },
    body: JSON.stringify({ cedula: "111", nombre: "Otro" }),
  });
  check("la llave no deja repetir el valor", repetida.status >= 400);

  // Marcar una llave sobre una tabla que ya tiene filas tampoco falla: el
  // índice no cuenta las celdas vacias, y las filas nuevas nacen vacias.
  const conFilas = await runTool(
    "agregar_columnas",
    { tabla: empleadosTabla?.name, fields: [{ label: "Carnet", type: "text", unique: true }] },
    ctx,
  );
  check("se puede marcar una llave sobre una tabla con filas", !conFilas.startsWith("Error:"));

  /* Una tabla nueva que apunta a la anterior, sin decir que enseña. */
  const turnos = await runTool(
    "crear_tabla",
    {
      label: "Turnos IA",
      fields: [
        { label: "Codigo", type: "text", unique: true },
        { label: "Empleado", type: "relation", relationTable: empleadosTabla?.name },
      ],
    },
    ctx,
  );
  const turnosTabla = tabla(String(JSON.parse(turnos).nombre ?? ""));
  const columnaEmpleado = turnosTabla?.fields.find((f) => f.name === "empleado");
  check(
    "la columna apunta a la tabla que se nombro",
    columnaEmpleado?.relationTableId === empleadosTabla?.id,
  );
  check(
    "y sin decirlo ensena la primera llave del destino",
    columnaEmpleado?.displayField === "cedula",
  );

  // La misma forma que una creada desde el panel: dos columnas reales, la del
  // enlace y la del valor que todavía no encontro dueno.
  const conValorSuelto = await call<{ id: string; empleado: string; empleado_sin_enlace: string }>(
    records(turnosTabla?.dataCollection ?? ""),
    {
      method: "POST",
      body: JSON.stringify({ codigo: "T-1", [orphanFieldName("empleado")]: "999" }),
    },
  );
  check("la relacion ocupa las dos columnas reales", conValorSuelto.empleado_sin_enlace === "999");
  check("y nace sin enlace, no rota", conValorSuelto.empleado === "");

  /* Apuntar a personas: sin marcar nada, y ensenando la columna que se pida. */
  await runTool(
    "agregar_columnas",
    {
      tabla: turnosTabla?.name,
      fields: [
        {
          label: "Quien lo hizo",
          type: "relation",
          relationTable: personas.name,
          displayColumn: "documento",
        },
      ],
    },
    ctx,
  );
  const conPersona = tabla(String(turnosTabla?.name ?? ""))?.fields.find(
    (f) => f.name === "quien_lo_hizo",
  );
  check("se puede apuntar a la tabla de personas", conPersona?.relationTableId === personas.id);
  check("ensenando la columna que se pidio", conPersona?.displayField === "documento");

  /* Los tres rechazos: ninguno crea nada y ninguno deja aviso. */
  const cuantas = ctx.tables.length;
  const avisos = ctx.steps.length;

  const sinDestino = await runTool(
    "crear_tabla",
    {
      label: "Rechazada IA",
      fields: [{ label: "Cosa", type: "relation", relationTable: "no_existe_esta" }],
    },
    ctx,
  );
  check("un destino que no existe se rechaza", sinDestino.startsWith("Error:"));
  check("y el mensaje dice que tabla se nombro", sinDestino.includes("no_existe_esta"));

  await runTool(
    "crear_tabla",
    { label: "Sin Llave IA", fields: [{ label: "Nota", type: "text" }] },
    ctx,
  );
  const sinLlave = tabla("sin_llave_ia");
  const rechazoLlave = await runTool(
    "crear_tabla",
    {
      label: "Apunta A Sin Llave",
      fields: [{ label: "Cual", type: "relation", relationTable: sinLlave?.name }],
    },
    ctx,
  );
  check("un destino sin llave se rechaza", rechazoLlave.startsWith("Error:"));
  check("y el mensaje dice como arreglarlo", rechazoLlave.includes("agregar_columnas"));

  const rechazoColumna = await runTool(
    "crear_tabla",
    {
      label: "Ensena Lo Que No Hay",
      fields: [
        {
          label: "Cual",
          type: "relation",
          relationTable: empleadosTabla?.name,
          displayColumn: "no_esta",
        },
      ],
    },
    ctx,
  );
  check("una columna que ensenar que no existe se rechaza", rechazoColumna.startsWith("Error:"));
  check("y el mensaje lista las que si valen", rechazoColumna.includes("cedula"));

  check("ninguno de los tres rechazos creo una tabla", ctx.tables.length === cuantas + 1);
  check("ni dejo aviso en el panel", ctx.steps.length === avisos + 1);

  /* La IA se recupera sola: le añade la llave al destino y vuelve a pedirlo. */
  await runTool(
    "agregar_columnas",
    { tabla: sinLlave?.name, fields: [{ label: "Codigo", type: "text", unique: true }] },
    ctx,
  );
  const reintento = await runTool(
    "crear_tabla",
    {
      label: "Apunta A Sin Llave",
      fields: [{ label: "Cual", type: "relation", relationTable: sinLlave?.name }],
    },
    ctx,
  );
  check("con la llave puesta, la misma orden se aplica", !reintento.startsWith("Error:"));
  check(
    "y la columna ensena la llave recien anadida",
    tabla(String(JSON.parse(reintento).nombre ?? ""))?.fields.find((f) => f.name === "cual")
      ?.displayField === "codigo",
  );

  /* Convertir una columna que ya existe no le corresponde a la IA. */
  const pendientes = ctx.pending.length;
  const conversion = await runTool(
    "cambiar_tipo_columna",
    { tabla: empleadosTabla?.name, columna: "nombre", tipo: "relation" },
    ctx,
  );
  check("pedir convertir a relacion se rechaza", conversion.startsWith("Error:"));
  check("y no deja nada esperando autorizacion", ctx.pending.length === pendientes);

  await runTool(
    "cambiar_tipo_columna",
    { tabla: empleadosTabla?.name, columna: "nombre", tipo: "number" },
    ctx,
  );
  check("un cambio de tipo corriente sigue archivandose", ctx.pending.length === pendientes + 1);
}

console.log("\n22. Lo que nace de un archivo se nombra para leerse");

const { readableLabel } = await import("../web/src/lib/importPlan.ts");
const { planDataFile, tableFromPlan, importIntoTable } =
  await import("../web/src/lib/dropFiles.ts");

// La regla sola, empezando por lo que no toca: un texto ya escrito para leerse
// se queda como vino, venga con espacios, con mayusculas propias o con sigla.
check(
  "un nombre tecnico se traduce",
  readableLabel("chequeo-preoperacional") === "Chequeo preoperacional",
);
check("y con guion bajo igual", readableLabel("codigo_empleado") === "Codigo empleado");
check(
  "un texto con espacios no se toca",
  readableLabel("Chequeo Preoperacional") === "Chequeo Preoperacional",
);
check("ni uno con mayusculas propias", readableLabel("cedula NIT") === "Cedula NIT");
check("ni una sigla con separador", readableLabel("IVA_2026") === "IVA_2026");
check(
  "un encabezado a gritos se sigue bajando",
  readableLabel("NOMBRE COMPLETO") === "Nombre completo",
);
check("y uno en minusculas solo levanta la primera", readableLabel("full name") === "Full name");

// La vuelta completa: una tabla de varias palabras sale a un archivo y vuelve.
const chequeo = await call<TableRecord>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Chequeo preoperacional",
    fields: [
      { name: "", label: "Codigo empleado", type: "text" },
      { name: "", label: "Fecha revision", type: "text" },
    ],
  }),
});
await call(records(chequeo.dataCollection), {
  method: "POST",
  body: JSON.stringify({ codigo_empleado: "E-1", fecha_revision: "2026-01-02" }),
});

const nombreArchivo = exportName(chequeo, "csv");
check(
  "el archivo sale con el nombre tecnico de la tabla",
  nombreArchivo === "chequeo-preoperacional.csv",
);

const filasChequeo = (
  await call<{ items: Record<string, unknown>[] }>(`${records(chequeo.dataCollection)}?perPage=10`)
).items;
const csvChequeo = rowsToCsv(chequeo.fields ?? [], filasChequeo as never[], ";");
check(
  "y sus encabezados tambien son tecnicos",
  csvChequeo.startsWith("id;codigo_empleado;fecha_revision"),
);

// Soltarlo cuando la tabla si existe no crea nada: emparejar ya normalizaba los
// dos lados, y eso es lo que este cambio no puede romper.
const tablasConChequeo = await tablesNow();
const antesDeLaVuelta = tablasConChequeo.length;
const vuelveASuTabla = await matchingTable(
  tablasConChequeo,
  new File([csvChequeo], nombreArchivo, { type: "text/csv" }),
);
check("el archivo exportado vuelve a su tabla", vuelveASuTabla?.id === chequeo.id);
check("y no creo ninguna tabla", (await tablesNow()).length === antesDeLaVuelta);

// Y soltado donde no corresponde a ninguna, la que nace se lee.
const plan = await planDataFile(new File([csvChequeo], nombreArchivo, { type: "text/csv" }));
check("el nombre que se propone ya es el legible", plan.label === "Chequeo preoperacional");
const nacida = await tableFromPlan(app.id, plan, null, { tables: tablasConChequeo, people: [] });
check("la tabla nace con el nombre legible", nacida.table.label === "Chequeo preoperacional");
check(
  "y sus columnas tambien",
  nacida.table.fields.map((f) => f.label).join(" | ") === "Codigo empleado | Fecha revision",
);
check("con la fila del archivo dentro", nacida.rows === filasChequeo.length);

// Una columna que el archivo trae de mas a una tabla que ya existe.
const conColumnaNueva = csvFile("cualquier-cosa.csv", [
  "codigo_empleado;turno_asignado",
  "E-1;Noche",
]);
const importada = await importIntoTable(chequeo, conColumnaNueva, "add");
const nueva = importada.table.fields.find((f) => f.name === "turno_asignado");
check("la columna que el archivo trae de mas se crea", nueva !== undefined);
check("y se llama para leerse", nueva?.label === "Turno asignado");

console.log("\n23. Limpiar");
await call(`/api/apps/${app.id}`, { method: "DELETE" });
await call(`/api/apps/${otraApp.id}`, { method: "DELETE" });
check("app borrada", true);

console.log(failures === 0 ? "\nTodo bien." : `\n${failures} fallos.`);
process.exit(failures === 0 ? 0 : 1);
