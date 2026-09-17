## ADDED Requirements

### Requirement: Las partes de un turno se dibujan en el orden en que ocurrieron

Dentro de un turno de la IA, lo que ocurrio antes SHALL dibujarse antes: primero el razonamiento y los pasos, despues la respuesta.

La respuesta SHALL ser la ultima parte del turno, de modo que saber que hizo la IA no obligue a pasar por debajo de lo que respondio.

#### Scenario: Un turno con pasos

- **WHEN** la IA da varios pasos y responde
- **THEN** los pasos se leen encima de la respuesta

### Requirement: Un turno se distingue del siguiente

La separacion entre un turno y el siguiente SHALL ser mayor que la separacion entre las partes de un mismo turno, de modo que se vea donde acaba uno y empieza otro.

#### Scenario: Una conversacion de varios turnos

- **WHEN** quien construye recorre una conversacion con varias peticiones
- **THEN** distingue donde termina cada turno sin leerlo

## MODIFIED Requirements

### Requirement: Los atajos y lo anadido son badges que se pueden quitar

Los atajos de peticion SHALL dibujarse como badges dentro de la conversacion, no como una barra aparte. Todo badge que quien construye haya anadido a lo que esta escribiendo SHALL poder quitarse antes de enviar, sin que se pierda el texto ya escrito.

Un archivo adjunto SHALL dibujarse con su nombre y su tamano. Mientras el archivo se este guardando, su badge SHALL decir que va en camino; quitarlo antes de que termine SHALL cancelar ese guardado.

Un archivo que todavia no termino de guardarse SHALL NO impedir seguir escribiendo.

#### Scenario: Quitar un badge del borrador

- **WHEN** quien construye quita un badge de lo que esta escribiendo
- **THEN** el badge desaparece
- **AND** el texto que llevaba escrito sigue intacto

#### Scenario: Adjuntar un archivo grande

- **WHEN** quien construye adjunta un archivo que tarda en guardarse
- **THEN** el badge dice que va en camino
- **AND** puede seguir escribiendo mientras tanto

#### Scenario: Quitar un adjunto a medio guardar

- **WHEN** quien construye quita el badge de un archivo que todavia se esta guardando
- **THEN** ese guardado se cancela

### Requirement: La burbuja de la peticion dice con que se pidio

Cuando una peticion lleve archivos adjuntos o elementos senalados, la burbuja de esa peticion SHALL mostrarlos: el nombre de cada archivo y el nombre legible de cada elemento senalado. SHALL seguir mostrandolos al volver a abrir esa conversacion mas tarde.

La burbuja SHALL NO mostrar el contenido de los archivos ni el HTML de lo senalado.

Un archivo nombrado en una burbuja SHALL poder abrirse para ver lo que se adjunto, mientras siga guardado.

#### Scenario: Pedir con un archivo y un elemento senalado

- **WHEN** quien construye adjunta un archivo, senala una tabla y envia la peticion
- **THEN** la burbuja de esa peticion muestra el nombre del archivo y el nombre de la tabla

#### Scenario: Volver a una conversacion guardada

- **WHEN** quien construye abre una conversacion anterior donde se habian adjuntado archivos
- **THEN** las burbujas siguen diciendo con que se pidio

#### Scenario: Ver lo que se adjunto

- **WHEN** quien construye abre el nombre de un archivo de una burbuja anterior
- **THEN** ve lo que se adjunto

#### Scenario: Peticion sin nada adjunto

- **WHEN** la peticion no llevaba archivos ni elementos senalados
- **THEN** la burbuja muestra solo el texto
