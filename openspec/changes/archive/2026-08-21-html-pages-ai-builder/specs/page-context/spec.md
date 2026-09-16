## Purpose

Reune en un solo texto todo lo que hay que saber para escribir el HTML de una pagina: colores, espaciados, tablas, ordenes de datos, quien esta mirando y lo prohibido. De ese texto salen la documentacion que lee el constructor y el contexto que recibe la IA, para que nunca se contradigan.

## ADDED Requirements

### Requirement: Un solo texto para la documentacion y para la IA

El sistema SHALL construir el contexto de una pagina desde una unica fuente. La documentacion del constructor y el contexto que se manda a la IA SHALL derivar de esa misma fuente.

#### Scenario: Cambiar como se piden los datos

- **WHEN** cambia la forma de pedir datos y se actualiza la fuente unica
- **THEN** la documentacion del constructor y el contexto de la IA reflejan el cambio a la vez

#### Scenario: La documentacion del constructor

- **WHEN** el constructor consulta como conectarse a la base de datos desde el HTML
- **THEN** encuentra las mismas ordenes y los mismos nombres que recibe la IA

### Requirement: El contexto se arma en el momento

El contexto SHALL construirse en cada peticion con el estado actual de la aplicacion. El sistema SHALL NO guardar el contexto dentro del documento HTML de la pagina.

#### Scenario: Cambiar una tabla y volver a pedir

- **WHEN** se anade una columna a una tabla y despues se hace una peticion a la IA
- **THEN** el contexto ya nombra esa columna

#### Scenario: Borrar una tabla y volver a pedir

- **WHEN** se borra una tabla y despues se hace una peticion a la IA
- **THEN** el contexto ya no la nombra

### Requirement: Contenido del contexto

El contexto SHALL incluir, como minimo: los colores de la paleta de la aplicacion en modo claro y oscuro, los espaciados y tamanos de texto, las tablas de la aplicacion con sus columnas y tipos, las ordenes para listar, obtener, crear, actualizar y borrar con lo que devuelve cada una, y como saber quien esta mirando y que roles tiene.

#### Scenario: Aplicacion con tablas

- **WHEN** se arma el contexto de una aplicacion con tablas
- **THEN** el contexto nombra cada tabla, sus columnas y el tipo de cada columna

#### Scenario: Aplicacion sin tablas

- **WHEN** se arma el contexto de una aplicacion que todavia no tiene tablas
- **THEN** el contexto dice que no hay tablas y que no se llamen las ordenes de datos

### Requirement: El contexto declara los limites

El contexto SHALL declarar de forma explicita lo que el HTML de una pagina no puede hacer: crear su propio inicio de sesion o padron de usuarios, guardar datos en el navegador, y llevar la pantalla a otra direccion.

#### Scenario: Peticion que pide una pantalla de acceso

- **WHEN** se le pide a la IA una pantalla con inicio de sesion propio
- **THEN** la IA no lo escribe y explica que la sesion la pone la plataforma

### Requirement: Los colores se ofrecen, no se imponen

El contexto SHALL entregar los colores y espaciados de la aplicacion como variables disponibles. La IA SHALL decidir si usarlas segun lo que pida el constructor.

#### Scenario: Peticion sin indicaciones de estilo

- **WHEN** el constructor pide una pantalla sin decir nada del aspecto
- **THEN** la pagina usa los colores de la paleta de la aplicacion

#### Scenario: Cambiar la paleta despues

- **WHEN** una pagina usa las variables de la paleta y se cambia la paleta de la aplicacion
- **THEN** la pagina se repinta con los colores nuevos sin editarla

#### Scenario: Peticion con un aspecto propio

- **WHEN** el constructor pide de forma explicita una pantalla con otros colores
- **THEN** la IA puede apartarse de la paleta
