## MODIFIED Requirements

### Requirement: La lista de personas es una tabla de la aplicacion

La lista de personas SHALL presentarse con la misma cuadricula que las demas tablas: buscar, ordenar, elegir que columnas se ven, ancho de columna, paginacion y panel lateral para editar una fila. Las acciones que ya existen sobre una persona --invitar, quitar el acceso y cambiar sus roles-- SHALL seguir estando.

Toda aplicacion SHALL tener esta tabla desde el primer dia, sin que nadie la cree.

#### Scenario: Abrir la lista de personas

- **WHEN** el constructor abre personas y roles
- **THEN** ve las personas en una cuadricula, con las mismas herramientas que en cualquier otra tabla

#### Scenario: Invitar desde la tabla

- **WHEN** el constructor añade una fila a la tabla de personas con un correo
- **THEN** se crea la cuenta si no existia y la persona queda invitada a esta aplicacion

#### Scenario: Quitar el acceso

- **WHEN** el constructor borra una fila de la tabla de personas
- **THEN** esa persona deja de tener acceso a esta aplicacion, sin que su cuenta desaparezca de las demas

#### Scenario: Una aplicacion recien creada

- **WHEN** el constructor crea una aplicacion y abre personas y roles
- **THEN** la tabla ya existe, vacia, con sus columnas puestas

### Requirement: Columnas del sistema que no se tocan

La cuenta con la que la persona entra y los roles con los que ve las pantallas SHALL ser columnas del sistema: se muestran en la cuadricula y se pueden editar en su fila, pero SHALL NO poder borrarse, renombrarse ni cambiar de tipo.

La tabla de personas SHALL NO tener ninguna columna que declare lo que una persona puede hacer con los datos.

#### Scenario: Intentar borrar una columna del sistema

- **WHEN** el constructor intenta borrar la columna de la cuenta
- **THEN** el sistema no lo permite y explica que es una columna que sostiene el acceso

#### Scenario: Cambiar los roles de una persona

- **WHEN** el constructor cambia en la cuadricula los roles de una persona
- **THEN** el cambio se aplica sin necesidad de confirmar

#### Scenario: Cambiar lo que puede hacer una persona

- **WHEN** el constructor busca en la cuadricula la columna que decia lo que una persona puede hacer con los datos
- **THEN** esa columna no existe, porque lo que puede hacer ya no se declara por persona

#### Scenario: Las columnas del sistema son dos

- **WHEN** el constructor abre la tabla de personas de cualquier aplicacion
- **THEN** las columnas del sistema son la cuenta y los roles, y ninguna mas

## ADDED Requirements

### Requirement: El nombre de un rol se normaliza al escribirlo

El nombre de un rol SHALL guardarse en minusculas, sin espacios y con guiones en lugar de ellos. La normalizacion SHALL aplicarse mientras se escribe, de modo que quien lo escribe vea el nombre tal como va a quedar antes de guardarlo.

Dos nombres que se normalicen al mismo resultado SHALL tratarse como el mismo rol, y el segundo SHALL rechazarse por repetido.

#### Scenario: Escribir un rol con espacios y mayusculas

- **WHEN** el constructor escribe "Jefe de Zona" en el campo de un rol nuevo
- **THEN** el campo va mostrando `jefe-de-zona` mientras escribe
- **AND** al guardar, el rol se llama `jefe-de-zona`

#### Scenario: Rol repetido por normalizacion

- **WHEN** la aplicacion ya tiene el rol `jefe-de-zona` y el constructor escribe "JEFE DE ZONA"
- **THEN** el sistema no lo añade y avisa de que ese rol ya existe

### Requirement: Toda aplicacion nace con el rol admin

Toda aplicacion SHALL definir el rol `admin` desde su creacion, sin que nadie lo escriba.

Quien construye la aplicacion SHALL tener ese rol al mirar sus paginas, tanto en el panel como en la vista previa. Quien construye SHALL NO aparecer como fila de la tabla de personas: esa tabla lista a quien esta invitado, y quien construye es el dueño.

El rol `admin` SHALL comportarse como cualquier otro rol: darselo a una persona invitada SHALL mostrarle lo que las paginas reserven a ese rol, y SHALL NO darle acceso al panel ni a nada que corresponda a quien construye.

#### Scenario: Crear una aplicacion

- **WHEN** el constructor crea una aplicacion
- **THEN** la aplicacion define el rol `admin`

#### Scenario: Quien construye no esta en la lista

- **WHEN** el constructor abre personas y roles de una aplicacion a la que no ha invitado a nadie
- **THEN** la tabla esta vacia

#### Scenario: Dar el rol admin a una persona invitada

- **WHEN** el constructor le da el rol `admin` a una persona invitada
- **THEN** esa persona abre las paginas reservadas a `admin`
- **AND** no puede entrar al panel ni publicar la aplicacion
