## Why

Un turno de la IA no es una llamada al modelo: son hasta doce. `MAX_ROUNDS = 12` en `server/ai/aiPage/index.ts`, y cada ronda reenvia entera la anterior --el contrato de HTML, las veinte herramientas, los turnos previos y todos los resultados de herramientas acumulados, incluido el HTML de la pagina--. Lo unico que cambia entre una ronda y la siguiente es la cola.

Los proveedores cobran una decima parte por lo que reconocen como ya enviado, y el prompt de la plataforma esta construido de forma que lo reconocerian: no lleva fechas ni identificadores variables, y las herramientas se generan siempre en el mismo orden. Pero nadie lo pide, asi que cada ronda se paga entera.

## What Changes

- Las peticiones a la IA **marcan donde termina la parte repetida** para que el proveedor la cobre como ya enviada.
- Tres marcas por peticion:
  - Una **comun a toda la plataforma**, al final de las secciones del contrato que no dependen de ninguna aplicacion --idioma, catalogo de componentes, colores, medidas, oficio, ordenes de datos y graficas--. Ese bloque es identico en toda pagina de toda aplicacion.
  - Una **fija** al final del texto de sistema, que cubre ademas lo propio de esa pagina.
  - Una **movil** al final de la ultima ronda, que avanza segun crecen los resultados de herramientas.
- Para que la primera marca sea util, el **nombre de la aplicacion sale del intro del contrato** y pasa a la seccion que ya nombra la pagina. Es lo unico variable que hoy ensucia ese bloque.
- El camino de Anthropic marca con el campo del SDK; el camino compatible con ChatGPT marca dentro del contenido del mensaje, que es la forma que entiende OpenRouter con modelos Claude. Los servidores que no lo entienden --OpenAI, Ollama, LM Studio-- lo ignoran sin coste ni error.
- La marca dura **cinco minutos** y cada lectura reinicia ese plazo, asi que cubre el turno entero.
- Va **siempre activa**. No hay ajuste que encender.
- El recuento deja de sumar tres cosas en una: se guardan por separado los tokens nuevos, los leidos de lo ya enviado y los escritos. El total de entrada **sigue sumandolos todos**, porque todos ocupan contexto.
- Ese desglose queda en el **registro de depuracion** de la pagina y se ve en el **medidor de contexto** del dock, con la parte reutilizada diferenciada en la barra.
- **No se reordena el texto de sistema.** Hoy la guia de herramientas va detras de los bloques senalados, lo que limita el reuso entre turnos; corregirlo cambia como responde el modelo y se mide aparte. Mover el nombre de la aplicacion no es un reordenamiento: es un dato que cambia de seccion, no una instruccion que cambia de sitio.

## Capabilities

### New Capabilities

- `ai-cache`: como se marca la parte repetida de una peticion a la IA, que la invalida, y como se comprueba que sigue funcionando.

### Modified Capabilities

- `ai-debug`: la constancia de la ultima peticion guarda ademas el desglose del recuento --nuevos, leidos, escritos--.

## Impact

- **Servidor**: `server/ai/ai.ts` --los dos caminos de proveedor, el marcado y el desglose del recuento--, `server/ai/aiPage/index.ts` --la marca movil en el bucle de rondas--, `server/ai/aiDebug.ts` --guardar el desglose--.
- **Contrato**: `shared/htmlContract.ts` --sacar el nombre de la aplicacion del intro y senalar donde termina el bloque comun-- y `server/ai/aiPage/prompts.ts` --nombrar la aplicacion en la seccion de la pagina--. Lo lee tambien la documentacion del constructor y la conversion de paginas, que llaman al mismo constructor de contrato.
- **Tipos**: `AiUsage` en `shared/types.ts` gana el desglose; `input` conserva su significado actual.
- **Panel**: `web/src/components/ai/ContextMeter.svelte`.
- **Coste**: escribir la parte repetida cuesta un 25% mas una vez por turno; leerla cuesta una decima parte las once veces restantes.
- **Sin efecto** sobre lo que la IA responde: se marca lo que ya se enviaba, no se cambia el contenido ni el orden de la peticion.
