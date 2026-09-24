/** Lo que se reserva por imagen: no se tokeniza como su base64. */
export const IMAGE_TOKENS = 2000;

/** Por debajo de esto una página no se llega a escribir: mejor avisar que cortar. */
export const MIN_OUTPUT_TOKENS = 4096;

/**
 * Estimación de tokens de lo que se va a mandar, sin llamar al proveedor.
 *
 * Un token son unos 3,5 caracteres de texto latino (inglés, español, JSON); un
 * carácter fuera de ASCII cuenta más, porque los alfabetos que no son latinos
 * se parten mucho más. Es una aproximación: `CalibratedEstimate` la corrige
 * con lo que el proveedor cuenta de verdad en cuanto hay una ronda medida.
 */
export function estimateContext(value: unknown): number {
  // Las imágenes no se tokenizan como su base64: se reserva espacio aparte.
  const dump = value as { system?: string; messages?: { role?: string }[] } | null;
  const counted =
    dump?.system && dump.messages?.some((message) => message.role === "system")
      ? { ...dump, system: undefined }
      : value;
  const text = (JSON.stringify(counted) ?? "")
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, "[image]")
    .replace(/"data":"[A-Za-z0-9+/=]{256,}"/g, '"data":"[image]"');
  let ascii = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) < 128) ascii++;
  return Math.ceil(ascii / 3.5 + (text.length - ascii) / 1.5);
}

/**
 * La estimación, corregida por lo medido.
 *
 * Tras cada ronda el proveedor dice cuántos tokens de entrada contó; la razón
 * entre eso y lo estimado se aplica a las siguientes. Se acota para que una
 * medida rara --una caché contada aparte, un servidor que no cuenta bien-- no
 * dispare ni anule el presupuesto.
 */
export class CalibratedEstimate {
  private ratio = 1;

  of(value: unknown): number {
    return Math.ceil(estimateContext(value) * this.ratio);
  }

  calibrate(estimated: number, measured: number): void {
    if (estimated <= 0 || measured <= 0) return;
    const raw = (measured / estimated) * this.ratio;
    this.ratio = Math.min(2.5, Math.max(0.5, raw));
  }
}

export class ContextBudgetError extends Error {
  constructor() {
    super(
      "La solicitud necesita más espacio del que admite este modelo. Reduce los archivos o elige un modelo con más capacidad. Los cambios ya guardados se conservan.",
    );
    this.name = "ContextBudgetError";
  }
}

/** Sustituye solo lecturas repetidas; conserva llamadas, identificadores y escrituras. */
export function compactReadResults(messages: unknown[]): void {
  const reads = new Set([
    "ver_pagina",
    "leer_bloque",
    "consultar_tablas",
    "consultar_datos",
    "leer_archivo",
    "consultar_guia",
  ]);
  const calls = new Map<string, string>();
  const latest = new Map<string, Record<string, unknown>>();
  const remember = (id: string, name: string, input: unknown) => {
    if (reads.has(name)) calls.set(id, JSON.stringify([name, input]));
  };
  const result = (id: string, item: Record<string, unknown>) => {
    const key = calls.get(id);
    if (!key) return;
    const previous = latest.get(key);
    if (previous && typeof previous.content === "string" && previous.content.length > 2000) {
      previous.content =
        "[Superseded read. The later result of this same tool and arguments contains the current content.]";
    }
    latest.set(key, item);
  };
  for (const raw of messages) {
    const message = raw as Record<string, unknown>;
    if (Array.isArray(message.tool_calls))
      for (const rawCall of message.tool_calls) {
        const call = rawCall as { id: string; function: { name: string; arguments: string } };
        remember(call.id, call.function.name, call.function.arguments);
      }
    if (message.role === "tool") result(String(message.tool_call_id), message);
    if (Array.isArray(message.content))
      for (const rawBlock of message.content) {
        const block = rawBlock as Record<string, unknown>;
        if (block.type === "tool_use") remember(String(block.id), String(block.name), block.input);
        if (block.type === "tool_result") result(String(block.tool_use_id), block);
      }
  }
}
