# table-relations Specification

## Purpose
Cómo una columna que apunta a otra tabla se ve, se escribe y se empareja usando un valor que la persona reconoce --una cédula, una placa-- mientras el enlace real sigue siendo el id del registro. Incluye qué ocurre cuando un valor no corresponde a ningún registro y cómo se resuelve después.

## Requirements

### Requirement: La columna de relación declara qué columna enseña

Una columna de tipo relación SHALL declarar, además de la tabla destino, la columna de esa tabla que se muestra en su lugar. Esa columna SHALL usarse en la grilla, en la exportación y en lo que recibe la página publicada. El sistema SHALL NO deducir qué columna mostrar del orden de las columnas de la tabla destino.

#### Scenario: Elegir qué se ve

- **WHEN** el constructor crea una columna que apunta a la tabla de vehículos y elige la placa como columna que se muestra
- **THEN** la grilla enseña la placa en esa columna, no el id ni otra columna cualquiera

#### Scenario: Añadir una columna a la tabla destino

- **WHEN** se añade una columna nueva a la tabla destino
- **THEN** lo que enseña la columna de relación no cambia

#### Scenario: Cambiar qué se ve

- **WHEN** el constructor cambia la columna que se muestra
- **THEN** la grilla y la exportación pasan a enseñar la nueva, sin que se toquen los enlaces guardados

### Requirement: El enlace se guarda por id

El enlace entre una fila y el registro al que apunta SHALL guardarse como el id de ese registro. Lo que se muestra SHALL leerse del registro enlazado en el momento, y no guardarse copiado en la fila.

#### Scenario: Corregir el valor en la tabla destino

- **WHEN** se corrige en la tabla destino el valor de la columna que se muestra
- **THEN** todas las filas enlazadas a ese registro pasan a enseñar el valor corregido, sin tocarlas una a una

#### Scenario: El id no se escribe a mano

- **WHEN** el constructor rellena una celda de relación
- **THEN** escribe o elige el valor de la columna que se muestra, y el sistema deriva el id

### Requirement: Solo una columna única sirve de llave

Una columna de una tabla SHALL poder marcarse como única, y el sistema SHALL impedir que dos filas de esa tabla tengan el mismo valor en ella. Emparejar un valor con un registro SHALL usar únicamente columnas marcadas como únicas.

#### Scenario: Marcar una columna como única

- **WHEN** el constructor marca una columna como única y ya hay dos filas con el mismo valor
- **THEN** el sistema no aplica la marca y dice cuántas filas están repetidas y cuáles

#### Scenario: Repetir un valor en una columna única

- **WHEN** se guarda una fila con un valor que ya existe en una columna única
- **THEN** el guardado se rechaza y se dice con qué fila choca

#### Scenario: Una columna no única no puede emparejar

- **WHEN** el constructor quiere emparejar por una columna que no está marcada como única
- **THEN** el sistema no la ofrece como llave y explica que hay que marcarla como única primero

### Requirement: Un valor sin registro es un estado válido

Cuando el valor de una celda de relación no corresponde a ningún registro de la tabla destino, la fila SHALL guardarse igualmente y el valor SHALL conservarse visible en esa celda. El sistema SHALL señalar esa celda de forma neutra, distinguible de un error de datos.

#### Scenario: Guardar una fila cuyo valor no corresponde a nadie

- **WHEN** se guarda una fila cuya celda de relación trae un valor que no existe en la tabla destino
- **THEN** la fila se guarda completa, la celda enseña ese valor y queda señalada como sin enlace

#### Scenario: El valor no se pierde

- **WHEN** una fila lleva un valor sin enlace y se edita cualquier otra columna de esa fila
- **THEN** el valor sin enlace sigue ahí después de guardar

#### Scenario: La columna que decide quién ve la fila

- **WHEN** la columna de relación es la que decide quién alcanza cada fila y el valor no corresponde a ningún registro
- **THEN** el sistema no permite dejarla sin enlace, porque la fila quedaría guardada y fuera del alcance de todo el mundo

### Requirement: Los valores sin registro se resuelven agrupados por valor

El sistema SHALL ofrecer, por tabla, el recuento de filas con una celda de relación sin enlace y la lista de los valores distintos que la causan, con cuántas filas depende de cada uno. Cada valor SHALL poder resolverse de dos formas: crear el registro que le corresponde --con lo cual todas sus filas quedan enlazadas a la vez-- o aceptarlo, con lo cual deja de contarse.

#### Scenario: Ver qué falta

- **WHEN** una tabla tiene veinte filas sin enlace causadas por tres valores distintos
- **THEN** el sistema enseña tres valores con cuántas filas depende de cada uno, no veinte filas

#### Scenario: Crear el registro que faltaba

- **WHEN** el constructor crea el registro que corresponde a un valor sin dueño
- **THEN** todas las filas que llevaban ese valor quedan enlazadas a ese registro de una vez

#### Scenario: Aceptar un valor que nunca va a tener registro

- **WHEN** el constructor acepta un valor sin dueño
- **THEN** sus filas dejan de contarse en el recuento y siguen enseñando el valor

#### Scenario: Un registro nuevo que coincide con lo que esperaba

- **WHEN** se crea en la tabla destino un registro cuyo valor en la columna llave coincide con un valor sin dueño que no había sido aceptado
- **THEN** el sistema avisa de cuántas filas lo esperaban y ofrece enlazarlas

### Requirement: Un enlace que deja de resolver se avisa, no se borra

Cuando una fila apunta a un registro que ya no existe o que ya no está al alcance, el sistema SHALL señalarlo. El sistema SHALL NO vaciar la celda en silencio.

Cuando el registro desaparece por una acción del propio sistema --borrar una fila de la tabla destino, quitarle el acceso a una persona-- y la columna conserva el valor, el valor que la celda enseñaba SHALL guardarse en ella como valor sin enlace antes de que el enlace se pierda. Una fila SHALL NO quedar a la vez sin enlace y sin valor.

Esto SHALL cumplirse por cualquiera de los caminos que borran una fila: la cuadrícula del constructor, una orden de una página publicada y quitarle el acceso a una persona.

#### Scenario: Desaparece el registro enlazado

- **WHEN** se borra un registro de la tabla destino al que apuntaban filas de otra tabla
- **THEN** esas filas conservan visible el valor que enseñaban, señalado como valor sin enlace

#### Scenario: Se quita el acceso a una persona enlazada

- **WHEN** se le quita el acceso a una persona a la que apuntaban filas de otra tabla
- **THEN** esas filas conservan visible el valor que enseñaban --su cédula, su correo-- señalado como valor sin enlace

#### Scenario: Borrar desde la cuadrícula

- **WHEN** el constructor borra desde la cuadrícula una fila a la que apuntaban filas de otra tabla
- **THEN** esas filas conservan el valor igual que si se hubiera borrado por cualquier otro camino

#### Scenario: Esa persona vuelve

- **WHEN** se vuelve a invitar a una persona cuyo valor quedó conservado en esas filas
- **THEN** esas filas pueden volver a enlazarse a ella, porque el valor que la nombraba sigue ahí

### Requirement: Una columna que apunta a personas empareja por cualquiera de sus columnas

Una columna que apunta a la tabla de personas SHALL poder declarar como columna que enseña, y como llave para emparejar, cualquier columna de esa tabla que lleve un solo valor --su correo, su documento, su cargo--, y no solo el correo. SHALL valer tambien una columna sin indice unico: las que llegan al importar personas no nacen con el, y aun asi son la llave con la que otras tablas las nombran.

Los roles SHALL NO poder elegirse como columna que enseña ni como llave, porque una persona lleva varios.

Un valor que corresponda a mas de una persona invitada SHALL NO enlazar a ninguna. La busqueda SHALL hacerse unicamente entre las personas invitadas a esa aplicacion.

Dos tablas distintas SHALL poder apuntar a la tabla de personas por llaves distintas --una por el correo, otra por el documento-- sin que ninguna condicione a la otra.

#### Scenario: Emparejar por documento

- **WHEN** una tabla tiene una columna que apunta a personas, enseña el documento, y se importa un archivo con documentos
- **THEN** cada fila queda enlazada a la persona cuyo documento coincide

#### Scenario: Dos tablas con llaves distintas

- **WHEN** una tabla apunta a personas por el correo y otra por el documento
- **THEN** las dos emparejan por su propia llave, contra la misma tabla de personas

#### Scenario: Una llave que llevan dos personas

- **WHEN** el valor de una fila corresponde a dos personas invitadas
- **THEN** no se enlaza a ninguna, y la fila queda con el valor sin enlace

#### Scenario: No emparejar contra quien no esta invitado

- **WHEN** un valor coincide con el de una persona que tiene cuenta pero no esta invitada a esta aplicacion
- **THEN** no se empareja, y la fila queda con el valor sin enlace

#### Scenario: Cambiar la llave de una columna de persona

- **WHEN** el constructor cambia la columna que enseña de correo a documento
- **THEN** la cuadricula y la exportacion pasan a enseñar el documento, sin que se toquen los enlaces guardados

### Requirement: Apuntar a otra tabla tiene un solo tipo de columna

Una columna que apunte a otra tabla SHALL ser de tipo relación. El sistema SHALL NO ofrecer un segundo tipo de columna para apuntar a las personas de la aplicación: la tabla de personas SHALL aparecer entre las tablas destino como una tabla más.

El enlace SHALL guardarse como el identificador de la fila de la tabla destino, también cuando la tabla destino es la de personas. El sistema SHALL NO guardar el identificador de la cuenta con la que esa persona inicia sesión.

Una columna que estuviera guardada con el tipo anterior SHALL convertirse a relación a la tabla de personas conservando a quién apunta cada fila. Una fila cuya persona ya no esté invitada SHALL conservar su valor como valor sin enlace.

#### Scenario: Elegir la tabla de personas como destino

- **WHEN** el constructor crea una columna de relación y elige "Personas y roles" como tabla destino
- **THEN** la columna se guarda como una relación normal a esa tabla, sin convertirse en otra cosa

#### Scenario: No hay un tipo aparte para las personas

- **WHEN** el constructor despliega los tipos de columna disponibles
- **THEN** hay un solo tipo para apuntar a otra tabla, y ninguno que hable de quien inicia sesión

#### Scenario: Convertir una columna del tipo anterior

- **WHEN** una aplicación tiene una columna guardada con el tipo anterior y se aplica la conversión
- **THEN** cada fila sigue apuntando a la misma persona, ahora por su fila de la tabla de personas

#### Scenario: Convertir una fila cuya persona ya no está

- **WHEN** al convertir, una fila apunta a una cuenta que ya no está invitada a la aplicación
- **THEN** esa fila queda con el valor que enseñaba a la vista, señalado como valor sin enlace, y no vacía

### Requirement: Una columna declara qué pasa con sus filas cuando se borra lo apuntado

Una columna de relación SHALL declarar qué ocurre con sus filas cuando se borra el registro al que apuntan, entre dos conductas:

- **Conservar el valor**: la fila se queda y la celda sigue enseñando lo que decía, señalada como valor sin enlace. SHALL ser la conducta por defecto.
- **Borrar las filas**: las filas que apuntaban al registro borrado se borran con él.

El sistema SHALL NO ofrecer una tercera conducta que vacíe la celda dejando la fila.

La conducta SHALL poder cambiarse desde la tarjeta de la columna, y SHALL NO preguntarse al crear la columna.

Antes de borrar un registro al que apuntan filas de otras tablas, el sistema SHALL decir cuántas filas se conservan y cuántas se borran, nombrando cada tabla.

#### Scenario: Borrar con la conducta por defecto

- **WHEN** se borra una fila de la tabla de personas a la que apuntaban dos filas de chequeos
- **THEN** las dos filas de chequeos siguen ahí, enseñando el valor que tenían, señalado como valor sin enlace

#### Scenario: Borrar con la conducta en cascada

- **WHEN** una columna está declarada en cascada y se borra el registro al que apunta
- **THEN** las filas que apuntaban a ese registro se borran también

#### Scenario: Crear una columna no pregunta por esto

- **WHEN** el constructor crea una columna de relación
- **THEN** no se le pregunta qué pasa al borrar, y la columna nace conservando el valor

#### Scenario: El aviso antes de borrar dice números

- **WHEN** el constructor va a borrar un registro al que apuntan filas de dos tablas, una en cascada y otra no
- **THEN** el aviso dice cuántas filas se borran y de qué tabla, y cuántas se conservan y de cuál
