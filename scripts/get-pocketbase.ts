/**
 * Descarga el programa de PocketBase que corresponde a este equipo.
 */
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const VERSION = process.env.PB_VERSION ?? "0.39.11";
const ROOT = join(import.meta.dir, "..");
const DIR = join(ROOT, "pb");
const BIN = join(DIR, "pocketbase");

if (existsSync(BIN) && !process.argv.includes("--force")) {
  console.log("PocketBase ya esta descargado.");
  process.exit(0);
}

const platform = { linux: "linux", darwin: "darwin", win32: "windows" }[process.platform as string];
const arch = { x64: "amd64", arm64: "arm64" }[process.arch as string];
if (!platform || !arch) {
  console.error(`Sistema no soportado: ${process.platform}/${process.arch}`);
  process.exit(1);
}

const url = `https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_${platform}_${arch}.zip`;
console.log(`Descargando ${url}`);

mkdirSync(DIR, { recursive: true });
const zip = join(DIR, "pb.zip");

const res = await fetch(url);
if (!res.ok) {
  console.error(`No se pudo descargar (${res.status}).`);
  process.exit(1);
}
await Bun.write(zip, res);

const unzip = Bun.spawnSync(["unzip", "-oq", zip, "pocketbase", "-d", DIR]);
if (unzip.exitCode !== 0) {
  console.error("No se pudo descomprimir. Instala `unzip` o extrae el archivo a mano.");
  process.exit(1);
}
await Bun.file(zip).delete();
chmodSync(BIN, 0o755);
console.log(`Listo: ${BIN}`);
