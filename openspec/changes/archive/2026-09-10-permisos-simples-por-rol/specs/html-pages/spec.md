## MODIFIED Requirements

### Requirement: Quien puede ver una pagina

Quién puede abrir una página SHALL decidirse en dos sitios que no se repiten.

La aplicación SHALL declarar una sola cosa: si es pública o si requiere iniciar sesión. Cuando requiere iniciar sesión, ninguna de sus páginas SHALL abrirse sin cuenta.

Cada página SHALL declarar qué roles pueden abrirla, como una lista de marcas. La lista SHALL incluir una marca `Todos` y una marca por cada rol que la aplicación define. `Todos` SHALL venir marcada por defecto y SHALL ser excluyente con las demás: marcar un rol la desmarca, y desmarcar el último rol la vuelve a marcar. Entre roles SHALL poder marcarse varios a la vez.

Con `Todos` marcada, la página SHALL abrirse a cualquiera que alcance la aplicación. Con uno o más roles marcados, la página SHALL exigir sesión iniciada y uno de esos roles, aunque la aplicación sea pública.

Lo declarado SHALL aplicarse en el servidor. Una página que quien pregunta no puede abrir SHALL NO entregar su contenido ni sus datos.

#### Scenario: Pagina abierta a cualquiera

- **WHEN** alguien sin cuenta abre una pagina con `Todos` marcada de una aplicacion publica
- **THEN** la ve

#### Scenario: Pagina que exige sesion

- **WHEN** alguien sin cuenta abre cualquier pagina de una aplicacion que requiere iniciar sesion
- **THEN** se le pide entrar
- **AND** al entrar se le muestra la pagina que pedia

#### Scenario: Pagina limitada por rol

- **WHEN** alguien sin el rol exigido abre una pagina que tiene ese rol marcado
- **THEN** no recibe el contenido de la pagina
- **AND** si llego sin cuenta, se le pide entrar

#### Scenario: Pagina limitada a varios roles

- **WHEN** una pagina tiene marcados los roles `admin` y `jefe`
- **THEN** la abre quien tenga cualquiera de los dos
- **AND** quien tenga solo el rol `vendedor` no recibe su contenido

#### Scenario: Marcar un rol desmarca Todos

- **WHEN** el constructor marca el rol `jefe` en una pagina que tenia `Todos`
- **THEN** `Todos` queda desmarcada y la pagina pasa a exigir ese rol

#### Scenario: Desmarcar el ultimo rol vuelve a Todos

- **WHEN** el constructor desmarca el unico rol marcado de una pagina
- **THEN** `Todos` vuelve a quedar marcada

#### Scenario: El servidor manda

- **WHEN** se pide directamente el contenido de una pagina para la que no se tiene permiso
- **THEN** el servidor no lo entrega, aunque el sidebar no la mostrara

## ADDED Requirements

### Requirement: Una página nueva se abre a todos

Una página recién creada SHALL nacer con `Todos` marcada. Limitar quién la abre SHALL ser un añadido, no un paso previo para poder usarla.

#### Scenario: Crear una página y publicarla

- **WHEN** el constructor crea una página y publica la aplicación sin abrir sus opciones
- **THEN** la página se abre a cualquiera que alcance la aplicación
