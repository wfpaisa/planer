/**
 * Punto de entrada. Arranca PocketBase, prepara las colecciones internas
 * y levanta el servidor web (panel + apps publicadas + API propia).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { bootstrap } from "./bootstrap.ts";
import { config, INTERNAL } from "./config.ts";
import {
  ASSETS_TAG,
  BRIDGE_FILE,
  BRIDGE_PATH,
  CHARTS_FILE,
  CHARTS_PATH,
  STYLES_FILE,
  STYLES_PATH,
} from "./pageAssets.ts";
import { pb } from "./pb.ts";
import * as api from "./routes.ts";
import { toResponse } from "./routes.ts";

const ROOT = join(import.meta.dir, "..");
const PB_BIN = join(ROOT, "pb", "pocketbase");
const DIST = join(ROOT, "web", "dist");

/* ------------------------------------------------------------------ */
/* PocketBase como proceso hijo                                         */
/* ------------------------------------------------------------------ */

/** Aborta con un mensaje claro en vez de dejar dos servidores peleando. */
function alreadyRunning(what: string, port: number): never {
  console.error(`\n  Ya hay algo escuchando en el puerto ${port} (${what}).`);
  console.error("  Seguramente Planer ya esta encendido en otra terminal.");
  console.error("  Cierra esa instancia, o cambia los puertos en el archivo .env\n");
  process.exit(1);
}

/**
 * Al recargar en desarrollo el puerto tarda un instante en liberarse,
 * asi que insistimos un poco antes de dar por ocupado.
 */
async function portTaken(port: number, waitMs = 3000): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } }).stop(true);
      return false;
    } catch {
      if (Date.now() >= deadline) return true;
      await Bun.sleep(150);
    }
  }
}

const pocketBaseAnswers = () =>
  fetch(`${config.pbUrl}/api/health`)
    .then((r) => r.ok)
    .catch(() => false);

async function startPocketBase() {
  if (!existsSync(PB_BIN)) {
    console.error(`\nNo encuentro el programa de PocketBase en ${PB_BIN}`);
    console.error("Descargalo con:  bun run pocketbase:get\n");
    process.exit(1);
  }

  // Si el puerto del panel esta ocupado, ya hay otro Planer encendido.
  if (await portTaken(config.port)) alreadyRunning("el servidor de Planer", config.port);

  // Al recargar en desarrollo, PocketBase suele seguir vivo. Lo reutilizamos:
  // volver a escribir la cuenta de administrador invalidaria las sesiones.
  if (await pocketBaseAnswers()) {
    console.log("  Reutilizando el PocketBase que ya estaba encendido.");
    return null;
  }
  if (await portTaken(config.pbPort, 1000)) alreadyRunning("otro programa", config.pbPort);

  // La cuenta de administrador se crea o actualiza en cada arranque.
  const upsert = Bun.spawn(
    [PB_BIN, "superuser", "upsert", config.adminEmail, config.adminPassword],
    { cwd: join(ROOT, "pb"), stdout: "pipe", stderr: "pipe" },
  );
  await upsert.exited;

  // Sin --automigrate: bootstrap.ts ya es la fuente de verdad del esquema
  // interno (idempotente, en el orden correcto). Dejar que PocketBase anote
  // cada coleccion como una migracion aparte solo acumula archivos que, al
  // compartir el mismo segundo de creacion, se reproducen en orden alfabetico
  // y no en el orden real -> el siguiente arranque en limpio se rompe solo.
  const child = Bun.spawn(
    [PB_BIN, "serve", "--http", `127.0.0.1:${config.pbPort}`, "--automigrate=0"],
    {
      cwd: join(ROOT, "pb"),
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  const stop = () => {
    child.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("exit", () => child.kill());

  // Esperamos a que responda.
  for (let i = 0; i < 100; i++) {
    if (await pocketBaseAnswers()) return child;
    await Bun.sleep(100);
  }
  throw new Error("PocketBase no arranco a tiempo");
}

/* ------------------------------------------------------------------ */
/* Proxy hacia PocketBase                                               */
/* ------------------------------------------------------------------ */

/**
 * Lo que el navegador puede pedirle a PocketBase por la puerta publica.
 *
 * La lista no puede ser mas corta: el panel lee y escribe los registros
 * directo contra la base. Lo que se cierra es la otra API --definir
 * colecciones, los ajustes, los respaldos, entrar como superusuario--, que se
 * alcanza solo por `config.adminPath`.
 */
function publicPbPath(path: string): boolean {
  if (/(^|\/)_superusers(\/|$)/.test(path)) return false;
  return (
    path === "/api/health" ||
    path === "/api/batch" ||
    path.startsWith("/api/files/") ||
    /^\/api\/collections\/[^/]+\/(records|auth-with-password|auth-refresh)(\/|$)/.test(path)
  );
}

/**
 * Reenvia a PocketBase. La ruta llega ya sin el prefijo por el que entro.
 *
 * `clientIp` es de quien llamo. Va delante porque el tope de intentos de
 * PocketBase reparte por direccion, y todo le llega desde este mismo proceso:
 * sin decirselo, el tope seria uno solo para toda la instalacion y los
 * intentos fallidos de cualquiera cerrarian la puerta a los demas.
 */
async function proxyToPocketBase(req: Request, path: string, clientIp: string): Promise<Response> {
  const url = new URL(req.url);
  const target = `${config.pbUrl}${path}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("accept-encoding");

  if (config.trustedProxy) {
    // Delante hay un proxy inverso: la cabecera que llega es suya y dice de
    // quien es la peticion. Solo se rellena si no vino ninguna.
    if (!headers.has("x-forwarded-for") && clientIp) headers.set("x-forwarded-for", clientIp);
  } else {
    // Sin proxy delante la cabecera la escribe quien llama, asi que no dice
    // nada: dejarla pasar le daria cupo nuevo en cada intento.
    headers.delete("x-forwarded-for");
    if (clientIp) headers.set("x-forwarded-for", clientIp);
  }

  const init: RequestInit = { method: req.method, headers, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    // @ts-expect-error: necesario para reenviar cuerpos en streaming
    init.duplex = "half";
  }

  const res = await fetch(target, init);
  const out = new Headers(res.headers);
  out.delete("content-encoding");
  out.delete("content-length");
  return new Response(res.body, { status: res.status, headers: out });
}

/* ------------------------------------------------------------------ */
/* Los dos archivos que lleva cada pagina                               */
/* ------------------------------------------------------------------ */

/**
 * Las rutas no llevan huella, para que una mejora llegue a todas las paginas
 * ya escritas. Lo que cambia es la marca: el navegador pregunta si hay algo
 * nuevo y casi siempre se le responde que no, sin volver a mandar el archivo.
 */
function pageAsset(req: Request, pathname: string): Response | null {
  const asset =
    pathname === STYLES_PATH
      ? { body: STYLES_FILE, type: "text/css; charset=utf-8" }
      : pathname === BRIDGE_PATH
        ? { body: BRIDGE_FILE, type: "text/javascript; charset=utf-8" }
        : pathname === CHARTS_PATH
          ? { body: CHARTS_FILE, type: "text/javascript; charset=utf-8" }
          : null;
  if (!asset) return null;

  const tag = `"${ASSETS_TAG}"`;
  const headers = {
    "content-type": asset.type,
    "cache-control": "public, no-cache",
    etag: tag,
  };
  if (req.headers.get("if-none-match") === tag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(asset.body, { headers });
}

/* ------------------------------------------------------------------ */
/* Archivos del panel                                                   */
/* ------------------------------------------------------------------ */

const indexHtml = () => Bun.file(join(DIST, "index.html"));

async function proxyToVite(req: Request, url: URL): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("accept-encoding");

  try {
    const res = await fetch(`http://127.0.0.1:${config.webPort}${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      redirect: "manual",
    });
    const out = new Headers(res.headers);
    out.delete("content-encoding");
    out.delete("content-length");
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return new Response(
      `<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;padding:2rem;line-height:1.6">
       <h1>Falta el panel</h1>
       <p>El servidor de desarrollo de Vite no esta encendido.</p>
       <p>Arranca todo junto con <code>bun run dev</code>, o compila el panel con
       <code>bun run build</code> y usa <code>bun run start</code>.</p>
       </body>`,
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
}

async function serveStatic(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // En desarrollo el panel lo compila Vite; lo reenviamos para que este
  // puerto funcione igual que en produccion.
  if (config.isDev) return proxyToVite(req, url);

  const path = decodeURIComponent(url.pathname);
  if (path !== "/" && !path.includes("..")) {
    const file = Bun.file(join(DIST, path));
    if (await file.exists()) {
      const immutable = path.startsWith("/assets/");
      return new Response(file, {
        headers: immutable ? { "cache-control": "public, max-age=31536000, immutable" } : {},
      });
    }
  }

  const html = indexHtml();
  if (!(await html.exists())) {
    return new Response("El panel no esta compilado. Ejecuta: bun run build", { status: 500 });
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

/* ------------------------------------------------------------------ */
/* Rutas de la API propia                                               */
/* ------------------------------------------------------------------ */

type Handler = (req: Request, ...params: string[]) => Promise<Response>;

const ROUTES: [RegExp, string, Handler][] = [
  [/^\/api\/apps$/, "POST", api.createApp],
  // Antes que `/api/apps/:id`: "limpiar" no es el id de ninguna aplicacion.
  [/^\/api\/apps\/limpiar$/, "POST", api.wipeApps],
  [/^\/api\/apps\/([^/]+)$/, "PATCH", api.updateApp],
  [/^\/api\/apps\/([^/]+)$/, "DELETE", api.deleteApp],
  [/^\/api\/apps\/([^/]+)\/tables$/, "POST", api.createTable],
  [/^\/api\/apps\/([^/]+)\/members$/, "GET", api.listMembers],
  [/^\/api\/apps\/([^/]+)\/personas$/, "GET", api.listPeople],
  [/^\/api\/apps\/([^/]+)\/members$/, "POST", api.addMember],
  [/^\/api\/apps\/([^/]+)\/personas\/importar$/, "POST", api.importPeopleRows],
  [/^\/api\/members\/([^/]+)$/, "PATCH", api.updateMember],
  [/^\/api\/members\/([^/]+)$/, "DELETE", api.removeMember],
  [/^\/api\/members\/([^/]+)\/clave$/, "POST", api.resetMemberPassword],
  [/^\/api\/tables\/([^/]+)$/, "PATCH", api.updateTable],
  [/^\/api\/tables\/([^/]+)$/, "DELETE", api.deleteTable],
  [/^\/api\/tables\/([^/]+)\/duplicar$/, "POST", api.duplicateTable],
  [/^\/api\/tables\/([^/]+)\/filas\/impacto$/, "POST", api.rowsDeleteImpact],
  [/^\/api\/tables\/([^/]+)\/filas\/borrar$/, "POST", api.deleteRows],
  [/^\/api\/ai\/config$/, "GET", api.getAiConfig],
  [/^\/api\/ai\/config$/, "PUT", api.putAiConfig],
  [/^\/api\/ai\/check$/, "POST", api.checkAiConfig],
  [/^\/api\/ai\/catalogo$/, "POST", api.aiCatalog],
  [/^\/api\/ai\/depuracion$/, "DELETE", api.clearAiDebugAll],
  [/^\/api\/apps\/([^/]+)\/ia\/enMarcha$/, "GET", api.listAppRuns],
  [/^\/api\/apps\/([^/]+)\/ia\/archivos$/, "POST", api.uploadAiFile],
  [/^\/api\/apps\/([^/]+)\/ia\/archivos\/([^/]+)$/, "GET", api.getAiFile],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/ia$/, "POST", api.askPage],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/ia$/, "GET", api.getPageRun],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/ia\/seguir$/, "POST", api.followPageRun],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/ia\/detener$/, "POST", api.stopPageRun],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/ia\/prueba$/, "POST", api.reportPageProbe],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/ia\/depuracion$/, "GET", api.getAiDebug],
  [/^\/api\/apps\/([^/]+)\/conversaciones$/, "GET", api.listAiChats],
  // Antes que `/conversaciones/:id`: "abierta" no es el id de ninguna.
  [/^\/api\/apps\/([^/]+)\/conversaciones\/abierta$/, "GET", api.getOpenAiChat],
  [/^\/api\/apps\/([^/]+)\/conversaciones\/abierta$/, "PUT", api.putOpenAiChat],
  [/^\/api\/apps\/([^/]+)\/conversaciones\/([^/]+)$/, "GET", api.getAiChat],
  [/^\/api\/apps\/([^/]+)\/impacto$/, "POST", api.resolveImpact],
  [/^\/api\/apps\/([^/]+)\/impacto\/detalle$/, "POST", api.impactDetail],
  [/^\/api\/apps\/([^/]+)\/acceso$/, "POST", api.resolveAccess],
  [/^\/api\/apps\/([^/]+)\/versiones$/, "GET", api.listAppVersions],
  [/^\/api\/apps\/([^/]+)\/versiones$/, "POST", api.createAppVersion],
  [/^\/api\/apps\/([^/]+)\/versiones\/([^/]+)$/, "PATCH", api.updateAppVersion],
  [/^\/api\/apps\/([^/]+)\/versiones\/([^/]+)$/, "DELETE", api.deleteAppVersion],
  [/^\/api\/apps\/([^/]+)\/versiones\/([^/]+)\/restaurar$/, "POST", api.restoreAppVersion],
  [/^\/api\/apps\/([^/]+)\/publicar$/, "POST", api.publishApp],
  [/^\/api\/apps\/([^/]+)\/vista\/([^/]+)$/, "GET", api.previewBundle],
  [/^\/api\/apps\/([^/]+)\/html\/([^/]+)$/, "GET", api.getHtmlDoc],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/html\/crudo$/, "GET", api.getRawPageHtml],
  // Por huella: la vista previa de una version pide el HTML de entonces, no el
  // que la pagina tiene ahora.
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/html\/([0-9a-f]{64})$/, "GET", api.getPageHtmlAt],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/html$/, "GET", api.getPageHtml],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/html$/, "PUT", api.savePageHtml],
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/convertir$/, "POST", api.convertPage],
  // Las seis ordenes de datos de una pagina. El navegador ya no habla con la
  // base: el permiso se aplica aqui, antes de entregar nada.
  [/^\/api\/apps\/([^/]+)\/paginas\/([^/]+)\/datos$/, "POST", api.pageData],
  [/^\/api\/apps\/([^/]+)\/html\/contrato$/, "POST", api.htmlContract],
  [/^\/api\/public\/([^/]+)$/, "GET", api.publicBundle],
  [/^\/api\/public\/([^/]+)\/personas$/, "GET", api.publicPeople],
  [/^\/api\/public\/([^/]+)\/paginas\/([^/]+)\/html$/, "GET", api.getPublicPageHtml],
];

async function handleApi(req: Request, pathname: string): Promise<Response | null> {
  for (const [pattern, method, handler] of ROUTES) {
    const match = pattern.exec(pathname);
    if (!match) continue;
    if (req.method !== method) continue;
    try {
      return await handler(req, ...match.slice(1).map(decodeURIComponent));
    } catch (err) {
      return toResponse(err);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

console.log("Arrancando PocketBase...");
await startPocketBase();

console.log("Preparando colecciones internas...");
await bootstrap();

/**
 * Importar datos en bloque usa la API de lote de PocketBase, que viene
 * apagada en instalaciones nuevas. La activamos en cada arranque: es
 * idempotente (si ya esta, no toca nada) y solo escribe la seccion de lote,
 * sin pisar el resto de la configuracion.
 */
async function enableBatchApi() {
  const settings = await pb<{ batch?: { enabled?: boolean } }>("/api/settings");
  if (settings.batch?.enabled === true) {
    console.log("  La API de lote ya esta activa.");
    return;
  }
  await pb("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({ batch: { ...(settings.batch ?? {}), enabled: true } }),
  });
  console.log("  API de lote activada.");
}

await enableBatchApi();

/**
 * Un tope de intentos en la puerta de entrada.
 *
 * PocketBase trae sus reglas de serie pero viene apagado, asi que hasta aqui
 * una clave de seis caracteres --el minimo de una persona invitada-- se podia
 * probar entera.
 *
 * El tope se pone por la ruta exacta en la que se prueba una clave, y con el
 * se quita `*:auth`, la regla que PocketBase trae puesta. Se quita por dos
 * razones, y las dos hacen falta: esa etiqueta gana a la ruta exacta --con
 * ella puesta el tope que manda es el suyo, comprobado-- y alcanza tambien a
 * `auth-refresh`, que el navegador pregunta en cada carga, asi que estrecharla
 * echaria a quien ya entro. Sin ella, refrescar la sesion queda bajo la regla
 * general de `/api/`. Una coleccion de cuentas nueva no queda cubierta sola:
 * hay que anadirle su ruta aqui.
 *
 * Las llamadas de este mismo proceso no hay que dejarlas fuera a mano:
 * PocketBase no le aplica el tope a un superusuario, y con esa cuenta habla
 * el servidor. Asi una importacion en bloque no se estrella contra el tope,
 * y una direccion excluida --que con `TRUSTED_PROXY` puesto podria llegar
 * desde fuera-- no hace falta en ninguna parte.
 */
async function enableRateLimits() {
  const RULE = { audience: "", duration: 60, maxRequests: 12 };
  const mine = [INTERNAL.builders, INTERNAL.members, "_superusers"].map((collection) => ({
    ...RULE,
    label: `/api/collections/${collection}/auth-with-password`,
  }));

  const settings = await pb<{
    rateLimits?: { enabled?: boolean; rules?: { label: string }[] };
  }>("/api/settings");
  const current = settings.rateLimits ?? {};
  const before = current.rules ?? [];
  const rules = before.filter((rule) => rule.label !== "*:auth");

  const missing = mine.filter((rule) => !rules.some((r) => r.label === rule.label));
  const same = current.enabled === true && rules.length === before.length && !missing.length;
  if (same) {
    console.log("  El tope de intentos ya esta puesto.");
    return;
  }

  await pb("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({
      rateLimits: { ...current, enabled: true, rules: [...rules, ...missing] },
      // Sin esto PocketBase se queda con la direccion de quien le habla, que
      // siempre es este proceso. Ver `proxyToPocketBase`.
      trustedProxy: { headers: ["X-Forwarded-For"], useLeftmostIP: true },
    }),
  });
  console.log(`  Tope de intentos: ${RULE.maxRequests} por minuto en cada puerta de entrada.`);
}

await enableRateLimits();

Bun.serve({
  port: config.port,
  idleTimeout: 0,
  async fetch(req, server) {
    const url = new URL(req.url);
    const clientIp = server.requestIP(req)?.address ?? "";

    // La puerta privada: PocketBase entero, consola incluida. El prefijo solo
    // esta en el entorno del servidor, asi que sin el no se llega desde fuera.
    if (config.adminPath && url.pathname.startsWith(`/${config.adminPath}/`)) {
      return proxyToPocketBase(req, url.pathname.slice(config.adminPath.length + 1), clientIp);
    }

    // La puerta publica: registros, sesiones y archivos, y nada mas.
    if (url.pathname.startsWith("/pb/")) {
      const path = url.pathname.slice(3);
      // Se responde que no existe y no que esta prohibido: negar sin confirmar
      // que detras hay algo que alcanzar.
      if (!publicPbPath(path)) return new Response("No encontrado", { status: 404 });
      return proxyToPocketBase(req, path, clientIp);
    }

    if (url.pathname.startsWith("/plane/")) {
      const asset = pageAsset(req, url.pathname);
      if (asset) return asset;
    }

    if (url.pathname.startsWith("/api/")) {
      const res = await handleApi(req, url.pathname);
      if (res) return res;
      return Response.json({ error: "Ruta no encontrada" }, { status: 404 });
    }

    return serveStatic(req);
  },
});

console.log(`\n  Planer listo en http://localhost:${config.port}`);
console.log(`  PocketBase interno: ${config.pbUrl}/_/\n`);
