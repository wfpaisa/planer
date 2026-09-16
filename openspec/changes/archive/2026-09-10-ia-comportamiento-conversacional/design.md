## Context

Ver proposal.md - Why. El estado actual relevante para el como:

- `runPageRequest` ([server/aiPage.ts:976](/home/projects/plane-zite/server/aiPage.ts)) es un solo bucle continuo con un solo modelo (hasta `MAX_ROUNDS = 12`); el modelo ve sus propios resultados intermedios y se corrige sobre la marcha.
- `revisar_errores` ya existe como herramienta - estilo por codigo (`auditPageHtml`, determinista) mas consola real via probe del navegador - pero hoy es opcional: `TOOL_GUIDE` le pide al modelo que la llame, nada la fuerza.
- `ctx.pending` / `impact` ([server/aiPage.ts](/home/projects/plane-zite/server/aiPage.ts)) ya es el mecanismo de "esto necesita autorizacion humana", pero es de tablas y solo de tablas: `ctx.pending` es `StructureChange[]`, y `StructureChange` ([shared/types.ts:648](/home/projects/plane-zite/shared/types.ts)) exige `tableId` y `tableLabel`, con `ChangeKind` limitado a tres operaciones de esquema. Un cambio de acceso no tiene tabla, asi que no cabe ahi.
- **No hay ninguna forma de preguntar.** No existe `ask_user_question` ni herramienta equivalente: un turno construye o no construye, y el resultado (`AiPageResult`) no tiene donde llevar una pregunta ni el panel donde pintarla. Ademas el nombre tendria que ir en espanol, como el resto de la API de herramientas (`ver_pagina`, `crear_tabla`): lo dice AGENTS.md.
- **Cada peticion abre una conversacion nueva.** `runPageRequest` llama a `startConversation` con el texto de sistema y el prompt de esa peticion, nada mas. Lo que guarda `appendToChat` es historial para el panel, no contexto del modelo. Una pregunta hecha en un turno no esta en el contexto del siguiente: llegaria la respuesta suelta, sin memoria de que se pregunto.
- Los roles de la aplicacion son `AppRecord.roles`. `app_access` guarda, por persona, su nivel (`viewer`/`editor`/`admin`) y sus roles; `peopleOf()` ([server/access.ts:119](/home/projects/plane-zite/server/access.ts)) ya los lee. Escribirlos, en cambio, no esta en `access.ts`: vive en `updatePerson` ([server/routes.ts:850](/home/projects/plane-zite/server/routes.ts)).
- El contrato ([shared/htmlContract.ts](/home/projects/plane-zite/shared/htmlContract.ts)) le pasa al modelo los nombres de rol de la aplicacion, nunca las personas invitadas. Sin ellas no puede nombrar a nadie en la consecuencia de un cambio de acceso.
- `anthropicConversation` y `openAiConversation` ([server/ai.ts:452](/home/projects/plane-zite/server/ai.ts), [server/ai.ts:590](/home/projects/plane-zite/server/ai.ts)) tienen formas de mensaje distintas por proveedor - una conversacion no se puede "continuar" cambiando de modelo a mitad de camino, cada fase nueva tendria que ser una conversacion nueva.

## Goals / Non-Goals

**Goals:**
- Que la validacion (estilo + consola) corra siempre al cerrar el turno, sin depender de que el modelo se acuerde de pedirla.
- Que preguntar antes de construir quede limitado a ambiguedad de conjunto cerrado y bloqueante (elegir entre algo que ya existe), no a preguntas de diseno abierto.
- Que la IA pueda proponer una mejora no solicitada, acotada a cuatro situaciones concretas y observables, nunca por gusto o por norma.
- Fijar un tono conversacional consistente para toda respuesta de la IA.
- Que un cambio de permisos o roles pedido por la IA pase por la misma familia de autorizacion que ya existe para esquema, con una consecuencia especifica en lenguaje llano en vez de un boton generico.

**Non-Goals:**
- No se introduce un split de modelos por fase (planificar/ejecutar/validar con modelos distintos). Se evaluo y se descarto - ver Decisiones.
- No se introduce un formulario tipo stepper con varias preguntas antes de construir nada. Se evaluo y se descarto.
- No se crea una marca nueva de "sensible"/"confidencial" en tablas o columnas.
- No se agrega una ventana de espera antes de aplicar un cambio de permisos, ni un aviso permanente aparte del historial de versiones.
- No se corrige en este cambio la eleccion entre editar un bloque o reescribir la pagina entera (bisturi vs reescritura) - queda como pregunta abierta, ver Open Questions.
- No se agrega un validador semantico tipo "LLM como juez" que compare el resultado contra un plan estructurado.

## Decisions

**Un solo modelo, sin split por fases.** Se evaluo planificar con un modelo alto y ejecutar/validar con modelos medios o bajos, para abaratar costo. Se descarta porque:
- Cada fase seria una conversacion nueva (las formas de mensaje de Anthropic y OpenAI-compatible no se pueden continuar entre si), asi que el traspaso entre fases solo puede ir por un objeto estructurado, no por el historial completo - mas piezas para mantener sincronizadas con lo que las herramientas realmente soportan.
- Un ejecutor mas barato no tiene forma de notar que el plan estaba mal especificado para un pedido ambiguo, que es justo el caso mas comun de este publico.
- Una correccion suelta a mitad de construccion ("que el boton sea azul") no tiene un lugar natural: reabrir la fase de plan pierde el ahorro, dejarsela al ejecutor barato le exige el mismo juicio que se le queria quitar.
- El razonamiento visible (`ReasoningRow`) se fragmentaria entre modelos distintos, rompiendo el patron ya adoptado de "ver pensar" como un hilo continuo.

**Preguntar antes de construir, acotado por la forma de la pregunta, no por el tema.** La regla no es "pregunta si es ambiguo" (demasiado amplio, termina en un stepper) sino: preguntar solo cuando la respuesta es una eleccion entre opciones que ya existen en la app (que tabla, que fuente) - encaja exacto en la forma de `ask_user_question`. Cualquier pregunta de diseno abierto (que columnas, que layout) se resuelve mostrando un primer resultado, no preguntando a ciegas. Se descarto un stepper con multiples preguntas antes de construir porque el publico objetivo suele no saber que necesita hasta que ve algo concreto - preguntar en abstracto reproduce el problema de ambiguedad en vez de resolverlo.

**Propuesta proactiva, acotada a cuatro categorias con exclusiones explicitas.** El criterio no es "hay algo que mejorar" (siempre hay algo, no filtra nada) sino "dejarlo sin decir tiene una consecuencia real": alcance implicito no resuelto, capacidad de la plataforma que los datos piden y no se uso, contradiccion entre lo pedido y lo que ya existe, o un dato visible a mas gente de la esperada. Quedan excluidas explicitamente la estetica (ya cubierta por el auditor determinista), funciones no pedidas y reorganizar lo no tocado. Una sola propuesta por turno, y solo en turnos de construccion real - nunca en una correccion chica. Se prefiere quedarse callada de mas a proponer de mas: el riesgo de una lista demasiado angosta es menor que el de que la propositividad se sienta impostada o agote la paciencia de alguien que solo queria un ajuste rapido.

**Preguntar necesita herramienta propia, y la respuesta viaja por el prompt.** No hay nada que reutilizar: hay que construir `preguntar` --nombre en espanol, como el resto-- que cierre el turno y deje la pregunta con sus opciones en el resultado, para que el panel las pinte. Elegir una opcion manda una peticion nueva, y como cada peticion abre una conversacion nueva, esa peticion tiene que llevar en su propio prompt la pregunta y la opcion elegida: sin eso el modelo recibe una respuesta suelta que no sabe a que contesta. Se descarto llevar el historial del chat al modelo: es mas caro en contexto en todas las peticiones, no solo en las que hubo pregunta, y obliga a tocar el bucle entero para un caso que la propia regla quiere que sea raro.

**Un cambio de acceso no cabe en `StructureChange`: tipo propio y lista propia.** Se evaluo ensanchar `StructureChange` para que `tableId` fuera opcional y `ChangeKind` incluyera los permisos. Se descarta: las cuatro salidas del dialogo de impacto (`conservar`, `aplicar`, `aplicar_y_arreglar`, `no_tocar`) no significan nada para un permiso, `pagesForChanges` y `fixPage` son conceptos de tabla que no aplican, y el propio spec pide un aviso distinto en vez del dialogo generico. Ensancharlo dejaria un tipo que en la mitad de sus casos no sabe responder a su propia interfaz. Van, entonces, por su lado: tipo propio, lista propia junto a `ctx.pending`, campo propio en `AiPageResult` y aviso propio en el panel.

**El modelo necesita a las personas invitadas en el contexto.** Hoy solo recibe los nombres de rol. Para escribir "Ana podra ver los pedidos de todos los clientes" hace falta que el contrato le pase quien esta invitado, con su nivel y sus roles; sale de `peopleOf()`, que ya existe. Es la aplicacion de quien construye y son sus propios invitados, asi que no abre ningun dato que no sea suyo.

**Un turno con las dos autorizaciones pendientes: cada una en su sitio, y ninguna bloquea a la otra.** Un mismo turno puede dejar pendiente un cambio de esquema y uno de acceso. No se encolan ni se juntan en un dialogo: viven en sitios distintos y por eso no compiten. El de esquema se queda donde ya estaba --`ImpactPanel` ocupa la columna entera y tapa la conversacion-- y el de acceso, dentro de la conversacion, en la entrada del turno que lo pidio. De ahi sale el orden solo: mientras el dialogo de esquema este abierto es lo unico que se ve, y al cerrarlo la conversacion vuelve con el aviso de acceso esperando. Ninguno depende del otro: negar el de esquema no retira el de acceso, ni al reves. Dos avisos de acceso en el mismo turno --dos personas-- se confirman uno a uno, cada uno con su frase; no hay un boton que los acepte juntos, porque lo que se autoriza es cada consecuencia y no el lote.

Ninguna de las dos autorizaciones sobrevive a recargar: viven en el resultado de la peticion, no en la base. Es lo que ya hacia el dialogo de impacto y no cambia aqui: una autorizacion que se queda esperando dias deja de leerse como parte de lo que se pidio, y volver a pedirlo es barato.

**Tono sin nombre, profesional, con sutileza amigable.** Se descarto personalizar con el nombre de quien construye: depende de que el sistema conozca ese nombre con certeza en todos los casos, y una falla ahi (nombre generico o correo) rompe justo el efecto buscado. El tono se define por exclusion: ni ludico, ni de interrogatorio.

**Permisos como categoria de riesgo nueva en `data-impact`, ejecutada por la IA tras una confirmacion especifica.** La alternativa de que la persona haga el cambio ella misma en la pantalla de roles se descarto: el publico sin experiencia manipulando una base de datos puede cometer mas errores navegando una pantalla desconocida que autorizando a la IA con una consecuencia clara delante. La confirmacion tiene que nombrar la consecuencia real ("Ana podra ver los pedidos de todos los clientes, no solo los suyos"), no ser un boton generico de "autorizar". La friccion es asimetrica: dar acceso nuevo siempre pasa por esa confirmacion especifica porque no se puede deshacer que alguien ya vio un dato; quitar acceso se resuelve mas directo porque como mucho corrige algo que sobraba. Se evaluaron y descartaron tres mitigaciones adicionales - ventana de espera antes de aplicar, aviso permanente aparte del chat, marca de "sensible" en el esquema - por no considerarse necesarias frente al costo de construirlas.

**El modelo no ve las demas paginas de la aplicacion.** `systemPrompt` le pasa la pagina abierta, sus tablas y las personas invitadas, nunca `ctx.pages`. Se evaluo ensancharlo para que la cuarta categoria de propuesta --contradiccion con lo que ya existe-- alcanzara tambien a otras pantallas. Se descarta: el coste en contexto se paga en toda peticion, incluidas las muchas que no proponen nada, y lo unico que compra es esa categoria. La consecuencia se acepta y queda escrita: una contradiccion con otra pantalla le es invisible por construccion, no por la guia. Revisable si la experiencia real muestra que esas contradicciones son frecuentes.

## Risks / Trade-offs

- [La confirmacion especifica de un cambio de permisos depende de que la IA describa bien la consecuencia en lenguaje llano, y nada determinista lo verifica] -> Se prueba con casos concretos antes de liberarlo, igual que se afino `revisar_errores`; es un punto donde el juicio del modelo pesa y no hay sensor computacional posible.
- ["Dar acceso pesa mas que quitarlo" asume que quitar acceso nunca tiene costo propio (p. ej. quitarle a alguien algo que si necesitaba)] -> El punto de respaldo (version) sigue disponible para restaurar el estado; se acepta que revertir un acceso perdido es mas barato que revertir una exposicion de datos ya ocurrida.
- [Las cuatro categorias de propuesta proactiva pueden no cubrir toda ambiguedad real, o dar algun falso positivo] -> Es una lista cerrada y revisable a proposito, no exhaustiva por diseno; se prefiere el silencio de mas.
- [Este cambio no corrige que el modelo pueda reescribir la pagina entera cuando bastaba editar un bloque] -> Fuera de alcance, ver Open Questions.
- [La cuarta categoria de propuesta proactiva no se puede verificar ni disparar entre pantallas distintas] -> Limitacion conocida y aceptada, consecuencia de no pasarle las demas paginas al modelo. Las otras tres categorias si se prueban.

## Migration Plan

Sin migracion de datos. Se despliega por partes, de menor a mayor superficie:

1. **Hecho.** Forzar `revisar_errores` al cerrar el turno si el modelo no la llamo, y las reglas de propuesta y tono en `TOOL_GUIDE`. Vive en `runPageRequest` mas un metodo `say()` en `Conversation` ([server/ai.ts](/home/projects/plane-zite/server/ai.ts)): un `tool_result` no sirve para devolverle una revision que el modelo nunca pidio, porque nombraria una llamada inexistente y el proveedor la rechaza.
2. Preguntar: herramienta `preguntar`, su forma en `shared/types.ts`, el paso por el resultado y el progreso, la pantalla en el panel, y el prompt compuesto de la peticion siguiente. Es la primera parte que toca panel y servidor a la vez.
3. Permisos: tipo propio de cambio de acceso, las personas en el contrato, lectura y escritura de acceso en `access.ts`, la clasificacion por direccion en `dataImpact.ts`, la herramienta `cambiar_acceso`, el aviso propio en el panel y la ruta que lo aplica.

Rollback: la parte 1 se revierte con su texto y su condicion; las partes 2 y 3 retirando su herramienta de `TOOLS`, que deja al modelo sin forma de llegar a ellas aunque el resto del codigo siga puesto. Ninguna depende de datos ya guardados.

## Open Questions

- La eleccion entre editar un bloque (bisturi) y reescribir la pagina entera no tiene hoy ningun sensor que la revise despues de hecha - queda dependiendo solo de la guia de texto. Se identifico como una brecha separada de arquitectura (no de comportamiento conversacional) y se explora en un cambio aparte.
- Un validador semantico tipo "LLM como juez", comparando el resultado contra un plan estructurado en vez de contra el pedido en texto libre, se descarto por ahora. Se revisita si la experiencia real muestra que las cuatro categorias de propuesta proactiva no bastan para atrapar desajustes de intencion.
- ~~Si anunciar un paso sin darlo debe impedir que el turno se cierre.~~ **Respondida al volver a medir (10 de septiembre de 2026): no se toca `TOOL_GUIDE`.** El sintoma no reaparecio - en la pasada nueva ese mismo pedido llamo a cuatro herramientas y escribio la pagina -, asi que la evidencia era una salida suelta y no una regla que falte. Lo que si quedo pendiente ahi es de juicio y de otra cosa: la propuesta de la cuarta situacion - el dato visible a mas gente de la esperada - no salio, con la pagina abierta a cualquiera. Es una duda, no un fallo, y se afina la guia solo si se repite.
