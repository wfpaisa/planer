/**
 * Regenera `shared/iconNames.ts` a partir de la hoja de estilo de la fuente.
 *
 * La lista de nombres vive escrita en el repositorio para que el buscador de
 * iconos funcione sin red (ver la cabecera de `shared/iconNames.ts`). Cuando
 * Hugeicons publique una version nueva de la fuente, este guion la vuelve a
 * leer y reescribe el archivo.
 *
 *   bun run scripts/icon-names.ts
 */
import { ICON_FONT_URL } from "../shared/icons.ts";

const res = await fetch(ICON_FONT_URL);
if (!res.ok) {
  console.error(`No se pudo leer ${ICON_FONT_URL}: ${res.status}`);
  process.exit(1);
}

const css = await res.text();
/* La hoja de `use.` escribe `::before` y la de `cdn.` escribia `:before`:
   las dos formas valen, asi que el patron acepta las dos. */
const names = [...css.matchAll(/\.hgi-stroke\.hgi-([a-z0-9-]+)::?before/g)].map((m) => m[1]);
const unique = [...new Set(names)].sort();

if (unique.length < 1000) {
  console.error(`Solo se encontraron ${unique.length} iconos: la hoja no tiene la forma esperada.`);
  process.exit(1);
}

const file = `/**
 * Los nombres de la fuente de iconos, tal como los declara su hoja de estilo.
 *
 * Se saca de ${ICON_FONT_URL}, que trae
 * una regla por icono (\`.hgi-stroke.hgi-<nombre>::before\`). Esta aqui escrito y
 * no leido del CDN a proposito: el buscador de iconos y la comprobacion de un
 * nombre guardado tienen que funcionar sin red y sin esperar. Son unos 100 KB
 * de texto, la sesentava parte de lo que pesaba traerse los trazados.
 *
 * Para regenerarlo: \`bun run scripts/icon-names.ts\`.
 */

export const ICON_NAMES: readonly string[] = [
${unique.map((n) => `  "${n}",`).join("\n")}
];

export const ICON_NAME_SET: ReadonlySet<string> = new Set(ICON_NAMES);
`;

await Bun.write("shared/iconNames.ts", file);
console.log(`${unique.length} iconos escritos en shared/iconNames.ts`);
