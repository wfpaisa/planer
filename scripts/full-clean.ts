/**
 * Borra todo el estado local (dependencias, base de datos, .env) para
 * volver a empezar desde cero con `bun run setup`.
 */
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { config } from "../server/config.ts";

const ROOT = join(import.meta.dir, "..");

const TARGETS = [join(ROOT, "node_modules"), join(ROOT, "pb", "pb_data"), join(ROOT, ".env")];

async function portAnswers(port: number): Promise<boolean> {
  return fetch(`http://127.0.0.1:${port}`)
    .then(() => true)
    .catch(() => false);
}

if ((await portAnswers(config.port)) || (await portAnswers(config.pbPort))) {
  console.error("\n  Planer parece estar corriendo (puerto 3000 u 8090 responde).");
  console.error("  Deten `bun run dev` antes de limpiar.\n");
  process.exit(1);
}

console.log("Esto borra permanentemente:");
for (const target of TARGETS) console.log(`  - ${target}`);
console.log("\nLos datos de PocketBase (apps, tablas, usuarios) se pierden.");

const answer = prompt('Escribe "yes" para confirmar:');
if (answer?.trim() !== "yes") {
  console.log("Cancelado. No se borro nada.");
  process.exit(1);
}

for (const target of TARGETS) {
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  console.log(`Borrado: ${target}`);
}

console.log("\nListo. Corre `bun run setup` para empezar de nuevo.");
