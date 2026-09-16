const env = (key: string, fallback: string) => process.env[key] ?? fallback;

export const config = {
  port: Number(env("PORT", "3000")),
  pbPort: Number(env("PB_PORT", "8090")),
  pbUrl: env("PB_URL", `http://127.0.0.1:${env("PB_PORT", "8090")}`),
  adminEmail: env("PB_ADMIN_EMAIL", "admin@planer.local"),
  adminPassword: env("PB_ADMIN_PASSWORD", "planer-admin-1234"),
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
