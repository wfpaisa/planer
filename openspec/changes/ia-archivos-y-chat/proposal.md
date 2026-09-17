## Why

Quien construye adjunta un CSV y pide un tablero: la IA crea la pagina y la tabla, dice "Listo" y la tabla se queda vacia. Al volver a pedirlo, contesta que no tiene acceso al archivo.

Son dos huecos distintos. Ninguna herramienta de la IA escribe filas, asi que poblar una tabla es imposible aunque el contexto le diga que lo haga. Y el adjunto viaja dentro del contexto de una sola peticion: no se guarda en ningun sitio, y cada peticion abre una conversacion nueva con el modelo, asi que en el turno siguiente ya no existe.

Arreglar eso deja el chat a medias si no se arregla tambien lo que se ve: el proceso se dibuja debajo de la respuesta, los pasos no se pliegan nunca, y con una peticion en marcha pulsar Enter no hace nada y no lo dice.

## What Changes

**Los archivos adjuntos se guardan.** Un adjunto se guarda por la huella de su contenido, como ya se guardan los documentos HTML de las paginas, y vive mientras alguna conversacion lo nombre. Subirlo dos veces ocupa una.

**El modelo recibe una muestra, no el archivo.** De una hoja de calculo o un CSV recibe las columnas, unas veinte filas y cuantas filas trae en total; de un JSON que es una lista, sus claves y sus primeros elementos; de un HTML, un CSS o un texto, el archivo entero mientras sea pequeno. Ademas recibe siempre un identificador con el que pedir el archivo completo, y una herramienta nueva para leerlo.

**La IA puede llenar una tabla desde un archivo.** Una herramienta nueva recibe a que columna de la tabla va cada columna del archivo; el servidor lee el archivo guardado, convierte las celdas y escribe las filas. Lo que la IA manda es el emparejamiento, no los datos, asi que un archivo de miles de filas no ocupa contexto.

**La IA recuerda los turnos anteriores.** Cada peticion le manda los ultimos turnos de la conversacion, con un tope. Hoy cada peticion empieza de cero.

**Se puede escribir mientras trabaja.** Enter deja de esperar: limpia el campo y encola la peticion. Hoy no hace nada y no avisa.

**El proceso se pliega al terminar el turno.** Mientras la IA trabaja se ve todo; al cerrar el turno, razonamiento y pasos se pliegan en una sola fila con sus cuentas y debajo queda la respuesta. Un turno que fallo no pliega nada. El razonamiento en marcha y el ya guardado pasan a ser la misma fila, no dos componentes distintos.

**Se corrigen orden y espaciados del chat.** El proceso pasa a dibujarse encima de la respuesta, los turnos se separan mas entre si que sus partes, los controles del campo de texto dejan de leerse como un bloque, y lo secundario gana un nivel de letra propio.

## Capabilities

### New Capabilities
- `ai-archivos`: los archivos adjuntos a una peticion — donde se guardan, cuanto duran, que parte de ellos ve el modelo y como los lee entero.

### Modified Capabilities
- `ai-tables`: la IA puede llenar una tabla con los datos de un archivo adjunto, emparejando columnas.
- `ai-authoring`: la peticion lleva los ultimos turnos de la conversacion; una peticion pedida mientras otra trabaja se encola en vez de descartarse; ver a la IA trabajar pasa a ser una sola fila que se pliega al cerrar el turno.
- `builder-ai-dock`: el proceso de un turno se pliega al terminar, los adjuntos se quedan como tarjetas mientras dure la conversacion, y se corrigen el orden de las partes de un turno y sus espaciados.

## Impact

- `shared/types.ts`: `AiFile` deja de llevar el contenido y pasa a llevar la referencia guardada; tipos nuevos para la muestra y el emparejamiento de columnas.
- `server/`: coleccion interna nueva para los adjuntos con su poda, dos herramientas nuevas en `aiPage.ts` (leer el archivo, llenar la tabla), el contexto deja de llevar el archivo entero, y la conversacion con el modelo deja de empezar vacia en `ai.ts`.
- `web/src/lib/importParse.ts`: el parseo y la conversion de celdas se mueven a `shared/` para que el servidor los use.
- `web/src/components/AiPanel.svelte` y `components/ai/`: cola de envio, plegado por turno, tarjetas de adjunto, orden y espaciados.
- Sin cambio de esquema en las tablas de quien construye. Los adjuntos de conversaciones anteriores no se recuperan: no se guardaron nunca.
