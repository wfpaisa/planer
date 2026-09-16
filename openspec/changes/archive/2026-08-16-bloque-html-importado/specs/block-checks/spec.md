## ADDED Requirements

### Requirement: Revision de los bloques de HTML

La revision de referencias SHALL cubrir tambien los bloques de HTML, a traves de las fuentes declaradas en su manifiesto. Una fuente cuya tabla ya no existe SHALL dar un aviso de nivel `broken`; una columna declarada que ya no existe SHALL dar un aviso de nivel `warning` que nombre la fuente y el nombre logico afectado.

#### Scenario: Tabla de una fuente eliminada

- **WHEN** se elimina una tabla declarada en el manifiesto de un bloque de HTML y se revisa la app
- **THEN** aparece un aviso de nivel `broken` con el nombre de la pagina y del bloque

#### Scenario: Columna de una fuente eliminada

- **WHEN** se elimina una columna declarada en el manifiesto de un bloque de HTML y se revisa la app
- **THEN** aparece un aviso de nivel `warning` que nombra la fuente y el nombre logico afectado

#### Scenario: Bloque de HTML sin fuentes

- **WHEN** un bloque de HTML no declara ninguna fuente y se revisa la app
- **THEN** no genera ningun aviso

### Requirement: Los bloques de HTML no necesitan arreglo automatico

Renombrar una tabla o una columna SHALL NOT modificar el contenido ni el manifiesto de un bloque de HTML, y SHALL NOT generar avisos informativos por ese bloque.

#### Scenario: Renombrar una columna que declara un bloque de HTML

- **WHEN** cambia el nombre de una columna declarada en el manifiesto de un bloque de HTML
- **THEN** el manifiesto queda igual
- **AND** no se anade ningun aviso informativo por ese bloque
- **AND** el bloque sigue recibiendo esa columna

### Requirement: Bloque de HTML roto segun quien mira

Un bloque de HTML cuya fuente perdio la tabla SHALL mostrar en el editor y en la vista previa un mensaje que diga que esa tabla ya no existe. En la app publicada ese bloque SHALL omitirse sin ninguna marca.

#### Scenario: El constructor ve el problema

- **WHEN** el constructor abre una pagina con un bloque de HTML cuya tabla fue eliminada
- **THEN** ve un mensaje que dice que esa tabla ya no existe

#### Scenario: El visitante no ve el bloque roto

- **WHEN** un visitante abre esa misma pagina en el enlace publico
- **THEN** el bloque no se muestra
- **AND** el resto de la pagina se muestra normal

#### Scenario: Falta solo una columna

- **WHEN** a un bloque de HTML le falta una columna declarada pero su tabla existe
- **THEN** el bloque se muestra en el enlace publico
- **AND** las ordenes de datos responden sin esa columna
