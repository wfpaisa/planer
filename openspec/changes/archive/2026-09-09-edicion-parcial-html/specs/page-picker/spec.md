## ADDED Requirements

### Requirement: Se puede señalar un elemento del documento

Quien construye SHALL poder activar un cursor de seleccion desde el dock y señalar un elemento del documento, como se inspecciona un elemento en un navegador. Mientras el cursor esta activo, pasar por encima SHALL iluminar el elemento que se seleccionaria.

#### Scenario: Activar el cursor y señalar

- **WHEN** quien construye activa el cursor y pasa el raton sobre la tabla de clientes
- **THEN** la tabla se ilumina como lo que se seleccionaria
- **AND** al hacer clic queda seleccionada

#### Scenario: Salir del cursor sin seleccionar

- **WHEN** quien construye activa el cursor y se arrepiente
- **THEN** puede desactivarlo sin haber seleccionado nada
- **AND** el documento queda como estaba

### Requirement: Solo se senalan cosas con entidad

El cursor SHALL ofrecer como candidatos unicamente elementos con entidad propia --secciones, articulos, tablas, formularios, navegaciones, listas, figuras, los mandos de un formulario --campos, selectores, areas de texto, botones y grupos-- y cualquier elemento que ya lleve nombre de bloque--. Apuntar a algo que no lo es SHALL subir al candidato mas cercano hacia arriba.

Un mando SHALL nombrarse por lo que lo identifica de cara a quien mira --su etiqueta, su texto de ayuda, su nombre o su tipo-- para que dos campos seguidos no den dos badges iguales.

#### Scenario: Apuntar a una palabra dentro de una tabla

- **WHEN** quien construye apunta a un texto dentro de una celda
- **THEN** lo que se ilumina es la tabla que lo contiene

#### Scenario: Señalar un campo de un formulario

- **WHEN** quien construye apunta a un campo, un selector o un boton
- **THEN** lo que se ilumina es ese mando, no el formulario que lo rodea
- **AND** el badge dice cual es, por su etiqueta o su texto

#### Scenario: Un documento sin candidatos claros

- **WHEN** el documento esta hecho solo de contenedores genericos sin entidad
- **THEN** el cursor ofrece los bloques mas grandes que pueda reconocer
- **AND** nunca deja al raton sin nada que señalar

### Requirement: Un clic del cursor no llega al documento

Mientras el cursor esta activo, el clic SHALL consumirse en la seleccion. El documento SHALL NO navegar, enviar formularios ni reaccionar de ninguna otra forma a ese clic.

#### Scenario: Señalar un enlace

- **WHEN** quien construye senala con el cursor un elemento que contiene un enlace
- **THEN** el elemento queda seleccionado
- **AND** la pagina no navega a ninguna parte

### Requirement: Lo senalado es un badge de la conversacion

Cada elemento senalado SHALL aparecer como un badge dentro de la conversacion, con un nombre legible que permita saber a que se refiere. Un badge SHALL poder quitarse antes de enviar, sin que se pierda el texto ya escrito.

#### Scenario: Señalar y describir lo que se quiere

- **WHEN** quien construye senala una tabla y escribe "agrega una columna de telefono"
- **THEN** la peticion viaja con esa tabla como contexto
- **AND** el badge dice de que elemento se trata

#### Scenario: Quitar lo senalado

- **WHEN** quien construye quita el badge de un elemento senalado
- **THEN** ese elemento deja de ir en la peticion
- **AND** lo que llevaba escrito sigue intacto

### Requirement: Se puede señalar mas de un elemento

El cursor SHALL permitir tener varios elementos senalados a la vez, cada uno con su badge. La IA SHALL recibirlos todos como contexto.

Cada edicion SHALL apuntar a un solo bloque: unir varios elementos en uno no entra aqui.

#### Scenario: Señalar tres tarjetas

- **WHEN** quien construye senala tres tarjetas y pide el mismo color para todas
- **THEN** las tres viajan como contexto
- **AND** la IA las edita una por una

### Requirement: Lo senalado llega con su sitio y su contenido

De cada elemento senalado SHALL viajar como minimo donde esta dentro del documento y el HTML que tiene ahora, recortado si es enorme. La IA SHALL NO tener que releer la pagina entera para saber que se le senalo.

#### Scenario: Señalar un elemento muy grande

- **WHEN** quien construye senala una tabla con cientos de filas
- **THEN** la IA recibe donde esta y una parte suficiente de su contenido
- **AND** se le indica que el contenido va recortado
