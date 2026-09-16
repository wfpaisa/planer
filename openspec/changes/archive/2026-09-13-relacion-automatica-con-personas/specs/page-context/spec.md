## ADDED Requirements

### Requirement: El contexto enumera lo que se sabe de quien mira

El contexto SHALL enumerar, por su nombre, cada dato de la persona que la pagina recibe: su identificador, su nombre, su correo, sus roles y **todas** las columnas propias que la aplicacion tenga en su tabla de personas. Los nombres SHALL ser los reales de esa aplicacion, no una lista fija.

Esos datos SHALL llegar a la pagina en un solo nivel, sin agruparse aparte.

El contexto SHALL decir que una columna puede venir vacia --una persona a la que nadie le rellenó el documento-- y que la pagina tiene que dibujarse bien en ese caso.

#### Scenario: Aplicacion con columnas propias de personas

- **WHEN** se arma el contexto de una aplicacion cuya tabla de personas tiene una columna de documento y otra de cargo
- **THEN** el contexto nombra el documento y el cargo entre lo que se sabe de quien mira

#### Scenario: Aplicacion sin columnas propias

- **WHEN** se arma el contexto de una aplicacion cuya tabla de personas no tiene ninguna columna propia
- **THEN** el contexto nombra solo el identificador, el nombre, el correo y los roles, y no inventa ninguna otra

#### Scenario: Una persona sin ese dato

- **WHEN** se le pide a la IA una pantalla que use el documento de quien mira
- **THEN** la pagina que escribe contempla que ese documento pueda venir vacio

### Requirement: El contexto dice como enseñar solo las filas de quien mira

El contexto SHALL decir que enseñar "lo mio" se hace filtrando en el servidor, pasando el filtro en la propia orden de listar, y SHALL decir expresamente que no se hace trayendo todas las filas y descartandolas al pintar.

El contexto SHALL decir que el valor por el que se filtra es el dato de la persona que corresponda a la llave de esa tabla, y que la llave puede ser distinta en cada tabla.

El contexto SHALL NO decir que "lo mio" se resuelve comparando el identificador de quien mira.

El contexto SHALL advertir que ese filtro decide lo que se enseña y no lo que se puede alcanzar, igual que ya advierte de lo mismo para los roles.

#### Scenario: Dos tablas que enlazan por llaves distintas

- **WHEN** se le pide a la IA una pantalla con las filas de quien mira, en una aplicacion donde una tabla apunta a personas por el correo y otra por el documento
- **THEN** la pagina filtra cada tabla por su propia llave

#### Scenario: Filtrar no es descartar al pintar

- **WHEN** se le pide a la IA una pantalla con las filas de quien mira
- **THEN** la pagina pide al servidor solo esas filas, y no la tabla entera

#### Scenario: Quien llega sin sesion

- **WHEN** una pagina que enseña "lo mio" se abre sin cuenta
- **THEN** no hay nada que sea "lo mio", y la pagina dibuja el caso general

#### Scenario: Confiar en el filtro como barrera

- **WHEN** se le pide a la IA que unos datos "solo los pueda ver" cada quien de si mismo
- **THEN** la IA lo implementa y advierte de que el filtro decide lo que se enseña, no lo que se puede pedir
- **AND** explica que lo que si cierra el paso es marcar la aplicacion como privada

### Requirement: El contexto dice como se nombra a una persona en una pagina

El contexto SHALL fijar como se presenta a una persona cuando quien construye no ha dicho otra cosa:

- SHALL usarse su nombre, y su apellido si la aplicacion tiene una columna para el.
- Un segundo dato --su documento, su correo-- SHALL añadirse solo cuando distinga a dos personas que se leen igual o cuando la pantalla trate justo de ese dato, y SHALL ir en letra mas pequeña y apagada.
- El identificador SHALL NO enseñarse nunca.

Lo que el constructor haya pedido enseñar SHALL prevalecer sobre lo anterior.

El contexto SHALL decir ademas que la cuadricula del constructor hace lo contrario a proposito --el valor por delante y la persona detras, porque ahi el valor es lo que se corrige-- para que no se tome por una incoherencia.

#### Scenario: Una lista de personas sin instrucciones

- **WHEN** se le pide a la IA una pantalla que liste personas, sin decir que enseñar de ellas
- **THEN** la pagina enseña el nombre, y el identificador no aparece

#### Scenario: Una pantalla que trata de documentos

- **WHEN** se le pide a la IA una pantalla de control de documentos
- **THEN** la pagina enseña el nombre y, debajo y en letra pequeña, el documento

#### Scenario: El constructor dice que enseñar

- **WHEN** se le pide a la IA que en esa pantalla se vea el correo de cada persona
- **THEN** la pagina enseña el correo, sin que la regla por defecto lo impida

## MODIFIED Requirements

### Requirement: Contenido del contexto

El contexto SHALL incluir, como minimo: los colores de la paleta de la aplicacion en modo claro y oscuro, los espaciados y tamanos de texto, las tablas de la aplicacion con sus columnas y tipos, las ordenes para listar, obtener, crear, actualizar y borrar con lo que devuelve cada una, como saber quien esta mirando y que roles tiene, los roles que la aplicacion define y que roles tiene marcados la pagina que se esta escribiendo. Para cada columna que apunte a otra tabla SHALL decir ademas a que tabla apunta, que columna enseña --que es tambien la llave por la que empareja--, que una fila puede venir sin enlace y que la columna que enseña esta siempre presente.

El contexto SHALL explicar ademas los nombres de bloque: que un elemento puede llevar un nombre estable, que ese nombre es lo que permite editarlo sin rehacer la pagina, y que conviene ponerselo con significado a lo que se edita.

#### Scenario: Aplicacion con tablas

- **WHEN** se arma el contexto de una aplicacion con tablas
- **THEN** el contexto nombra cada tabla, sus columnas y el tipo de cada columna

#### Scenario: Aplicacion sin tablas

- **WHEN** se arma el contexto de una aplicacion que todavia no tiene tablas
- **THEN** el contexto dice que no hay tablas y que no se llamen las ordenes de datos

#### Scenario: Tabla con una columna de relacion

- **WHEN** se arma el contexto de una tabla con una columna que apunta a otra tabla
- **THEN** el contexto dice a que tabla apunta, que columna enseña y que puede llegar sin enlace

#### Scenario: Tabla que apunta a las personas

- **WHEN** se arma el contexto de una tabla con una columna que apunta a la tabla de personas
- **THEN** el contexto la describe igual que cualquier otra relacion, nombrando la tabla de personas como destino

#### Scenario: Tabla con alcances declarados por rol

- **WHEN** se arma el contexto de una aplicacion cuyas tablas traian alcances declarados por rol de antes de este cambio
- **THEN** el contexto no los menciona, porque ya no se aplican

#### Scenario: Tabla sin alcances declarados

- **WHEN** se arma el contexto de cualquier tabla
- **THEN** el contexto dice que quien puede abrir la pagina alcanza todas sus filas

#### Scenario: Aplicacion con roles definidos

- **WHEN** se arma el contexto de una aplicacion que define varios roles
- **THEN** el contexto los nombra tal como estan escritos, para compararlos contra los roles de quien mira

#### Scenario: Pagina limitada a ciertos roles

- **WHEN** se arma el contexto de una pagina que tiene marcados uno o mas roles
- **THEN** el contexto dice cuales son y que quien la abre tiene alguno de ellos

#### Scenario: Pagina abierta a todos

- **WHEN** se arma el contexto de una pagina con `Todos` marcada en una aplicacion publica
- **THEN** el contexto dice que quien mira puede llegar sin cuenta, y que la pagina tiene que dibujarse bien en ese caso

#### Scenario: Explicar los nombres de bloque

- **WHEN** se arma el contexto de cualquier pagina
- **THEN** explica que es un nombre de bloque y para que sirve
- **AND** dice que se le pone a lo que se edita, no a todo el documento
