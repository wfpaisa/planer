const env = (key: string, fallback: string) => process.env[key] ?? fallback;

export const config = {
  port: Number(env("PORT", "3000")),
  pbPort: Number(env("PB_PORT", "8090")),
  pbUrl: env("PB_URL", `http://127.0.0.1:${env("PB_PORT", "8090")}`),
  adminEmail: env("PB_ADMIN_EMAIL", "admin@planer.local"),
  adminPassword: env("PB_ADMIN_PASSWORD", "planer-admin-1234"),
  /**
   * Prefijo privado por el que se llega a PocketBase entero, consola incluida.
   *
   * Vacio --lo normal-- es que no se monte: desde fuera no hay forma de llegar
   * a la consola ni a la API que define colecciones. Solo vive en el entorno
   * del servidor, nunca en el repositorio. Ver `publicPbPath` en
   * `server/index.ts`.
   */
  adminPath: env("PB_ADMIN_PATH", "").replace(/^\/+|\/+$/g, ""),
  /**
   * Hay un proxy inverso delante (nginx, Caddy, Cloudflare).
   *
   * Cambia de quien se cree que es una peticion, que es lo que reparte el tope
   * de intentos: con proxy delante manda la cabecera que el trae --es el unico
   * que sabe quien llamo--; sin el, la cabecera la escribe quien llama y se
   * descarta. Ver `proxyToPocketBase` en `server/index.ts`.
   */
  trustedProxy: env("TRUSTED_PROXY", "") === "1",
  webPort: Number(env("WEB_PORT", "5173")),
  isDev: process.env.NODE_ENV !== "production",
  /** Prefijo de las colecciones de datos creadas por los usuarios. */
  dataPrefix: "d_",
};

/** Colecciones internas de la plataforma. */
export const INTERNAL = {
  builders: "builders",
  members: "members",
  apps: "apps",
  tables: "tables",
  pages: "pages",
  access: "app_access",
  versions: "app_versions",
  htmlDocs: "html_docs",
  chats: "ai_chats",
  aiDebug: "ai_debug",
  settings: "settings",
} as const;
