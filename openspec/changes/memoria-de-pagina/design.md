## Context

Ver `proposal.md` - Why. Piezas del codigo de donde parte este diseno:

- Las conversaciones ([server/ai/aiChats.ts](../../../server/ai/aiChats.ts)) pertenecen a la pagina y se conservan, pero de ellas solo se le mandan al modelo los ultimos turnos: `MAX_HISTORY_TURNS = 10` y `MAX_HISTORY_CHARS = 40_000` en [server/ai/aiPage/index.ts](../../../server/ai/aiPage/index.ts). Ademas `startNew` en [AiPanel.svelte](../../../web/src/components/AiPanel.svelte) deja el `chatId` vacio, y sin `chatId` la ruta no carga historial: una conversacion nueva empieza sin nada de las anteriores.
- El contexto de cada peticion se arma en `systemPrompt` ([server/ai/aiPage/prompts.ts](../../../server/ai/aiPage/prompts.ts)), que ya concatena secciones --contrato, `## This page`, bloques senalados, adjuntos, guia de herramientas--. Una seccion mas encaja sin tocar el resto.
- `preguntar` ([server/ai/aiPage/tools.ts](../../../server/ai/aiPage/tools.ts)) ya es una herramienta que cierra el turno con dos a cuatro opciones, y elegir una arranca la peticion siguiente con `choice`. Es el mecanismo que necesita la confirmacion ante una contradiccion.
- Una pagina ([bootstrap.ts](../../../server/bootstrap.ts), coleccion `pages`) ya guarda campos propios --`doc`, `sources`, `roles`-- y se borra en cascada desde la aplicacion.
- La capa de modelos ([server/ai/ai.ts](../../../server/ai/ai.ts)) admite varios proveedores --Anthropic por SDK, compatibles con ChatGPT por `fetch`-- y `ask` ya devuelve `usage`.

## Goals / Non-Goals

**Goals:**

- Que una regla funcional sobreviva a las dos formas en que hoy se pierde: el recorte de los ultimos turnos y el boton de conversacion nueva.
- Que guardar sea automatico. Una funcion que depende de que alguien se acuerde de escribirla no se usa.
- Que ninguna regla guardada desaparezca sin que alguien la haya nombrado: ni por un resumen automatico, ni por un recorte de tamano, ni por una reescritura completa.
- Reusar lo que ya existe --la seccion de contexto, la herramienta `preguntar`, el campo en `pages`-- en vez de introducir mecanismos nuevos.

**Non-Goals:**

- No hay memoria de aplicacion. Ver D1.
- No se deduce memoria del HTML ya construido. Ver D9.
- No se toca como se guarda ni como se recorta el historial de conversaciones (`ai-authoring`): la memoria es un camino paralelo, no un reemplazo.
- No se introduce cacheo de prompt en esta propuesta. Ver D10.

## Decisions

**D1 -- La memoria vive en la pagina, no en la aplicacion.**
Para quien construye, una aplicacion es el contenido de una pagina: la app "Odontologia" es la carpeta, y agendas, vacaciones y pacientes son tres aplicaciones distintas dentro de ella. Las reglas funcionales son de cada una. Se considero una memoria de aplicacion para lo comun --el negocio, los roles-- y se descarta porque eso ya viaja: `buildHtmlContract` manda el nombre de la aplicacion, sus roles y su padron de personas en cada peticion. Lo que no viaja es "en agendas, los auxiliares crean citas pero no las borran", y eso es de la pagina. Dos memorias tambien serian dos sitios donde escribir y dos pantallas, por una parte que ya esta cubierta.

**D2 -- Un campo de texto en `pages`, no una coleccion aparte.**
La memoria es un texto por pagina, se lee entera en cada peticion y se borra con la pagina. Una coleccion propia solo se justificaria para guardar historial de la memoria --quien escribio cada vineta y cuando--, que nadie ha pedido y que se puede agregar despues sin romper nada. El campo se suma junto a `doc`, `sources` y `roles`, y hereda la cascada de borrado sin codigo adicional.

**D3 -- La escritura es una pasada aparte al cerrar el turno, no instrucciones dentro del turno principal.**
La alternativa era anadirle al prompt principal la orden de guardar memoria. Se descarta: ese prompt ya lleva veinte herramientas y toda la guia de construccion, y la memoria competiria con ellas; en la practica el modelo prioriza construir y la escritura queda irregular, que es justo lo que se quiere evitar. Una llamada aparte recibe solo tres cosas --el intercambio, la memoria actual y sus reglas de redaccion-- y es el unico sitio donde un texto de sistema estricto se puede afinar sin efectos colaterales. Cuesta una llamada corta por turno, del orden del tres por ciento del turno.

**D4 -- La pasada devuelve una operacion sobre una vineta, nunca la memoria entera.**
Se considero que devolviera el markdown completo, que es mas simple. Se descarta porque en la reescritura numero quince el modelo puede resumir de mas y borrar una regla que nadie estaba mirando: silenciosa y sin forma de detectarla. La pasada contesta `sin cambios`, o `agregar`, `reemplazar` o `borrar` nombrando la vineta.

La vineta se nombra **por su texto exacto**, no por su posicion. Una posicion se desplaza en cuanto alguien edita la caja a mano, y una operacion sobre la posicion 3 aplicada a una lista que cambio borra la vineta equivocada. Si el texto nombrado ya no aparece, la operacion se descarta y la memoria queda como estaba: perder una escritura es recuperable, pisar una regla ajena no.

La pasada puede operar sobre cualquier vineta, no solo la del pedido en curso: asi puede fundir dos que dicen lo mismo, que es lo que impide que la memoria crezca (D6).

**D5 -- Detectar la contradiccion es del turno principal; escribir sigue siendo de la pasada.**
La confirmacion tiene que ocurrir antes de construir, asi que no puede vivir en una pasada posterior. El turno principal recibe la memoria en su contexto y, cuando el pedido choca con una regla, usa `preguntar` --que ya cierra el turno con opciones y reanuda con `choice`--. No hace falta un mecanismo nuevo; hace falta levantar la restriccion actual, que prohibe preguntar por decisiones de diseno. Una contradiccion no lo es: la opcion ya existe, es la regla guardada.

Consecuencia sobre D3: la pasada recibe el intercambio completo --pregunta, respuesta y lo que la IA hizo--, no solo el mensaje de quien construye. Con "Si, cambiarlo" suelto no sabria de que.

**D6 -- Sin tope de tamano. El control es la estrictez de la pasada.**
Se evaluo un tope duro con aviso al llenarse. Se descarta: cortar reintroduce la perdida que D4 acaba de eliminar, y el espacio no es el problema --sesenta vinetas son unos seis mil caracteres, siete veces menos que el historial que ya viaja--. Lo que mantiene la memoria corta es como escribe la pasada: una regla por vineta, en presente y en una linea, reemplazar antes que agregar algo parecido, y no escribir ante la duda. Una pagina que acumulara muchas decenas de reglas estaria senalando que hace demasiadas cosas, o que la pasada escribe ruido; en ambos casos el arreglo es el prompt o la pagina, no un corte.

**D7 -- El mismo modelo de la peticion, con un ajuste para senalar otro.**
Por defecto la pasada usa el modelo que se eligio para el turno, para no introducir una segunda configuracion que nadie mantiene. El ajuste queda en la configuracion de IA por si mas adelante conviene un modelo mas barato para esta tarea.

**D8 -- La caja se bloquea mientras la IA trabaja, en vez de fusionar ediciones.**
Quien construye puede tener la caja abierta cuando la pasada escribe; al guardar, guardaria el texto que cargo antes y borraria la vineta recien anadida. Se considero detectar el conflicto al guardar y avisar. Se descarta por desproporcionado: bloquear la caja durante la peticion elimina la ventana entera, y la peticion ya tiene un estado visible en el panel del que colgar el bloqueo.

**D9 -- Las paginas que ya existen nacen con la memoria vacia.**
Se considero deducir una memoria inicial leyendo el HTML, y ofrecerlo como boton. Se descarta para esta propuesta: del HTML se leen los campos y los roles, pero no las reglas que no dejaron rastro --"no se agenda domingo"-- y en cambio se puede tomar por regla algo que fue un accidente. Una memoria inicial con reglas inventadas es peor que ninguna, porque la IA la respeta. Si mas adelante se quiere, el boton se agrega sin cambiar nada de lo demas.

**D10 -- No se cachea el prompt de la pasada.**
El cacheo es una coincidencia de prefijo: la pasada y el turno principal son prompts distintos y no comparten nada. El prefijo estable de la pasada --sus reglas de redaccion-- queda por debajo del minimo cacheable de cualquier modelo actual, asi que el cache no se crearia y no avisaria de ello. Donde el cacheo si pagaria es en el turno principal, que reenvia decenas de miles de tokens identicos en cada ronda de herramientas; eso es un cambio de la capa de modelos y va aparte.

## Risks / Trade-offs

- La pasada no reconoce una regla y la memoria queda incompleta → Mitigacion: la caja es editable; quien construye la escribe a mano. El fallo es silencioso pero visible en cuanto se abre `Memorias`.
- La pasada escribe ruido pese a sus reglas → Mitigacion: la caja es editable y borrar una vineta es una linea. Si el ruido es sistematico, el arreglo es el texto de sistema, no la funcion.
- El turno principal no detecta una contradiccion y construye sin preguntar → Mitigacion: la pasada reemplaza igualmente la regla despues, asi que la memoria no queda mintiendo; se pierde la confirmacion, no la coherencia.
- La memoria y el HTML dicen cosas distintas, porque alguien edito la pagina por codigo → Mitigacion asumida: la memoria describe lo pedido, no lo construido. Es una limitacion conocida, no un fallo.
- El bloqueo de D8 no cubre a dos personas editando la misma memoria desde equipos distintos → Limitacion conocida: el panel es de quien construye la aplicacion y hoy no hay edicion concurrente en ninguna otra pantalla del constructor.

## Migration Plan

Campo nuevo y opcional en `pages`. Las paginas existentes lo leen vacio, que es exactamente el estado que pide D9: no hay datos que migrar ni script que correr. Es un despliegue de codigo --contexto, pasada, ruta y panel-- mas la creacion del campo en el arranque, como el resto de los campos de la coleccion.

Volver atras es quitar la seccion del contexto y la pasada: el campo puede quedarse con su contenido sin afectar a nada.
