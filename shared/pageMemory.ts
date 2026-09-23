/**
 * La memoria de una página: sus reglas funcionales, una por vineta.
 *
 * Es texto, no una estructura: se lee entero en cada petición a la IA, se edita
 * a mano en una caja y se borra con la página. Aquí vive lo único que hay que
 * decidir sobre el, y vive compartido porque lo usan los dos sitios que
 * escriben: la ruta por la que guarda quien construye y la pasada que escribe
 * al cerrar un turno.
 *
 * Nada de esto recorta por tamaño. Lo que mantiene la memoria corta es como
 * escribe la pasada --una regla por vineta, reemplazar antes que agregar algo
 * parecido, no escribir ante la duda--, no un corte que haria desaparecer una
 * regla que nadie estaba mirando. Ver `design.md` D6.
 */

/**
 * El texto tal como se guarda.
 *
 * Plano: los saltos de línea se conservan --son lo que separa una vineta de la
 * siguiente-- y de lo demás solo se quitan los caracteres de control, que no
 * dicen nada y ensucian lo que se le manda al modelo. Los finales de línea de
 * Windows se unifican para que la misma regla escrita en dos equipos sea el
 * mismo texto, que es de lo que depende nombrar una vineta (D4).
 */
export function normalizeMemory(value: unknown): string {
  if (typeof value !== "string") return "";
  return withoutControls(value.replace(/\r\n?/g, "\n"))
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}

/**
 * Sin los caracteres de control, menos el salto de línea y el tabulador.
 *
 * Se recorre en vez de escribirse como expresion regular porque una expresion
 * con caracteres de control dentro es lo que prohibe la regla de lint, y aquí
 * la prohibicion tiene razon: escritos no se ven.
 */
function withoutControls(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\n" || ch === "\t" || (code >= 0x20 && code !== 0x7f)) out += ch;
  }
  return out;
}

/** El marcador con el que se escribe cada regla. */
const BULLET = "- ";

/** Si una línea es una vineta, lo que dice sin el marcador. */
function bulletText(line: string): string | null {
  const match = /^\s*[-*]\s+(.*)$/.exec(line);
  return match ? match[1].trim() : null;
}

/** Las reglas guardadas, en el orden en que estan escritas. */
export function memoryBullets(memory: string): string[] {
  const out: string[] = [];
  for (const line of normalizeMemory(memory).split("\n")) {
    const text = bulletText(line);
    if (text) out.push(text);
  }
  return out;
}

/** Lo que la pasada puede hacerle a la memoria. Ver `design.md` D4. */
export type MemoryOp =
  | { op: "sin cambios" }
  | { op: "agregar"; texto: string }
  | { op: "reemplazar"; vineta: string; texto: string }
  | { op: "borrar"; vineta: string };

/**
 * Compara dos textos de vineta como los compara quien los lee: sin importar
 * espacios de mas ni mayusculas. La pasada nombra la vineta copiandola, y una
 * copia con un espacio distinto sigue siendo la misma regla.
 */
const sameBullet = (a: string, b: string): boolean =>
  a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Aplica una operacion sobre el texto guardado.
 *
 * La vineta se nombra por su texto, nunca por su posicion: una posicion se
 * desplaza en cuanto alguien edita la caja a mano, y operar sobre la tercera de
 * una lista que cambio borra la regla equivocada. Si el texto nombrado ya no
 * aparece, la operacion se descarta y la memoria queda como estaba: perder una
 * escritura es recuperable, pisar una regla ajena no. Ver `design.md` D4.
 *
 * Devuelve el texto nuevo, o `null` si no había nada que cambiar --tanto
 * porque la pasada dijo que no como porque nombro algo que ya no esta--.
 */
export function applyMemoryOp(memory: string, operation: MemoryOp): string | null {
  const current = normalizeMemory(memory);

  if (operation.op === "sin cambios") return null;

  if (operation.op === "agregar") {
    const text = normalizeMemory(operation.texto).replace(/\s+/g, " ").trim();
    if (!text) return null;
    // Una regla que ya esta escrita no se escribe dos veces: agregar lo mismo
    // es lo que hace crecer la memoria sin decir nada nuevo.
    if (memoryBullets(current).some((bullet) => sameBullet(bullet, text))) return null;
    return current ? `${current}\n${BULLET}${text}` : `${BULLET}${text}`;
  }

  const target = normalizeMemory(operation.vineta).replace(/\s+/g, " ").trim();
  if (!target) return null;

  const lines = current.split("\n");
  const index = lines.findIndex((line) => {
    const text = bulletText(line);
    return text !== null && sameBullet(text, target);
  });
  if (index === -1) return null;

  if (operation.op === "borrar") {
    lines.splice(index, 1);
    return normalizeMemory(lines.join("\n"));
  }

  const text = normalizeMemory(operation.texto).replace(/\s+/g, " ").trim();
  if (!text) return null;
  lines[index] = `${BULLET}${text}`;
  return normalizeMemory(lines.join("\n"));
}

/**
 * Aplica varias operaciones, en el orden en que vienen.
 *
 * Cada una trabaja sobre el resultado de la anterior: reemplazar una vineta y
 * después nombrarla por su texto nuevo funciona, y nombrarla por el viejo ya
 * no. Es el orden lo que las hace legibles, y por eso no se reordenan.
 *
 * Una operacion que no cambia nada --nombra una vineta que ya no esta, o
 * repite una regla escrita-- se salta sin detener a las demás: que la pasada
 * falle en una de diez no es motivo para perder las otras nueve.
 *
 * Devuelve el texto nuevo, o `null` si ninguna cambio nada.
 */
export function applyMemoryOps(memory: string, operations: MemoryOp[]): string | null {
  let current = normalizeMemory(memory);
  let changed = false;
  for (const operation of operations) {
    const next = applyMemoryOp(current, operation);
    if (next === null || next === current) continue;
    current = next;
    changed = true;
  }
  return changed ? current : null;
}
