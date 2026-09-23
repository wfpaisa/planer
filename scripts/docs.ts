/**
 * Escribe en los archivos de documentacion las secciones que se regeneran
 * a partir del código:
 *
 *  - `README.md`, sección "Funcionalidades" -> `shared/features.ts`.
 *  - `docs/PAGINAS-HTML.md`, sección "Escribir el HTML de una página"
 *    -> `shared/htmlContract.ts` (la misma fuente que recibe la IA).
 *
 * Cada sección se delimita con marcas `<!-- ... -->`; este script reemplaza
 * el contenido entre marcas sin tocar el resto del archivo. Si nada cambia,
 * no escribe.
 *
 * Uso:  bun run docs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildFeaturesSection } from "../shared/features.ts";
import { buildHtmlDocs } from "../shared/htmlContract.ts";

const FILES: {
  path: string;
  sections: {
    start: string;
    end: string;
    build: () => string;
  }[];
}[] = [
  {
    path: join(import.meta.dir, "..", "README.md"),
    sections: [
      {
        start: "<!-- generado:features -->",
        end: "<!-- fin:features -->",
        build: buildFeaturesSection,
      },
    ],
  },
  {
    path: join(import.meta.dir, "..", "docs", "PAGINAS-HTML.md"),
    sections: [
      {
        start: "<!-- generado por: bun run docs -->",
        end: "<!-- fin de lo generado -->",
        build: buildHtmlDocs,
      },
    ],
  },
];

let changed = false;

for (const file of FILES) {
  const source = readFileSync(file.path, "utf8");
  let next = source;
  for (const { start, end, build } of file.sections) {
    const begin = next.indexOf(start);
    const finish = next.indexOf(end);
    if (begin === -1 || finish === -1 || finish < begin) {
      console.error(`No encontre las marcas "${start}" y "${end}" en ${file.path}.`);
      process.exit(1);
    }
    const replacement = `${next.slice(0, begin + start.length)}\n\n${build()}\n\n${next.slice(finish)}`;
    if (replacement !== next) {
      next = replacement;
      changed = true;
    }
  }
  if (next !== source) {
    writeFileSync(file.path, next);
  }
}

if (!changed) {
  console.log("Las secciones de los README ya estaban al dia.");
  process.exit(0);
}

console.log("Secciones de los README actualizadas.");
