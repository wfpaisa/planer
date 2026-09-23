/**
 * Regenera `shared/iconNames.ts` a partir de la hoja de estilo de la fuente.
 *
 * La lista de nombres vive escrita en el repositorio para que el buscador de
 * iconos funcione sin red (ver la cabecera de `shared/iconNames.ts`). Cuando
 * se reemplace `web/public/iconos/` por una versión nueva de la fuente, este
 * guion la vuelve a leer y reescribe el archivo.
 *
 *   bun run scripts/icon-names.ts
 *
 * Se lee el archivo del repositorio y no una dirección: la fuente ya no viene
 * de un CDN, y `/iconos/iconos.css` es una ruta del servidor, no algo que un
 * guion suelto pueda pedir.
 */
/** La hoja, tal como esta en el repositorio. `ICON_FONT_URL` es su dirección
    al servirla, que no se puede abrir desde aquí. */
const HOJA = "web/public/iconos/iconos.css";

const hoja = Bun.file(HOJA);
if (!(await hoja.exists())) {
  console.error(`No se encontro ${HOJA}.`);
  process.exit(1);
}

const css = await hoja.text();
/* La hoja de `use.` escribe `::before` y la de `cdn.` escribia `:before`:
   las dos formas valen, así que el patron acepta las dos. */
const names = [...css.matchAll(/\.hgi-stroke\.hgi-([a-z0-9-]+)::?before/g)].map((m) => m[1]);
const unique = [...new Set(names)].sort();

if (unique.length < 1000) {
  console.error(`Solo se encontraron ${unique.length} iconos: la hoja no tiene la forma esperada.`);
  process.exit(1);
}

const file = `/**
 * Los nombres de la fuente de iconos, tal como los declara su hoja de estilo.
 *
 * Se saca de \`${HOJA}\`, que trae una regla por icono
 * (\`.hgi-stroke.hgi-<nombre>::before\`). Esta aqui escrito y no leido de la
 * hoja a propósito: el buscador de iconos y la comprobacion de un nombre
 * guardado corren en el navegador y tienen que responder sin esperar a
 * novecientos kilobytes de fuente. Son unos 100 KB de texto, la sesentava
 * parte de lo que pesaba traerse los trazados.
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
