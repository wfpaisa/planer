## Purpose

Decide qué filas de cada tabla alcanza cada rol de una aplicación y qué puede hacer con ellas, lo aplica en el servidor antes de entregar ningún dato, y lo cuenta en español para que quien construye pueda confirmarlo sin interpretar una cuadrícula.

## ADDED Requirements

### Requirement: Alcance por rol en cada tabla

Una tabla SHALL poder declarar, para cada rol de la aplicación, qué filas alcanza ese rol. El alcance SHALL ser uno de tres: `todas`, `las mías` o `ninguna`. Cuando el alcance es `las mías`, la declaración SHALL nombrar la columna de tipo persona que conecta la fila con quien mira.

Una tabla SHALL poder declarar alcances distintos para distintos roles.

#### Scenario: Un rol alcanza todas las filas y otro sólo las suyas

- **WHEN** la tabla de multas declara `todas` para el rol gestor y `las mías` por la columna conductor para el rol conductor
- **THEN** el gestor recibe todas las multas
- **AND** el conductor recibe sólo las multas donde la columna conductor lo nombra a él

#### Scenario: Un rol no alcanza ninguna fila

- **WHEN** la tabla de agendas declara `ninguna` para el rol auxiliar
- **THEN** el auxiliar recibe una lista vacía al pedir agendas
- **AND** no puede obtener una agenda concreta ni siquiera conociendo su identificador

#### Scenario: La columna que conecta no es de tipo persona

- **WHEN** se declara `las mías` nombrando una columna que no es de tipo persona
- **THEN** el sistema rechaza la declaración y explica que la conexión se hace con una columna de tipo persona

#### Scenario: Una tabla con dos columnas de persona

- **WHEN** la tabla de agendas tiene las columnas odontólogo y conductor, y declara `las mías` por odontólogo para el rol odontólogo y `las mías` por conductor para el rol conductor
- **THEN** cada rol recibe las filas donde su propia columna lo nombra

### Requirement: Leer y escribir se declaran por separado

El alcance de lectura y el alcance de escritura de un rol sobre una tabla SHALL declararse de forma independiente. Un rol SHALL poder alcanzar más filas para leer que para escribir.

#### Scenario: Ver todas las reservas y mover sólo la propia

- **WHEN** la tabla de reservas declara para el rol empleado alcance de lectura `todas` y alcance de escritura `las mías` por la columna reservado_por
- **THEN** el empleado ve todas las reservas de salas
- **AND** sólo puede cambiar o borrar aquellas donde la columna reservado_por lo nombra a él

#### Scenario: Escribir más allá de lo que se lee

- **WHEN** se declara para un rol un alcance de escritura más amplio que el de lectura
- **THEN** el sistema rechaza la declaración y explica que no se puede cambiar una fila que no se puede ver

### Requirement: Escalera de acciones

Lo que un rol puede hacer con las filas que alcanza SHALL elegirse de una escalera de cinco peldaños, donde cada peldaño incluye lo del anterior:

| Peldaño | Permite |
|---|---|
| `nada` | La tabla no existe para ese rol |
| `consultar` | Leer |
| `registrar` | Leer y crear; no cambiar ni borrar lo ya creado |
| `trabajar` | Leer, crear y cambiar; no borrar |
| `administrar` | Leer, crear, cambiar y borrar |

#### Scenario: Leer sin poder borrar

- **WHEN** la tabla de llamados de atención declara `consultar` para el rol colaborador con alcance `las mías`
- **THEN** el colaborador lee su llamado de atención
- **AND** el intento de cambiarlo o borrarlo se rechaza

#### Scenario: Añadir sin poder editar después

- **WHEN** una tabla de solicitudes declara `registrar` para el rol empleado con alcance `las mías`
- **THEN** el empleado crea su solicitud
- **AND** el intento de cambiarla después se rechaza

#### Scenario: El peldaño `nada` gana sobre el alcance

- **WHEN** un rol tiene el peldaño `nada` en una tabla
- **THEN** no alcanza ninguna fila, sea cual sea el alcance declarado

### Requirement: Quien tiene varios roles alcanza la unión

Una persona SHALL poder tener varios roles en una aplicación. Sobre una tabla, esa persona SHALL alcanzar la unión de las filas que alcanza cada uno de sus roles, y SHALL poder hacer lo que permita el peldaño más alto de entre sus roles.

#### Scenario: Odontólogo y conductor a la vez

- **WHEN** una persona tiene los roles odontólogo y conductor, y la tabla de agendas declara `las mías` por odontólogo para uno y `las mías` por conductor para el otro
- **THEN** esa persona recibe tanto las agendas donde es el odontólogo como aquellas donde es el conductor

#### Scenario: Un rol permite más que el otro

- **WHEN** una persona tiene un rol con peldaño `consultar` y otro con peldaño `trabajar` sobre la misma tabla
- **THEN** esa persona puede cambiar las filas que alcanza

### Requirement: El servidor aplica el permiso antes de entregar

El servidor SHALL resolver toda orden de datos de una página publicada: listar, obtener, crear, actualizar y borrar. El servidor SHALL determinar los roles de quien pregunta a partir de su sesión, nunca a partir de lo que envíe el navegador.

Una fila que quien pregunta no alcanza SHALL NO viajar al navegador, ni siquiera parcialmente, ni siquiera en el total de una lista.

El navegador SHALL NO poder consultar la base de datos de una aplicación por su cuenta, saltándose al servidor.

#### Scenario: Petición sin filtro desde el navegador

- **WHEN** alguien con alcance `las mías` pide la lista completa de una tabla sin filtro
- **THEN** recibe sólo sus filas
- **AND** el total que acompaña a la lista cuenta sólo sus filas

#### Scenario: Intento de alcanzar una fila ajena por su identificador

- **WHEN** alguien pide una fila concreta que no alcanza
- **THEN** el servidor responde que no existe, sin revelar que existe y es de otro

#### Scenario: Roles enviados por el navegador

- **WHEN** una petición llega diciendo que quien pregunta tiene el rol administrador
- **THEN** el servidor ignora lo que dice la petición y usa los roles de la sesión

#### Scenario: Intento de hablar con la base directamente

- **WHEN** se intenta consultar la base de datos de una aplicación sin pasar por el servidor
- **THEN** la consulta se rechaza

### Requirement: Una tabla nueva no obliga a configurar nada

Una tabla recién creada SHALL comportarse sin que nadie declare alcances. El comportamiento por defecto SHALL ser el mismo que tenía el sistema antes de existir los alcances por rol: quien está invitado a la aplicación alcanza todas las filas, y lo que puede hacer lo decide su nivel en la aplicación.

Declarar alcances por rol SHALL ser un añadido, no un requisito previo para usar una tabla.

#### Scenario: Crear una tabla y usarla enseguida

- **WHEN** se crea una tabla y se publica una página que la usa, sin abrir el ajuste de quién ve qué
- **THEN** la página funciona para los invitados de la aplicación

#### Scenario: La columna de dueño que ya existía

- **WHEN** una tabla ya tenía declarada una columna de dueño de fila
- **THEN** sigue comportándose igual sin que nadie la vuelva a declarar

### Requirement: El ajuste se resume en español

Junto al ajuste de quién ve qué, el sistema SHALL mostrar lo declarado escrito en español corriente, una frase por rol. El resumen SHALL nombrar el rol, qué filas alcanza y qué puede hacer con ellas.

#### Scenario: Resumen de una tabla con cuatro roles

- **WHEN** se declara que el callcenter trabaja todas las agendas, cada odontólogo trabaja las suyas, el conductor consulta las suyas y el auxiliar no las ve
- **THEN** el resumen dice exactamente eso, en cuatro frases, sin nombrar columnas técnicas ni peldaños

#### Scenario: Tabla sin alcances declarados

- **WHEN** una tabla no tiene ningún alcance declarado
- **THEN** el resumen dice que todos los invitados alcanzan todas las filas y que lo que pueden hacer lo decide su nivel

### Requirement: Ver una página como otro rol

Quien construye SHALL poder abrir una página de su aplicación viéndola como la vería alguien con un rol determinado, sin cerrar su sesión. Lo que se muestre en esa vista SHALL ser el resultado real de aplicar los alcances de ese rol, no una simulación en el navegador.

La vista SHALL indicar de forma visible que se está mirando como otro rol.

#### Scenario: Mirar la agenda como odontólogo

- **WHEN** quien construye elige ver la página de agendas como el rol odontólogo
- **THEN** la pantalla muestra sólo lo que alcanzaría un odontólogo
- **AND** queda visible que se está mirando como ese rol

#### Scenario: Mirar como un rol que no alcanza nada

- **WHEN** quien construye mira como un rol con peldaño `nada` en la única tabla de la página
- **THEN** la pantalla se ve tal como la vería ese rol, vacía, sin errores

### Requirement: Ningún rol alcanza la fila de otro

El sistema SHALL comprobar de forma automática, para cada combinación de rol y tabla declarada, que quien tiene ese rol no alcanza ninguna fila fuera de su alcance, ni para leer ni para escribir.

#### Scenario: Comprobación de una tabla con alcances mixtos

- **WHEN** se comprueba una tabla donde un rol alcanza `todas` y otro `las mías`
- **THEN** queda demostrado que el segundo rol no recibe ninguna fila del primero por ninguna de las cinco órdenes de datos
