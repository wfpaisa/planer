## MODIFIED Requirements

### Requirement: Contenido del contexto

El contexto SHALL incluir, como minimo: los colores de la paleta de la aplicacion en modo claro y oscuro, los espaciados y tamanos de texto, las tablas de la aplicacion con sus columnas y tipos, las ordenes para listar, obtener, crear, actualizar y borrar con lo que devuelve cada una, como saber quien esta mirando y que roles tiene, los roles que la aplicacion define y que roles tiene marcados la pagina que se esta escribiendo. Para cada columna de persona o relacion SHALL decir ademas a que tabla apunta, que columna enseña, que una fila puede venir sin enlace y que la columna que enseña esta siempre presente.

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

## ADDED Requirements

### Requirement: El contexto dice que los roles son para ajustar la pantalla

El contexto SHALL decir que los roles de quien mira sirven para decidir que se le muestra, y que ajustar la pantalla por rol se hace dentro de la pagina comparando contra los roles de quien mira.

El contexto SHALL decir tambien que lo que se esconde por rol no queda protegido: los datos de las tablas que la pagina declara llegan enteros al navegador de cualquiera que pueda abrirla. Esconder un boton SHALL presentarse como una decision de presentacion, nunca como una barrera.

#### Scenario: Peticion de esconder algo por rol

- **WHEN** se le pide a la IA que un boton solo lo vea un rol
- **THEN** la pagina que escribe comprueba el rol de quien mira antes de dibujarlo

#### Scenario: Peticion que confia en el rol como barrera

- **WHEN** se le pide a la IA que unos datos "solo los pueda ver" un rol dentro de una pagina abierta a todos
- **THEN** la IA lo implementa y advierte de que esconderlos no impide que lleguen al navegador
- **AND** explica que para impedirlo hay que limitar la pagina a ese rol

### Requirement: El contexto advierte de que guardar exige cuenta

El contexto SHALL decir que crear, actualizar y borrar exigen una sesion iniciada, y que la plataforma avisa por su cuenta cuando alguien sin sesion lo intenta. La pagina SHALL NO tener que escribir ese aviso.

La IA SHALL advertirlo al construir una pagina que guarda datos y que puede abrirse sin cuenta, nombrando lo que va a pasar cuando alguien sin sesion intente guardar.

#### Scenario: Pagina abierta a todos con un formulario

- **WHEN** se le pide a la IA un formulario en una pagina abierta a `Todos`
- **THEN** la IA lo construye
- **AND** advierte de que quien llegue sin cuenta vera un aviso pidiendo iniciar sesion al guardar

#### Scenario: La pagina no escribe el aviso

- **WHEN** la IA construye una pagina que guarda datos
- **THEN** no escribe su propio mensaje de "inicia sesion", porque lo pone la plataforma

## REMOVED Requirements

### Requirement: El contexto advierte de lo que no va a llegar

**Reason**: El aviso describia un sistema donde el servidor recortaba las filas segun quien mirara. Ya no las recorta: quien puede abrir una pagina recibe todas las filas de las tablas que esa pagina declara, y el total que las acompaña las cuenta todas. Seguir advirtiendo de un recorte que no ocurre haria que la IA escribiera paginas defendiendose de algo inexistente.

**Migration**: Lo que sustituye a este aviso es el requisito "El contexto dice que los roles son para ajustar la pantalla", que le cuenta a la IA lo que si es cierto ahora: que puede contar con recibir todo, y que lo que esconda por rol es presentacion y no barrera.
