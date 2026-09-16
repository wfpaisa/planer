## ADDED Requirements

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

## MODIFIED Requirements

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
