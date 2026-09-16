## ADDED Requirements

### Requirement: Borrar una pagina se lleva lo que era suyo

Al borrar una pagina, el sistema SHALL borrar con ella sus conversaciones con la IA y la constancia de su ultima peticion. SHALL NO quedar nada que nombre una pagina que ya no existe.

El dialogo de confirmacion SHALL decir que las conversaciones de la pagina tambien se borran.

#### Scenario: Borrar una pagina con conversaciones

- **WHEN** el constructor borra una pagina que tenia conversaciones con la IA
- **THEN** esas conversaciones dejan de existir

#### Scenario: Avisar de lo que se lleva

- **WHEN** el constructor pide borrar una pagina que tiene conversaciones
- **THEN** la confirmacion dice que tambien se borran
