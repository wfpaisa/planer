## ADDED Requirements

### Requirement: Una columna de persona empareja por cualquier columna unica de personas

Una columna que apunta a personas SHALL poder declarar como columna que enseña, y como llave para emparejar, cualquier columna unica de la tabla de personas de esa aplicacion, y no solo el correo. La busqueda SHALL hacerse unicamente entre las personas invitadas a esa aplicacion.

#### Scenario: Emparejar por documento

- **WHEN** una tabla tiene una columna de persona que enseña el documento y se importa un archivo con documentos
- **THEN** cada fila queda enlazada a la persona cuyo documento coincide

#### Scenario: No emparejar contra quien no esta invitado

- **WHEN** un valor coincide con el de una persona que tiene cuenta pero no esta invitada a esta aplicacion
- **THEN** no se empareja, y la fila queda con el valor sin enlace

#### Scenario: Cambiar la llave de una columna de persona

- **WHEN** el constructor cambia la columna que enseña de correo a documento
- **THEN** la cuadricula y la exportacion pasan a enseñar el documento, sin que se toquen los enlaces guardados
