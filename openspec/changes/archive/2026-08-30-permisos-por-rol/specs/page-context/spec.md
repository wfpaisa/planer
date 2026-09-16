## MODIFIED Requirements

### Requirement: Contenido del contexto

El contexto SHALL incluir, como mínimo: los colores de la paleta de la aplicación en modo claro y oscuro, los espaciados y tamaños de texto, las tablas de la aplicación con sus columnas y tipos, las órdenes para listar, obtener, crear, actualizar y borrar con lo que devuelve cada una, cómo saber quién está mirando y qué roles tiene, y qué filas de cada tabla alcanza cada rol y qué puede hacer con ellas.

#### Scenario: Aplicacion con tablas

- **WHEN** se arma el contexto de una aplicación con tablas
- **THEN** el contexto nombra cada tabla, sus columnas y el tipo de cada columna

#### Scenario: Aplicacion sin tablas

- **WHEN** se arma el contexto de una aplicación que todavía no tiene tablas
- **THEN** el contexto dice que no hay tablas y que no se llamen las órdenes de datos

#### Scenario: Tabla con alcances declarados por rol

- **WHEN** se arma el contexto de una página cuya tabla declara que un rol alcanza todas las filas y otro sólo las suyas
- **THEN** el contexto lo dice para cada rol, con la columna que conecta la fila con quien mira

#### Scenario: Tabla sin alcances declarados

- **WHEN** se arma el contexto de una página cuya tabla no declara ningún alcance por rol
- **THEN** el contexto dice que todos los invitados alcanzan todas las filas

## ADDED Requirements

### Requirement: El contexto advierte de lo que no va a llegar

El contexto SHALL advertir que una página puede pedir datos y recibir menos de lo que espera, porque el permiso lo aplica el servidor según quién mire. El contexto SHALL indicar que la página se escribe para funcionar con una lista vacía y para no dar por hecho que una fila creada por otra persona está al alcance.

#### Scenario: Petición de una pantalla para un rol con alcance limitado

- **WHEN** se le pide a la IA una pantalla para un rol que sólo alcanza sus propias filas
- **THEN** la página que escribe funciona sin errores cuando ese rol todavía no tiene ninguna fila

#### Scenario: Petición de una pantalla que cuenta filas

- **WHEN** se le pide a la IA una pantalla con un total o una estadística sobre una tabla
- **THEN** la IA no da por hecho que el total abarca todas las filas de la tabla, sino las que alcanza quien mira
