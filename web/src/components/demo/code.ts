/*
  El HTML de una ficha, leido de lo que hay pintado.

  La galeria no guarda en ningun sitio el codigo de sus ejemplos, y a proposito:
  el ejemplo *es* el marcado escrito en la ficha. Copiarlo a una cadena para
  poder enseñarlo seria tener el mismo componente escrito dos veces, y de las
  dos copias solo se actualiza una. Asi que lo que se enseña se lee del DOM al
  abrir el modal: se recorre el cuerpo de la ficha y se vuelve a escribir con
  sangrado. El marcado de la ficha se toca como siempre --en su sitio, en el
  `.card-body`-- y el modal se entera solo.

  Por el camino se quita lo que puso el navegador o la herramienta y nadie
  escribio: los comentarios, las clases con las que Svelte marca sus estilos
  scoped y la medida que Chart.js le clava al `<canvas>` cuando lo dibuja.
*/

/** Sin cierre: se escriben de una pieza. */
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
  "source",
  "track",
  "wbr",
]);

/** Su contenido es texto tal cual: ni se sangra ni se recorta. */
const RAW = new Set(["pre", "textarea"]);

/**
 * Atributos que aparecen solos al pintar, no en el marcado. Chart.js
 * redimensiona el canvas por atributo y le pone estilo y papel de imagen.
 */
const PAINTED: Record<string, Set<string>> = {
  canvas: new Set(["width", "height", "style", "role", "aria-label"]),
};

/**
 * La marca que Svelte le pone a lo que vista un `<style>` scoped: `s-` o
 * `svelte-` y un resumen largo, sin guiones. Se pide el resumen entero a
 * proposito --el catalogo tiene clases cortas que empiezan igual (`s-foot`,
 * `s-label`, `s-val`) y esas son del ejemplo, no del compilador.
 */
const SCOPED = /^(?:s|svelte)-[A-Za-z0-9_]{10,}$/;

/** A partir de aqui el elemento se abre en varias lineas. */
const MAX_LINE = 92;

const INDENT = "  ";

function flat(node: Node): string {
  return (node.textContent ?? "").replace(/\s+/g, " ");
}

/** Fuera comentarios, marcas de Svelte y los blancos entre etiquetas. */
function keep(node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) return true;
  return node.nodeType === Node.TEXT_NODE && flat(node).trim() !== "";
}

function openTag(el: Element): string {
  const painted = PAINTED[el.localName];
  const attrs = Array.from(el.attributes)
    .filter((a) => !painted?.has(a.name))
    .map((a) => {
      if (a.name === "class") {
        const kept = a.value
          .split(/\s+/)
          .filter((c) => c && !SCOPED.test(c))
          .join(" ");
        return kept ? ` class="${kept}"` : "";
      }
      // Un atributo sin valor se escribio sin valor: `popover`, `checked`.
      return a.value === "" ? ` ${a.name}` : ` ${a.name}="${a.value.replaceAll('"', "&quot;")}"`;
    })
    .join("");
  return `<${el.localName}${attrs}>`;
}

/**
 * El elemento entero en una linea, o `null` si no puede ser.
 *
 * Es lo que devuelve el marcado a como se escribio: un escalon de una ruta o
 * una celda con su icono se escribieron de un tiron, y partirlos por cada hijo
 * los haria ilegibles. El blanco entre etiquetas cuenta --en HTML un salto de
 * linea es un espacio-- asi que se conserva uno donde lo habia; sin eso, un
 * `</b> <span>` pegaria las dos palabras.
 */
function flatten(el: Element): string | null {
  const tag = el.localName;
  const open = openTag(el);
  if (VOID.has(tag)) return open;
  if (RAW.has(tag)) {
    const text = el.textContent ?? "";
    return text.includes("\n") ? null : `${open}${text}</${tag}>`;
  }

  let inner = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = flat(node);
      if (text.trim() === "") {
        if (inner) inner += " ";
        continue;
      }
      inner += text;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const sub = flatten(node as Element);
    if (sub === null) return null;
    inner += sub;
  }

  return `${open}${inner.trim()}</${tag}>`;
}

function write(node: Node, depth: number, out: string[]): void {
  const pad = INDENT.repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    out.push(pad + flat(node).trim());
    return;
  }

  const el = node as Element;
  const tag = el.localName;

  const kids = Array.from(el.childNodes).filter(keep);
  const line = flatten(el);

  // Cabe de una pieza, o no hay forma de partirlo por mucho que mida: un
  // `<input>`, o un elemento vacio --partirlo solo dejaria el cierre solo.
  const whole = VOID.has(tag) || RAW.has(tag) || kids.length === 0;
  if (line !== null && (whole || pad.length + line.length <= MAX_LINE)) {
    out.push(pad + line);
    return;
  }

  out.push(pad + openTag(el));
  for (const kid of kids) write(kid, depth + 1, out);
  out.push(`${pad}</${tag}>`);
}

/** El marcado de lo que hay dentro de `root`, sangrado y sin sus hijos vacios. */
export function readMarkup(root: Element): string {
  const out: string[] = [];
  for (const kid of Array.from(root.childNodes).filter(keep)) write(kid, 0, out);
  return out.join("\n");
}
