## Purpose

La lista de personas de una aplicacion tratada como una tabla mas: con columnas propias que pone quien construye, columnas del sistema que no se tocan, importar y exportar. Fija tambien que separa lo que una aplicacion sabe de una persona de lo que sabe otra aplicacion que tiene invitada a la misma.

## ADDED Requirements

### Requirement: La lista de personas es una tabla de la aplicacion

La lista de personas SHALL presentarse con la misma cuadricula que las demas tablas: buscar, ordenar, elegir que columnas se ven, ancho de columna, paginacion y panel lateral para editar una fila. Las acciones que ya existen sobre una persona --invitar, quitar el acceso, cambiar lo que puede hacer y sus roles-- SHALL seguir estando.

#### Scenario: Abrir la lista de personas

- **WHEN** el constructor abre personas y roles
- **THEN** ve las personas en una cuadricula, con las mismas herramientas que en cualquier otra tabla

#### Scenario: Invitar desde la tabla

- **WHEN** el constructor añade una fila a la tabla de personas con un correo
- **THEN** se crea la cuenta si no existia y la persona queda invitada a esta aplicacion

#### Scenario: Quitar el acceso

- **WHEN** el constructor borra una fila de la tabla de personas
- **THEN** esa persona deja de tener acceso a esta aplicacion, sin que su cuenta desaparezca de las demas

### Requirement: Columnas propias de cada aplicacion

Quien construye SHALL poder añadir columnas a la tabla de personas con los mismos tipos que en cualquier otra tabla. Esas columnas y sus valores SHALL pertenecer a la aplicacion que las creo y SHALL NO ser visibles desde otra aplicacion, aunque tenga invitada a la misma persona.

#### Scenario: Añadir una columna

- **WHEN** el constructor añade una columna de documento a la tabla de personas
- **THEN** la columna aparece en la cuadricula y se puede rellenar en cada persona

#### Scenario: La misma persona en dos aplicaciones

- **WHEN** una persona esta invitada a dos aplicaciones y en una de ellas se le rellena una columna propia
- **THEN** esa columna y su valor no existen en la otra aplicacion

#### Scenario: Quitar el acceso no borra la cuenta

- **WHEN** se quita a una persona de una aplicacion
- **THEN** los datos que esa aplicacion tenia de ella dejan de estar, y su cuenta y sus datos en otras aplicaciones siguen intactos

### Requirement: Columnas del sistema que no se tocan

La cuenta con la que la persona entra, lo que puede hacer con los datos y los roles con los que ve las pantallas SHALL ser columnas del sistema: se muestran en la cuadricula y se pueden editar en su fila, pero SHALL NO poder borrarse, renombrarse ni cambiar de tipo.

#### Scenario: Intentar borrar una columna del sistema

- **WHEN** el constructor intenta borrar la columna de la cuenta
- **THEN** el sistema no lo permite y explica que es una columna que sostiene el acceso

#### Scenario: Cambiar lo que puede hacer una persona

- **WHEN** el constructor cambia en la cuadricula lo que una persona puede hacer con los datos
- **THEN** el cambio se aplica sin necesidad de confirmar

### Requirement: La contrasena no es una columna

La contrasena SHALL tratarse aparte de las columnas. SHALL poder ponerse o cambiarse desde la fila de la persona, SHALL mostrarse una sola vez al crearla o cambiarla y SHALL NO poder leerse despues. El sistema SHALL NO ofrecerla como columna ni permitir crear una columna que la contenga.

#### Scenario: Cambiar la contrasena de una persona

- **WHEN** el constructor cambia la contrasena de una persona
- **THEN** la contrasena nueva se muestra una sola vez, se puede copiar y se cierran las sesiones que esa persona tuviera abiertas

#### Scenario: La contrasena no aparece como columna

- **WHEN** el constructor abre la lista de columnas de la tabla de personas
- **THEN** la contrasena no esta entre ellas ni se puede añadir

### Requirement: Importar personas

La tabla de personas SHALL poder importarse desde un archivo, igual que cualquier otra tabla. Cuando una fila del archivo corresponde a una persona que todavia no tiene cuenta, SHALL decirse cuantas cuentas se van a crear antes de guardar nada, y crearlas SHALL requerir que el constructor lo marque expresamente.

#### Scenario: Dar de alta a un equipo desde un archivo

- **WHEN** el constructor importa un archivo con doscientos empleados
- **THEN** antes de guardar se dice cuantas personas ya existen y cuantas cuentas se van a crear

#### Scenario: Crear cuentas no es lo que pasa por defecto

- **WHEN** el archivo trae personas que no tienen cuenta y el constructor no ha marcado que se creen
- **THEN** esas filas no se guardan y se dice por que

#### Scenario: Reconocer a quien ya esta

- **WHEN** el archivo trae una persona que ya tiene cuenta
- **THEN** se actualizan sus datos en esta aplicacion en vez de crear una cuenta nueva

### Requirement: Exportar personas sin contrasenas

La tabla de personas SHALL poder exportarse igual que cualquier otra tabla. La exportacion SHALL NO incluir contrasenas en ningun formato ni bajo ningun nombre de columna.

#### Scenario: Exportar el directorio

- **WHEN** el constructor exporta la tabla de personas
- **THEN** el archivo trae las columnas propias y las del sistema que se pueden leer

#### Scenario: La contrasena no sale

- **WHEN** se exporta la tabla de personas en cualquiera de los formatos disponibles
- **THEN** el archivo no contiene ninguna contrasena

### Requirement: Cualquier columna de personas puede ser unica

Una columna propia de la tabla de personas SHALL poder marcarse como unica, con las mismas reglas que en cualquier otra tabla. Una columna unica SHALL quedar disponible como llave para las columnas de otras tablas que apunten a personas.

#### Scenario: El documento como llave

- **WHEN** el constructor marca el documento como columna unica
- **THEN** una columna de persona de otra tabla puede mostrarse y emparejarse por el documento

#### Scenario: Documento repetido

- **WHEN** se guarda una persona con un documento que ya tiene otra
- **THEN** el guardado se rechaza y se dice con quien choca
