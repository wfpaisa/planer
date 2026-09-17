## Context

Ver `proposal.md` — Why. Lo que condiciona el diseno:

- Un adjunto se lee hoy entero en el navegador (`web/src/lib/aiFiles.ts`, tope de 200.000 caracteres), viaja dentro del cuerpo de la peticion y se suelta al enviarla.
- Cada peticion abre una conversacion nueva con el modelo (`startConversation` en `server/ai.ts`): el historial que se ve en pantalla no llega al modelo.
- Ya existe un almacen por huella para los documentos HTML de las paginas (`server/htmlDocs.ts`), con su poda. Los adjuntos son el mismo problema con otro contenido.
- El parseo de CSV, JSON y hojas de calculo, y la conversion de celda a tipo de columna, viven solo en el navegador (`web/src/lib/importParse.ts`, `importPlan.ts`).
- No hay sistema de migraciones: una coleccion interna nueva se declara en `server/bootstrap.ts` y se crea de forma idempotente.

## Goals / Non-Goals

**Goals:**

- Un adjunto se guarda una vez y sirve durante toda la conversacion.
- El contexto que gasta un adjunto no crece con el tamano del archivo.
- Poblar una tabla no obliga al modelo a reescribir los datos.
- El chat deja de descartar en silencio y deja de ensenar el proceso despues de la conclusion.

**Non-Goals:**

- Una biblioteca de archivos de la aplicacion. Un adjunto es material de una conversacion, no un documento de la aplicacion.
- Analisis de datos dentro del chat mas alla de leer el archivo y responder.
- Deshacer la escritura de filas.
- Reconstruir el chat sobre un registro de eventos como hace el harness de referencia.

## Decisions

### D1. Los adjuntos van en una coleccion interna propia, con el contenido como archivo

Coleccion `ai_files` en `INTERNAL`: `app`, `hash` (sha256 del contenido), `name`, `kind`, `mime`, `bytes` y el contenido como campo de archivo de PocketBase. Sin reglas de acceso, como el resto de las internas: se alcanza solo por el servidor.

El contenido va como archivo y no como texto porque un adjunto puede ser binario --una imagen, una hoja de calculo-- y un campo de texto obligaria a base64, que engorda un tercio y no sirve para nada mas.

*Alternativa descartada:* reutilizar `html_docs`. Guarda texto y su poda mira que paginas lo nombran; mezclar dos ciclos de vida en una tabla habria complicado las dos.

### D2. El modelo nombra un adjunto por su nombre de archivo

Lo que la IA escribe en una orden es `chequeo-preoperacional.csv`, no una huella. Si una conversacion tiene dos adjuntos con el mismo nombre, el segundo se ofrece como `chequeo-preoperacional (2).csv`. La huella es cosa del almacen.

### D3. Dos ordenes nuevas: `leer_archivo` y `llenar_tabla`

- `leer_archivo(archivo, desde?, lineas?)` devuelve el contenido guardado, por tramos. No cambia nada.
- `llenar_tabla(tabla, archivo, columnas)` recibe el emparejamiento `columna del archivo → columna de la tabla` y escribe las filas.

Los nombres siguen la regla de la casa: son la interfaz que lee quien construye, asi que van en espanol y dicen que hacen, no como.

`llenar_tabla` **anade**, nunca reemplaza. Reemplazar es borrar datos y eso no le corresponde a la IA, igual que no le corresponde borrar una columna.

### D4. El parseo se mueve a `shared/`

De `web/src/lib/importParse.ts` salen a `shared/` el troceado de CSV/TSV, la lectura de JSON y la conversion de celda a tipo de columna. El navegador los sigue usando para la importacion manual; el servidor los usa para la muestra y para `llenar_tabla`.

La lectura de hojas de calculo (`.xlsx`) se queda en el navegador: depende de una libreria de navegador y el archivo se sube ya convertido a filas y columnas.

### D5. El navegador sube el archivo; la peticion lleva referencias

`POST /api/apps/:id/ia/archivos` guarda el adjunto y devuelve su referencia. `AiFile` deja de llevar `text`/`data` y pasa a llevar la referencia, el nombre, la clase y el tamano.

La subida arranca al soltar el archivo, no al enviar: para cuando se termina de escribir la peticion, el archivo ya esta guardado.

La muestra la arma el servidor al construir el contexto, no el navegador. Asi la regla de que se ensena de cada clase de archivo vive en un solo sitio, junto al resto del contexto.

### D6. Que se le manda al modelo de los turnos anteriores

Por cada turno anterior, dos mensajes: lo que escribio quien construye y el texto con el que la IA cerro el turno. Tope de 10 turnos, y ademas un tope por tamano.

No se reenvian ni el razonamiento ni las llamadas a herramientas de turnos anteriores: el razonamiento de un turno cerrado no aporta al siguiente, hay servidores que lo rechazan al reenviarlo, y las herramientas ya dejaron su efecto en la aplicacion, que la IA vuelve a leer en el contexto de cada peticion.

### D7. La cola de peticiones vive en el navegador

La peticion en marcha ya sobrevive a recargar porque el servidor la reconoce (`aiRun`). Lo encolado todavia no existe para el servidor, asi que se queda en la conversacion del navegador.

Al recargar con algo en cola, lo encolado vuelve al campo de texto en vez de perderse. Es la unica forma honesta de no prometer lo que no se guardo.

### D8. El plegado del turno es un componente, no un estado del turno

`Working.svelte` y `Reasoning.svelte` se funden en una sola fila que cambia de estado, y un componente de turno agrupa esa fila con los pasos y decide si se pliega.

Plegado tiene altura fija y `contain: size layout`: lo que llega mientras la IA escribe no puede mover el resto de la conversacion.

Lo que se abre a mano se queda abierto mientras dure la visita; no se guarda entre visitas.

### D9. Espaciados y un nivel de letra mas

- Entre turnos `--sp-24`; entre las partes de un mismo turno `--sp-8`.
- Los controles del campo de texto pasan de `--sp-6` a `--sp-12`.
- Se anade un cuarto nivel de color de texto para lo terciario --razonamiento plegado, pasos, pistas--, por debajo de `--text-muted`, que hoy hace de secundario y de terciario a la vez.

## Risks / Trade-offs

- **Un emparejamiento mal hecho mete datos malos en una tabla y no hay deshacer.** → `llenar_tabla` solo anade; el paso dice cuantas filas entraron y cuantas quedaron fuera; el tope de la importacion manual sigue mandando; llenar una tabla que ya tiene filas se cuenta como cambio con impacto en los datos, que el dock ya sabe avisar.
- **Mandar los turnos anteriores encarece cada peticion.** → El contexto ya lleva el contrato HTML y las tablas, que pesan mas; el tope de turnos y el medidor de contexto que ya existe acotan el gasto.
- **Un adjunto grande ocupa aunque nadie lo use.** → Poda por los adjuntos que ninguna conversacion nombra, como `pruneDocs`.
- **Mover el parseo a `shared/` toca la importacion manual, que hoy funciona.** → Se mueve sin cambiar su comportamiento; el arnes de la importacion manual sigue siendo la referencia.
- **La cola en el navegador se pierde al recargar.** → Lo encolado vuelve al campo de texto y se dice; no se promete durabilidad que no hay.

## Migration Plan

1. `bootstrap.ts` crea `ai_files` de forma idempotente. No hay nada que migrar: los adjuntos anteriores no se guardaron nunca.
2. El parseo se mueve a `shared/` antes de tocar el servidor; la importacion manual tiene que seguir pasando su prueba de humo.
3. Las ordenes nuevas se anaden sin quitar ninguna: una conversacion en curso no cambia de forma a mitad.

## Open Questions

- El tope de 10 turnos es un punto de partida; se afina viendo el medidor de contexto en uso real.
- Cuanto vale la pena ensenar de un JSON que es una lista de objetos grandes: las claves y dos elementos pueden quedarse cortos o pasarse.
