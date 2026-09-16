## Purpose

Cómo una columna que apunta a otra tabla se ve, se escribe y se empareja usando un valor que la persona reconoce --una cédula, una placa-- mientras el enlace real sigue siendo el id del registro. Incluye qué ocurre cuando un valor no corresponde a ningún registro y cómo se resuelve después.

## ADDED Requirements

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

#### Scenario: Desaparece el registro enlazado

- **WHEN** se borra un registro de la tabla destino al que apuntaban filas de otra tabla
- **THEN** esas filas quedan señaladas como enlace roto, con lo que se sepa del enlace anterior
