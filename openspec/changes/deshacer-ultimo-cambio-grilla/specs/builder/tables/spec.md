## ADDED Requirements

### Requirement: Deshacer la última escritura hecha desde la cuadrícula

La cuadrícula SHALL recordar la última escritura hecha desde ella —pegar un rango, vaciarlo o escribir una celda— y SHALL ofrecer deshacerla. Deshacer SHALL devolver a cada celda tocada el valor que tenía justo antes de esa escritura, y SHALL borrar las filas que esa escritura hizo nacer.

Se SHALL recordar un solo nivel: deshacer no se encadena y no hay rehacer.

Deshacer SHALL ofrecerse desde dos sitios: un botón **Deshacer** en la barra de herramientas de la tabla, a la derecha de Roles en la tabla de personas y de Refrescar en cualquier otra, y el atajo `Ctrl+Z` en Windows y Linux o `Cmd+Z` en Mac, con el foco en la cuadrícula. El botón SHALL mostrarse solo cuando hay algo que deshacer, y SHALL desaparecer cuando no lo hay. El atajo SHALL NO actuar mientras hay una celda abierta para escribir: ahí es el deshacer del propio campo de texto.

El resultado de deshacer SHALL contarse igual que el de la escritura que revierte: cuántas celdas volvieron, cuántas filas se borraron y qué quedó fuera.

#### Scenario: Deshacer un pegado sobre filas que ya existían

- **WHEN** el constructor pega un rango sobre filas existentes y toca Deshacer
- **THEN** cada celda del área pegada vuelve al valor que tenía antes del pegado

#### Scenario: Deshacer un pegado que creó filas

- **WHEN** el constructor pega un rango eligiendo crear las filas que sobraban y luego deshace
- **THEN** las filas nacidas se borran y las celdas de las filas que ya existían vuelven a su valor anterior

#### Scenario: Deshacer un vaciado

- **WHEN** el constructor vacía un rango con Delete y toca Deshacer
- **THEN** las celdas vaciadas recuperan el valor que tenían

#### Scenario: Deshacer la escritura de una celda

- **WHEN** el constructor escribe una celda y pulsa `Ctrl+Z` con el foco en la cuadrícula
- **THEN** la celda vuelve a su valor anterior

#### Scenario: Sin nada que deshacer no hay botón

- **WHEN** el constructor abre una tabla y todavía no ha escrito nada desde la cuadrícula
- **THEN** el botón de deshacer no está en la barra

#### Scenario: Deshacer solo una vez

- **WHEN** el constructor deshace una escritura y vuelve a pulsar el atajo sin haber escrito nada más
- **THEN** no se deshace nada más y el botón desaparece de la barra

#### Scenario: El atajo no se roba al editar una celda

- **WHEN** el constructor tiene una celda abierta para escribir y pulsa `Ctrl+Z`
- **THEN** se deshace lo tecleado en esa celda y la última escritura guardada sigue disponible para deshacer

#### Scenario: Una relación vuelve enlazada como estaba

- **WHEN** el constructor pega sobre una columna que apunta a otra tabla y deshace
- **THEN** la celda vuelve a apuntar al mismo registro al que apuntaba antes, o a quedar con el valor sin enlace que tenía

#### Scenario: Deshacer que no entra entero

- **WHEN** alguna fila no acepta la vuelta atrás
- **THEN** el resto vuelve igual y se dice cuántas filas quedaron fuera

### Requirement: Cuándo se olvida lo que se puede deshacer

Lo recordado SHALL descartarse cuando deja de ser fiable escribirlo de vuelta: al cambiar de tabla, al cambiar de página, de filtro, de búsqueda o de orden, al cambiar las columnas de la tabla, al importar, al borrar filas seleccionadas y después de deshacer una vez.

Lo recordado SHALL identificar cada fila por su identificador y no por su sitio en la pantalla, de modo que reordenar o filtrar no haga que la vuelta atrás caiga sobre otras filas.

Deshacer SHALL escribir de nuevo sobre la tabla, sin comprobar si alguien más tocó esas filas mientras tanto. Esto SHALL declararse como límite conocido: lo que lo acota es que lo recordado se descarta en cuanto la cuadrícula hace cualquier otra cosa.

#### Scenario: Cambiar de página olvida lo recordado

- **WHEN** el constructor pega un rango y luego cambia de página, de filtro, de búsqueda o de orden
- **THEN** el botón de deshacer desaparece y el atajo deja de hacer nada

#### Scenario: Cambiar de tabla olvida lo recordado

- **WHEN** el constructor pega un rango y abre otra tabla
- **THEN** el botón de deshacer desaparece y el atajo deja de hacer nada

#### Scenario: Cambiar las columnas olvida lo recordado

- **WHEN** el constructor pega un rango y luego añade, borra o cambia una columna de la tabla
- **THEN** el botón de deshacer desaparece y el atajo deja de hacer nada

#### Scenario: Ordenar no desplaza la vuelta atrás

- **WHEN** las filas se ven en otro orden que cuando se escribió
- **THEN** deshacer no se ofrece, y nunca escribe sobre filas distintas de las que tocó la escritura

### Requirement: Qué no se puede deshacer desde la cuadrícula

El borrado de las filas seleccionadas SHALL NO poder deshacerse: se resuelve en el servidor aplicando la conducta declarada por cada columna, que puede borrar filas de otras tablas. Su diálogo de confirmación sigue siendo la única barrera.

La importación y los cambios de estructura de la tabla SHALL NO poder deshacerse desde la cuadrícula.

Las columnas de la tabla de personas que no viven en la colección —el correo, el nivel y los roles— SHALL NO poder deshacerse: se escriben por la puerta de los miembros de la aplicación, no por la de las filas.

#### Scenario: Borrar filas no ofrece deshacer

- **WHEN** el constructor borra las filas seleccionadas
- **THEN** el botón de deshacer no aparece y el aviso del borrado no cambia

#### Scenario: Importar no ofrece deshacer

- **WHEN** el constructor importa un archivo sobre la tabla abierta
- **THEN** el botón de deshacer no aparece

#### Scenario: El correo de una persona no ofrece deshacer

- **WHEN** el constructor cambia desde su celda el correo, el nivel o los roles de una fila de personas
- **THEN** el botón de deshacer no aparece para ese cambio
