## Purpose

Define como se le pide algo a la IA, donde quedan guardadas esas peticiones y hasta donde puede llegar la IA en una sola peticion.

## ADDED Requirements

### Requirement: Una sola entrada a la IA

El campo de texto de la barra SHALL ser la unica entrada a la IA. Escribir en el y confirmar SHALL abrir el dialogo de la IA con ese texto ya dentro. El boton de IA SHALL abrir una conversacion nueva vacia.

#### Scenario: Escribir en el campo

- **WHEN** quien construye escribe una peticion en el campo de la barra y confirma
- **THEN** se abre el dialogo de la IA con esa peticion dentro

#### Scenario: Pulsar el boton de IA

- **WHEN** quien construye pulsa el boton de IA
- **THEN** se abre una conversacion nueva y vacia
- **AND** puede llegar desde ahi a las conversaciones anteriores

### Requirement: Las conversaciones pertenecen a la aplicacion

Cada conversacion SHALL guardarse en la aplicacion, no en la pagina. Cada conversacion SHALL registrar en que pagina se hizo y SHALL mostrarlo en la lista.

#### Scenario: Ver las conversaciones anteriores

- **WHEN** quien construye abre la lista de conversaciones desde cualquier pagina
- **THEN** ve las conversaciones de toda la aplicacion
- **AND** cada una indica en que pagina se hizo

#### Scenario: Abrir una conversacion nueva sin perder la anterior

- **WHEN** hay una conversacion en curso y quien construye abre una nueva
- **THEN** la anterior queda guardada y se puede volver a ella

### Requirement: La IA toca una sola pagina por peticion

En una peticion, la IA SHALL escribir unicamente sobre la pagina abierta. SHALL NO crear ni modificar otras paginas, salvo que quien construye lo autorice de forma expresa en el dialogo de impacto.

#### Scenario: Peticion normal

- **WHEN** quien construye pide un cambio estando en una pagina
- **THEN** solo esa pagina cambia

#### Scenario: Peticion que abarca varias paginas

- **WHEN** quien construye pide algo que exigiria cambiar tambien otras paginas
- **THEN** la IA hace lo que puede en la pagina abierta
- **AND** dice que quedo fuera y por que

### Requirement: La IA recibe el contexto de la pagina

Cada peticion SHALL mandar a la IA el contexto armado en ese momento, con los colores, espaciados, tablas, ordenes, quien esta mirando y los limites.

#### Scenario: Peticion despues de cambiar una tabla

- **WHEN** se cambia una tabla y a continuacion se le pide algo a la IA
- **THEN** la IA trabaja con la tabla tal como quedo

### Requirement: Consultar los datos desde la conversacion

Cuando quien construye pregunta por los datos de la aplicacion, la IA SHALL poder consultarlos y responder dentro de la conversacion, sin modificar la pagina.

#### Scenario: Preguntar para que se usa una columna

- **WHEN** quien construye pregunta para que usa una pagina una columna concreta
- **THEN** la IA lo consulta y lo responde
- **AND** la pagina no cambia

### Requirement: Cada peticion queda como un paso de los cambios

Lo que la IA escriba en una peticion SHALL quedar registrado como un solo paso en los cambios de la pagina, con el texto que lo pidio.

#### Scenario: Deshacer lo que hizo la IA

- **WHEN** quien construye no quiere el resultado de la ultima peticion
- **THEN** puede volver al paso anterior de una sola vez
