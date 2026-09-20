## Context

Ver `proposal.md` - Why. Piezas del codigo de donde parte este diseno:

- El bucle de rondas esta en [server/ai/aiPage/index.ts](../../../server/ai/aiPage/index.ts): `MAX_ROUNDS = 12`, y cada vuelta llama a `chat.ask()` y devuelve resultados con `chat.reply()`. Cada `ask` es una peticion HTTP entera con todo lo acumulado.
- Hay dos caminos de proveedor en [server/ai/ai.ts](../../../server/ai/ai.ts): `anthropicConversation` por el SDK, y `openAiConversation` por `fetch` contra `/chat/completions`. `startConversation` elige con `speaksAnthropic`, que es cierto **solo** para `provider === "anthropic"`: OpenRouter, OpenAI, Ollama, LM Studio y vLLM van todos por el segundo.
- El prompt ya es estable: `systemPrompt()` ([prompts.ts](../../../server/ai/aiPage/prompts.ts)) no interpola fechas ni identificadores, y `TOOLS.map(...)` genera las herramientas siempre en el mismo orden. Es lo que suele romper el reuso y aqui no ocurre.
- El recuento ya llega y ya se lee: `response.usage.cache_read_input_tokens` y `cache_creation_input_tokens` en el camino de Anthropic. Se suman dentro de `input` y se pierden.
- `AiUsage` ([shared/types.ts](../../../shared/types.ts)) es `{ input, output, window, model }`, y lo pinta [ContextMeter.svelte](../../../web/src/components/ai/ContextMeter.svelte) como una barra de contexto ocupado.
- `aiDebug` ([server/ai/aiDebug.ts](../../../server/ai/aiDebug.ts)) guarda una fila por pagina, sobrescrita en cada peticion, y se escribe siempre.

## Goals / Non-Goals

**Goals:**

- Que las rondas de un turno dejen de pagar entera la parte que no cambia.
- Que la averia sea visible. Dejar de reutilizar no produce ningun error, asi que sin un contador a la vista nadie se entera.
- Que ningun proveedor empeore por esto: el que no entiende la marca sigue como hoy.

**Non-Goals:**

- No se reordena el texto de sistema. Ver D5.
- No se cambia cuanto historial se manda ni como se recorta (`ai-authoring`): esta propuesta no toca que se envia, solo como se cobra.
- No cubre la pasada de memorias, que es un prompt distinto y demasiado corto para reutilizar nada. Ver `memoria-de-pagina` D10.

## Decisions

**D1 -- Tres marcas: el bloque comun de la plataforma, el final del sistema, y el final de cada ronda.**
Se evaluo una sola marca al final del texto de sistema: cubre unos quince mil tokens en cada ronda y es la version mas simple. Se descarta porque deja fuera lo que mas pesa --los resultados de herramientas acumulados, con el HTML de la pagina dentro-- que es justo lo que crece ronda tras ronda. Con la marca movil, la ronda doce reenvia casi todo reconocido en vez de la mitad.

La tercera marca --la primera en orden de envio-- separa lo que no depende de nadie. `buildHtmlContract` ya arma sus secciones con las estaticas delante: idioma, catalogo de componentes, colores, medidas, oficio, ordenes de datos y graficas van antes de la primera que lee datos (`viewerSection`). Ese bloque es identico en toda peticion de toda pagina de toda aplicacion, asi que una sola entrada sirve a la plataforma entera y se mantiene caliente mientras alguien use la IA cada pocos minutos. Sobrevive a cambiar de pagina, de aplicacion, de tablas y a senalar cualquier cosa.

Se descarta la cuarta marca disponible: no hay un cuarto limite de estabilidad que justifique mantenerlo.

**D1b -- El nombre de la aplicacion sale del intro del contrato.**
El intro interpola el nombre de la aplicacion, y es lo unico variable de todo ese bloque: con el dentro, la entrada comun seria una por aplicacion en vez de una para todas. Se mueve a la seccion que ya nombra la pagina, donde encaja igual de bien.

No es un reordenamiento de instrucciones y no cae en lo que descarta D5: se mueve un dato de sitio, no una regla. El orden en que la IA lee las instrucciones no cambia.

**D2 -- Cinco minutos, no una hora.**
Las rondas de un turno van separadas por segundos y cada lectura reinicia el plazo, asi que cinco minutos cubren el turno entero por largo que sea. La version de una hora cuesta el doble al escribir y solo aportaria cuando alguien se va y vuelve --un caso que ademas llega con el prompt ya cambiado, porque la pagina se modifico en el turno anterior--.

**D3 -- Siempre activo, sin ajuste.**
Escribir la marca cuesta un cuarto mas y se recupera en la segunda lectura. Un turno de una sola ronda pierde ese cuarto sobre la parte marcada; un turno de doce ahorra mucho mas que eso. Se evaluo un ajuste en la configuracion de IA para poder apagarlo con servidores que no lo aprovechan, y se descarta: los que no entienden la marca la ignoran sin coste (D4), asi que el ajuste solo existiria para un problema que no ocurre.

**D4 -- Cada camino marca en su forma; el que no la entiende la ignora.**
En el camino de Anthropic la marca es un campo del SDK sobre el bloque correspondiente. En el camino compatible con ChatGPT se escribe dentro del contenido del mensaje, que es la forma que OpenRouter traduce cuando detras hay un modelo Claude. Un servidor que no conozca ese campo lo descarta al deserializar el cuerpo: no falla ni cobra de mas. Por eso no hace falta una lista de proveedores compatibles que alguien tenga que mantener.

Aparte va OpenAI, que reutiliza por su cuenta sin que nadie se lo pida y lo informa en su respuesta. Ahi no hay nada que marcar; lo que falta es leer ese dato, que hoy se ignora.

**D5 -- No se reordena el texto de sistema, aunque hoy limita el reuso.**
`systemPrompt()` concatena en este orden: contrato, `## This page`, guia de plan, bloques senalados, adjuntos y guia de herramientas. Los bloques senalados y los adjuntos cambian cada turno, y van **delante** de la guia de herramientas, que son unos seis mil tokens que no cambian nunca: senalar otro elemento invalida tambien esa guia. Mover lo estable arriba lo arreglaria.

Se deja fuera a proposito. El orden de un prompt influye en como responde el modelo, y esas veinte ordenes estan escritas dando por hecho que se leen al final. Reordenarlas es cambiar el comportamiento de la IA para ahorrar dinero: dos cosas que no deben ir en el mismo cambio, porque si algo se degrada no habria forma de saber cual de las dos fue. Queda como cambio posterior, medido aparte.

La consecuencia asumida: el reuso funciona completo dentro de un turno --que es donde esta el grueso-- y entre turnos solo mientras no cambien los bloques senalados ni los adjuntos.

Esa consecuencia la amortigua D1: el bloque comun va delante de todo lo variable, asi que se reutiliza aunque los senalados cambien. Lo que se pierde por el orden actual es la guia de herramientas y las secciones del contrato que leen datos, no los diez mil tokens del bloque comun.

**D6 -- El desglose se guarda, pero `input` no cambia de significado.**
`AiUsage.input` mide cuanto tuvo delante el modelo, y lo reutilizado ocupa contexto igual que lo nuevo: si se restara, el medidor diria que una conversacion larga cabe en nada. El desglose se agrega al lado, y `input` sigue siendo la suma de los tres. Lo que hoy hace `ai.ts` al sumarlos esta bien; lo que falta es no tirar las partes.

**D7 -- Se comprueba en dos sitios, y por razones distintas.**
En el medidor del dock, porque es donde se nota la averia en el momento: la barra pasa a ensenar toda la entrada como nueva. En la constancia de depuracion, porque es donde se mira un fallo despues, cuando ya no se puede reproducir. Uno sirve para darse cuenta y el otro para investigar.

## Risks / Trade-offs

- Un cambio futuro introduce algo variable al principio del prompt --una fecha, un identificador-- y el reuso se cae sin avisar → Mitigacion: D7. Es exactamente el caso que la barra hace visible.
- Cambiar el nivel de razonamiento a mitad de conversacion invalida lo marcado en los mensajes → Limitacion asumida: es una accion deliberada y poco frecuente, y la peticion siguiente vuelve a marcar.
- El camino compatible con ChatGPT manda un campo que algunos servidores no conocen → Mitigacion: D4; un campo desconocido se descarta al leer el cuerpo. Conviene comprobarlo contra un Ollama o un LM Studio antes de dar el cambio por terminado.
- El ahorro depende de que los turnos tengan varias rondas; si la mayoria se resuelven en una, el balance es peor de lo estimado → Mitigacion: el desglose de D6 permite medirlo con datos reales en vez de suponerlo.

## Migration Plan

Sin migracion de datos. `AiUsage` gana campos opcionales, y una constancia de depuracion anterior que no los tenga se lee igual: el medidor los trata como cero y ensena la barra entera como nueva, que es lo que era.

Volver atras es dejar de poner las marcas. Lo ya marcado en el proveedor caduca solo a los cinco minutos.
