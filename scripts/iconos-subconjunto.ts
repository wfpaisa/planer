/**
 * Recorta la fuente de iconos a los nombres que dibuja una pagina.
 *
 *   bun run iconos:subconjunto
 *
 * Escribe un solo archivo, `web/public/iconos/comunes.css`: las reglas de
 * `SUBSET_ICONS` y, pegada dentro como `data:`, la fuente recortada a esos
 * mismos glifos. Un archivo y no dos porque quien lo usa no puede pedir el
 * segundo: el marco de una pagina es un `srcdoc` sin origen, y desde ahi no
 * se alcanza el servidor (ver `SUBSET_FONT_URL` en `shared/icons.ts`). El
 * panel lo trae una vez por sesion y lo mete en cada marco.
 *
 * Hace falta `fonttools` y las herramientas de `woff2`, que no son del
 * proyecto: por eso esto se corre a mano --cuando cambie la lista o la
 * fuente-- y lo que se guarda en el repositorio es el resultado. Es el mismo
 * trato que `scripts/icon-names.ts`.
 *
 *   Arch:    sudo pacman -S python-fonttools woff2
 *   Debian:  sudo apt install fonttools woff2
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SUBSET_ICONS } from "../shared/icons.ts";

const DIR = "web/public/iconos";
const FUENTE = `${DIR}/iconos.woff2`;
const HOJA = `${DIR}/iconos.css`;
const SALIDA = `${DIR}/comunes.css`;

/** Que la herramienta exista se comprueba antes, no a mitad. */
async function needs(cmd: string): Promise<void> {
  if (await Bun.which(cmd)) return;
  console.error(
    `Falta \`${cmd}\`. Se necesitan fonttools y las herramientas de woff2:\n` +
      `  Arch:   sudo pacman -S python-fonttools woff2\n` +
      `  Debian: sudo apt install fonttools woff2`,
  );
  process.exit(1);
}

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  if ((await proc.exited) === 0) return;
  console.error(`Fallo: ${cmd.join(" ")}\n${await new Response(proc.stderr).text()}`);
  process.exit(1);
}

await needs("pyftsubset");
await needs("woff2_decompress");
await needs("woff2_compress");

/*
 * El codigo de cada icono sale de la hoja completa, que es donde esta escrito
 * (`.hgi-nombre::before { content: "\ea01" }`). No hay otra lista: inventarse
 * una aqui seria una segunda copia que se separaria de la fuente.
 */
const css = await Bun.file(HOJA).text();
const punto = new Map<string, string>();
for (const m of css.matchAll(/\.hgi-([a-z0-9-]+):+before\s*\{\s*content:\s*"\\([0-9a-f]+)"/gi)) {
  punto.set(m[1], m[2]);
}

const faltan = SUBSET_ICONS.filter((n) => !punto.has(n));
if (faltan.length) {
  console.error(`Estos nombres no estan en la fuente:\n  ${faltan.join("\n  ")}`);
  process.exit(1);
}

const nombres = [...SUBSET_ICONS].sort();
const tmp = await mkdtemp(join(tmpdir(), "planer-iconos-"));
try {
  /* pyftsubset no lee woff2 sin brotli, que no siempre esta instalado con
     fonttools. Dar la vuelta por el ttf no depende de eso. */
  await Bun.write(`${tmp}/full.woff2`, Bun.file(FUENTE));
  await run(["woff2_decompress", `${tmp}/full.woff2`]);
  await Bun.write(`${tmp}/puntos.txt`, nombres.map((n) => `U+${punto.get(n)}`).join(","));
  await run([
    "pyftsubset",
    `${tmp}/full.ttf`,
    `--unicodes-file=${tmp}/puntos.txt`,
    `--output-file=${tmp}/sub.ttf`,
    "--no-hinting",
    "--desubroutinize",
    "--layout-features=",
    "--drop-tables+=DSIG",
  ]);
  await run(["woff2_compress", `${tmp}/sub.ttf`]);

  const woff2 = await Bun.file(`${tmp}/sub.woff2`).bytes();
  const base64 = Buffer.from(woff2).toString("base64");

  /*
   * `.hgi-stroke` se repite tal cual de la hoja completa: es la clase que
   * pone la familia, y una pagina la lleva escrita en cada icono. El
   * `font-family` tiene el mismo nombre a proposito --si la hoja completa
   * tambien esta puesta, las dos declaran la misma familia y la que gane
   * dibuja lo mismo--.
   */
  const reglas = nombres.map((n) => `.hgi-${n}::before{content:"\\${punto.get(n)}"}`).join("\n");

  await Bun.write(
    SALIDA,
    `/*
 * Iconos de Planer, recortados: ${nombres.length} de los ${punto.size} de la fuente.
 *
 * Generado por \`bun run iconos:subconjunto\`. No se edita a mano: la lista
 * es \`SUBSET_ICONS\` en \`shared/icons.ts\`.
 *
 * La fuente va pegada como \`data:\` porque quien usa esta hoja no puede
 * pedir un segundo archivo: el marco de una pagina es un \`srcdoc\` sin
 * origen propio. Ver \`SUBSET_FONT_URL\`.
 */
@font-face {
  font-family: "hugeicons-stroke-rounded";
  src: url("data:font/woff2;base64,${base64}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
.hgi-stroke {
  font-family: "hugeicons-stroke-rounded" !important;
  font-style: normal;
  font-weight: 400;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
${reglas}
`,
  );

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `${nombres.length} iconos: ${kb(woff2.length)} de fuente, ` +
      `${kb((await Bun.file(SALIDA).stat()).size)} de hoja con todo dentro.`,
  );
} finally {
  await rm(tmp, { recursive: true, force: true });
}
