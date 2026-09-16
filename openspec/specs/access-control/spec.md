# access-control Specification

## Purpose
Decide quién puede abrir cada página de una aplicación y lo aplica en el servidor antes de entregar ningún dato. Quien puede abrir una página alcanza todas las filas de las tablas que esa página declara: las filas no se reparten por rol. Lo único que separa leer de escribir es la sesión, y quien construye puede mirar cualquiera de sus páginas como la vería otro rol, otra persona o alguien sin cuenta.

## Requirements

### Requirement: El servidor aplica el permiso antes de entregar

El servidor SHALL resolver toda orden de datos de una página publicada: listar, obtener, crear, actualizar y borrar. El servidor SHALL determinar quién pregunta y qué roles tiene a partir de su sesión, nunca a partir de lo que envíe el navegador.

El servidor SHALL comprobar, antes de cualquier otra cosa, que quien pregunta puede abrir la página desde la que se pregunta, y que la tabla que se pide está declarada en el manifiesto de esa página. Una orden sobre una tabla que la página no declara SHALL rechazarse.

El servidor SHALL NO filtrar filas por quien pregunta. Quien puede abrir una página alcanza todas las filas de las tablas que esa página declara, y el total que acompaña a una lista cuenta todas ellas.

El navegador SHALL NO poder consultar la base de datos de una aplicación por su cuenta, saltándose al servidor.

#### Scenario: Petición sin filtro desde el navegador

- **WHEN** alguien que puede abrir una página pide la lista completa de una tabla que esa página declara, sin filtro
- **THEN** recibe todas las filas de esa tabla
- **AND** el total que acompaña a la lista cuenta todas ellas

#### Scenario: Intento de alcanzar una fila ajena por su identificador

- **WHEN** alguien pide por su identificador una fila creada por otra persona, desde una página que declara esa tabla
- **THEN** la recibe, porque las filas ya no pertenecen a nadie en particular

#### Scenario: Roles enviados por el navegador

- **WHEN** una petición llega diciendo que quien pregunta tiene el rol `admin`
- **THEN** el servidor ignora lo que dice la petición y usa los roles de la sesión

#### Scenario: Tabla que la página no declara

- **WHEN** una página pide datos de una tabla que no está en su manifiesto
- **THEN** el servidor rechaza la orden

#### Scenario: Petición desde una página que no se puede abrir

- **WHEN** alguien pide datos desde una página que sus roles no le permiten abrir
- **THEN** el servidor rechaza la orden sin entregar ninguna fila

#### Scenario: Intento de hablar con la base directamente

- **WHEN** se intenta consultar la base de datos de una aplicación sin pasar por el servidor
- **THEN** la consulta se rechaza

### Requirement: Ver una página como otro rol

Quien construye SHALL poder abrir una página de su aplicación viéndola como la vería alguien con un rol determinado, sin cerrar su sesión. Quien construye SHALL poder además elegir una persona concreta de entre las que tienen ese rol, y ver la página como la vería esa persona.

El selector SHALL empezar en el rol `admin`, que es el de quien construye, y SHALL NO ofrecer una opción de mirar sin rol ninguno. Elegir una persona SHALL ser opcional: sin elegirla, la página se ve con ese rol y sin ser nadie en concreto.

El selector SHALL ofrecer también mirar la página sin sesión, tal como la vería alguien que llega sin cuenta.

La vista SHALL indicar de forma visible con qué rol --y, si se eligió, con qué persona-- se está mirando.

#### Scenario: Mirar la agenda como odontólogo

- **WHEN** quien construye elige ver la página de agendas como el rol `odontologo`
- **THEN** la página recibe ese rol como el de quien mira
- **AND** queda visible que se está mirando como ese rol

#### Scenario: Mirar como un rol que no alcanza nada

- **WHEN** quien construye mira como un rol que la página no tiene marcado
- **THEN** la pantalla se ve tal como la vería ese rol, sin poder abrir la página y sin errores

#### Scenario: Mirar la página como una persona concreta

- **WHEN** quien construye elige el rol `odontologo` y después elige a Ana entre las personas que lo tienen
- **THEN** la página recibe la identidad de Ana como la de quien mira
- **AND** una pantalla que muestra "mis citas" enseña las de Ana

#### Scenario: El selector de persona sólo ofrece a quien tiene ese rol

- **WHEN** quien construye elige un rol y abre el selector de persona
- **THEN** sólo aparecen las personas que tienen ese rol

#### Scenario: Mirar la página sin sesión

- **WHEN** quien construye elige mirar sin sesión una página abierta a `Todos`
- **THEN** la página se ve como la vería alguien sin cuenta
- **AND** el intento de guardar desde ella produce el aviso de iniciar sesión

#### Scenario: El selector empieza en admin

- **WHEN** quien construye abre una página de su aplicación
- **THEN** la está mirando como el rol `admin`

### Requirement: Guardar exige una cuenta iniciada

Crear, actualizar y borrar filas SHALL exigir una sesión iniciada. El servidor SHALL rechazar esas tres órdenes cuando quien pregunta llega sin sesión, sea cual sea el nivel de acceso de la página.

Cuando una de esas órdenes se rechaza por falta de sesión, la plataforma SHALL avisarlo en la pantalla con un mensaje que pida iniciar sesión para guardar. El aviso SHALL emitirlo la plataforma, sin que el HTML de la página tenga que escribirlo.

Leer SHALL NO exigir sesión: una página abierta a `Todos` entrega sus datos a quien llegue sin cuenta.

#### Scenario: Guardar sin sesión en una página abierta a todos

- **WHEN** alguien sin cuenta rellena un formulario en una página abierta a `Todos` e intenta guardarlo
- **THEN** la fila no se crea
- **AND** aparece un aviso pidiendo iniciar sesión para guardar

#### Scenario: Leer sin sesión en una página abierta a todos

- **WHEN** alguien sin cuenta abre una página abierta a `Todos` que lista una tabla
- **THEN** recibe las filas de esa tabla

#### Scenario: Guardar con sesión

- **WHEN** alguien con sesión iniciada guarda una fila desde una página que puede abrir
- **THEN** la fila se guarda

#### Scenario: Quien construye guarda desde el panel

- **WHEN** quien construye prueba desde el panel un formulario de su propia página
- **THEN** la fila se guarda, porque su sesión de constructor cuenta como sesión iniciada
