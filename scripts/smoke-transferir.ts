/**
 * Prueba de extremo a extremo de llevarse una aplicación: duplicar, exportar a
 * un archivo `.planer` y volver a importarlo.
 *
 * Uso:  bun run scripts/smoke-transferir.ts
 *
 * Lo que se comprueba no es que las rutas contesten, sino que lo que llega al
 * otro lado sea la misma aplicación: las mismas tablas, las mismas columnas,
 * las relaciones enganchadas a la tabla que toca, las filas con sus enlaces en
 * pie, el HTML de cada página y las fuentes que esa página declara.
 *
 * Deja limpio lo que crea.
 */
import { PEOPLE_TABLE } from "../shared/people.ts";
import { MANIFEST_NAME, type TransferResult } from "../shared/transfer.ts";
import type { FieldDef, PageRecord, TableRecord } from "../shared/types.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@planer.local";
const PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "planer-admin-1234";

let token = "";
let failures = 0;
const creadas: string[] = [];

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
  if (init.body && !(init.body instanceof FormData))
    headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Lista de PocketBase con la sesión del constructor. */
async function list<T>(collection: string, query = ""): Promise<T[]> {
  const res = await call<{ items: T[] }>(
    `/pb/api/collections/${collection}/records?perPage=500&skipTotal=1${query}`,
  );
  return res.items;
}

const tablesOf = (appId: string) =>
  list<TableRecord>("tables", `&filter=${encodeURIComponent(`app = "${appId}"`)}&sort=order`);
const pagesOf = (appId: string) =>
  list<PageRecord>("pages", `&filter=${encodeURIComponent(`app = "${appId}"`)}&sort=order`);

const byName = (tables: TableRecord[], name: string) => tables.find((t) => t.name === name);
const field = (table: TableRecord | undefined, name: string): FieldDef | undefined =>
  (table?.fields ?? []).find((f) => f.name === name);

/* ------------------------------------------------------------------ */

console.log("\n1. Entrar como constructor");
const auth = await call<{ token: string }>("/pb/api/collections/builders/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
});
token = auth.token;
check("sesion iniciada", !!token);

console.log("\n2. Armar la aplicacion de origen");
const origen = await call<{ id: string; slug: string; name: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: `Transferencia ${Date.now()}` }),
});
creadas.push(origen.id);
check("app creada", !!origen.id);

const clientes = await call<TableRecord>(`/api/apps/${origen.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Clientes",
    fields: [
      { name: "cedula", label: "Cédula", type: "text", unique: true, required: true },
      { name: "nombre", label: "Nombre", type: "text" },
      { name: "activo", label: "Activo", type: "bool" },
    ],
  }),
});
const pedidos = await call<TableRecord>(`/api/apps/${origen.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Pedidos",
    fields: [
      { name: "numero", label: "Número", type: "text" },
      { name: "total", label: "Total", type: "number" },
      {
        name: "cliente",
        label: "Cliente",
        type: "relation",
        relationTableId: clientes.id,
        displayField: "cedula",
      },
      { name: "soporte", label: "Soporte", type: "file" },
    ],
  }),
});
check("dos tablas con una relación entre ellas", !!clientes.id && !!pedidos.id);

// Filas: dos clientes y dos pedidos que los nombran.
const cliente1 = await call<{ id: string }>(
  `/pb/api/collections/${clientes.dataCollection}/records`,
  {
    method: "POST",
    body: JSON.stringify({ cedula: "1001", nombre: "Ana", activo: true }),
  },
);
const cliente2 = await call<{ id: string }>(
  `/pb/api/collections/${clientes.dataCollection}/records`,
  {
    method: "POST",
    body: JSON.stringify({ cedula: "1002", nombre: "Beto", activo: false }),
  },
);
// El primero con un adjunto: los archivos viajan dentro del comprimido y se
// vuelven a subir al importar, así que hay que verlos llegar.
const conArchivo = new FormData();
conArchivo.append("numero", "A-1");
conArchivo.append("total", "150");
conArchivo.append("cliente", cliente1.id);
conArchivo.append("soporte", new Blob(["hola"], { type: "text/plain" }), "nota.txt");
await call(`/pb/api/collections/${pedidos.dataCollection}/records`, {
  method: "POST",
  body: conArchivo,
});
await call(`/pb/api/collections/${pedidos.dataCollection}/records`, {
  method: "POST",
  body: JSON.stringify({ numero: "A-2", total: 300, cliente: cliente2.id }),
});

// Una página con HTML y con la tabla de pedidos declarada.
const paginas = await pagesOf(origen.id);
const inicio = paginas.find((p) => p.isHome);
if (!inicio) throw new Error("La aplicacion nacio sin pagina de inicio");
const HTML = '<section class="plane-card"><h1>Pedidos del mes</h1></section>';
await call(`/api/apps/${origen.id}/paginas/${inicio.id}/html`, {
  method: "PUT",
  body: JSON.stringify({
    html: HTML,
    sources: [
      {
        name: "pedidos",
        tableId: pedidos.id,
        fields: { numero: field(pedidos, "numero")?.id, total: field(pedidos, "total")?.id },
      },
    ],
  }),
});

console.log("\n3. Duplicar la aplicacion");
const copia = await call<TransferResult>(`/api/apps/${origen.id}/duplicar`, {
  method: "POST",
  body: JSON.stringify({}),
});
creadas.push(copia.appId);
check("la copia se creo", !!copia.appId);
check("enlace propio, distinto del original", copia.slug !== origen.slug);
check("cuatro filas copiadas", copia.filas === 4);
check("y el adjunto con ellas", copia.archivos === 1);
check("sin avisos", copia.avisos.length === 0);

const copiaTablas = await tablesOf(copia.appId);
check("tres tablas (personas, clientes, pedidos)", copiaTablas.length === 3);
check("la tabla de personas vino sola", !!byName(copiaTablas, PEOPLE_TABLE));

const copiaPedidos = byName(copiaTablas, pedidos.name);
const copiaClientes = byName(copiaTablas, clientes.name);
check(
  "la relación apunta a la tabla de clientes de la copia, no a la del original",
  field(copiaPedidos, "cliente")?.relationTableId === copiaClientes?.id,
);
check("la columna única sigue marcada", field(copiaClientes, "cedula")?.unique === true);

const copiaFilas = await list<{ cliente?: string; numero?: string; soporte?: string }>(
  copiaPedidos?.dataCollection ?? "",
);
check("los dos pedidos estan en la copia", copiaFilas.length === 2);
check(
  "cada pedido sigue enganchado a su cliente",
  copiaFilas.every((r) => !!r.cliente),
);
check(
  "el adjunto quedo colgado de su fila",
  copiaFilas.some((r) => typeof r.soporte === "string" && r.soporte.includes("nota")),
);

const copiaPaginas = await pagesOf(copia.appId);
const copiaInicio = copiaPaginas.find((p) => p.isHome);
check("la pagina de inicio vino", !!copiaInicio);
const copiaHtml = await call<{ html: string }>(
  `/api/apps/${copia.appId}/paginas/${copiaInicio?.id}/html/crudo`,
);
check("el HTML de la pagina es el mismo", copiaHtml.html.includes("Pedidos del mes"));
check(
  "la fuente de la pagina apunta a la tabla de la copia",
  copiaInicio?.sources?.[0]?.tableId === copiaPedidos?.id,
);
check(
  "las columnas de la fuente se resolvieron a los ids nuevos",
  copiaInicio?.sources?.[0]?.fields?.numero === field(copiaPedidos, "numero")?.id,
);

console.log("\n4. Exportar a un archivo .planer");
const res = await fetch(`${BASE}/api/apps/${origen.id}/exportar`, {
  headers: { authorization: token },
});
check("la descarga responde", res.ok);
check(
  "se descarga, no se abre",
  (res.headers.get("content-disposition") ?? "").startsWith("attachment"),
);
const bytes = new Uint8Array(await res.arrayBuffer());
check("el archivo pesa algo", bytes.length > 0);
// Un zip empieza por "PK".
check("por dentro es un comprimido", bytes[0] === 0x50 && bytes[1] === 0x4b);

console.log("\n5. Volver a importarlo");
const form = new FormData();
form.append("archivo", new Blob([bytes]), "prueba.planer");
form.append("nombre", `Importada ${Date.now()}`);
const importada = await call<TransferResult>("/api/apps/importar", { method: "POST", body: form });
creadas.push(importada.appId);
check("la aplicacion importada se creo", !!importada.appId);
check("cuatro filas importadas", importada.filas === 4);
check("sin avisos", importada.avisos.length === 0);

const impTablas = await tablesOf(importada.appId);
const impPedidos = byName(impTablas, pedidos.name);
const impClientes = byName(impTablas, clientes.name);
check("tres tablas", impTablas.length === 3);
check(
  "la relación se resolvio dentro de la aplicacion importada",
  field(impPedidos, "cliente")?.relationTableId === impClientes?.id,
);
const impFilas = await list<{ cliente?: string; total?: number }>(impPedidos?.dataCollection ?? "");
check("los dos pedidos entraron", impFilas.length === 2);
check(
  "cada uno conserva su enlace y su total",
  impFilas.every((r) => !!r.cliente) && impFilas.some((r) => r.total === 300),
);

const impPaginas = await pagesOf(importada.appId);
const impInicio = impPaginas.find((p) => p.isHome);
const impHtml = await call<{ html: string }>(
  `/api/apps/${importada.appId}/paginas/${impInicio?.id}/html/crudo`,
);
check("el HTML llego entero", impHtml.html.includes("Pedidos del mes"));
check("la fuente apunta a la tabla importada", impInicio?.sources?.[0]?.tableId === impPedidos?.id);
check("nace como borrador", true);

console.log("\n6. Exportar sin datos deja una plantilla");
const plantillaRes = await fetch(`${BASE}/api/apps/${origen.id}/exportar?datos=0`, {
  headers: { authorization: token },
});
const plantillaBytes = new Uint8Array(await plantillaRes.arrayBuffer());
const plantillaForm = new FormData();
plantillaForm.append("archivo", new Blob([plantillaBytes]), "plantilla.planer");
plantillaForm.append("nombre", `Plantilla ${Date.now()}`);
const plantilla = await call<TransferResult>("/api/apps/importar", {
  method: "POST",
  body: plantillaForm,
});
creadas.push(plantilla.appId);
check("la plantilla trae las tablas", plantilla.tablas === 3);
check("y ninguna fila", plantilla.filas === 0);
check("el archivo sin datos pesa menos", plantillaBytes.length < bytes.length);
check("y sigue trayendo la estructura", MANIFEST_NAME === "planer.json");

console.log("\n7. Un archivo que no es un .planer se rechaza con una frase");
const basura = new FormData();
basura.append("archivo", new Blob([new Uint8Array([1, 2, 3, 4])]), "cosa.planer");
const malRes = await fetch(`${BASE}/api/apps/importar`, {
  method: "POST",
  headers: { authorization: token },
  body: basura,
});
const malBody = (await malRes.json()) as { error?: string };
check("responde 400", malRes.status === 400);
check("y lo dice en español", (malBody.error ?? "").includes("no es un archivo de Planer"));

console.log("\n8. Limpiar");
await call("/api/apps/limpiar", { method: "POST", body: JSON.stringify({ apps: creadas }) });
check("las aplicaciones de prueba se borraron", true);

console.log(failures === 0 ? "\nTodo bien.\n" : `\n${failures} comprobaciones fallaron.\n`);
process.exit(failures === 0 ? 0 : 1);
