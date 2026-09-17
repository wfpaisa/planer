## Purpose

Los archivos que quien construye adjunta a una peticion a la IA: donde quedan guardados, cuanto duran, que parte de ellos ve el modelo y como los lee enteros cuando los necesita.

## ADDED Requirements

### Requirement: Un adjunto se guarda por su contenido

Todo archivo adjuntado a una peticion SHALL quedar guardado, identificado por la huella de su contenido. Dos adjuntos con el mismo contenido SHALL compartir un solo guardado.

Un adjunto SHALL pertenecer a la aplicacion donde se adjunto y SHALL NO ser alcanzable desde otra.

El contenido guardado SHALL ser el mismo que traia el archivo, sin recortar. Lo que se recorta es lo que se le ensena al modelo, no lo que se guarda.

#### Scenario: El mismo archivo dos veces

- **WHEN** quien construye adjunta el mismo archivo en dos peticiones
- **THEN** ocupa un solo guardado

#### Scenario: Un archivo mas grande que lo que el modelo puede leer de una vez

- **WHEN** se adjunta un archivo de varios megabytes
- **THEN** se guarda entero
- **AND** lo que viaja al modelo es una muestra

### Requirement: El adjunto sigue estando en los turnos siguientes

Mientras la conversacion siga abierta, la IA SHALL poder nombrar y leer cualquier archivo adjuntado antes en esa misma conversacion.

Preguntar por un archivo adjuntado en un turno anterior SHALL NO obligar a adjuntarlo otra vez, ni dentro de la misma visita ni despues de recargar.

#### Scenario: Preguntar por el archivo dos turnos despues

- **WHEN** quien construye adjunta un archivo, pide otras dos cosas y luego pregunta cuantos registros trae
- **THEN** la IA lo responde
- **AND** no pide que se vuelva a adjuntar

#### Scenario: Recargar y seguir

- **WHEN** quien construye recarga el panel y sigue la misma conversacion
- **THEN** los archivos adjuntados antes siguen disponibles para la IA

### Requirement: Un adjunto deja de guardarse cuando nadie lo nombra

Cuando ninguna conversacion guardada nombre un adjunto, el sistema SHALL poder borrarlo.

Borrar una conversacion SHALL NO borrar un adjunto que otra conversacion siga nombrando.

#### Scenario: Borrar la conversacion que lo trajo

- **WHEN** se borra la unica conversacion donde se adjunto un archivo
- **THEN** ese adjunto queda sin nadie que lo nombre y puede borrarse

#### Scenario: El mismo archivo en dos conversaciones

- **WHEN** se borra una de las dos conversaciones que adjuntaron el mismo archivo
- **THEN** el adjunto sigue guardado

### Requirement: El modelo recibe una muestra del archivo, no el archivo

Lo que viaja al modelo con la peticion SHALL depender de lo que traiga el archivo:

- De un archivo de filas y columnas --hoja de calculo, CSV, texto separado--: los nombres de las columnas, las primeras filas y cuantas filas trae en total.
- De un JSON que es una lista: sus claves y sus primeros elementos.
- De un JSON que es un solo objeto, de un HTML, de una hoja de estilos, de codigo o de texto: el contenido entero mientras quepa dentro del limite; por encima del limite, su principio.
- De una imagen: sigue viajando dentro de la peticion, como hasta ahora.

Toda muestra SHALL decir si esta recortada, y SHALL ir acompanada del nombre del archivo, su tamano y con que nombrarlo para leerlo entero.

#### Scenario: Un CSV de miles de filas

- **WHEN** se adjunta un CSV de cinco mil filas
- **THEN** el modelo recibe sus columnas, unas pocas filas y el total de filas
- **AND** no recibe las cinco mil

#### Scenario: Un HTML pequeno de referencia

- **WHEN** se adjunta un HTML para que la IA lo tome como referencia
- **THEN** el modelo lo recibe entero

#### Scenario: Un archivo de texto muy largo

- **WHEN** se adjunta un texto que no cabe en el limite
- **THEN** el modelo recibe su principio
- **AND** se le dice que esta recortado

### Requirement: La IA puede leer un adjunto entero

La IA SHALL disponer de una orden para leer el contenido completo de un archivo adjuntado a la conversacion, por tramos cuando sea largo.

Leer un adjunto SHALL NO cambiar nada de la aplicacion: ni la pagina, ni las tablas, ni los datos.

Una orden de lectura sobre un archivo que no pertenece a esa conversacion SHALL fallar y decirlo.

#### Scenario: Una cuenta exacta sobre un archivo largo

- **WHEN** quien construye pregunta cuantas filas cumplen una condicion en un archivo del que solo se mando una muestra
- **THEN** la IA lee el archivo y responde sobre el contenido entero

#### Scenario: Leer no cambia nada

- **WHEN** la IA lee un adjunto
- **THEN** la pagina queda como estaba
