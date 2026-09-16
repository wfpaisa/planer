## MODIFIED Requirements

### Requirement: Posicion y comportamiento se ajustan una vez

La posicion del sidebar (izquierda o derecha) SHALL elegirse en los ajustes de la aplicacion y SHALL valer para todos. El comportamiento (anclado o flotante) SHALL dejar de ser un ajuste de la aplicacion y pasar a ser una preferencia de cada persona, elegida desde el propio sidebar y recordada por aplicacion en su navegador. Anclado SHALL ocupar su espacio junto al documento; flotante SHALL dibujarse encima sin quitarle espacio. Dentro de la pagina, cualquiera SHALL poder plegarlo y desplegarlo.

#### Scenario: Cambiar la posicion

- **WHEN** quien construye pone el sidebar a la derecha en los ajustes de la aplicacion
- **THEN** todas las paginas lo muestran a la derecha, tambien para los visitantes

#### Scenario: Anclar el sidebar

- **WHEN** alguien ancla el sidebar desde el propio sidebar
- **THEN** ocupa su espacio y el documento se dibuja en lo que queda
- **AND** sigue anclado la proxima vez que esa persona abra esa aplicacion

#### Scenario: Desplegar el sidebar flotante

- **WHEN** alguien despliega el sidebar sin anclarlo
- **THEN** aparece encima del documento
- **AND** el documento no cambia de tamano

#### Scenario: Plegar el sidebar

- **WHEN** alguien pliega el sidebar
- **THEN** queda una forma visible de desplegarlo
- **AND** el documento ocupa toda la ventana

## ADDED Requirements

### Requirement: El sidebar empieza plegado

El sidebar SHALL empezar plegado la primera vez que alguien abre una aplicacion, para que el documento se vea completo. Despues SHALL recordar por aplicacion si esa persona lo dejo plegado o desplegado.

#### Scenario: Primera visita a una aplicacion

- **WHEN** alguien abre una aplicacion por primera vez
- **THEN** el sidebar aparece plegado

#### Scenario: Se recuerda la eleccion

- **WHEN** alguien despliega el sidebar y vuelve mas tarde a la misma aplicacion
- **THEN** el sidebar aparece desplegado

### Requirement: Elegir una pagina pliega el sidebar flotante

Cuando el sidebar esta flotando encima del documento y alguien elige una pagina, el sidebar SHALL plegarse solo, para devolver la vista completa al documento. Anclado SHALL quedarse donde esta: para eso se anclo.

#### Scenario: Navegar con el sidebar flotante desplegado

- **WHEN** alguien elige otra pagina con el sidebar flotante desplegado
- **THEN** se abre esa pagina
- **AND** el sidebar se pliega

#### Scenario: Navegar con el sidebar anclado

- **WHEN** alguien elige otra pagina con el sidebar anclado
- **THEN** se abre esa pagina
- **AND** el sidebar sigue visible en su sitio
