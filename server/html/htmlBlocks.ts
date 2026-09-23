/**
 * El bisturi sobre el HTML de una página: leer, reemplazar, insertar y quitar
 * un trozo sin tocar el resto del documento.
 *
 * Un trozo se llama bloque y se direcciona con el atributo `data-plane`, un
 * nombre legible y único dentro del documento. El mismo nombre vale en los dos
 * lados: aquí es un selector de atributo, y en el navegador lo resuelve
 * `el.closest("[data-plane]")`.
 *
 * Solo se nombra lo que se toca. Un documento no se recorre estampando
 * nombres: un elemento recibe el suyo cuando se edita por primera vez, así que
 * un HTML traido de fuera entra sin ninguno y los va ganando con el uso.
 *
 * Todo se apoya en `HTMLRewriter`, que Bun ya trae. Comprobado sobre Bun
 * 1.3.14: un documento que pasa por `transform` sin ninguna coincidencia sale
 * **identico byte a byte** --doctype, comentarios, `<script>` con `<` dentro,
 * entidades, elementos vacios y atributos con `>` en su valor--, así que la
 * transformacion se puede aplicar sobre el documento entero sin miedo.
 *
 * Escribir es directo. Leer no lo es, y por eso esta explicado abajo en
 * `readBlock`: `HTMLRewriter` trabaja en flujo y no ofrece el `outerHTML` de
 * un elemento.
 */

/** El atributo que lleva el nombre de un bloque. */
export const BLOCK_ATTR = "data-plane";

/**
 * Marca de trabajo. Se estampa sobre el elemento que resolvio el selector para
 * poder reconocerlo dentro de un manejador --que no sabe evaluar CSS-- y se
 * descarta con el documento intermedio. Nunca llega a guardarse.
 */
const MARK = "data-plane-marca";

/** Elementos sin etiqueta de cierre: no reciben `onEndTag`. */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Un nombre de bloque: minusculas, numeros y guiones. Nada mas. */
const PLAIN_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Lo que falla al pedir un bloque que no esta, o que esta mas de una vez. */
export class BlockError extends Error {}

type Element = HTMLRewriterTypes.Element;

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/* ------------------------------------------------------------------ */
/* Nombres                                                              */
/* ------------------------------------------------------------------ */

/** Todos los nombres de bloque que ya viven en el documento. */
export function blockNames(doc: string): Set<string> {
  const names = new Set<string>();
  new HTMLRewriter()
    .on(`[${BLOCK_ATTR}]`, {
      element(el) {
        const name = el.getAttribute(BLOCK_ATTR);
        if (name) names.add(name);
      },
    })
    .transform(doc);
  return names;
}

/**
 * Un nombre legible a partir de un texto cualquiera. Sin tildes, sin simbolos
 * y sin longitud de sobra: lo que se lee bien en "Código HTML".
 */
export function slugName(text: string): string {
  const clean = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return clean || "bloque";
}

/**
 * El nombre propuesto, o uno derivado si ya esta ocupado.
 *
 * La IA propone el nombre porque es quien sabe que es el bloque; la unicidad
 * la garantiza el servidor, que es quien ve el documento entero. Así un nombre
 * repetido no rechaza la operacion ni pisa el bloque que ya lo tenia.
 */
export function uniqueBlockName(doc: string, proposed: string, taken?: Set<string>): string {
  const names = taken ?? blockNames(doc);
  const base = slugName(proposed);
  if (!names.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const next = `${base}-${n}`;
    if (!names.has(next)) return next;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Localizar un bloque                                                  */
/* ------------------------------------------------------------------ */

/** Cuantos elementos del documento responden a un selector. */
function countMatches(doc: string, selector: string): number {
  let hits = 0;
  try {
    new HTMLRewriter()
      .on(selector, {
        element() {
          hits++;
        },
      })
      .transform(doc);
  } catch {
    throw new BlockError(`"${selector}" is not a valid way to point at a block.`);
  }
  return hits;
}

/**
 * Traduce una referencia a un selector que senala un solo elemento.
 *
 * Una referencia es el nombre de un bloque --lo normal, y lo estable-- o el
 * selector de un elemento que todavía no tiene nombre, que es como llega lo
 * que se senala con el cursor. Un nombre que no esta se busca ademas como
 * selector antes de rendirse: así "table" o "#lista" también valen.
 */
export function resolveBlock(doc: string, ref: unknown): string {
  const wanted = String(ref ?? "").trim();
  if (!wanted) throw new BlockError("You did not say which block.");

  if (PLAIN_NAME.test(wanted)) {
    const byName = `[${BLOCK_ATTR}="${wanted}"]`;
    if (countMatches(doc, byName) === 1) return byName;
  }

  const hits = countMatches(doc, wanted);
  if (hits === 1) return wanted;
  if (hits === 0) {
    throw new BlockError(
      `There is no block "${wanted}" on this page. Look at the HTML with "ver_pagina" before editing it.`,
    );
  }
  throw new BlockError(
    `"${wanted}" points at ${hits} elements at once, and an edit targets exactly one. Be more precise.`,
  );
}

/** El documento con el elemento del selector marcado, para poder reconocerlo. */
function mark(doc: string, selector: string): string {
  let first = true;
  return new HTMLRewriter()
    .on(selector, {
      element(el) {
        if (!first) return;
        first = false;
        el.setAttribute(MARK, "1");
      },
    })
    .transform(doc);
}

/* ------------------------------------------------------------------ */
/* Leer                                                                 */
/* ------------------------------------------------------------------ */

/** Una etiqueta de apertura reconstruida con sus atributos. */
function openTag(el: Element, skip: string): string {
  let out = `<${el.tagName}`;
  for (const [name, value] of el.attributes) {
    if (name === skip) continue;
    out += ` ${name}="${escapeAttr(value)}"`;
  }
  return `${out}${el.selfClosing ? " /" : ""}>`;
}

/**
 * El HTML de un bloque, tal como esta.
 *
 * `HTMLRewriter` trabaja en flujo y no da el `outerHTML` de un elemento: un
 * manejador sobre `*` solo ve texto suelto, y dentro de `onEndTag` el
 * `tagName` ya no esta. La forma que si funciona es un contador de
 * profundidad: al entrar en el elemento buscado se pone a uno, cada elemento
 * anidado lo sube, cada cierre lo baja, y mientras sea mayor que cero se van
 * concatenando las etiquetas de apertura con sus atributos, el texto y las de
 * cierre. Los elementos vacios no reciben cierre, así que no cuentan.
 */
export function readBlock(doc: string, ref: unknown): string {
  const selector = resolveBlock(doc, ref);
  const marked = mark(doc, selector);

  let depth = 0;
  let done = false;
  let out = "";

  new HTMLRewriter()
    .on("*", {
      element(el) {
        if (done) return;
        const target = el.hasAttribute(MARK);
        if (!target && depth === 0) return;

        out += openTag(el, target ? MARK : "");
        if (VOID.has(el.tagName) || el.selfClosing) {
          if (target) done = true;
          return;
        }

        // El nombre de la etiqueta se guarda aquí: dentro de `onEndTag` ya no
        // existe.
        const tag = el.tagName;
        depth += 1;
        el.onEndTag(() => {
          depth -= 1;
          out += `</${tag}>`;
          if (depth === 0) done = true;
        });
      },
      text(chunk) {
        if (!done && depth > 0) out += chunk.text;
      },
      comments(comment) {
        if (!done && depth > 0) out += `<!--${comment.text}-->`;
      },
    })
    .transform(marked);

  if (!out) throw new BlockError("That block could not be read.");
  return out;
}

/* ------------------------------------------------------------------ */
/* Escribir                                                             */
/* ------------------------------------------------------------------ */

/**
 * Estampa el nombre sobre el primer elemento de un trozo de HTML.
 *
 * Es lo que hace que reemplazar no sea borrar y crear: si lo que devuelve la
 * IA no trae su `data-plane`, se le repone. La misma disciplina que ya rige
 * con `FieldDef.id` en las tablas, y por la misma razon.
 *
 * Devuelve el nombre que quedo puesto: puede no ser el pedido si el que traia
 * el HTML ya estaba ocupado por otro bloque.
 */
function stampName(html: string, name: string): { html: string; name: string } {
  let first = true;
  let stamped = name;

  const out = new HTMLRewriter()
    .on("*", {
      element(el) {
        if (!first) return;
        first = false;
        el.setAttribute(BLOCK_ATTR, name);
        stamped = name;
      },
    })
    .transform(html);

  /*
   * Un trozo sin ningún elemento --texto suelto-- no tiene donde llevar el
   * nombre, y guardarlo así convertiria la edicion en borrar y crear: el
   * bloque perderia su identidad y las referencias que apuntaban ahi dejarian
   * de valer en silencio. Se rechaza diciendo por que, que es la otra salida
   * que el requisito admite.
   */
  if (first) {
    throw new BlockError(
      "A block's HTML has to start with an element --a tag--, not with loose text: that is what carries the block name. Wrap it in whichever element it belongs in.",
    );
  }

  return { html: out, name: stamped };
}

/**
 * Un nombre sacado de lo que el trozo es, para cuando nadie propuso ninguno.
 *
 * Existe porque un nombre sin significado --`bloque`, `bloque-2`-- no vale
 * para nada: no se lee en "Código HTML" y no dice a que se refiere. Antes de
 * caer en eso se mira lo que el propio HTML ya dice de si mismo: su título, su
 * id, su clase, y en ultimo termino su etiqueta.
 */
function deriveName(html: string): string {
  let tag = "";
  let id = "";
  let cls = "";
  let heading = "";
  let first = true;
  let reading = false;

  new HTMLRewriter()
    .on("*", {
      element(el) {
        if (first) {
          first = false;
          tag = el.tagName;
          id = el.getAttribute("id") ?? "";
          cls = (el.getAttribute("class") ?? "").trim().split(/\s+/)[0] ?? "";
          return;
        }
        if (!heading && /^(h[1-6]|caption|legend|summary)$/.test(el.tagName)) reading = true;
      },
      text(chunk) {
        if (!reading || heading) return;
        const text = chunk.text.trim();
        if (text) {
          heading = text;
          reading = false;
        }
      },
    })
    .transform(html);

  return slugName(heading || id || cls || tag || "bloque");
}

/** El nombre que ya lleva el primer elemento de un trozo, si lleva alguno. */
function nameOf(html: string): string {
  let name = "";
  let first = true;
  new HTMLRewriter()
    .on("*", {
      element(el) {
        if (!first) return;
        first = false;
        name = el.getAttribute(BLOCK_ATTR) ?? "";
      },
    })
    .transform(html);
  return name;
}

/** El nombre que le toca a un trozo que se guarda: el que tenia manda. */
function keepName(opts: {
  doc: string;
  html: string;
  /** El que ya tenia el bloque en el documento. Vacío: es la primera edicion. */
  current: string;
  /** El que propone la IA. */
  proposed: unknown;
}): string {
  if (opts.current) return opts.current;

  const asked = String(opts.proposed ?? "").trim();
  const taken = blockNames(opts.doc);
  return uniqueBlockName(opts.doc, asked || nameOf(opts.html) || deriveName(opts.html), taken);
}

/** El nombre del bloque al que apunta una referencia, si ya tiene uno. */
function currentName(doc: string, selector: string): string {
  let name = "";
  let first = true;
  new HTMLRewriter()
    .on(selector, {
      element(el) {
        if (!first) return;
        first = false;
        name = el.getAttribute(BLOCK_ATTR) ?? "";
      },
    })
    .transform(doc);
  return name;
}

/**
 * Reemplaza un bloque por otro HTML. Todo lo que no sea ese bloque queda
 * exactamente como estaba.
 */
export function replaceBlock(
  doc: string,
  ref: unknown,
  html: string,
  proposed?: unknown,
): { doc: string; name: string } {
  const selector = resolveBlock(doc, ref);
  const name = keepName({ doc, html, current: currentName(doc, selector), proposed });
  const piece = stampName(html, name);

  let first = true;
  const out = new HTMLRewriter()
    .on(selector, {
      element(el) {
        if (!first) return;
        first = false;
        el.replace(piece.html, { html: true });
      },
    })
    .transform(doc);

  return { doc: out, name: piece.name };
}

/** Mete un bloque nuevo justo antes o justo después de uno que ya existe. */
export function insertBlock(
  doc: string,
  ref: unknown,
  where: "antes" | "despues",
  html: string,
  proposed?: unknown,
): { doc: string; name: string } {
  const selector = resolveBlock(doc, ref);
  const asked = String(proposed ?? "").trim();
  const name = uniqueBlockName(doc, asked || nameOf(html) || deriveName(html));
  const piece = stampName(html, name);

  let first = true;
  const out = new HTMLRewriter()
    .on(selector, {
      element(el) {
        if (!first) return;
        first = false;
        if (where === "antes") el.before(piece.html, { html: true });
        else el.after(piece.html, { html: true });
      },
    })
    .transform(doc);

  return { doc: out, name: piece.name };
}

/** Quita un bloque del documento, con todo lo que tiene dentro. */
export function removeBlock(doc: string, ref: unknown): string {
  const selector = resolveBlock(doc, ref);

  let first = true;
  return new HTMLRewriter()
    .on(selector, {
      element(el) {
        if (!first) return;
        first = false;
        el.remove();
      },
    })
    .transform(doc);
}
