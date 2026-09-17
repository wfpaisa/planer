## Why

Hoy la IA del dock construye y deja corregir: no hay forma de detenerla a conversar y concretar una idea de pantalla antes de que toque la página. Para cambios grandes o ambiguos, eso obliga a corregir sobre algo ya escrito en vez de definirlo primero.

## What Changes

- Nuevo botón "Plan" en el composer del dock de IA, junto a `btn-toggle-picker`.
- Al activarlo, la IA entra en modo Plan: conversa, pregunta y lee la página y las tablas, pero no llama herramientas que modifican la página ni las tablas.
- El plan se queda dentro de la página abierta. Si necesita navegación, se resuelve con pestañas o secciones que se muestran/ocultan en la misma página, nunca creando o modificando otras páginas.
- El modo Plan termina cuando la IA no tiene más preguntas, o cuando el usuario da la orden de implementar en cualquier momento.
- Al terminar, se muestra en el hilo una tarjeta de plan (ícono y estilo propios) con la opción de pasar a modo Implementador.
- La transición a Implementador es de un solo sentido: una vez que se pasa, el plan queda visible en el hilo pero no se edita ni se reabre. Planear otra cosa exige un plan nuevo.
- El modo Implementador es el comportamiento actual del dock (construye con las herramientas existentes), arrancado ahora a partir de un plan ya cerrado.

## Capabilities

### New Capabilities
- `ai-plan-mode`: modo de planeación conversacional en el dock de IA, previo a construir, con cierre y transición de un solo sentido hacia el modo que construye.

### Modified Capabilities
(ninguna: el modo Plan opera dentro de las reglas ya vigentes de `ai-authoring` -- una sola página por petición -- sin cambiarlas)

## Impact

- **Frontend**: `AiPanel.svelte` (botón y estado del modo Plan), un componente nuevo para la tarjeta de plan, `aiConversation.svelte.ts` (persistir si el modo está activo, como ya se hace con el modelo elegido).
- **Backend**: `aiPage.ts` -- sección de guía inyectada en `systemPrompt()` mientras el modo está activo, y una herramienta nueva para cerrar el plan (paralela a `preguntar`), que gatea las herramientas que mutan la página o las tablas.
- **Tipos compartidos**: `shared/types.ts` -- nuevo tipo de mensaje/evento para el plan cerrado.
- No agrega tablas ni endpoints nuevos: reusa el recorrido de `runPageRequest` / `executeRun` que ya existe.
