## 1. Tipos y recuento

- [ ] 1.1 Ampliar `AiUsage` en `shared/types.ts` con el desglose de la entrada --nuevos, reutilizados, marcados-- como campos opcionales, con el comentario de que `input` sigue siendo la suma de los tres (D6).
- [ ] 1.2 En el camino de Anthropic de `server/ai/ai.ts`, dejar de perder `cache_read_input_tokens` y `cache_creation_input_tokens`: se guardan en el desglose y se siguen sumando en `input`.
- [ ] 1.3 En el camino compatible con ChatGPT, leer el desglose que informe el servidor cuando venga, y contar todo como nuevo cuando no venga (`ai-cache`: "Proveedor que no informa").

## 2. El bloque comun de la plataforma

- [ ] 2.1 En `shared/htmlContract.ts`, sacar el nombre de la aplicacion del intro, y nombrarla en la seccion de la pagina de `server/ai/aiPage/prompts.ts` (D1b).
- [ ] 2.2 Comprobar que los otros dos que llaman a `buildHtmlContract` --la documentacion del constructor en `server/routes.ts` y la conversion de paginas en `server/page/pageConvert.ts`-- siguen diciendo lo que decian.
- [ ] 2.3 Exponer donde termina el bloque comun, para que quien arma la peticion pueda marcarlo sin conocer las secciones por dentro (D1).
- [ ] 2.4 Comprobar que ese bloque no contiene ningun dato de aplicacion, pagina ni personas: mismo texto exacto para dos aplicaciones distintas (`ai-cache`: "Peticiones en paginas y aplicaciones distintas").

## 3. Las marcas fija y comun

- [ ] 3.1 En `anthropicConversation`, marcar el final del bloque comun y el final del texto de sistema (D1).
- [ ] 3.2 En `openAiConversation`, marcar los mismos dos puntos dentro del contenido del mensaje de sistema, en la forma que traduce OpenRouter (D4).
- [ ] 3.3 Comprobar que un servidor que no conoce el campo responde con normalidad: probar contra Ollama o LM Studio (`ai-cache`: "Servidor local").

## 4. La marca movil

- [ ] 4.1 Mover la marca al final del ultimo mensaje en cada vuelta del bucle, en los dos caminos, de forma que avance con los resultados de herramientas acumulados (D1).
- [ ] 4.2 Comprobar que no se pasa del numero de marcas que admite el proveedor cuando un turno agota las doce rondas.
- [ ] 4.3 Comprobar con el desglose de 1.2 y 1.3 que a partir de la segunda ronda la mayor parte de la entrada llega reconocida.

## 5. El medidor de contexto

- [ ] 5.1 En `web/src/components/ai/ContextMeter.svelte`, decir cuanto de lo que el modelo tuvo delante venia reutilizado, sin cambiar el total ni la ventana.
- [ ] 5.2 Distinguir esa parte en la barra con otro tono, de modo que una peticion sin reuso se vea entera como nueva (D7).
- [ ] 5.3 Resolver el caso de una peticion sin desglose --anterior a este cambio o de un proveedor que no informa-- como barra entera nueva, sin texto adicional.

## 6. El registro de depuracion

- [ ] 6.1 Guardar el desglose en la constancia de `server/ai/aiDebug.ts`, junto al modelo y el tiempo que ya guarda.
- [ ] 6.2 Ensenarlo donde se lee la constancia, en la misma pantalla que el contexto y la respuesta.

## 7. Verificacion

- [ ] 7.1 `bun run typecheck` en cero errores y cero avisos.
- [ ] 7.2 `bun run lint` limpio y `bun run format` sobre los archivos tocados.
- [ ] 7.3 Prueba contra Anthropic: un turno de varias rondas, comprobando en el desglose que la primera ronda escribe y las siguientes leen.
- [ ] 7.4 Prueba contra OpenRouter con un modelo Claude: el mismo comportamiento por el otro camino.
- [ ] 7.5 Prueba contra un servidor que no reutiliza: la peticion se responde igual y el medidor ensena toda la entrada como nueva.
- [ ] 7.6 Comprobar que lo que la IA responde no cambia: el mismo pedido sobre la misma pagina produce un resultado equivalente al de antes del cambio (`ai-cache`: "Marcar no cambia lo que se le manda al modelo").
