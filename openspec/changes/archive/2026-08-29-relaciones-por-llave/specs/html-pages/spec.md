## ADDED Requirements

### Requirement: Una celda de relacion llega resuelta al documento

Cuando el puente de datos entrega una fila al documento HTML, una celda de tipo persona o relacion SHALL llegar con el valor de la columna que esa relacion enseña siempre presente, y con los datos del registro enlazado cuando lo haya. Cuando no hay enlace, el valor SHALL seguir presente y los datos del registro SHALL llegar vacios. El puente SHALL NO entregar el id del registro como unico contenido de la celda.

#### Scenario: Fila con enlace

- **WHEN** el documento pide una tabla con una columna de relacion y la fila esta enlazada
- **THEN** la celda llega con el valor de la columna que enseña y con los datos del registro enlazado

#### Scenario: Fila sin enlace

- **WHEN** el documento pide una tabla con una columna de relacion y la fila no esta enlazada
- **THEN** la celda llega con el valor tal como se guardo y los datos del registro vacios

#### Scenario: Pintar una fila sin enlace

- **WHEN** una pagina escribe el nombre del registro enlazado y la fila no tiene enlace
- **THEN** ese hueco sale vacio y el resto de la fila se pinta igual, sin que la pagina falle

#### Scenario: Contar filas sin enlace

- **WHEN** una pagina agrupa o suma filas por una columna de relacion usando el valor que enseña
- **THEN** las filas sin enlace entran en el recuento con su valor, y el total coincide con el de la tabla

### Requirement: Solo llegan las columnas declaradas del registro enlazado

De un registro enlazado SHALL llegar unicamente lo que la pagina tenga declarado, igual que ocurre con las columnas de la tabla que se pide. El puente SHALL rechazar la peticion de una columna del registro enlazado que no este declarada.

#### Scenario: Columna del enlace no declarada

- **WHEN** una pagina pide de un registro enlazado una columna que no declaro
- **THEN** esa columna no llega y la peticion se rechaza con el mismo mensaje que una fuente no declarada
