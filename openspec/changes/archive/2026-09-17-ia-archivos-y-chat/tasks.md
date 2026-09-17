## 1. El parseo pasa a ser compartido

- [x] 1.1 Mover a `shared/` el troceado de CSV/TSV y la lectura de JSON de `web/src/lib/importParse.ts`, sin cambiar su comportamiento
- [x] 1.2 Mover a `shared/` la conversion de celda a tipo de columna (`convertValue` y lo que arrastre de `importPlan.ts`)
- [x] 1.3 Dejar `web/src/lib/importParse.ts` reexportando lo movido, para que la importacion manual y `dropFiles.ts` no cambien
- [x] 1.4 `bun run typecheck` y probar a mano una importacion manual desde un CSV y desde un `.xlsx`

## 2. El almacen de adjuntos

- [x] 2.1 Declarar la coleccion interna `ai_files` en `server/config.ts` y crearla en `server/bootstrap.ts` (`app`, `hash`, `name`, `kind`, `mime`, `bytes`, contenido como campo de archivo)
- [x] 2.2 Escribir `server/aiFiles.ts`: guardar por huella --devolviendo el que ya estaba si coincide--, leer, y resolver el nombre visible cuando se repite dentro de una conversacion
- [x] 2.3 Ruta `POST /api/apps/:id/ia/archivos` que recibe el archivo y devuelve su referencia
- [x] 2.4 Guardar en la conversacion que adjuntos nombra cada peticion
- [x] 2.5 Poda de los adjuntos que ninguna conversacion nombra, a imagen de `pruneDocs`

## 3. El navegador sube en vez de leer

- [x] 3.1 Cambiar `AiFile` en `shared/types.ts`: fuera el contenido, dentro la referencia guardada
- [x] 3.2 `web/src/lib/aiFiles.ts` sube el archivo al soltarlo y deja el badge en camino mientras tanto
- [x] 3.3 Quitar un badge a medio subir cancela la subida
- [x] 3.4 La peticion manda referencias; el campo de texto no espera a que termine la subida

## 4. La muestra en el contexto

- [x] 4.1 Armar la muestra en el servidor segun la clase de archivo: filas y columnas, lista JSON, texto o codigo, imagen
- [x] 4.2 Decir siempre nombre, tamano, si esta recortada y con que nombre se pide entera
- [x] 4.3 Sustituir en `server/aiPage.ts` la seccion de adjuntos por la nueva, y quitar de ahi el contenido entero
- [x] 4.4 Los adjuntos de turnos anteriores de la conversacion entran tambien en el contexto

## 5. Leer un adjunto

- [x] 5.1 Orden `leer_archivo(archivo, desde?, lineas?)` en `server/aiPage.ts`, por tramos
- [x] 5.2 Fallar y decirlo cuando el archivo no es de esa conversacion
- [x] 5.3 Su seccion en el contexto: cuando usarla y que no afirmar sin haberla usado

## 6. Llenar una tabla

- [x] 6.1 Orden `llenar_tabla(tabla, archivo, columnas)` en `server/aiPage.ts`
- [x] 6.2 Escribir las filas en lotes, con los topes y los ajustes que ya usa la importacion manual
- [x] 6.3 Contar y devolver: filas que entraron, filas que se quedaron fuera y por que, columnas sin emparejar
- [x] 6.4 Una tabla que ya tiene filas se avisa como cambio con impacto en los datos
- [x] 6.5 La seccion del contexto que dice que llenar anade y nunca reemplaza

## 7. La IA recuerda los turnos anteriores

- [x] 7.1 `startConversation` en `server/ai.ts` acepta los turnos anteriores, para Anthropic y para los servidores compatibles
- [x] 7.2 Armar esos turnos en `server/aiPage.ts`: peticion y respuesta, con tope de turnos y de tamano
- [x] 7.3 Quitar del panel el texto que hoy repite la pregunta y lo elegido al contestar (`answer` en `AiPanel.svelte`)
- [x] 7.4 Anadir al contexto la frase que prohibe declarar hecho lo que no se hizo

## 8. Escribir mientras trabaja

- [x] 8.1 Cola en `aiConversation.svelte.ts`: enviar con una peticion en marcha encola en vez de descartar
- [x] 8.2 Dibujar lo encolado y dejar quitarlo antes de que le llegue el turno
- [x] 8.3 Al terminar la peticion en marcha, arrancar la siguiente de la cola
- [x] 8.4 Recargar con algo en cola lo devuelve al campo de texto y lo dice

## 9. El turno se pliega

- [x] 9.1 Fundir `Working.svelte` y `Reasoning.svelte` en una sola fila que cambia de estado
- [x] 9.2 La fila plegada tiene altura fija y `contain: size layout`
- [x] 9.3 Componente de turno que agrupa la fila y los pasos, y los pliega al cerrar el turno con la cuenta de pasos
- [x] 9.4 Un turno que fallo o se detuvo no pliega nada
- [x] 9.5 Lo abierto a mano sigue abierto durante la visita
- [x] 9.6 Anunciar a los lectores de pantalla que la IA esta trabajando

## 10. Orden y espaciados

- [x] 10.1 Dibujar el proceso encima de la respuesta en `AiPanel.svelte`
- [x] 10.2 Separacion entre turnos mayor que entre las partes de un turno
- [x] 10.3 Los controles del campo de texto pasan a `--sp-12`
- [x] 10.4 Cuarto nivel de color de texto en `web/src/styles/theme.css`, y usarlo en razonamiento, pasos y pistas
- [x] 10.5 Un archivo nombrado en una burbuja anterior se puede abrir para ver lo que se adjunto

## 11. Verificacion

- [x] 11.1 `bun run typecheck`, `bun run check` y `bun run harness`
- [x] 11.2 `bun run smoke` contra el servidor levantado
- [x] 11.3 A mano: adjuntar un CSV, crear la tabla, llenarla, y preguntar por el archivo dos turnos despues
- [x] 11.4 A mano: enviar mientras trabaja, quitar lo encolado, y recargar con algo en cola
- [x] 11.5 Actualizar `AGENTS.md` con las dos ordenes nuevas y con el almacen de adjuntos
