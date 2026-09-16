## MODIFIED Requirements

### Requirement: Convertir valores segun el tipo de columna

Al importar SHALL convertirse los valores segun el tipo de la columna: numeros, si/no y fechas (a un formato de fecha comun). Las columnas de tipo archivo SHALL NO convertirse. Las columnas de persona y relacion SHALL emparejarse por llave: el valor del archivo se busca en la columna llave de la tabla destino y se guarda el enlace al registro que coincide; si no coincide con ninguno, el valor se conserva en la celda sin enlace. Un valor que no se puede convertir al tipo de su columna SHALL marcarse como error de esa fila.

#### Scenario: Convertir un numero

- **WHEN** una celda destinada a una columna numerica trae un valor numerico
- **THEN** se guarda como numero

#### Scenario: Convertir un si/no

- **WHEN** una celda destinada a una columna de si/no trae "si", "no", "1", "0", "true" o "false"
- **THEN** se convierte al valor correspondiente de si/no

#### Scenario: Normalizar una fecha

- **WHEN** una celda destinada a una columna de fecha trae una fecha en un formato comun
- **THEN** se normaliza al formato de fecha que usa el sistema

#### Scenario: Valor no convertible

- **WHEN** una celda no se puede convertir al tipo de su columna
- **THEN** la fila queda marcada con error y se explica el motivo

#### Scenario: Emparejar por llave

- **WHEN** una celda destinada a una columna de persona o relacion trae un valor que coincide con la llave de un registro de la tabla destino
- **THEN** la fila queda enlazada a ese registro

#### Scenario: Valor que no corresponde a ningun registro

- **WHEN** una celda destinada a una columna de persona o relacion trae un valor que no coincide con ningun registro
- **THEN** la fila se importa igualmente y la celda conserva el valor sin enlace

#### Scenario: Id sin convertir en relacion

- **WHEN** una celda destinada a una columna de persona o relacion trae un id de registro de la tabla destino
- **THEN** el id se toma como el enlace, sin buscar por llave

### Requirement: Emparejar columnas del archivo

Las columnas del archivo SHALL emparejarse con las columnas de la tabla. Las columnas del archivo que no existan en la tabla SHALL poder crearse como columnas nuevas. Las columnas de la tabla que no vengan en el archivo SHALL quedar sin valor en las filas nuevas. Para una columna de persona o relacion SHALL poder elegirse ademas por que llave se empareja, entre las columnas unicas de la tabla destino; el sistema SHALL proponer una y la eleccion SHALL valer solo para esa importacion, sin cambiar lo que enseña la grilla.

#### Scenario: Coincidencia por nombre

- **WHEN** una columna del archivo coincide con el nombre o la etiqueta de una columna de la tabla
- **THEN** los valores de esa columna se destinan a la columna de la tabla correspondiente

#### Scenario: Crear una columna nueva

- **WHEN** una columna del archivo no existe en la tabla
- **THEN** se ofrece crearla como columna nueva de la tabla

#### Scenario: Columna de la tabla sin datos en el archivo

- **WHEN** una columna de la tabla no viene en el archivo
- **THEN** esa columna queda sin valor en las filas importadas

#### Scenario: Proponer la llave de emparejamiento

- **WHEN** una columna del archivo se destina a una columna de persona o relacion
- **THEN** el sistema propone una llave entre las columnas unicas de la tabla destino y el constructor puede cambiarla

#### Scenario: La llave del archivo no cambia la grilla

- **WHEN** el constructor empareja un archivo por una llave distinta de la que enseña la columna
- **THEN** la grilla sigue enseñando la columna declarada en la definicion de la columna

### Requirement: Previsualizar antes de guardar

El constructor SHALL poder ver una previsualizacion a pantalla completa con todos los datos del archivo, el total de filas y, cuando hay errores, el listado de errores. En el modo Sobrescribir SHALL marcarse cada fila como **nueva** o **actualizara la fila X**. Para cada columna de persona o relacion SHALL mostrarse cuantos valores encontraron registro y cuantos no, con acceso a la lista de los que no.

#### Scenario: Ver la previsualizacion

- **WHEN** hay contenido importable y el constructor toca Previsualizar
- **THEN** se abre la previsualizacion a pantalla completa con las filas y el total

#### Scenario: Ver los errores

- **WHEN** hay filas con errores
- **THEN** la previsualizacion muestra cuantas hay y el listado de errores

#### Scenario: Marcar el destino de cada fila

- **WHEN** el modo es Sobrescribir
- **THEN** cada fila del archivo aparece marcada como nueva o como actualizara la fila con la que coincide por id

#### Scenario: Recuento de coincidencias

- **WHEN** el archivo trae una columna destinada a una columna de persona o relacion
- **THEN** la previsualizacion dice cuantos valores encontraron registro y cuantos no, antes de guardar nada

#### Scenario: Ver los valores que no encontraron registro

- **WHEN** hay valores que no encontraron registro
- **THEN** el constructor puede ver la lista de valores distintos, con cuantas filas depende de cada uno

### Requirement: Exportar datos de una tabla

El editor SHALL ofrecer un boton **Exportar** con cuatro opciones: exportar CSV, copiar CSV, exportar JSON y copiar JSON. Todas SHALL incluir la columna id y el contenido completo de la tabla. El separador del CSV SHALL poder elegirse entre coma y punto y coma, con punto y coma por defecto. Cuando hay filas seleccionadas, el menu SHALL ofrecer ademas una seccion **Seleccionadas (N)** con las mismas cuatro opciones aplicadas solo a las filas marcadas. Las columnas de persona y relacion SHALL exportarse con el valor de la columna que enseñan, de modo que el archivo exportado vuelva a emparejarse al reimportarlo. Antes de exportar, el sistema SHALL avisar de las filas cuyo enlace ya no resuelve, porque saldrian como celda vacia.

#### Scenario: Exportar CSV

- **WHEN** el constructor elige exportar CSV
- **THEN** se descarga un archivo CSV con la columna id y todas las filas

#### Scenario: Copiar CSV

- **WHEN** el constructor elige copiar CSV
- **THEN** el contenido CSV se copia al portapapeles

#### Scenario: Exportar JSON

- **WHEN** el constructor elige exportar JSON
- **THEN** se descarga un archivo JSON con la columna id y todas las filas

#### Scenario: Copiar JSON

- **WHEN** el constructor elige copiar JSON
- **THEN** el contenido JSON se copia al portapapeles

#### Scenario: Elegir el separador del CSV

- **WHEN** el constructor elige el separador del CSV
- **THEN** se usa ese separador (punto y coma por defecto) en el archivo descargado y en lo copiado

#### Scenario: Exportar la seleccion

- **WHEN** el constructor marca filas y elige una opcion de la seccion Seleccionadas del menu Exportar
- **THEN** la descarga o copia incluye solo las filas marcadas, con las mismas columnas de la exportacion completa

#### Scenario: Sin seleccion no hay seccion de seleccionadas

- **WHEN** el constructor abre el menu Exportar sin filas marcadas
- **THEN** no se muestra la seccion Seleccionadas

#### Scenario: Una relacion se exporta por su llave

- **WHEN** se exporta una tabla con una columna de relacion
- **THEN** el archivo trae el valor de la columna que esa relacion enseña, no el id del registro enlazado

#### Scenario: Ida y vuelta

- **WHEN** se exporta una tabla y ese mismo archivo se vuelve a importar
- **THEN** cada fila queda enlazada al mismo registro al que estaba enlazada antes

#### Scenario: Aviso de enlaces rotos al exportar

- **WHEN** hay filas cuyo enlace ya no resuelve
- **THEN** antes de descargar se dice cuantas son y que esa columna saldra vacia en ellas
