## Why

Hoy la IA del panel valida su propio trabajo solo si se acuerda de pedirlo, pregunta o construye sin ningun criterio explicito sobre cuando aclarar algo antes de escribir, y no tiene forma de pedir permiso para tocar roles o permisos - solo para cambios de esquema. Para un publico sin experiencia tecnica que suele pedir cosas ambiguas, eso deja mas al azar de lo que conviene: la IA puede quedarse callada cuando deberia preguntar, inventar mejoras que nadie pidio, o ejecutar un cambio de acceso sin que la persona entienda la consecuencia real.

## What Changes

- La revision de estilo y consola (`revisar_errores`) se fuerza al final del turno si el modelo no la llamo por su cuenta, con el mismo reintento de hoy (maximo 2 veces).
- Preguntar antes de construir queda acotado a ambiguedad de conjunto cerrado y bloqueante (por ejemplo, elegir entre varias tablas ya existentes). Todo lo demas se resuelve mostrando un primer resultado y dejando corregir, no preguntando por adelantado.
- Se define una segunda ronda propositiva: la IA puede proponer **una sola** mejora concreta por turno, y solo cuando detecta una de cuatro situaciones - alcance implicito no resuelto, capacidad de la plataforma que los datos estan pidiendo y no se uso, contradiccion entre lo pedido y lo que ya existe, o un dato visible a mas gente de la que el pedido sugiere. Quedan excluidas explicitamente las propuestas de estetica/layout (ya cubiertas por el auditor determinista), funciones no pedidas, y reorganizar lo que la persona no toco.
- Se fija el tono de la IA: profesional y respetuoso, sin usar el nombre de quien construye, sin animo ludico ni de interrogatorio.
- Nueva categoria de riesgo para cambios de permisos y roles solicitados por la IA (hoy `data-impact` solo cubre esquema): la IA describe la consecuencia especifica del cambio en lenguaje llano - no un boton generico de "autorizar" - y la friccion es distinta segun la direccion: dar acceso nuevo siempre pide esa confirmacion especifica, quitar acceso se resuelve mas directo.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `ai-authoring`: agrega los requisitos de validacion obligatoria al cerrar el turno, el criterio de cuando preguntar antes de construir, el mecanismo de propuesta proactiva acotado a cuatro situaciones, y el tono de las respuestas.
- `data-impact`: agrega permisos y roles como categoria de cambio con riesgo, junto a los cambios de esquema que ya clasifica, con su propia forma de pedir autorizacion (consecuencia especifica en vez de boton generico) y friccion asimetrica segun la direccion del cambio.

## Impact

Ni preguntar ni cambiar un acceso existen hoy en el codigo, asi que no es extender lo que hay: hay que construirlos. Los archivos que toca:

- `server/aiPage.ts`: `TOOL_GUIDE` (cuando preguntar, cuando proponer, tono), el cierre de turno en `runPageRequest` (forzar `revisar_errores`), y dos herramientas nuevas - `preguntar` y `cambiar_acceso`.
- `server/ai.ts`: un `say()` en `Conversation` para devolverle al modelo la revision que no pidio; un `tool_result` no vale ahi porque nombraria una llamada inexistente.
- `shared/types.ts`: la forma de una pregunta y la de un cambio de acceso - `StructureChange` es de tablas y no le sirve a ninguna de las dos -, y los campos que las llevan en `AiPageResult` y en `AiProgress`.
- `shared/htmlContract.ts`: las personas invitadas en el contexto del modelo. Hoy solo recibe los nombres de rol, y sin las personas no puede redactar la consecuencia de un cambio de acceso.
- `server/dataImpact.ts`: la clasificacion por direccion del cambio de acceso - dar es riesgo, quitar no -, junto a la de esquema que ya existe.
- `server/access.ts`: la lectura de personas y roles que ya hace `peopleOf`, mas la escritura de nivel y roles, que hoy solo esta en `updatePerson` de `routes.ts`.
- `server/routes.ts`: la ruta que aplica un cambio de acceso confirmado, y el prompt compuesto que lleva la respuesta de una pregunta a la peticion siguiente.
- El panel: la pregunta con sus opciones y el aviso de consecuencia, cada uno con su pantalla propia; el dialogo de impacto de esquema (`ImpactPanel`) se queda como esta.
- No hay cambio de infraestructura de modelos: se descarto un split por fases con distintos modelos, se mantiene un solo modelo como hoy.
