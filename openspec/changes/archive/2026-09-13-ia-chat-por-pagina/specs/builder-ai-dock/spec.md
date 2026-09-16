## ADDED Requirements

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

#### Scenario: Pedir con un archivo y un elemento senalado

- **WHEN** quien construye adjunta un archivo, senala una tabla y envia la peticion
- **THEN** la burbuja de esa peticion muestra el nombre del archivo y el nombre de la tabla

#### Scenario: Volver a una conversacion guardada

- **WHEN** quien construye abre una conversacion anterior donde se habian adjuntado archivos
- **THEN** las burbujas siguen diciendo con que se pidio

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
