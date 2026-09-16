## MODIFIED Requirements

### Requirement: Contenido del contexto

El contexto SHALL incluir, como minimo: los colores de la paleta de la aplicacion en modo claro y oscuro, los espaciados y tamanos de texto, las tablas de la aplicacion con sus columnas y tipos, las ordenes para listar, obtener, crear, actualizar y borrar con lo que devuelve cada una, como saber quien esta mirando y que roles tiene, y que filas de cada tabla alcanza cada rol y que puede hacer con ellas. Para cada columna de persona o relacion SHALL decir ademas a que tabla apunta, que columna enseña, que una fila puede venir sin enlace y que la columna que enseña esta siempre presente.

El contexto SHALL explicar ademas los nombres de bloque: que un elemento puede llevar un nombre estable, que ese nombre es lo que permite editarlo sin rehacer la pagina, y que conviene ponerselo con significado a lo que se edita.

#### Scenario: Aplicacion con tablas

- **WHEN** se arma el contexto de una aplicacion con tablas
- **THEN** el contexto nombra cada tabla, sus columnas y el tipo de cada columna

#### Scenario: Aplicacion sin tablas

- **WHEN** se arma el contexto de una aplicacion que todavia no tiene tablas
- **THEN** el contexto dice que no hay tablas y que no se llamen las ordenes de datos

#### Scenario: Tabla con una columna de relacion

- **WHEN** se arma el contexto de una tabla con una columna de persona o relacion
- **THEN** el contexto dice a que tabla apunta, que columna enseña y que puede llegar sin enlace

#### Scenario: Tabla con alcances declarados por rol

- **WHEN** se arma el contexto de una pagina cuya tabla declara que un rol alcanza todas las filas y otro solo las suyas
- **THEN** el contexto lo dice para cada rol, con la columna que conecta la fila con quien mira

#### Scenario: Tabla sin alcances declarados

- **WHEN** se arma el contexto de una pagina cuya tabla no declara ningun alcance por rol
- **THEN** el contexto dice que todos los invitados alcanzan todas las filas

#### Scenario: Explicar los nombres de bloque

- **WHEN** se arma el contexto de cualquier pagina
- **THEN** explica que es un nombre de bloque y para que sirve
- **AND** dice que se le pone a lo que se edita, no a todo el documento

## ADDED Requirements

### Requirement: El contexto dice cuando usar el bisturi

El contexto SHALL decir que un cambio localizado se hace editando el bloque que le corresponde, y que rehacer el documento entero se reserva para cuando cambia la estructura de la pantalla.

#### Scenario: Contexto de una pagina ya construida

- **WHEN** se arma el contexto de una pagina que ya tiene contenido
- **THEN** explica que para un cambio localizado se edita el bloque
- **AND** que rehacer la pagina entera es para cuando cambia la estructura
