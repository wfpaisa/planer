/**
 * Las colecciones de datos que ya no nombra ninguna tabla.
 *
 * Cada tabla de Planer es una coleccion de PocketBase (`d_<app>_<tabla>`), y el
 * puente entre las dos es el campo `dataCollection` del registro de la tabla.
 * Si el registro se va y la coleccion no, queda una huerfana: ocupa sitio, se
 * ve en el panel de PocketBase y no hay nada en Planer que la alcance.
 *
 * De donde salen: PocketBase se niega a borrar una coleccion mientras otra la
 * nombre en una relacion. Al borrar una aplicacion sus tablas se van juntas,
 * pero si la apuntada salia antes que quien la apuntaba, su borrado fallaba en
 * silencio. Eso ya no pasa --`dropDataCollections` lo hace en pasadas-- pero
 * lo que quedo de antes sigue ahi, y esto es lo que lo retira.
 *
 * Uso:
 *   bun run scripts/tablas-huerfanas.ts                 solo mira y cuenta
 *   bun run scripts/tablas-huerfanas.ts --borrar        las retira, tras confirmar
 *   bun run scripts/tablas-huerfanas.ts --borrar --si   sin preguntar
 *
 * `--si` existe para cuando esto corre sin nadie delante --un guion, la
 * consola de un agente-- donde no hay teclado que conteste. A mano se escribe
 * la confirmacion, que para algo no se puede deshacer.
 */
import { config, INTERNAL } from "../server/config.ts";
import { listCollections, listRecords } from "../server/pb.ts";
import { dropDataCollections } from "../server/schema.ts";

const BORRAR = process.argv.includes("--borrar");
const SIN_PREGUNTAR = process.argv.includes("--si");

const collections = await listCollections();
const data = collections.filter((c) => c.name.startsWith(config.dataPrefix));

const tables = await listRecords<{ name: string; dataCollection: string }>(INTERNAL.tables, {
  perPage: 500,
  skipTotal: 1,
});
const enUso = new Set(tables.items.map((t) => t.dataCollection));

const huerfanas = data.filter((c) => !enUso.has(c.name));

console.log(`Colecciones de datos: ${data.length}`);
console.log(`  en uso por una tabla: ${data.length - huerfanas.length}`);
console.log(`  huerfanas:            ${huerfanas.length}`);

if (huerfanas.length === 0) {
  console.log("\nNo hay nada que limpiar.");
  process.exit(0);
}

// Cuantas filas guarda cada una: es lo que se perderia, y conviene verlo antes
// de decidir. Una huerfana con filas dentro sigue siendo basura --no hay tabla
// que la lea-- pero el numero deja claro que no esta vacia.
console.log("\nHuerfanas:");
let filas = 0;
for (const c of huerfanas) {
  const rows = await listRecords(c.name, { perPage: 1 }).catch(() => null);
  const total = rows?.totalItems ?? 0;
  filas += total;
  console.log(`  ${c.name}  (${total} ${total === 1 ? "fila" : "filas"})`);
}

if (!BORRAR) {
  console.log(`\nEn total ${filas} ${filas === 1 ? "fila" : "filas"}.`);
  console.log("Nada se ha tocado. Corre con --borrar para retirarlas.");
  process.exit(0);
}

console.log(`\nEsto borra permanentemente ${huerfanas.length} colecciones y sus ${filas} filas.`);
console.log("No se puede deshacer.");

if (!SIN_PREGUNTAR) {
  const answer = prompt('Escribe "borrar" para confirmar:');
  if (answer?.trim() !== "borrar") {
    console.log("Cancelado. No se borro nada.");
    process.exit(1);
  }
}

const { dropped, stuck } = await dropDataCollections(huerfanas.map((c) => c.name));
console.log(`\nRetiradas: ${dropped}`);

if (stuck.length > 0) {
  // Algo de fuera del grupo las sujeta: una tabla viva que las nombra en una
  // relacion. Entonces no son basura, y el que resistan es la senal.
  console.log(`Resistieron ${stuck.length}, porque algo que sigue vivo las nombra:`);
  for (const name of stuck) console.log(`  ${name}`);
  process.exit(1);
}
