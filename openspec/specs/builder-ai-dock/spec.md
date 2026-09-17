# builder-ai-dock Specification

## Purpose
TBD - created by archiving change dock-ia-lateral. Update Purpose after archive.

## Requirements

### Requirement: La IA vive en una columna propia

La conversacion con la IA SHALL vivir en una columna a la izquierda del panel de construccion. Esa columna SHALL ocupar su espacio junto al documento y SHALL NO dibujarse encima de el: mientras se habla con la IA, lo construido sigue viendose entero.

#### Scenario: Abrir el dock con una pagina delante

- **WHEN** quien construye abre el dock estando en una pagina con contenido
- **THEN** la conversacion aparece a la izquierda
- **AND** el documento se sigue viendo entero, mas estrecho

#### Scenario: La IA termina un cambio

- **WHEN** la IA termina de cambiar la pagina con el dock abierto
- **THEN** el documento se repinta a la vista, sin cerrar la conversacion

### Requirement: El ancho del dock lo ajusta cada quien

El ancho del dock SHALL poder ajustarse arrastrando su borde, entre un minimo y un maximo que impidan dejarlo inservible o comerse el documento. El ancho elegido SHALL recordarse por aplicacion en el navegador de cada persona.

#### Scenario: Ensanchar el dock

- **WHEN** quien construye arrastra el borde del dock hacia la derecha
- **THEN** la conversacion se ensancha y el documento se estrecha en la misma medida

#### Scenario: Volver a la aplicacion mas tarde

- **WHEN** quien construye ajusto el ancho y vuelve mas tarde a la misma aplicacion
- **THEN** el dock aparece con el ancho que dejo

#### Scenario: Arrastrar mas alla del limite

- **WHEN** quien construye arrastra el borde mas alla del minimo o del maximo
- **THEN** el dock se queda en el limite

### Requirement: El dock se esconde y vuelve desde un solo boton

El dock SHALL poder esconderse por completo, devolviendo todo su ancho al documento. SHALL volver unicamente desde un boton en la barra superior del panel. Ese boton SHALL distinguirse del resto con un halo animado, y SHALL indicar si el dock esta abierto o escondido.

#### Scenario: Esconder el dock

- **WHEN** quien construye esconde el dock
- **THEN** el documento recupera ese ancho
- **AND** el boton de la barra superior sigue a la vista para traerlo de vuelta

#### Scenario: Traer el dock de vuelta

- **WHEN** quien construye pulsa el boton de la barra superior con el dock escondido
- **THEN** el dock vuelve con el ancho que tenia
- **AND** la conversacion aparece tal como se dejo

### Requirement: El dock convive con el sidebar de paginas

El dock y el sidebar de paginas SHALL ser independientes. Abrir o cerrar el dock SHALL NO plegar, desplegar ni desanclar el sidebar. Con los dos a la vista, el documento SHALL ocupar el ancho que quede.

#### Scenario: Abrir el dock con el sidebar anclado

- **WHEN** quien construye abre el dock teniendo el sidebar anclado
- **THEN** el sidebar se queda como estaba
- **AND** el documento se dibuja en el ancho que queda entre los dos

### Requirement: El dock es solo para quien construye

El dock SHALL mostrarse unicamente a quien construye la aplicacion. Un visitante SHALL NO verlo en ninguna pagina, ni su boton en ninguna parte.

#### Scenario: Visitante en una pagina publicada

- **WHEN** un visitante abre una pagina de la aplicacion publicada
- **THEN** no ve el dock ni ningun boton para traerlo

### Requirement: El dock se pinta con la paleta del panel

El dock SHALL usar la paleta del panel de construccion, en modo claro y oscuro, como el resto del chrome --el encabezado y el sidebar de paginas--.

La paleta de la aplicacion SHALL quedarse donde es la aplicacion: el documento HTML mientras se construye, y el documento mas el sidebar en la vista publicada. El dock SHALL NO tomarla: esta pegado al sidebar de paginas, y dos paletas una al lado de la otra se leerian como dos programas distintos.

#### Scenario: Cambiar la paleta de la aplicacion

- **WHEN** se cambia la paleta de una aplicacion
- **THEN** el documento se repinta con los colores nuevos
- **AND** el dock se queda con los del panel

#### Scenario: Cambiar el tema del panel

- **WHEN** quien construye pasa el panel de claro a oscuro
- **THEN** el dock se repinta con el tema nuevo, junto al resto del chrome

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

### Requirement: El aviso de impacto en los datos vive en el dock

Cuando una peticion a la IA lleva a cambios de estructura con riesgo, el aviso SHALL dibujarse dentro del dock, encadenado a la conversacion que lo provoco. Decidir SHALL devolver a esa misma conversacion.

#### Scenario: La IA propone un cambio con riesgo

- **WHEN** una peticion a la IA lleva a un cambio de estructura con riesgo
- **THEN** el aviso aparece dentro del dock
- **AND** al decidir se vuelve a la conversacion donde se pidio

### Requirement: Historiales con nombres distintos

Las conversaciones con la IA SHALL llamarse "Conversaciones". Los cambios guardados de una pagina SHALL llamarse "Cambios". El sistema SHALL NO llamar "historial" a ninguno de los dos, para que no se confundan.

#### Scenario: Buscar una conversacion anterior

- **WHEN** quien construye busca una conversacion anterior
- **THEN** la encuentra bajo el nombre "Conversaciones"

#### Scenario: Buscar como estaba antes una pagina

- **WHEN** quien construye busca una version anterior de la pagina
- **THEN** la encuentra bajo el nombre "Cambios"

### Requirement: Borrar sigue preguntando aparte

Borrar una pagina o una aplicacion SHALL seguir preguntando en un dialogo que interrumpe, fuera del dock. Es la unica pregunta que interrumpe a proposito.

#### Scenario: Borrar una pagina

- **WHEN** quien construye pide borrar una pagina
- **THEN** se le pregunta en un dialogo aparte que hay que contestar

### Requirement: El dock de una pagina ajena no admite peticiones

Mientras la IA trabaje en otra pagina de la misma aplicacion, el campo de texto del dock SHALL quedar tapado por completo, sin dejar escribir ni enviar. Lo que se lea ahi SHALL decir en que pagina esta trabajando y SHALL ofrecer un clic que lleve a ella, que es la unica accion disponible mientras dure el bloqueo.

El campo SHALL quedar tambien fuera del alcance del teclado: no se llega a el tabulando.

Lo que quien construye llevaba escrito sin enviar SHALL conservarse mientras dure el bloqueo, y SHALL volver a estar delante cuando se levante.

#### Scenario: Llegar a otra pagina con la IA trabajando

- **WHEN** la IA esta trabajando en una pagina y quien construye abre otra y trae el dock
- **THEN** el campo de texto esta tapado y no admite ni escribir ni enviar
- **AND** se lee en que pagina esta trabajando
- **AND** un clic lleva a esa pagina

#### Scenario: Lo escrito antes del bloqueo

- **WHEN** quien construye tenia algo escrito sin enviar, el dock se bloquea y la peticion termina
- **THEN** lo escrito vuelve a estar delante
- **AND** ya se puede enviar

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
### Requirement: El boton de la IA se enciende cuando hay algo en marcha

Cuando el dock este escondido y la IA este trabajando en alguna pagina de la aplicacion, el boton que trae el dock SHALL indicarlo.

#### Scenario: Esconder el dock mientras la IA trabaja

- **WHEN** quien construye esconde el dock con una peticion en marcha
- **THEN** el boton que lo trae indica que hay algo en marcha

#### Scenario: Nada en marcha

- **WHEN** no hay ninguna peticion en marcha en la aplicacion
- **THEN** el boton no indica nada
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
