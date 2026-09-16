/**
 * Levanta el servidor y el panel en modo desarrollo.
 */
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const server = Bun.spawn(["bun", "--watch", "server/index.ts"], {
  cwd: ROOT,
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

const web = Bun.spawn(["bunx", "vite", "--host"], {
  cwd: join(ROOT, "web"),
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env },
});

const stop = async () => {
  server.kill();
  web.kill();
  await Promise.allSettled([server.exited, web.exited]);
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await Promise.race([server.exited, web.exited]);
stop();
