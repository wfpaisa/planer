## 1. Tipos compartidos

- [x] 1.1 Agregar `AiMessage.plan?: { texto: string; implementado: boolean }` en `shared/types.ts`, junto al `question?: AiQuestion` existente, con su comentario explicando el patron (D2).
- [x] 1.2 Agregar el evento de progreso correspondiente en `AiProgress` (paralelo a `{ tipo: "pregunta"; pregunta: AiQuestion }`) para que el panel pinte la tarjeta en cuanto se cierra el plan, sin esperar al `fin`.

## 2. Servidor -- gating de herramientas y cierre del plan

- [x] 2.1 En `server/aiPage.ts`, calcular si la conversacion esta en modo Plan a partir del historial (`history: AiMessage[]`): activo si no hay un `.plan` sin implementar en el ultimo mensaje relevante, cerrado si lo hay, implementado si ya se eligio construir (D1).
- [x] 2.2 Filtrar la lista `TOOLS` que se ofrece al modelo cuando el modo esta activo: excluir las que escriben pagina o tablas (`escribir_pagina`, `reemplazar_bloque`, `insertar_bloque`, `quitar_bloque`, `crear_tabla`, `agregar_columnas`, `renombrar_columna`, `borrar_columna`, `cambiar_tipo_columna`, `borrar_tabla`, `llenar_tabla`, `cambiar_acceso`, `cambiar_roles_pagina`), dejando las de lectura/consulta (`ver_pagina`, `leer_bloque`, `consultar_datos`, `leer_archivo`, `preguntar`) (D3).
- [x] 2.3 Agregar la herramienta `cerrar_plan` (misma forma que `preguntar`: cierra el turno, no construye nada), que trae el texto del plan concretado y queda disponible solo cuando el modo esta activo.
- [x] 2.4 Agregar la seccion de guia al `systemPrompt()` que se incluye solo mientras el modo esta activo: instruye a conversar y preguntar hasta concretar la idea, respetar que el plan no sale de la pagina abierta (pestanas o secciones que se muestran/esconden en vez de paginas nuevas), y cerrar con `cerrar_plan` cuando no queden preguntas.
- [x] 2.5 En `runTool`, manejar `cerrar_plan` guardando el resultado como el `.plan` del mensaje de la IA (implementado: false), igual que `preguntar` guarda `.question`.
- [x] 2.6 Agregar el camino para la orden de implementar a mitad de conversacion (D4): una peticion que, en vez de mandar texto nuevo al modelo, cierra el plan con lo que la IA tiene hasta ese punto y lo marca listo para construir.
- [x] 2.7 Agregar el camino para pasar de un plan cerrado a construir: marca ese `.plan.implementado = true` y la siguiente peticion en esa conversacion corre con la lista completa de herramientas, como hoy fuera del modo Plan.

## 3. Ruteo

- [x] 3.1 En `server/routes.ts` / `executeRun`, aceptar la intencion de modo Plan (activar, cortar y cerrar, o implementar) en la peticion que arranca una corrida, y pasarla a `runPageRequest`.

## 4. Panel -- boton y estado

- [x] 4.1 En `AiPanel.svelte`, agregar el boton de Plan junto a `btn-toggle-picker`, con su propio `aria-pressed` y tip, siguiendo el mismo patron que `picker.active`.
- [x] 4.2 Derivar si el boton se muestra activo, cerrado-esperando-decision, o apagado a partir del ultimo mensaje del hilo (`chat.messages`), no de un estado local aparte (D1).
- [x] 4.3 Mandar la intencion de modo Plan (D1) en la siguiente peticion cuando el boton este activo.
- [x] 4.4 Agregar la accion de "implementar ya" en el dock, visible mientras el modo esta activo y sin cerrar, que dispara el camino de 2.6.

## 5. Panel -- tarjeta de plan

- [x] 5.1 Crear `web/src/components/ai/PlanCard.svelte`, siguiendo el molde de `Question.svelte`: icono y estilo propios, texto del plan, y el boton para pasar a modo Implementador.
- [x] 5.2 Enganchar `PlanCard.svelte` en `ChatList.svelte` para los mensajes que traen `.plan`, y en el manejo del evento de progreso nuevo (1.2) para que aparezca en cuanto se cierra, antes del `fin`.
- [x] 5.3 Cuando `.plan.implementado` es `true`, pintar la tarjeta sin el boton de accion (ya no se puede editar ni reabrir).

## 6. Verificacion manual

- [x] 6.1 `bun run typecheck`.
- [x] 6.2 Con `bun run dev`, probar: activar el modo Plan, pedir una pantalla, confirmar que la pagina y las tablas no cambian y que la IA solo conversa/pregunta.
- [x] 6.3 Probar el cierre por parte de la IA (sin mas preguntas) y el cierre por orden del usuario a mitad de conversacion; confirmar que en ambos casos aparece la tarjeta.
- [x] 6.4 Probar apagar el boton de Plan antes y despues de cerrar una tarjeta, sin implementar, y confirmar que la tarjeta queda en el hilo sin marcarse implementada (D5).
- [x] 6.5 Probar "Implementar" desde la tarjeta: confirmar que la IA construye con las herramientas de siempre, que el modo Plan queda apagado, y que esa tarjeta ya no ofrece la accion ni se puede reabrir.
- [x] 6.6 Probar que activar el modo Plan de nuevo, despues de implementar, abre un plan distinto y no reabre el anterior.
