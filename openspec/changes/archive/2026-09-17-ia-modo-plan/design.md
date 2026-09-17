## Context

Ver `proposal.md` - Why. Piezas del código de donde parte este diseño:

- El composer del dock ([AiPanel.svelte](../../../web/src/components/AiPanel.svelte)) ya tiene un patron de boton-interruptor junto al que va este: `btn-toggle-picker`, con estado `picker.active`.
- `AiMessage` ([shared/types.ts](../../../shared/types.ts)) ya distingue mensajes "especiales" con un campo opcional -- `question?: AiQuestion` es el que mas se parece a lo que necesita el plan: un mensaje de la IA que cierra el turno y se pinta con una tarjeta propia (`Question.svelte`), en vez de texto corrido.
- El bucle de herramientas (`runPageRequest` / `runTool` en `server/aiPage.ts`) arma la lista `TOOLS` que se le ofrece al modelo en cada ronda; el modelo solo puede llamar lo que esa lista contiene.
- `preguntar` ya es un ejemplo de herramienta que cierra el turno sin construir nada (ver `AiQuestion` y "Preguntar cierra el turno" en `shared/types.ts`).

## Goals / Non-Goals

**Goals:**
- El estado del modo Plan (activo, cerrado, implementado) sobrevive a recargar la pagina y a abrir la conversacion desde otro navegador, igual que el resto del hilo.
- Que la IA no pueda mutar la pagina ni las tablas en modo Plan sea una garantia del servidor, no solo una instruccion en el prompt.
- Reusar los patrones que ya existen (tarjeta de turno especial, boton-interruptor) en vez de introducir mecanismos nuevos de UI.

**Non-Goals:**
- No cubre planes que abarquen mas de una pagina (ver proposal.md - Capabilities).
- No cambia como se guarda o se recorre el historial de conversaciones (`ai-authoring`), solo agrega un tipo de mensaje mas.

## Decisions

**D1 -- El estado del modo Plan se deriva del hilo, no de un interruptor aparte en el navegador.**
Igual que el modelo elegido se guarda con `readChoice`/`writeChoice` en `localStorage`, se penso primero en guardar ahi si el modo Plan esta activo. Se descarta: el modo Plan tiene que sobrevivir a recargar y respetar que ya se cerro e implemento un plan ("un solo sentido"), y eso tiene que ser cierto para cualquiera que abra esa conversacion, no solo en el navegador donde se activo. En su lugar, el estado se dobla del propio hilo (`AiChat.messages`), pareciendo al `plan` folded state de deepseek-harness: activo si el ultimo mensaje relevante no cerro un plan, cerrado si el ultimo mensaje de la IA trae `.plan` sin implementar, implementado si ya se eligio construir. El boton del composer solo manda la intencion (activar/desactivar) para la proxima peticion; quien decide el estado real es el servidor, a partir del hilo.

**D2 -- El plan cerrado es un campo opcional en `AiMessage`, paralelo a `question`.**
Se sigue el mismo patron que ya distingue una pregunta de una respuesta normal, en vez de crear un tipo de mensaje aparte o un canal distinto de eventos. `AiMessage.plan?: { texto: string; implementado: boolean }`. El hilo ya sabe pintar mensajes especiales delante del texto (`Question.svelte` es el precedente); un `PlanCard.svelte` sigue el mismo molde, con icono y estilo propios como pide la spec.

**D3 -- El gating de herramientas ocurre en el servidor, filtrando `TOOLS`.**
Mientras el modo Plan este activo, la lista de herramientas que se le ofrece al modelo en esa ronda excluye las que escriben pagina o tablas, y agrega una herramienta de cierre nueva (`cerrar_plan`, con la misma forma que `preguntar`: cierra el turno y trae el texto del plan). Pedirlo solo por prompt no alcanza -- el propio sistema ya distingue entre "instruir por texto" (el modelo puede ignorarlo) y "no ofrecer la herramienta" (lo unico que de verdad lo impide), que es como esta armado hoy `preguntar` frente a las herramientas que construyen.

**D4 -- Cortar el plan a mitad de conversacion es una accion del dock, no un mensaje de texto.**
La orden de "implementar ya" del usuario es un boton, no algo que el usuario escriba en el campo para que el modelo lo interprete como orden de cierre. Evita que el modelo confunda esa orden con contenido a planear, y es coherente con que el propio cierre por parte de la IA ya usa una herramienta dedicada (D3) en vez de una convencion de texto.

**D5 -- Apagar el boton de Plan despues de que ya se cerro una tarjeta, sin haber elegido implementar, no descarta la tarjeta.**
La tarjeta de plan cerrado queda en el hilo como cualquier mensaje pasado (sin marcar implementado), y el boton vuelve a modo normal. Es la misma regla que apagarlo antes de cerrar, aplicada un paso mas tarde: el "un solo sentido" de la spec es sobre implementar, no sobre el boton.

## Risks / Trade-offs

- El proveedor de IA podria intentar llamar una herramienta que no esta en la lista ofrecida → Mitigacion: `runTool` ya rechaza nombres de herramienta que no reconoce, igual que hoy con cualquier alucinacion de nombre; el gating de D3 hace que las de escritura ni siquiera esten en esa lista durante el modo Plan.
- Un plan cerrado sin implementar puede quedar "colgado" en el hilo si nadie lo retoma → Mitigacion: no es un estado invalido -- el hilo ya convive con preguntas sin responder de la misma forma -- y el boton de Plan sigue disponible para empezar uno nuevo.

## Migration Plan

Sin migracion de datos: los chats existentes no tienen mensajes con `.plan`, y ese campo opcional ausente se lee igual que hoy se leen mensajes sin `.question`. Es un despliegue de codigo unicamente (dock + `aiPage.ts` + tipos compartidos).
