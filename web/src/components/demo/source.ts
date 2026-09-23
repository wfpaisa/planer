/*
  El ejemplo de cada ficha, leido del propio archivo de la galeria.

  La galeria no guarda en ningún sitio el código de sus ejemplos, y a propósito:
  el ejemplo *es* lo que hay escrito en la ficha. Copiarlo a una cadena para
  poder enseñarlo seria tener el mismo componente escrito dos veces, y de las
  dos copias solo se actualiza una.

  Antes lo que se enseñaba se recomponia de lo pintado, leyendo el DOM de la
  ficha. Servia mientras el ejemplo fuera marcado, pero no cuando la pieza es un
  componente: de `<PlanerAvatar mood="ok" size={24} />` el DOM solo tiene el
  `<svg>` que salio, y enseñar sus trazados no dice como se usa. Así que lo que
  se enseña se saca de los archivos de la galeria --como texto-- buscando el
  `card-body` de cada ficha por el título con el que la dibuja `head()`. Lo que
  se ve en el modal es entonces, literalmente, lo que hay escrito en la ficha:
  componentes incluidos, y con sus `{#if}` y sus `{#each}` donde los haya.

  Se leen las cinco secciones y no una sola porque ahi es donde estan las
  fichas; `DemoGallery.svelte` solo las compone y no tiene ninguna. Cada título
  es único en la galeria --es lo que se lee en la cabecera de la ficha-- así que
  juntar los cinco mapas no pisa nada.

  Los archivos pesan lo suyo, así que se traen con `import()` y no de entrada:
  lo paga quien abre el código de una ficha, y la primera vez nada mas.
*/

/** El título con el que cada ficha llama a `head()`. */
const HEAD = /\{@render head\(\s*"((?:[^"\\]|\\.)*)"/g;

/** Donde empieza el ejemplo. La ficha de la tabla no tiene `card-body`. */
const BODY = /<div class="(?:card-body|table-wrap)"[^>]*>/;

/** Los comentarios son notas para quien lee la galeria, no parte del ejemplo. */
const COMMENT = /[ \t]*<!--[\s\S]*?-->[ \t]*\n?/g;

/** El cuerpo que abre en `from`, hasta el `</div>` que lo cierra. */
function body(raw: string, from: number): string | null {
  const open = BODY.exec(raw.slice(from));
  if (!open) return null;

  const start = from + open.index;
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = start + open[0].length;
  let depth = 1;

  for (let tag = tags.exec(raw); tag; tag = tags.exec(raw)) {
    depth += tag[0] === "</div>" ? -1 : 1;
    // Dentro del cuerpo, sin el `<div>` que lo envuelve: eso es la ficha, no
    // el ejemplo.
    if (depth === 0) return raw.slice(start + open[0].length, tag.index);
  }
  return null;
}

/** Sin los blancos de estar dentro de la ficha, y sin líneas vacias de sobra. */
function dedent(code: string): string {
  const lines = code.replace(COMMENT, "").split("\n");
  const pads = lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const pad = pads.length ? Math.min(...pads) : 0;
  return lines
    .map((l) => l.slice(pad).trimEnd())
    .join("\n")
    .trim();
}

function parse(raw: string): Map<string, string> {
  const cards = new Map<string, string>();
  HEAD.lastIndex = 0;
  for (let head = HEAD.exec(raw); head; head = HEAD.exec(raw)) {
    const code = body(raw, HEAD.lastIndex);
    if (code) cards.set(head[1], dedent(code));
  }
  return cards;
}

let pending: Promise<Map<string, string>> | null = null;

/** Las secciones de la galeria, que es donde estan las fichas. */
const SECTIONS = [
  () => import("./DemoNavegacion.svelte?raw"),
  () => import("./DemoContenido.svelte?raw"),
  () => import("./DemoGraficas.svelte?raw"),
  () => import("./DemoFormularios.svelte?raw"),
  () => import("./DemoAvisos.svelte?raw"),
];

/** El ejemplo de cada ficha, por el título de su cabecera. */
export function loadCardSource(): Promise<Map<string, string>> {
  pending ??= Promise.all(SECTIONS.map((load) => load())).then(
    (mods) => new Map(mods.flatMap((mod) => [...parse(mod.default)])),
  );
  return pending;
}
