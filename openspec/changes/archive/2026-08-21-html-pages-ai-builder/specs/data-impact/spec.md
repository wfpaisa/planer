## Purpose

Separa los cambios de base de datos que no pueden romper nada de los que si, y define el dialogo con el que quien construye decide cuando la IA necesita tocar una tabla que otras paginas usan.

## ADDED Requirements

### Requirement: Los cambios se clasifican por riesgo

El sistema SHALL clasificar todo cambio de estructura de una tabla en dos grupos. Sin riesgo: crear una tabla, anadir una columna y renombrar una columna. Con riesgo: borrar una tabla, borrar una columna y cambiar el tipo de una columna.

#### Scenario: Crear una tabla que falta

- **WHEN** la IA necesita una tabla que no existe
- **THEN** se muestra un aviso corto con un solo boton de confirmacion

#### Scenario: Anadir una columna

- **WHEN** la IA necesita una columna nueva en una tabla existente
- **THEN** se muestra un aviso corto con un solo boton de confirmacion

#### Scenario: Renombrar una columna

- **WHEN** la IA necesita renombrar una columna
- **THEN** el cambio se aplica sin preguntar

#### Scenario: Borrar una columna

- **WHEN** la IA necesita borrar una columna
- **THEN** se abre el dialogo de impacto

### Requirement: El dialogo de impacto dice que, para que, quien y que salidas

El dialogo de impacto SHALL mostrar siempre: que cambio se quiere hacer, para que se pide, que paginas usan lo que se va a cambiar, y las opciones disponibles. La primera opcion SHALL ser la que no rompe nada, y SHALL existir siempre la opcion de no tocar la tabla.

#### Scenario: Borrar una columna que usan dos paginas

- **WHEN** la IA necesita borrar una columna que declaran dos paginas
- **THEN** el dialogo nombra el cambio, la peticion que lo motiva y las dos paginas
- **AND** ofrece como primera opcion una que conserva los datos
- **AND** ofrece la opcion de no tocar la tabla

#### Scenario: Borrar una columna que no usa nadie

- **WHEN** la IA necesita borrar una columna que ninguna pagina declara
- **THEN** el dialogo lo dice
- **AND** sigue ofreciendo la opcion de no tocar la tabla

#### Scenario: Elegir no tocar la tabla

- **WHEN** quien construye elige no tocar la tabla
- **THEN** la IA continua con lo que si puede hacer en la pagina
- **AND** dice de forma expresa que quedo sin hacer

### Requirement: El aviso es instantaneo y el detalle se pide

El dialogo de impacto SHALL mostrarse sin espera, nombrando solo las paginas afectadas. El detalle de para que usa cada pagina lo que se va a cambiar SHALL consultarse solo cuando quien construye lo pide.

#### Scenario: Abrir el dialogo

- **WHEN** se abre el dialogo de impacto
- **THEN** aparece de inmediato con la lista de paginas afectadas

#### Scenario: Pedir el detalle de una pagina

- **WHEN** quien construye pide el detalle de una de las paginas afectadas
- **THEN** la IA lo consulta en ese momento y lo responde en el mismo dialogo

### Requirement: Todos los cambios en una sola pregunta

Cuando una peticion exige varios cambios con riesgo, el sistema SHALL presentarlos juntos en un solo dialogo. SHALL NO encadenar varios dialogos seguidos.

#### Scenario: Peticion con tres cambios con riesgo

- **WHEN** una peticion exige borrar una columna y cambiar el tipo de otras dos
- **THEN** el dialogo muestra los tres cambios y su impacto a la vez
- **AND** se decide una sola vez

### Requirement: Autorizar el arreglo de otras paginas

El dialogo de impacto SHALL ser el unico lugar donde quien construye puede autorizar que la IA modifique paginas distintas de la abierta.

#### Scenario: Autorizar el arreglo

- **WHEN** quien construye elige la opcion de aplicar el cambio y arreglar las paginas afectadas
- **THEN** la IA modifica tambien esas paginas

#### Scenario: Sin autorizacion no se sale de la pagina

- **WHEN** quien construye no elige esa opcion
- **THEN** ninguna pagina distinta de la abierta cambia

### Requirement: Lo aceptado queda como un solo paso

El cambio de la tabla y los cambios de las paginas que se aceptaron en un mismo dialogo SHALL quedar como un unico paso de los cambios, que se pueda deshacer de una vez.

#### Scenario: Deshacer un cambio con impacto

- **WHEN** quien construye deshace el paso creado por un dialogo de impacto
- **THEN** vuelven a la vez la estructura de la tabla y el HTML de las paginas que se tocaron
- **AND** las filas no se tocan
