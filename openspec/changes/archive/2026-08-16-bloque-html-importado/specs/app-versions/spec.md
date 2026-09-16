## ADDED Requirements

### Requirement: Una version guarda la referencia del HTML, no su contenido

Una fotografia SHALL guardar de un bloque de HTML solo la referencia a su contenido y su manifiesto. El contenido SHALL guardarse una sola vez, compartido por todas las versiones que lo nombren.

#### Scenario: Publicar varias veces sin tocar el HTML

- **WHEN** el constructor publica cinco veces seguidas y el contenido de un bloque de HTML no cambio
- **THEN** ese contenido sigue guardado una sola vez

#### Scenario: Restaurar una version con otro contenido

- **WHEN** el constructor restaura una version en la que un bloque de HTML tenia otro contenido
- **THEN** el borrador vuelve a ese contenido
- **AND** el bloque se dibuja con el

### Requirement: El contenido HTML se conserva mientras alguna version lo nombre

El contenido HTML SHALL conservarse mientras el borrador o cualquier version del historial lo nombren. SHALL eliminarse solo cuando deje de estar nombrado en todos ellos.

#### Scenario: Cambiar el contenido no rompe el historial

- **WHEN** el constructor reemplaza el contenido de un bloque de HTML que aparece en una version anterior
- **THEN** esa version anterior sigue pudiendo previsualizarse con su contenido

#### Scenario: Recorte del historial

- **WHEN** el recorte automatico elimina las versiones que eran las ultimas en nombrar un contenido
- **THEN** ese contenido se elimina tambien

#### Scenario: Contenido descartado

- **WHEN** el constructor descarta el resultado de la varita magica
- **THEN** el contenido candidato deja de estar nombrado
- **AND** se elimina en el siguiente recorte
