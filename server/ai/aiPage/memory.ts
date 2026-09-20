/**
 * La pasada que escribe la memoria de una pagina.
 *
 * Al cerrar un turno se hace una llamada corta y aparte, con su propio texto de
 * sistema, que recibe tres cosas --el intercambio entero, la memoria de ahora y
 * sus reglas de redaccion-- y contesta con las operaciones que hagan falta,
 * cada una sobre una vineta, o con ninguna. Nadie tiene que pedir que se guarde
 * nada.
 *
 * Es una llamada aparte y no una instruccion mas dentro del turno principal
 * porque alli competiria con veinte herramientas y toda la guia de
 * construccion: el modelo prioriza construir y la escritura sale irregular, que
 * es justo lo que hay que evitar. Aqui el texto de sistema se puede apretar sin
 * efectos colaterales. Ver `design.md` D3.
 *
 * Lo unico que no puede hacer es devolver la memoria entera reescrita: en la
 * reescritura numero quince el modelo resume de mas y borra en silencio una
 * regla que nadie miraba. Cada operacion nombra la vineta que toca, y lo que
 * ninguna nombra queda intacto. Por lo demas escribe lo que juzgue: cuantas
 * reglas toca, y cuanto lleva cada una, lo decide ella. Ver `design.md` D4.
 *
 * La unica cosa que manda sobre su criterio es una orden directa: si quien
 * construye pidio que algo se recuerde, se guarda aunque la pasada no lo
 * habria considerado una regla. La lista de lo que no se guarda existe para
 * que el sistema no adivine solo, no para desautorizar al dueno de la app.
 *
 * Que falle no rompe el turno: se registra, la memoria queda como estaba y la
 * respuesta sale igual.
 */
import { applyMemoryOps, type MemoryOp, normalizeMemory } from "../../../shared/pageMemory.ts";
import type { AiChoice, AiStep, AppRecord, PageRecord } from "../../../shared/types.ts";
import { INTERNAL } from "../../config.ts";
import { updateRecord } from "../../pb.ts";
import { askAi, loadAiConfig } from "../ai.ts";

/**
 * Lo que le cabe escribir.
 *
 * Holgado a proposito: no se le pone limite a cuantas reglas toca en un turno,
 * asi que el tope no puede ser lo que se lo ponga por la puerta de atras
 * cortando la lista por la mitad. Es lo que ocupa la respuesta, no lo que
 * tarda en pensarla: al modelo que piensa le suma su sitio `askAi`. Sin eso el
 * razonamiento se come el tope y la pasada vuelve con las manos vacias.
 */
const MAX_TOKENS = 12_000;

/** Lo que se conserva de cada pieza del intercambio al contarselo. */
const MAX_PIECE = 6_000;

export const MEMORY_SYSTEM = `You keep one page's rules.

The memory is what this page has to go on doing. It is read before every single request about this page --including the first one of a conversation that starts from nothing-- and it outlives the exchange that settled it. What is written there gets obeyed later; what is not written is forgotten, and nobody will notice until the page is rebuilt wrong.

You receive the whole exchange --what was asked, what the AI did, what it answered-- and the rules the page has saved right now. You decide what the memory has to say once this turn is over, and you get there by writing rules, changing rules and deleting rules. How many you touch, and how much each one carries, is your call.

## What goes in the memory

A rule is what would still have to be true if this page were rebuilt from scratch by somebody who never read this conversation. In practice it is one of these:

- **Who may do what.** "Solo los auxiliares crean citas." "Un odontólogo no cambia el estado de una cita ajena."
- **What the screen is for, and who uses it.** "La pantalla es para agendar pacientes desde recepción; el histórico se consulta en otra."
- **What data is required, and what it has to look like.** "El teléfono del paciente es obligatorio." "La cédula no se repite entre pacientes."
- **What the business does not allow.** "No se agenda en domingo." "No se reserva sobre días pasados."
- **The states a thing can be in, and what each change of state demands.** "Una cita está libre, reservada, confirmada o cancelada." "Cancelar exige un motivo de cancelación y conserva los datos del paciente."
- **How something is worked out.** "Los días de promesa son los 15 días hábiles siguientes a hoy." "Aplicar una plantilla crea una franja libre por cada franja suya en cada fecha del rango elegido."
- **What is born from what, and in what order.** "Las citas no se crean sueltas: nacen sobre una franja libre."
- **What has to be left on record.** "Cada acción queda en auditoría con fecha, hora, usuario y detalle."

One question settles the doubtful ones: **if this page were rebuilt tomorrow and this line were not there, would the rebuilt page be wrong?** If yes, it belongs in the memory. If it would merely look different, it does not.

## What does not go in it

When you are the one deciding, leave out:

- How it looks: colours, spacing, layout, wording, which columns and in what order, which icon.
- Fixing what was broken, or correcting a mistake the AI made. The fix is already in the page; it is not a rule about what the page does.
- Preferences about how to write or how to answer.
- The story of what happened. "Se pidió un filtro por fecha" is not a rule; "El listado solo muestra las citas del mes en curso" is.
- What the data already says on its own: how many patients there are, which places exist, what a table is called inside.

## When they asked you to remember it, you save it

That list is about what you decide on your own. It does not overrule a direct order.

When the person building the app asked for something to be remembered --"recuerda que...", "memoriza esto", "que no se te olvide", "agrégalo a las memorias", "guarda esto"-- **you save it**, and you save it even when it is one of the things above and even when you would not have called it a rule yourself. The memory is theirs; the list exists so that you do not guess, not so that you can turn them down.

- What they asked to remember may have been settled turns ago, and you only see this one. Take it from the AI's answer in this exchange, which restates it for exactly this reason. If neither the request nor the answer says what it is, return an empty list: inventing what they meant is worse than not saving it.
- If a saved rule already covers part of it, that part is "reemplazar" on that rule, not a second line beside it.

Asking you to **manage** the memory is not this: deleting a rule, rewriting the whole list, reading it out. That is done by hand in the page's settings, and it is not something you return. Return an empty list.

## What you return

Return JSON and nothing else. No prose, no code fence. Always this shape, with as many entries as this turn calls for:

\`\`\`
{"operaciones": []}
\`\`\`

Each entry is one of these three:

\`\`\`
{"op": "agregar", "texto": "<a rule that was not there>"}
{"op": "reemplazar", "vineta": "<the saved rule, copied exactly>", "texto": "<what it says now>"}
{"op": "borrar", "vineta": "<the saved rule, copied exactly>"}
\`\`\`

None is the usual answer. A turn that settles how a whole screen works is a dozen. Nothing caps you, and nothing makes you split a rule you would rather keep whole: you write the memory you think this page should have.

The one thing you cannot do is hand back the memory rewritten as a block. Every change names the rule it touches, so that what you did not name stays exactly as it was: that is what keeps a rule nobody was looking at from disappearing in silence.

"vineta" names a saved rule **by copying its text exactly as it is written**, without the leading dash. Never by its position: positions move as soon as somebody edits the list by hand, and operating on the third line of a list that changed rewrites the wrong rule. If what you copy does not match a line that is there, that operation is thrown away and the rest still apply.

They are applied in the order you write them, each one over what the one before left. So a rule you replaced earlier in the same list is named, from then on, by its new text.

## How a rule is written

- In Spanish, in the present tense, saying what the page does --not what was asked for, and not what you did. Proper accents and ñ.
- One line, no line breaks inside. It reads like a rule of the house: "Solo los auxiliares crean citas", never "Se pidió que solo los auxiliares crearan citas".
- No names of tables, columns, functions or any other internal identifier: say what a person sees and does.
- **Read what is saved before you write.** If a rule already covers the ground, that is "reemplazar" on it. Two lines saying nearly the same thing is what rots a memory, because later nobody knows which of the two is in force.
- You may touch a rule this exchange never mentioned: merge two that say the same, delete one the page no longer does, rewrite one that got overtaken. You are keeping the list, not just appending to it.

## When you return an empty list

This is the normal answer, not a failure. Return \`{"operaciones": []}\` whenever:

- The exchange settled nothing about what the page must do --a colour, a title, a fix, a question, a turn that built nothing-- **and** nobody asked for anything to be remembered.
- What it settled is already written, in the same words or in others.
- They asked to remember something but neither the request nor the answer says what.
- They asked you to delete, rewrite or show the memory rather than add to it.
- You are not sure. A rule saved wrongly gets obeyed afterwards, which is worse than one that was not saved: the person can always write it by hand.`;

/** Un intercambio, tal y como se le cuenta a la pasada. */
export interface MemoryExchange {
  /** Lo que se pidio en este turno. */
  prompt: string;
  /** La pregunta con la que la IA cerro el turno anterior, si este la contesta. */
  question?: string;
  /** El texto con el que la IA cerro este turno. */
  answer: string;
  /** Lo que la IA hizo de verdad: sus pasos, tal como se apuntaron. */
  steps: AiStep[];
}

/** El intercambio entero, en el orden en que ocurrio. */
function exchangeText(exchange: MemoryExchange, memory: string): string {
  const cut = (text: string) => text.trim().slice(0, MAX_PIECE);
  const parts: string[] = [];

  if (exchange.question) {
    parts.push(
      `## What the AI asked in the previous turn\n\n${cut(exchange.question)}\n\nWhat follows is the answer to that question, so read the two together: on its own the answer does not say what it is about.`,
    );
  }

  parts.push(`## What was asked\n\n${cut(exchange.prompt)}`);

  const done = exchange.steps
    .filter((step) => step.ok)
    .map((step) => `- ${step.tool}: ${step.summary}`)
    .join("\n");
  parts.push(
    done
      ? `## What the AI actually did\n\n${cut(done)}`
      : "## What the AI actually did\n\nNothing: no command of its own changed the page or the database this turn.",
  );

  if (exchange.answer.trim()) {
    parts.push(`## What the AI answered\n\n${cut(exchange.answer)}`);
  }

  parts.push(
    memory
      ? `## The rules saved right now\n\n${memory}`
      : "## The rules saved right now\n\nNone yet: this page has no saved rules.",
  );

  return parts.join("\n\n");
}

/** El modelo suele envolver el JSON en un bloque de codigo. */
function unfence(text: string): string {
  const fenced = /^\s*```[\w-]*\s*\n([\s\S]*?)\n?```\s*$/.exec(text.trim());
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Una entrada de la lista, si se entiende.
 *
 * Lo que no es una de las tres formas se descarta --`null`-- en vez de
 * detener a las demas: de una lista de ocho, la que vino mal se pierde sola.
 */
function readOne(entry: unknown): MemoryOp | null {
  const value = (entry ?? {}) as Record<string, unknown>;
  const op = String(value.op ?? "").trim();
  const texto = typeof value.texto === "string" ? value.texto : "";
  const vineta = typeof value.vineta === "string" ? value.vineta : "";

  if (op === "agregar" && texto.trim()) return { op: "agregar", texto };
  if (op === "reemplazar" && texto.trim() && vineta.trim()) {
    return { op: "reemplazar", vineta, texto };
  }
  if (op === "borrar" && vineta.trim()) return { op: "borrar", vineta };
  return null;
}

/**
 * El JSON que venga dentro del texto, sea objeto o lista.
 *
 * El sistema pide un objeto pelado, pero el modelo escribe alrededor mas de lo
 * que promete: se busca el primer parentesis que abre de cada clase y el
 * ultimo que cierra de la misma clase, y lo de fuera se ignora.
 */
function readJson(text: string): unknown {
  const spans = [
    [text.indexOf("{"), text.lastIndexOf("}")],
    [text.indexOf("["), text.lastIndexOf("]")],
  ]
    .filter(([start, end]) => start !== -1 && end > start)
    // El que empiece antes es el que envuelve al otro.
    .sort((a, b) => a[0] - b[0]);

  for (const [start, end] of spans) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // La otra forma puede seguir valiendo.
    }
  }
  return null;
}

/**
 * Lo que contesto, en la forma que se puede aplicar.
 *
 * Una respuesta que no se entiende no es motivo para tocar la memoria: se
 * devuelve la lista vacia, que es lo mismo que no tener nada que guardar.
 */
export function readMemoryOps(answer: string): MemoryOp[] {
  const raw = readJson(unfence(answer));
  if (!raw) return [];

  // La lista es lo que se pide; un objeto suelto se acepta igual, que es como
  // contesta un modelo que decide escribir solo la operacion.
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>).operaciones)
      ? ((raw as Record<string, unknown>).operaciones as unknown[])
      : [raw];

  return list.map(readOne).filter((op): op is MemoryOp => op !== null);
}

/**
 * Con que modelo se atiende la pasada.
 *
 * Por defecto el mismo del turno que la disparo: no se introduce una segunda
 * configuracion que nadie mantiene. El ajuste existe por si mas adelante
 * conviene uno mas barato para esta tarea. Ver `design.md` D7.
 */
async function memoryChoice(turn: Partial<AiChoice> | undefined): Promise<Partial<AiChoice>> {
  const cfg = await loadAiConfig();
  const own = cfg.memoryChoice;
  return own?.provider && own.model ? own : (turn ?? {});
}

/**
 * La pasada entera: preguntar, aplicar y guardar.
 *
 * Devuelve la memoria que quedo escrita, o `null` si no cambio nada --tanto
 * porque no habia nada que guardar como porque lo que contesto nombraba una
 * vineta que ya no esta--.
 */
export async function runMemoryPass(opts: {
  app: AppRecord;
  page: PageRecord;
  exchange: MemoryExchange;
  /** Con que se atendio el turno, para atender la pasada igual. */
  choice?: Partial<AiChoice>;
}): Promise<string | null> {
  const memory = normalizeMemory(opts.page.memory);
  const answer = await askAi(
    MEMORY_SYSTEM,
    exchangeText(opts.exchange, memory),
    MAX_TOKENS,
    await memoryChoice(opts.choice),
  );

  /*
   * Una respuesta vacia se leeria como "no hay nada que guardar" y la memoria
   * se quedaria igual sin que nadie se entere. Se dice, porque por fuera no
   * se distingue de un turno que de verdad no traia ninguna regla.
   */
  if (!answer.trim()) {
    console.error(
      `[memoria] La pasada de la página "${opts.page.name}" no escribió nada. La memoria queda como estaba.`,
    );
    return null;
  }

  const next = applyMemoryOps(memory, readMemoryOps(answer));
  if (next === null || next === memory) return null;

  await updateRecord<PageRecord>(INTERNAL.pages, opts.page.id, { memory: next });
  return next;
}
