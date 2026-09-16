# builder/people Specification

## Purpose
La lista de personas de una aplicacion tratada como una tabla mas: con columnas propias que pone quien construye, columnas del sistema que no se tocan, importar y exportar. Fija tambien que separa lo que una aplicacion sabe de una persona de lo que sabe otra aplicacion que tiene invitada a la misma.

## Requirements

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

### Requirement: La columna del nombre siempre esta

La tabla de personas SHALL nacer con una columna "Nombre" en toda aplicacion, y esa columna SHALL NO poder borrarse ni editarse: es de donde sale el nombre de una persona en toda la plataforma. Su menu SHALL ofrecer lo mismo que el de la columna del correo --ordenar y esconder-- y ninguna de las dos SHALL abrir la tarjeta que cambia una columna. Lo que se rellena en cada fila SHALL seguir siendo de la aplicacion, como en cualquier columna propia.

Una tabla de personas que no la tenga --una aplicacion anterior a esta regla-- SHALL recuperarla vacia al arrancar el servidor.

#### Scenario: Una aplicacion recien creada trae la columna

- **WHEN** el constructor crea una aplicacion y abre personas y roles
- **THEN** la tabla trae la columna "Nombre" ademas de las dos del sistema

#### Scenario: El menu de la columna del nombre

- **WHEN** el constructor abre el menu de la columna "Nombre" en la cuadricula
- **THEN** puede ordenarla y esconderla, y no hay por donde editarla ni borrarla

#### Scenario: Intentar borrarla por la API

- **WHEN** llega una peticion que guarda las columnas de la tabla de personas sin la del nombre
- **THEN** se rechaza y se explica que es de donde sale el nombre de cada persona

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

Al terminar la importacion, las filas de otras tablas que llevaban sin enlace un valor que ahora identifica a una sola de las personas importadas SHALL quedar enlazadas a ella. Un valor que el constructor haya aceptado, o que identifique a mas de una persona, SHALL NO enlazarse.

El sistema SHALL decir lo ocurrido en frases separadas, cada una nombrando de que habla y cuantos son: cuantas personas se importaron y cuantas de ellas son nuevas, cuantas filas se enlazaron y en que tabla, y cuantas filas siguen sin enlace y donde se ven. Una cifra en cero SHALL omitir su frase.

#### Scenario: Dar de alta a un equipo desde un archivo

- **WHEN** el constructor importa un archivo con doscientos empleados
- **THEN** antes de guardar se dice cuantas personas ya existen y cuantas cuentas se van a crear

#### Scenario: Crear cuentas no es lo que pasa por defecto

- **WHEN** el archivo trae personas que no tienen cuenta y el constructor no ha marcado que se creen
- **THEN** esas filas no se guardan y se dice por que

#### Scenario: Reconocer a quien ya esta

- **WHEN** el archivo trae una persona que ya tiene cuenta
- **THEN** se actualizan sus datos en esta aplicacion en vez de crear una cuenta nueva

#### Scenario: Las filas que esperaban quedan enlazadas

- **WHEN** otra tabla tiene filas cuya columna que apunta a personas lleva sin enlace la cedula de alguien que se acaba de importar
- **THEN** esas filas quedan enlazadas a esa persona al terminar la importacion

#### Scenario: Lo que se dice al terminar

- **WHEN** la importacion enlaza filas de otra tabla y deja algunas sin enlace
- **THEN** se dice cuantas personas se importaron y cuantas son nuevas, cuantas filas se enlazaron y de que tabla, y cuantas siguen sin enlace y que estan señaladas en esa tabla

#### Scenario: Un valor que nombra a dos personas no se enlaza

- **WHEN** el valor sin enlace de unas filas corresponde a dos de las personas importadas
- **THEN** esas filas siguen sin enlace, porque no se puede saber a cual de las dos pertenecen

#### Scenario: Un valor aceptado se queda como esta

- **WHEN** el constructor habia aceptado un valor sin dueño y despues se importa una persona que lo lleva
- **THEN** esas filas siguen sin enlace y sin contarse

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

### Requirement: La tabla de personas no admite los nombres con los que llega la sesion

Una columna propia de la tabla de personas SHALL NO poder llamarse `id`, `correo` ni `roles`. Son los nombres con los que los datos de una persona llegan a una pagina publicada, y una columna que se llamara igual taparia el dato de la plataforma.

`nombre` SHALL seguir siendo valido, porque no tapa nada: la columna que la tabla de personas ya trae con ese nombre es de donde sale el nombre que la sesion manda. Esa columna SHALL seguir sin poder borrarse.

El rechazo SHALL ocurrir al guardar la columna, diciendo cual es el nombre que no se puede usar y por que.

Esta restriccion SHALL aplicarse unicamente a la tabla de personas. En cualquier otra tabla esos nombres SHALL seguir siendo validos.

#### Scenario: Intentar llamar a una columna como un dato de la sesion

- **WHEN** el constructor añade a la tabla de personas una columna llamada `correo`
- **THEN** el sistema no la guarda y explica que ese nombre lo ocupa el correo de la persona

#### Scenario: El mismo nombre en otra tabla

- **WHEN** el constructor añade una columna llamada `correo` a una tabla que no es la de personas
- **THEN** la columna se crea sin problema

### Requirement: La lista de invitados se relee despues de tocarla

Despues de una importacion que cree o cambie personas, el sistema SHALL volver a pedir la lista de invitados antes de usarla para emparejar. Lo que se empareje despues SHALL hacerlo contra la lista al dia.

#### Scenario: Dos archivos seguidos

- **WHEN** se importa un archivo de personas y a continuacion se suelta un archivo de otra tabla con las cedulas de esas personas
- **THEN** el segundo archivo empareja contra las personas recien importadas, no contra la lista anterior
