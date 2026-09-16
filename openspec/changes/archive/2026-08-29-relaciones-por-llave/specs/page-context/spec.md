## MODIFIED Requirements

### Requirement: Contenido del contexto

El contexto SHALL incluir, como minimo: los colores de la paleta de la aplicacion en modo claro y oscuro, los espaciados y tamanos de texto, las tablas de la aplicacion con sus columnas y tipos, las ordenes para listar, obtener, crear, actualizar y borrar con lo que devuelve cada una, y como saber quien esta mirando y que roles tiene. Para cada columna de persona o relacion SHALL decir ademas a que tabla apunta, que columna enseña, que una fila puede venir sin enlace y que la columna que enseña esta siempre presente.

#### Scenario: Aplicacion con tablas

- **WHEN** se arma el contexto de una aplicacion con tablas
- **THEN** el contexto nombra cada tabla, sus columnas y el tipo de cada columna

#### Scenario: Aplicacion sin tablas

- **WHEN** se arma el contexto de una aplicacion que todavia no tiene tablas
- **THEN** el contexto dice que no hay tablas y que no se llamen las ordenes de datos

#### Scenario: Tabla con una columna de relacion

- **WHEN** se arma el contexto de una tabla con una columna de persona o relacion
- **THEN** el contexto dice a que tabla apunta, que columna enseña y que puede llegar sin enlace

## ADDED Requirements

### Requirement: El contexto dice como se pinta y se cuenta una fila sin enlace

El contexto SHALL indicar que para agrupar, contar o comparar filas se use el valor de la columna que enseña la relacion y no el id del registro enlazado, para que las filas sin enlace no desaparezcan de los totales. SHALL indicar tambien una unica forma de pintar una fila sin enlace, de modo que todas las paginas de la aplicacion la muestren igual.

#### Scenario: Escribir una grafica sobre una columna de relacion

- **WHEN** la IA escribe una grafica que agrupa por una columna de persona o relacion
- **THEN** agrupa por el valor que enseña esa columna, y las filas sin enlace aparecen con su valor

#### Scenario: Escribir una lista con filas sin enlace

- **WHEN** la IA escribe una pantalla que lista filas de una tabla con una columna de relacion
- **THEN** las filas sin enlace se pintan de la forma que indica el contexto, sin inventar una distinta en cada pagina
