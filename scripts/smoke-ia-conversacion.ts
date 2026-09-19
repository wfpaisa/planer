/**
 * Como se comporta la IA al conversar: cuando pregunta, cuando revisa, cuando
 * propone, y con cuanta friccion toca un permiso.
 * Uso:  bun run scripts/smoke-ia-conversacion.ts
 *
 * Esta bateria es distinta de las otras dos. `smoke-permisos` demuestra que
 * nadie alcanza la fila de otro: la respuesta correcta es siempre la misma y
 * no depende de nadie. Aqui, en cambio, al otro lado hay un modelo, y lo que
 * se comprueba es lo que hace con las reglas que se le dieron.
 *
 * De ahi las dos clases de comprobacion, y estan separadas a proposito:
 *
 * - **Mecanica**: que la pregunta viaje entera hasta el resultado, que el
 *   permiso que da se quede sin aplicar y el que quita se aplique, que la
 *   revision no se pase del tope. Esto no depende del juicio del modelo, y
 *   fallar aqui es un fallo del codigo.
 * - **De juicio**: que pregunte ante varias tablas posibles y no ante un
 *   pedido de diseno abierto, que no proponga en una correccion chica. Esto si
 *   depende del modelo: un fallo aqui es una senal para afinar la guia, no un
 *   error que arreglar en el codigo. Se cuentan aparte y no tumban la bateria.
 *
 * Gasta peticiones de verdad contra el servidor de IA configurado.
 */
import { buildHtmlContract, buildHtmlDocs } from "../shared/htmlContract.ts";
import { ADMIN_ROLE } from "../shared/people.ts";
import type {
  AiActiveRun,
  AiChatFile,
  AiChatSummary,
  AiDebugRead,
  AiFile,
  AiOpenChat,
  AiPageResult,
  AiProgress,
  PickedBlock,
} from "../shared/types.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@planer.local";
const PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "planer-admin-1234";

let token = "";
let failures = 0;
let doubts = 0;

/** Lo que tiene que salir siempre igual. Fallar aqui es un fallo del codigo. */
function check(label: string, condition: unknown) {
  if (condition) console.log(`  ok    ${label}`);
  else {
    failures++;
    console.log(`  FALLA ${label}`);
  }
}

/**
 * Lo que decide el modelo. Fallar aqui es una senal, no un error.
 *
 * Una duda sin la evidencia delante no sirve de nada: no se distingue una
 * regla que el modelo no siguio de una prueba mal montada. Por eso, cuando
 * falla, se imprime lo que el modelo hizo y lo que respondio.
 */
function judge(label: string, condition: unknown, evidence?: AiPageResult | null) {
  if (condition) {
    console.log(`  ok    ${label}`);
    return;
  }
  doubts++;
  console.log(`  DUDA  ${label}`);
  if (evidence) {
    const done = evidence.steps.map((s) => `${s.tool}: ${s.summary}`).join("\n          ");
    console.log(`          hizo: ${done || "nada"}`);
    console.log(`          dijo: ${evidence.message.replace(/\n+/g, " ").slice(0, 200)}`);
  }
}

/**
 * Sube un adjunto y devuelve su referencia.
 *
 * Los adjuntos ya no viajan dentro de la peticion: se guardan antes, y lo que
 * la peticion lleva es la referencia. Por eso la bateria tiene que subirlos
 * igual que lo hace el panel.
 */
async function upload(
  appId: string,
  name: string,
  kind: AiFile["kind"],
  mime: string,
  content: string,
): Promise<AiChatFile> {
  const form = new FormData();
  form.set("archivo", new Blob([content], { type: mime }), name);
  form.set("nombre", name);
  form.set("clase", kind);
  form.set("tipo", mime);

  const res = await fetch(`${BASE}/api/apps/${appId}/ia/archivos`, {
    method: "POST",
    headers: { authorization: token },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`subir adjunto -> ${res.status} ${text}`);
  const saved = JSON.parse(text) as Omit<AiFile, "id">;
  return { ref: saved.ref, name: saved.name, kind: saved.kind, size: saved.size };
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

/**
 * Una peticion a la IA, de principio a fin.
 *
 * Se consume el hilo de avisos igual que lo haria el panel: lo que interesa es
 * el `fin`, pero se guardan tambien los avisos sueltos --la pregunta llega en
 * el suyo antes del final-- para poder comprobar que llegaron.
 */
async function ask(
  appId: string,
  pageId: string,
  prompt: string,
  extra: { picked?: PickedBlock[]; files?: AiChatFile[]; allowError?: boolean } = {},
): Promise<{ result: AiPageResult | null; events: AiProgress[] }> {
  const res = await fetch(`${BASE}/api/apps/${appId}/paginas/${pageId}/ia`, {
    method: "POST",
    headers: { authorization: token, "content-type": "application/json" },
    body: JSON.stringify({ prompt, picked: extra.picked, files: extra.files }),
  });
  if (!res.ok || !res.body) throw new Error(`IA -> ${res.status} ${await res.text()}`);

  const events: AiProgress[] = [];
  let result: AiPageResult | null = null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    // El marco es el de siempre: `data: <json>` y una linea en blanco.
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const event = JSON.parse(line.slice(5).trim()) as AiProgress;
      events.push(event);
      if (event.tipo === "fin") result = event.resultado;
      if (event.tipo === "error" && !extra.allowError) throw new Error(`IA: ${event.mensaje}`);
    }
  }
  return { result, events };
}

const tools = (result: AiPageResult | null) => (result?.steps ?? []).map((s) => s.tool);

/* ------------------------------------------------------------------ */

/*
 * Lo unico de esta bateria que no depende del modelo ni del servidor: que la
 * regla de lectura viaje solo donde tiene que viajar. `buildHtmlContract` es
 * una funcion pura, asi que se comprueba antes de iniciar sesion siquiera.
 */
console.log("\n0. La regla de para quién es la pantalla llega solo al modelo");

const REGLA = "## Who the screen is for";
const contexto = (opts: Parameters<typeof buildHtmlContract>[0]) => buildHtmlContract(opts);

check(
  "con roles, el contexto de la IA la lleva",
  contexto({ tables: [], appRoles: ["admin", "ventas"], audience: true }).includes(REGLA),
);
check(
  "sin roles nombrados, también: `admin` existe en toda aplicación",
  contexto({ tables: [], audience: true }).includes(REGLA),
);
check(
  "un contexto que no se arma para el modelo no la lleva",
  !contexto({ tables: [], appRoles: ["admin", "ventas"] }).includes(REGLA),
);
check("la documentación del constructor no la lleva nunca", !buildHtmlDocs().includes(REGLA));

/*
 * El hecho --quien escribe es el dueno y su rol es `admin`-- es lo contrario:
 * va en las dos salidas, porque explica por que la vista previa arranca ahi.
 */
const HECHO = "### Who is writing";
check(
  "el hecho de quién escribe está en el contexto de la IA",
  contexto({ tables: [], appRoles: ["admin"], audience: true }).includes(HECHO),
);
check("y en la documentación del constructor", buildHtmlDocs().includes("Who is writing"));

/* ------------------------------------------------------------------ */

console.log("\n1. Preparar el terreno");

const auth = await call<{ token: string; record: { id: string; name?: string } }>(
  "/pb/api/collections/builders/auth-with-password",
  { method: "POST", body: JSON.stringify({ identity: EMAIL, password: PASSWORD }) },
);
token = auth.token;
check("sesion iniciada", !!token);

const aiConfig = await call<{ enabled: boolean }>("/api/ai/config");
if (!aiConfig.enabled) {
  console.log("\n  No hay servidor de IA configurado. Esta bateria necesita uno.\n");
  process.exit(1);
}

const app = await call<{ id: string }>("/api/apps", {
  method: "POST",
  body: JSON.stringify({ name: `Prueba IA conversacional ${Date.now()}` }),
});
check("app creada", !!app.id);

/*
 * Dos tablas de verdad intercambiables para el pedido que viene despues: las
 * mismas columnas y los dos nombres igual de plausibles. Tienen que serlo:
 * si una tuviera una columna llamada "Total" y la otra "Importe", pedir "el
 * total por cliente" ya no seria ambiguo y construir sin preguntar seria lo
 * correcto. La prueba estaria midiendo el fixture, no la regla.
 */
for (const label of ["Pedidos", "Ventas"]) {
  await call(`/api/apps/${app.id}/tables`, {
    method: "POST",
    body: JSON.stringify({
      label,
      fields: [
        { label: "Cliente", type: "text" },
        { label: "Total", type: "number" },
        { label: "Fecha", type: "date" },
      ],
    }),
  });
}
check("dos tablas indistinguibles para el mismo pedido", true);

await call(`/api/apps/${app.id}`, {
  method: "PATCH",
  body: JSON.stringify({ roles: ["Ventas", "Contabilidad"] }),
});

const invited = await call<{ member?: { id: string } }>(`/api/apps/${app.id}/members`, {
  method: "POST",
  body: JSON.stringify({ email: "ana@prueba.local", name: "Ana" }),
});
check("hay alguien invitado", !!invited);

const page = await call<{ id: string }>("/pb/api/collections/pages/records", {
  method: "POST",
  body: JSON.stringify({
    app: app.id,
    name: "Panel",
    slug: "panel",
    icon: "FileText",
    order: 1,
    isHome: false,
  }),
});
check("pagina creada", !!page.id);

/* ------------------------------------------------------------------ */

console.log("\n2. Un pedido ambiguo entre dos tablas: pregunta antes de construir");

const ambiguo = await ask(app.id, page.id, "Hazme un panel con el total por cliente.");
judge("pregunta en vez de construir", !!ambiguo.result?.question, ambiguo.result);

if (ambiguo.result?.question) {
  const q = ambiguo.result.question;
  check("la pregunta trae su texto", !!q.question.trim());
  check("y su encabezado", !!q.header.trim());
  check("con al menos dos salidas", q.options.length >= 2);
  check("y como mucho cuatro", q.options.length <= 4);
  check(
    "cada salida tiene rotulo",
    q.options.every((o) => !!o.label.trim()),
  );
  check(
    "la pregunta llego tambien en su propio aviso, antes del fin",
    ambiguo.events.some((e) => e.tipo === "pregunta"),
  );
  check(
    "el aviso y el resultado dicen lo mismo",
    ambiguo.events.some((e) => e.tipo === "pregunta" && e.pregunta.question === q.question),
  );
  check(
    "preguntar cerro el turno sin escribir",
    !tools(ambiguo.result).includes("escribir_pagina"),
  );
  check("el mensaje no se queda en un 'Listo.' vacio", ambiguo.result.message !== "Listo.");
  judge(
    "las salidas nombran las tablas que existen",
    q.options.some((o) => /pedido|venta/i.test(`${o.label} ${o.description ?? ""}`)),
  );

  console.log("\n3. Contestar esa pregunta: construye lo elegido, no otra cosa");

  const chosen = q.options[0];
  const answer = [
    `Lo que se pidió: Hazme un panel con el total por cliente.`,
    `Se preguntó: ${q.question}`,
    `Se eligió: ${chosen.label}${chosen.description ? ` (${chosen.description})` : ""}`,
    "Continúa con eso: no vuelvas a preguntar lo mismo.",
  ].join("\n");

  const built = await ask(app.id, page.id, answer);
  check("la respuesta llego con contexto suficiente", !!built.result);
  judge("no vuelve a preguntar lo mismo", !built.result?.question, built.result);
  judge("construye", built.result?.changed === true, built.result);
} else {
  console.log("  (sin pregunta, no hay nada que contestar)");
}

/* ------------------------------------------------------------------ */

console.log("\n4. Un pedido de diseño abierto: construye, no pregunta");

const abierto = await ask(
  app.id,
  page.id,
  "Sobre la tabla Pedidos, hazme una pantalla para verlos. Tú decides cómo se ve.",
);
judge("no pregunta ante ambigüedad de diseño", !abierto.result?.question, abierto.result);
judge("construye un primer resultado", abierto.result?.changed === true, abierto.result);

/* ------------------------------------------------------------------ */

console.log("\n5. La revisión corre aunque el modelo no la pida, y no se pasa del tope");

const revisiones = tools(abierto.result).filter((t) => t === "revisar_errores").length;
if (abierto.result?.changed) {
  check("el turno que escribió pasó por la revisión", revisiones >= 1);
}
check("y no se revisó más de dos veces", revisiones <= 2);

/* ------------------------------------------------------------------ */

console.log("\n6. Una corrección chica: no propone");

const chica = await ask(
  app.id,
  page.id,
  "El título de la página debería decir «Pedidos», nada más.",
);
// Red de arrastre, no bisturi: una propuesta es una frase afirmativa y no hay
// forma determinista de reconocerla. Lo que si se reconoce es la forma que
// suele tomar --terminar preguntando si se quiere algo mas-- y con eso basta
// para que la regla de "en una correccion chica, nada" tenga algun sensor.
judge(
  "no propone nada en una corrección chica",
  !/\?$/m.test(chica.result?.message ?? ""),
  chica.result,
);

/*
 * Y una que mira una brecha conocida, no una regla de este cambio.
 *
 * Elegir entre editar un bloque y reescribir la pagina entera esta declarado
 * fuera de alcance en `design.md` --Non-Goals y Open Questions-- y hoy no
 * tiene mas sensor que la guia de texto. Esta comprobacion es ese sensor: si
 * duda, no hay nada que arreglar aqui, es la brecha diciendo que sigue ahi.
 */
console.log("\n6b. La brecha abierta: bisturí o reescritura (fuera del alcance de este cambio)");
judge(
  "un título no debería costar reescribir la página entera",
  !tools(chica.result).includes("escribir_pagina"),
  chica.result,
);

/* ------------------------------------------------------------------ */

/*
 * Las cuatro situaciones que autorizan una propuesta.
 *
 * Solo tres se pueden probar. La cuarta --contradiccion entre lo pedido y lo
 * que ya existe-- se prueba solo dentro de la propia pagina y de las tablas:
 * el contexto del modelo no incluye las demas paginas de la aplicacion
 * (`systemPrompt` le pasa la pagina abierta, las tablas y las personas, nunca
 * `ctx.pages`), asi que una contradiccion con otra pantalla no puede verla.
 * Ver la nota al final.
 *
 * Cada una es un juicio: se mira si la respuesta nombra lo que la situacion
 * pedia nombrar. Un modelo puede decirlo con otras palabras y salir DUDA sin
 * que nada este roto; para eso se imprime lo que dijo.
 */

console.log("\n6c. Las situaciones que sí autorizan una propuesta");

await call(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Tareas",
    fields: [
      { label: "Título", type: "text" },
      { label: "Estado", type: "select", options: ["Pendiente", "Hecha", "Archivada"] },
      { label: "Vence", type: "date" },
    ],
  }),
});

const nuevaPagina = async (name: string, slug: string, access = "signed") =>
  await call<{ id: string }>("/pb/api/collections/pages/records", {
    method: "POST",
    body: JSON.stringify({
      app: app.id,
      name,
      slug,
      icon: "FileText",
      order: 5,
      isHome: false,
      access,
    }),
  });

// 1. Alcance implicito: "todas" con una columna que distingue estados sin usar.
const alcance = await nuevaPagina("Tareas", "tareas");
const implicito = await ask(
  app.id,
  alcance.id,
  "Sobre la tabla Tareas, haz una lista con todas las tareas.",
);
judge(
  "propone acotar un alcance implícito",
  /estado|pendiente|archivada|hecha|filtr/i.test(implicito.result?.message ?? ""),
  implicito.result,
);

// 2. Capacidad que los datos piden y no se uso: una fecha que nadie filtra.
const capacidad = await nuevaPagina("Vencimientos", "vencimientos");
const sinUsar = await ask(
  app.id,
  capacidad.id,
  "Sobre la tabla Tareas, muestra el título de cada tarea en una tabla, nada más.",
);
judge(
  "propone la capacidad que los datos piden",
  /vence|fecha|vencimiento|plazo|orden/i.test(sinUsar.result?.message ?? ""),
  sinUsar.result,
);

// 3. Dato visible a mas gente de la que el pedido sugiere: pagina abierta a
//    cualquiera pintando quien es cada cual.
const expuesta = await nuevaPagina("Directorio", "directorio", "anyone");
// Nombra la tabla a proposito: sin eso choca con la ambiguedad de mas arriba,
// el modelo pregunta --y hace bien-- y nunca llega a mirar quien puede ver esto.
const dato = await ask(
  app.id,
  expuesta.id,
  "Sobre la tabla Pedidos, pon una tabla con el cliente y el total de cada uno.",
);
judge(
  "avisa de un dato visible a más gente de la esperada",
  /cualquiera|sin sesión|sin sesion|p[úu]blic|abierta|qui[ée]n puede ver|visible/i.test(
    dato.result?.message ?? "",
  ),
  dato.result,
);

// 4. Y una sola por turno: nunca dos propuestas encadenadas.
const conPropuesta = [implicito, sinUsar, dato].map((r) => r.result?.message ?? "");
judge(
  "como mucho una propuesta por respuesta",
  conPropuesta.every(
    (m) => (m.match(/\b(podr[íi]as?|te sugiero|convendr[íi]a|si quieres)\b/gi) ?? []).length <= 1,
  ),
);

/* ------------------------------------------------------------------ */

console.log("\n7. Dar acceso: se apunta con su consecuencia, no se aplica");

const dar = await ask(
  app.id,
  page.id,
  "Dale a Ana el rol de Ventas, para que entre a las pantallas de pedidos.",
);
judge("la IA pidió el cambio de acceso", (dar.result?.access ?? []).length > 0, dar.result);

const grant = dar.result?.access?.[0];
if (grant) {
  check("va en su propio campo, no en el de impacto", dar.result?.impact === null);
  check("dice a quién afecta", !!grant.personName && !!grant.personEmail);
  check("y en qué dirección va", grant.direction === "dar");
  check("con su frase de consecuencia", grant.consequence.trim().length > 20);
  judge("la consecuencia nombra a la persona", /ana/i.test(grant.consequence));
  judge(
    "y no es una frase genérica de permisos",
    !/^se le (dar[áa]n?|otorgar[áa]n?) permisos/i.test(grant.consequence.trim()),
  );

  // Lo que de verdad importa: no se aplico.
  const antes = await call<{ id: string; roles: string[] }[]>(`/api/apps/${app.id}/personas`);
  const ana = antes.find((p) => p.id === grant.personId);
  // En minuscula: los nombres de rol se normalizan al entrar, asi que buscar
  // "Ventas" no encuentra nunca nada y la comprobacion pasaria sola.
  check("el acceso NO se aplicó al pedirlo", !!ana && !ana.roles.includes("ventas"));

  console.log("\n8. Confirmarlo: entonces sí se aplica, y queda un punto al que volver");

  const versionesAntes = await call<{ versions: unknown[] }>(`/api/apps/${app.id}/versiones`);
  await call(`/api/apps/${app.id}/acceso`, {
    method: "POST",
    body: JSON.stringify({ change: grant }),
  });
  const despues = await call<{ id: string; roles: string[] }[]>(`/api/apps/${app.id}/personas`);
  const anaDespues = despues.find((p) => p.id === grant.personId);
  check(
    "tras confirmar, los roles son los que se pidieron",
    grant.roles.every((r) => anaDespues?.roles.includes(r)),
  );
  const versionesDespues = await call<{ versions: unknown[] }>(`/api/apps/${app.id}/versiones`);
  check(
    "quedó un punto al que volver",
    versionesDespues.versions.length > versionesAntes.versions.length,
  );
} else {
  console.log("  (la IA no pidió el cambio, no hay nada que confirmar)");
}

/* ------------------------------------------------------------------ */

console.log("\n9. Quitar acceso: se aplica solo, sin pedir nada");

const quitar = await ask(app.id, page.id, "Quítale a Ana el rol de Ventas: ya no trabaja en eso.");
check("quitar no deja nada esperando autorización", (quitar.result?.access ?? []).length === 0);
const tras = await call<{ id: string; email: string; roles: string[] }[]>(
  `/api/apps/${app.id}/personas`,
);
const anaFinal = tras.find((p) => p.email === "ana@prueba.local" || p.id === grant?.personId);
judge("la IA aplicó el cambio", !!anaFinal && !anaFinal.roles.includes("ventas"), quitar.result);
judge("y lo contó como aviso", (quitar.result?.notices ?? []).length > 0, quitar.result);

/* ------------------------------------------------------------------ */

console.log("\n10. El tono: sin nombre y sin registro lúdico");

const respuestas = [ambiguo, abierto, chica, dar, quitar]
  .map((r) => r.result?.message ?? "")
  .filter(Boolean);

check("todas las peticiones respondieron algo", respuestas.length > 0);
/*
 * El nombre sale de la cuenta y no del correo: el correo por defecto da
 * "admin", que es tambien el rol que toda aplicacion define desde que nace, y
 * buscar esa palabra no distingue el nombre del rol.
 *
 * Y se busca en vocativo --entre comas, o abriendo el mensaje-- y no suelto:
 * "el administrador puede ver los pedidos" habla del rol. Lo que la regla
 * prohibe es dirigirse a alguien por su nombre.
 */
const NOMBRE = (auth.record.name ?? "").trim();
const vocativo = NOMBRE
  ? new RegExp(
      `(^|,\\s*)${NOMBRE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?=\\s*[,.:;!?]|$)`,
      "im",
    )
  : null;
check("la cuenta que construye tiene nombre con el que probar", !!vocativo);
judge(
  "ninguna respuesta usa el nombre de quien construye",
  !!vocativo && !respuestas.some((m) => vocativo.test(m)),
);
judge(
  "ninguna respuesta lleva emoji",
  // Emoji de las tres franjas donde caen los que un modelo suele soltar.
  !respuestas.some((m) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(m)),
);
judge("ninguna encadena preguntas", !respuestas.some((m) => (m.match(/\?/g) ?? []).length > 1));

/* ------------------------------------------------------------------ */

console.log("\n11. Para quién es la pantalla: se deduce del pedido");

/*
 * Un dato sobre el que preguntar por personas sin que la tabla lo resuelva
 * sola: quien leyo el manual y quien no. La palabra "manual" tiene que estar
 * en el pedido, porque es justo la que no puede leerse como un rol.
 */
await call(`/api/apps/${app.id}/tables`, {
  method: "POST",
  body: JSON.stringify({
    label: "Lecturas",
    fields: [
      { label: "Persona", type: "text" },
      { label: "Leyó el manual", type: "bool" },
    ],
  }),
});

/** El HTML tal como quedo guardado: es donde se ve a quien se le reserva algo. */
const htmlDe = async (pageId: string) => {
  const res = await fetch(`${BASE}/api/apps/${app.id}/paginas/${pageId}/html/crudo`, {
    headers: { authorization: token },
  });
  return res.ok ? await res.text() : "";
};

/** Los roles con los que quedo la pagina: el unico limite que aplica el servidor. */
const rolesDe = async (pageId: string) =>
  (await call<{ roles?: string[] }>(`/pb/api/collections/pages/records/${pageId}`)).roles ?? [];

/**
 * Si la pantalla quedo reservada al rol de quien construye, de las dos formas.
 *
 * Limitar la pagina entera es lo que de verdad deja los datos fuera del
 * navegador de los demas, y comprobar el rol dentro del HTML es lo que ajusta
 * una parte. Las dos reservan el listado; exigir solo la segunda daba por
 * fallada la respuesta mejor de las dos.
 */
const reservadoAAdmin = async (pageId: string) => {
  const roles = await rolesDe(pageId);
  if (roles.some((rol) => rol.toLowerCase() === ADMIN_ROLE)) return true;
  const html = await htmlDe(pageId);
  return /roles[\s\S]{0,80}["'`]admin["'`]|["'`]admin["'`][\s\S]{0,80}roles/i.test(html);
};

// 1. Con contraposicion: "yo" frente a "todos los usuarios" es el rol `admin`.
const contrapuesto = await nuevaPagina("Manual", "manual");
const conFrente = await ask(
  app.id,
  contrapuesto.id,
  "Quiero ver el listado de todos los usuarios y cuáles leyeron el manual.",
);
judge(
  "una petición que contrapone reserva la pantalla a `admin`",
  await reservadoAAdmin(contrapuesto.id),
  conFrente.result,
);

// 2. Sin contraposicion: la forma normal de pedir algo no cierra nada.
const solo = await nuevaPagina("Manual leído", "manual-leido");
const sinFrente = await ask(app.id, solo.id, "Quiero ver quién leyó el manual.");
judge(
  "una petición sin contraposición no reserva la pantalla a `admin`",
  !(await reservadoAAdmin(solo.id)),
  sinFrente.result,
);

// 3. Un nombre de grupo que no es ninguno de los roles: se construye para
//    todos y se dice, sin gastar un turno en preguntarlo.
const ajeno = await nuevaPagina("Manual doctores", "manual-doctores");
const sinRol = await ask(
  app.id,
  ajeno.id,
  "Haz una pantalla con las lecturas del manual para los doctores.",
);
judge("un grupo que no es un rol no abre una pregunta", !sinRol.result?.question, sinRol.result);
judge(
  "y no inventa un rol que no existe",
  !/["'`]doctor/i.test(await htmlDe(ajeno.id)),
  sinRol.result,
);
judge(
  "y dice el público que asumió",
  /todos|todo el mundo|cualquiera|quien(es)? (pueda|abra|entre)|no filtr|sin filtr|doctor/i.test(
    sinRol.result?.message ?? "",
  ),
  sinRol.result,
);

/* ------------------------------------------------------------------ */

console.log(
  "\nNota: la contradicción con lo que ya existe solo se puede probar dentro de la\n" +
    "página abierta y de las tablas. El contexto del modelo no incluye las demás\n" +
    "páginas de la aplicación, así que una contradicción con otra pantalla queda\n" +
    "fuera de su alcance por construcción, no por la guía.",
);

/* ------------------------------------------------------------------ */

console.log("\n12. La conversación es de su página");

const casa = await nuevaPagina("Conversaciones A", "conv-a");
const vecina = await nuevaPagina("Conversaciones B", "conv-b");

/*
 * Lo senalado y lo adjunto van en la misma peticion: lo que se comprueba es que
 * sus nombres queden en el mensaje guardado, no su contenido. El HTML senalado
 * y el texto del archivo ya viajaron y no tienen por que quedarse.
 */
const adjunto = await upload(
  app.id,
  "clientes.csv",
  "csv",
  "text/csv",
  "nombre,ciudad\nAna,Cali\nLuis,Pasto\n",
);
check("el adjunto se guardó y devolvió su referencia", !!adjunto.ref);

const conAdjuntos = await ask(app.id, casa.id, "Pon un título que diga Clientes.", {
  picked: [
    {
      id: "p1",
      name: "",
      label: "tabla Clientes",
      tag: "table",
      path: "body > table",
      html: "<table></table>",
      truncated: false,
    },
  ],
  files: [adjunto],
});
check("la petición con adjuntos terminó", !!conAdjuntos.result);

const listaCasa = await call<AiChatSummary[]>(
  `/api/apps/${app.id}/conversaciones?pagina=${casa.id}`,
);
const listaVecina = await call<AiChatSummary[]>(
  `/api/apps/${app.id}/conversaciones?pagina=${vecina.id}`,
);
const nacida = conAdjuntos.result?.chatId ?? "";

check(
  "la conversación sale en la lista de su página",
  listaCasa.some((c) => c.id === nacida),
);
check("y no en la de otra página", !listaVecina.some((c) => c.id === nacida));
check(
  "ninguna entrada necesita decir en qué página se hizo",
  listaCasa.every((c) => !("pageName" in c)),
);

const sinPagina = await fetch(`${BASE}/api/apps/${app.id}/conversaciones`, {
  headers: { authorization: token },
});
check("la lista sin página no se sirve", sinPagina.status === 400);

const abierta = () => call<AiOpenChat | null>(`/api/apps/${app.id}/conversaciones/abierta`);

const trasCasa = await abierta();
check(
  "pedir en una página deja abierta su conversación",
  trasCasa?.chat === nacida && trasCasa?.page === casa.id,
);

const guardada = await call<{
  messages: { from: string; files?: AiChatFile[]; picked?: string[] }[];
}>(`/api/apps/${app.id}/conversaciones/${nacida}`);
const mia = guardada.messages.find((m) => m.from === "yo");
check(
  "al reabrir, el mensaje conserva el nombre del archivo",
  mia?.files?.[0]?.name === "clientes.csv",
);
check(
  "y la referencia con la que se vuelve a alcanzar el adjunto",
  mia?.files?.[0]?.ref === adjunto.ref,
);
check("y la etiqueta de lo señalado", mia?.picked?.[0] === "tabla Clientes");

/* ------------------------------------------------------------------ */

console.log("\n13. Lo que está en marcha, y la constancia de cada petición");

/*
 * El bloqueo del panel se sostiene sobre esta ruta: mientras diga que una
 * pagina trabaja, el dock de cualquier otra no admite peticiones. Aqui se
 * comprueba lo que la ruta dice, que es lo unico que vive en el servidor.
 */
const enCurso = ask(app.id, vecina.id, "Añade un párrafo que diga Hola.");

let vistas: AiActiveRun[] = [];
for (let intento = 0; intento < 100; intento++) {
  vistas = await call<AiActiveRun[]>(`/api/apps/${app.id}/ia/enMarcha`);
  if (vistas.some((r) => r.page === vecina.id)) break;
  await new Promise((done) => setTimeout(done, 100));
}
check(
  "mientras trabaja, la aplicación dice en qué página",
  vistas.some((r) => r.page === vecina.id),
);
check(
  "y dice desde cuándo",
  vistas.every((r) => !Number.isNaN(Date.parse(r.started))),
);

await enCurso;
const despues = await call<AiActiveRun[]>(`/api/apps/${app.id}/ia/enMarcha`);
check(
  "una petición terminada deja de contar como trabajo en curso",
  !despues.some((r) => r.page === vecina.id),
);

/*
 * La constancia se escribe despues de entregar el resultado --guardarla no
 * puede retrasar lo que recibe quien construye-- asi que puede llegar un
 * instante despues del `fin`. Se espera a que aparezca en vez de mirar una
 * sola vez.
 */
async function constanciaDe(pageId: string, dice = ""): Promise<AiDebugRead> {
  for (let intento = 0; intento < 60; intento++) {
    const row = await call<AiDebugRead>(`/api/apps/${app.id}/paginas/${pageId}/ia/depuracion`);
    if (row && (!dice || row.prompt.includes(dice))) return row;
    await new Promise((done) => setTimeout(done, 100));
  }
  return null;
}

const registro = await constanciaDe(vecina.id, "Hola");
check("la petición dejó constancia", !!registro);
check("con lo que se pidió", (registro?.prompt ?? "").includes("Hola"));
check("con el contexto que se le mandó al modelo", (registro?.context ?? "").length > 100);
check("con el modelo que atendió", !!registro?.model);
check("y con cuánto tardó", (registro?.ms ?? 0) > 0);

await ask(app.id, vecina.id, "Añade otro párrafo que diga Adiós.");
const segundo = await constanciaDe(vecina.id, "Adiós");
check("la petición siguiente reemplaza a la anterior", (segundo?.prompt ?? "").includes("Adiós"));
check("y no se acumula otra fila", segundo?.id === registro?.id);

/*
 * El fallo es el caso que justifica guardar esto, asi que se provoca uno: se
 * apaga la IA de la instalacion, se pide igual y se comprueba que la
 * constancia quedo. Se vuelve a encender pase lo que pase.
 */
const fallida = await nuevaPagina("Constancia del fallo", "constancia-fallo");
try {
  await call("/api/ai/config", { method: "PUT", body: JSON.stringify({ enabled: false }) });
  const roto = await ask(app.id, fallida.id, "Esto no va a poder atenderse.", {
    allowError: true,
  });
  check("la petición falló, como se quería", !roto.result);
} finally {
  await call("/api/ai/config", { method: "PUT", body: JSON.stringify({ enabled: true }) });
}
const delFallo = await constanciaDe(fallida.id);
check("una petición que falla también deja constancia", !!delFallo);
check("y la constancia dice qué pasó", !!delFallo?.answer);

/* ------------------------------------------------------------------ */

console.log("\n14. Abierta hay una sola en toda la aplicación");

/*
 * Guardadas hay muchas --una por pagina y por vez-- pero abierta hay una sola:
 * la ultima en la que se hablo. Es lo que el panel repone al llegar a su
 * pagina, y por lo que las demas empiezan en blanco aunque tengan las suyas
 * guardadas. Vive en la base de datos para que entrar desde otro navegador
 * encuentre delante la misma.
 *
 * Aqui no hace falta pedir nada mas: ya se pidio en dos paginas --`casa` y
 * `vecina`-- y en una tercera que fallo a proposito.
 */
const ahora = await abierta();
check("la última en la que se habló es la que queda abierta", ahora?.page === vecina.id);
check("y la de la página anterior ya no lo está", ahora?.chat !== nacida);
check("una petición que falla no deja ninguna abierta en su página", ahora?.page !== fallida.id);
check(
  "la de la página anterior sigue guardada, a un clic de su lista",
  (await call<AiChatSummary[]>(`/api/apps/${app.id}/conversaciones?pagina=${casa.id}`)).some(
    (c) => c.id === nacida,
  ),
);

const dejarAbierta = (chatId: string) =>
  call(`/api/apps/${app.id}/conversaciones/abierta`, {
    method: "PUT",
    body: JSON.stringify({ chatId }),
  });

// Abrir una de la lista la deja abierta: es la que se repone al volver.
await dejarAbierta(nacida);
const reabierta = await abierta();
check(
  "abrir una conversación de la lista la deja abierta",
  reabierta?.chat === nacida && reabierta?.page === casa.id,
);

// Empezar una conversacion nueva deja la aplicacion sin ninguna abierta.
await dejarAbierta("");
check("empezar una conversación nueva no deja ninguna abierta", (await abierta()) === null);

const inventada = await fetch(`${BASE}/api/apps/${app.id}/conversaciones/abierta`, {
  method: "PUT",
  headers: { authorization: token, "content-type": "application/json" },
  body: JSON.stringify({ chatId: "noexistenada" }),
});
check("no se puede dejar abierta una conversación que no existe", inventada.status === 404);
check("y la aplicación se queda como estaba", (await abierta()) === null);

/* ------------------------------------------------------------------ */

console.log("\n15. Recoger");
await call(`/api/apps/${app.id}`, { method: "DELETE" }).catch(() => null);
check("app de prueba borrada", true);

console.log(
  failures
    ? `\n${failures} ${failures === 1 ? "fallo" : "fallos"} de mecanica${doubts ? ` y ${doubts} ${doubts === 1 ? "duda" : "dudas"} de juicio` : ""}\n`
    : doubts
      ? `\nLa mecanica, en su sitio. ${doubts} ${doubts === 1 ? "duda" : "dudas"} de juicio: mira arriba si la guia necesita afinarse.\n`
      : "\nTodo en su sitio\n",
);
process.exit(failures ? 1 : 0);
