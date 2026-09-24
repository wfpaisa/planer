/** Regresiones del contexto: lecturas compactadas, historia y contratos por modo. */
import assert from "node:assert/strict";

import { priorTurns } from "../server/ai/aiPage/index.ts";
import { systemPrompt } from "../server/ai/aiPage/prompts.ts";
import { toolsFor } from "../server/ai/aiPage/tools.ts";
import {
  CalibratedEstimate,
  compactReadResults,
  estimateContext,
} from "../server/ai/contextBudget.ts";
import { buildHtmlContract, htmlGuide } from "../shared/htmlContract.ts";
import { ICON_NAME_SET } from "../shared/iconNames.ts";
import { searchIcons } from "../shared/icons.ts";
import type { AiMessage, AppRecord, PageRecord } from "../shared/types.ts";

const old = "contenido anterior ".repeat(500);
const current = "contenido vigente ".repeat(500);
const messages = [
  {
    role: "assistant",
    tool_calls: [
      { id: "a", function: { name: "leer_bloque", arguments: '{"bloque":"cabecera"}' } },
    ],
  },
  { role: "tool", tool_call_id: "a", content: old },
  {
    role: "assistant",
    tool_calls: [{ id: "w", function: { name: "reemplazar_bloque", arguments: "{}" } }],
  },
  { role: "tool", tool_call_id: "w", content: old },
  {
    role: "assistant",
    tool_calls: [
      { id: "b", function: { name: "leer_bloque", arguments: '{"bloque":"cabecera"}' } },
    ],
  },
  { role: "tool", tool_call_id: "b", content: current },
];
compactReadResults(messages);
assert.notEqual(messages[1].content, old);
assert.equal(messages[3].content, old, "La escritura conserva su resultado");
assert.equal(messages[5].content, current, "La lectura actual conserva todo el contenido");
assert.equal(messages[1].tool_call_id, "a", "No se rompe el par llamada-respuesta");
const blocks: { role: string; content: Record<string, unknown>[] }[] = [
  { role: "assistant", content: [{ type: "tool_use", id: "a", name: "ver_pagina", input: {} }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: old }] },
  { role: "assistant", content: [{ type: "tool_use", id: "b", name: "ver_pagina", input: {} }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "b", content: current }] },
];
compactReadResults(blocks);
assert.notEqual(blocks[1].content[0].content, old);
assert.equal(blocks[3].content[0].content, current);
const history: AiMessage[] = Array.from({ length: 15 }, (_, i) => [
  { from: "yo" as const, text: `Pregunta ${i}` },
  { from: "ia" as const, text: `Respuesta ${i}` },
]).flat();
const kept = priorTurns(history);
assert.equal(kept[0].text, "Pregunta 5");
assert.equal(kept.at(-1)?.text, "Respuesta 14");
assert.equal(kept.length, 20);
const planTools = toolsFor(true).map((tool) => tool.name);
for (const name of ["escribir_pagina", "llenar_tabla", "borrar_tabla", "cambiar_acceso"])
  assert.ok(!planTools.includes(name));
assert.ok(planTools.includes("cerrar_plan"));
assert.ok(planTools.includes("consultar_tablas"));
const app = { name: "Ejemplo", roles: ["admin"] } as AppRecord;
const page = {
  name: "Clientes",
  icon: "user-group",
  roles: [],
  memory: "",
} as unknown as PageRecord;
const plan = systemPrompt(app, page, [], [], [], [], true);
const build = systemPrompt(app, page, [], [], [], [], false);
assert.ok(!plan.includes("## Build workflow"));
assert.ok(!build.includes("## Plan workflow"));
assert.ok(plan.includes("little or no technology knowledge"));
// Unos 3,5 caracteres latinos por token: ni el doble, ni la mitad.
const latin = estimateContext({ content: "Añade un buscador encima de la lista. ".repeat(100) });
assert.ok(latin > 900 && latin < 1400, `estimación latina fuera de rango: ${latin}`);
// La calibración lleva la estimación a lo medido, dentro de sus cotas.
const calibrated = new CalibratedEstimate();
const raw = calibrated.of({ content: "x".repeat(3500) });
calibrated.calibrate(raw, raw * 2);
assert.equal(calibrated.of({ content: "x".repeat(3500) }), Math.ceil(raw * 2));
calibrated.calibrate(raw * 2, raw * 100);
assert.ok(calibrated.of({ content: "x".repeat(3500) }) <= Math.ceil(raw * 2.5));
for (const topic of [
  "componentes",
  "colores",
  "medidas",
  "oficio",
  "estilos",
  "datos",
  "graficas",
  "bloques",
  "iconos",
])
  assert.ok(htmlGuide(topic));
// Ningún tema cuesta más de dos lecturas salvo "estilos", que junta cuatro.
for (const topic of ["componentes", "colores", "medidas", "oficio", "datos", "graficas"])
  assert.ok((htmlGuide(topic) ?? "").length <= 16000, `${topic} no cabe en una lectura`);
// Los iconos se buscan: ni el contrato ni la guía llevan la lista.
assert.ok(toolsFor(false).some((tool) => tool.name === "buscar_iconos"));
assert.ok(planTools.includes("buscar_iconos"));
const fullContract = buildHtmlContract({ tables: [] });
assert.ok(!fullContract.includes("The safe names, by family"));
assert.ok(fullContract.includes("buscar_iconos"));
assert.ok((htmlGuide("iconos") ?? "").length < 1000);
assert.ok(!build.includes("--bg-level2"), "el contrato compacto usa el vocabulario de las páginas");
for (const query of ["user", "invoice", "calendar", "shopping cart", "warehouse"]) {
  const found = searchIcons(query);
  assert.ok(found.length, `sin iconos para ${query}`);
  assert.ok(found.every((name) => ICON_NAME_SET.has(name)));
}
assert.equal(searchIcons("invoice")[0], "invoice");
assert.deepEqual(searchIcons("  "), []);
assert.equal(htmlGuide("desconocido"), null);
console.log(
  JSON.stringify({
    resultado: "Contexto verificado",
    caracteresConstruir: build.length,
    caracteresPlan: plan.length,
  }),
);
