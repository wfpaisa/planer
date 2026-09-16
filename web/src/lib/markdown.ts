/**
 * El formato con el que escribe la IA, interpretado.
 *
 * La IA responde en Markdown porque asi escriben los modelos, y sin
 * interpretarlo se lee un amasijo de asteriscos y guiones. Aqui se reconoce el
 * subconjunto que de verdad usa: titulos, listas, negrita, cursiva, codigo y
 * enlaces.
 *
 * Esto solo entiende el texto: devuelve que hay y en que orden, sin decidir
 * como se ve. Dibujarlo es cosa de `components/Markdown.svelte`, y ahi cada
 * pieza sale como un nodo del arbol, nunca como HTML crudo. Es una decision de
 * seguridad: lo que llega de la IA puede traer cualquier cosa dentro, y por
 * este camino un `<script>` es texto y nada mas. Por eso tampoco se acepta
 * HTML dentro del Markdown: se ve tal cual se escribio.
 */

/** Un trozo de una linea, ya reconocido. */
export type Piece =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string };

/** Un elemento de una lista. Lleva su numero para no reordenarse al crecer. */
export interface Item {
  id: number;
  pieces: Piece[];
}

/** Lo que se dibuja de arriba abajo. */
export type Block =
  | { id: number; kind: "paragraph"; pieces: Piece[] }
  | { id: number; kind: "heading"; pieces: Piece[] }
  | { id: number; kind: "list"; ordered: boolean; items: Item[] }
  | { id: number; kind: "code"; text: string };

/* ------------------------------------------------------------------ */
/* Lo de dentro de una linea                                            */
/* ------------------------------------------------------------------ */

/*
 * El codigo va primero a proposito: dentro de `` `...` `` no hay negrita ni
 * enlaces, solo texto. Despues los enlaces, y al final los enfasis.
 */
const INLINE =
  /(`[^`\n]+`)|(\[[^\]\n]+\]\((?:https?:\/\/|\/)[^)\s]+\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)/;

export function parseInline(text: string): Piece[] {
  const out: Piece[] = [];
  let rest = text;

  while (rest) {
    const hit = INLINE.exec(rest);
    if (!hit || hit.index === undefined) {
      out.push({ kind: "text", text: rest });
      break;
    }

    if (hit.index > 0) out.push({ kind: "text", text: rest.slice(0, hit.index) });
    const token = hit[0];

    if (token.startsWith("`")) {
      out.push({ kind: "code", text: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      out.push({
        kind: "link",
        text: token.slice(1, split),
        href: token.slice(split + 2, -1),
      });
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push({ kind: "strong", text: token.slice(2, -2) });
    } else {
      out.push({ kind: "em", text: token.slice(1, -1) });
    }

    rest = rest.slice(hit.index + token.length);
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Los bloques                                                          */
/* ------------------------------------------------------------------ */

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,4})\s+(.*)$/;

/** Interpreta el texto de la IA y devuelve lo que hay que dibujar. */
export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  /** Lo que se viene juntando: un parrafo, una lista o un bloque de codigo. */
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: Item[] } | null = null;
  let fence: string[] | null = null;
  let n = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ id: n++, kind: "paragraph", pieces: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ id: n++, kind: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    // Dentro de un bloque de codigo no se interpreta nada hasta que cierra.
    if (fence) {
      if (line.trimStart().startsWith("```")) {
        blocks.push({ id: n++, kind: "code", text: fence.join("\n") });
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      flushAll();
      fence = [];
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      blocks.push({ id: n++, kind: "heading", pieces: parseInline(heading[2]) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBER.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      flushParagraph();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      list = list ?? { ordered, items: [] };
      list.items.push({ id: n++, pieces: parseInline(item[1]) });
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  // Lo que quedo a medias se dibuja igual: la IA puede estar escribiendo aun.
  if (fence?.length) blocks.push({ id: n++, kind: "code", text: fence.join("\n") });
  flushAll();

  return blocks;
}
