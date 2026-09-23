/**
 * Crea una aplicación de ejemplo para ver la plataforma funcionando.
 * Uso:  bun run scripts/demo.ts
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@planer.local";
const PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "planer-admin-1234";

let token = "";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", token);
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

const auth = await call<{ token: string }>("/pb/api/collections/builders/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
});
token = auth.token;

const app = await call<{ id: string; slug: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: "Directorio de empleados", icon: "Users", color: "amber" }),
});

const empleados = await call<{
  id: string;
  dataCollection: string;
  fields: { id?: string; name: string }[];
}>(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Empleados",
    icon: "Users",
    fields: [
      { name: "nombre", label: "Nombre", type: "text", required: true },
      { name: "correo", label: "Correo", type: "email" },
      {
        name: "area",
        label: "Area",
        type: "select",
        options: ["Diseno", "Ingenieria", "Marketing", "Ventas", "Soporte", "Finanzas"],
      },
      { name: "presentacion", label: "Presentacion", type: "longtext" },
      { name: "ingreso", label: "Ingreso", type: "date" },
      { name: "salario", label: "Salario", type: "number" },
      { name: "activo", label: "Activo", type: "bool" },
    ],
  }),
});

const PEOPLE = [
  [
    "Jane Smith",
    "jane.smith@example.com",
    "Diseno",
    "Contenta de sumarme al equipo. Trabajo en interfaces y en el sistema de diseno.",
    4200,
  ],
  [
    "Michael Johnson",
    "michael.johnson@example.com",
    "Ingenieria",
    "Feliz de ser parte del equipo. Me gusta hablar de rendimiento y de CSS.",
    4800,
  ],
  [
    "Hannah Smith",
    "hannah.smith@example.com",
    "Marketing",
    "Con ganas de aportar en campanas y de conectar con la audiencia.",
    3900,
  ],
  [
    "Robert Brown",
    "robert.brown@example.com",
    "Ventas",
    "Vengo del sector retail. Me enfoco en cuentas grandes.",
    4100,
  ],
  [
    "Linda Garcia",
    "linda.garcia@example.com",
    "Soporte",
    "Atiendo a los clientes y documento lo que aprendemos de ellos.",
    3400,
  ],
  [
    "William Martinez",
    "william.martinez@example.com",
    "Finanzas",
    "Llevo el control de presupuestos y proyecciones.",
    4500,
  ],
  [
    "Elizabeth Wilson",
    "elizabeth.wilson@example.com",
    "Ingenieria",
    "Trabajo en la base de datos y en las integraciones internas.",
    5200,
  ],
  [
    "David Lee",
    "david.lee@example.com",
    "Ventas",
    "Reparto mi tiempo entre nuevos clientes y renovaciones.",
    4000,
  ],
  [
    "Jessica Harris",
    "jessica.harris@example.com",
    "Marketing",
    "Escribo y coordino el calendario de contenidos.",
    3700,
  ],
] as const;

let day = 23;
for (const [nombre, correo, area, presentacion, salario] of PEOPLE) {
  await call(`/pb/api/collections/${empleados.dataCollection}/records`, {
    method: "POST",
    body: JSON.stringify({
      nombre,
      correo,
      area,
      presentacion,
      salario,
      activo: true,
      ingreso: `2025-11-${String(day--).padStart(2, "0")} 09:00:00.000Z`,
    }),
  });
}

const pages = await call<{ items: { id: string; isHome: boolean }[] }>(
  `/pb/api/collections/pages/records?filter=${encodeURIComponent(`app="${app.id}"`)}`,
);
const home = pages.items.find((p) => p.isHome) ?? pages.items[0];

/** El manifiesto de la tabla: cada columna por su id interno. */
const fuente = {
  name: "empleados",
  tableId: empleados.id,
  fields: Object.fromEntries(
    empleados.fields.filter((f) => f.id).map((f) => [f.name, f.id as string]),
  ),
};

/** Una página es un documento HTML; Planer le inyecta los estilos y el puente. */
const documento = (titulo: string, cuerpo: string, guion: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
</head>
<body>
  <main class="pagina">
    <h1>${titulo}</h1>
    ${cuerpo}
  </main>
  <script>
    window.addEventListener("plane:listo", async function () {
      try {
        ${guion}
      } catch (error) {
        document.querySelector(".pagina").insertAdjacentHTML(
          "beforeend",
          "<p>" + error.message + "</p>",
        );
      }
    });
  </script>
</body>
</html>
`;

/** Guarda el HTML de una página con las tablas que puede pedir. */
const escribir = (pageId: string, html: string) =>
  call(`/api/apps/${app.id}/paginas/${pageId}/html`, {
    method: "PUT",
    body: JSON.stringify({ content: html, sources: [fuente] }),
  });

await call(`/pb/api/collections/pages/records/${home.id}`, {
  method: "PATCH",
  body: JSON.stringify({ name: "Buscador", icon: "Search" }),
});

await escribir(
  home.id,
  documento(
    "Buscador general",
    `<p>Busca en todo el directorio de la empresa.</p>
    <input id="q" type="search" placeholder="Nombre, correo o area">
    <div id="totales"></div>
    <div id="fichas"></div>`,
    `var todos = (await plane.listar("empleados", { limite: 200 })).filas;
        var media = todos.reduce(function (t, p) { return t + (p.salario || 0); }, 0) / (todos.length || 1);
        document.getElementById("totales").textContent =
          todos.length + " personas, " + todos.filter(function (p) { return p.activo; }).length +
          " activas, salario promedio " + Math.round(media);

        function pintar(lista) {
          document.getElementById("fichas").innerHTML = lista
            .map(function (p) {
              return "<article><h2>" + p.nombre + "</h2><p>" + (p.correo || "") +
                "</p><p>" + (p.area || "") + "</p><p>" + (p.presentacion || "") + "</p></article>";
            })
            .join("");
        }
        pintar(todos.slice(0, 6));

        document.getElementById("q").addEventListener("input", function (e) {
          var texto = e.target.value.toLowerCase();
          pintar(
            todos.filter(function (p) {
              return (p.nombre + " " + p.correo + " " + p.area).toLowerCase().includes(texto);
            }).slice(0, 12),
          );
        });`,
  ),
);

const listado = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Empleados",
    slug: "empleados",
    icon: "Users",
    order: 1,
    isHome: false,
  }),
});

await escribir(
  listado.id,
  documento(
    "Todo el equipo",
    `<p>Toca una fila para ver la ficha completa.</p>
    <table><thead><tr><th>Nombre</th><th>Correo</th><th>Area</th><th>Ingreso</th></tr></thead>
    <tbody id="filas"></tbody></table>
    <div id="ficha"></div>`,
    `var r = await plane.listar("empleados", { limite: 50 });
        document.getElementById("filas").innerHTML = r.filas
          .map(function (p) {
            return "<tr data-id='" + p.id + "'><td>" + p.nombre + "</td><td>" + (p.correo || "") +
              "</td><td>" + (p.area || "") + "</td><td>" + (p.ingreso || "").slice(0, 10) + "</td></tr>";
          })
          .join("");

        document.getElementById("filas").addEventListener("click", async function (e) {
          var fila = e.target.closest("tr");
          if (!fila) return;
          var p = await plane.obtener("empleados", fila.dataset.id);
          document.getElementById("ficha").innerHTML =
            "<h2>" + p.nombre + "</h2><p>" + (p.presentacion || "") + "</p>";
        });`,
  ),
);

const alta = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Alta de personal",
    slug: "alta",
    icon: "UserRound",
    order: 2,
    isHome: false,
  }),
});

await escribir(
  alta.id,
  documento(
    "Nueva persona",
    `<p>Los datos entran directo al directorio.</p>
    <form id="alta">
      <input name="nombre" placeholder="Nombre" required>
      <input name="correo" type="email" placeholder="Correo">
      <input name="area" placeholder="Area">
      <button type="submit">Anadir al directorio</button>
    </form>
    <p id="aviso"></p>`,
    `document.getElementById("alta").addEventListener("submit", async function (e) {
          e.preventDefault();
          var datos = Object.fromEntries(new FormData(e.target).entries());
          try {
            await plane.crear("empleados", { ...datos, activo: true });
            e.target.reset();
            document.getElementById("aviso").textContent = "Persona anadida al directorio.";
          } catch (error) {
            document.getElementById("aviso").textContent = error.message;
          }
        });`,
  ),
);

await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ published: true, visibility: "public" }),
});

console.log(`\nAplicacion de ejemplo lista.`);
console.log(`  Panel:     ${BASE}/a/${app.id}/datos`);
console.log(`  Publicada: ${BASE}/p/${app.slug}\n`);
