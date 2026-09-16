# builder/tables Specification

## Purpose

Permite al constructor cargar y descargar datos de una tabla en bloque (CSV o JSON) desde el editor, con previsualizacion y control sobre como se guardan las filas, y deja ver las columnas del sistema de la grilla.

## Requirements

### Requirement: Importar datos a la tabla abierta

El editor de una tabla SHALL ofrecer un boton **Importar** que abre un dialogo para arrastrar un archivo o pegar un texto, aceptando solo **CSV o JSON**. La importacion SHALL apuntar a la tabla que esta abierta.

#### Scenario: Abrir la importacion desde una tabla

- **WHEN** el constructor abre una tabla y toca el boton Importar
- **THEN** se abre el dialogo de importacion para esa tabla

#### Scenario: Pegar un texto

- **WHEN** el constructor pega un texto CSV o JSON en el dialogo
- **THEN** el texto se interpreta como el contenido a importar

#### Scenario: Arrastrar un archivo

- **WHEN** el constructor suelta un archivo CSV o JSON en el dialogo
- **THEN** se lee el contenido del archivo como contenido a importar

#### Scenario: Formato no soportado

- **WHEN** el contenido no es ni CSV ni JSON valido
- **THEN** se muestra un error y no se habilita la previsualizacion

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

### Requirement: Bloquear el guardado cuando hay errores

Cuando hay errores SHALL deshabilitarse el boton **Guardar**, mostrarse un aviso con advertencia y ofrecerse un boton **filas fallidas** para descargar las filas con error.

#### Scenario: Errores bloquean el guardado

- **WHEN** hay filas con errores y la casilla de continuar esta desmarcada
- **THEN** el boton Guardar queda deshabilitado

#### Scenario: Descargar las filas fallidas

- **WHEN** hay filas con errores
- **THEN** el constructor puede descargar un archivo con esas filas

### Requirement: Modos de guardado

El constructor SHALL elegir entre tres modos antes de guardar: **Añadir**, **Sobrescribir** y **Reemplazar todo**. El modo Añadir SHALL crear registros nuevos sin tocar los existentes e ignorar las ids del archivo. El modo Sobrescribir SHALL actualizar los registros que coinciden por id y crear los que no. El modo Reemplazar todo SHALL borrar la coleccion y cargar el archivo conservando las ids.

#### Scenario: Añadir ignora las ids

- **WHEN** el modo es Añadir y el archivo trae columnas de id
- **THEN** cada fila entra como registro nuevo con su propia id y no se tocan los existentes

#### Scenario: Sobrescribir por id

- **WHEN** el modo es Sobrescribir y una fila trae una id que ya existe
- **THEN** se actualiza ese registro

#### Scenario: Sobrescribir crea lo que no existe

- **WHEN** el modo es Sobrescribir y una fila trae una id que no existe
- **THEN** se crea un registro nuevo

#### Scenario: Reemplazar todo conserva las ids

- **WHEN** el modo es Reemplazar todo
- **THEN** se borran todas las filas y se cargan las del archivo con sus ids, para no romper las relaciones que apuntan a ellas

### Requirement: Casillas de importacion

El constructor SHALL poder marcar dos casillas opcionales antes de guardar: **"Las celdas vacias borran el valor guardado"** y **"Continuar aunque alguna fila falle"**.

#### Scenario: Celdas vacias borran el valor guardado

- **WHEN** la casilla esta marcada y una celda del archivo viene vacia en un registro que se actualiza
- **THEN** el valor guardado de esa columna se borra

#### Scenario: Continuar aunque falle

- **WHEN** la casilla esta marcada y hay filas con error
- **THEN** se guardan las filas validas y se saltan las que fallan

#### Scenario: Sin la casilla se aborta

- **WHEN** la casilla esta desmarcada y hay filas con error
- **THEN** no se guarda nada

### Requirement: Exportar datos de una tabla

El editor SHALL ofrecer un boton **Exportar** con cuatro opciones: exportar CSV, copiar CSV, exportar JSON y copiar JSON. Todas SHALL incluir la columna id y el contenido completo de la tabla. El separador del CSV SHALL poder elegirse entre coma y punto y coma, con punto y coma por defecto. Cuando hay filas seleccionadas, el menu SHALL ofrecer ademas una seccion **Seleccionadas (N)** con las mismas cuatro opciones aplicadas solo a las filas marcadas. Las columnas de relacion SHALL exportarse con el valor de la columna que enseñan, de modo que el archivo exportado vuelva a emparejarse al reimportarlo. Antes de exportar, el sistema SHALL avisar de las filas cuyo enlace ya no resuelve, porque saldrian como celda vacia.

El archivo descargado SHALL nombrarse con la etiqueta de la tabla, que es la que el constructor ve, y no con su nombre tecnico.

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

#### Scenario: El archivo se llama como la tabla que se ve

- **WHEN** se exporta una tabla cuya etiqueta lleva mayusculas, tildes o espacios
- **THEN** el archivo descargado se llama con esa etiqueta, y soltarlo de vuelta lo reconoce como el archivo de esa tabla

### Requirement: Columnas del sistema en la grilla

Las columnas del sistema **id**, **created** y **updated** SHALL aparecer en la lista "Mostrar columnas" del editor, ocultas por defecto y de solo lectura. Al activarlas SHALL mostrarse como columnas de la grilla que no se pueden editar.

#### Scenario: Aparecen ocultas

- **WHEN** el constructor abre "Mostrar columnas"
- **THEN** ve las columnas id, created y updated, ocultas por defecto

#### Scenario: Activar una columna del sistema

- **WHEN** el constructor activa la columna id en "Mostrar columnas"
- **THEN** la grilla la muestra como una columna de solo lectura

### Requirement: Seleccionar filas con casillas

Cada fila de la grilla SHALL tener una casilla en la columna izquierda fija, y el encabezado de esa columna SHALL tener una casilla que marca o desmarca todas las filas visibles (las de la pagina actual y el filtro activo). Cuando solo una parte de las visibles esta marcada, la casilla del encabezado SHALL verse en estado indeterminado. La fila nueva que todavia no se guardo SHALL NO mostrar casilla.

#### Scenario: Marcar una fila

- **WHEN** el constructor marca la casilla de una fila
- **THEN** la fila queda seleccionada

#### Scenario: Desmarcar una fila

- **WHEN** el constructor desmarca la casilla de una fila seleccionada
- **THEN** la fila deja de estar seleccionada

#### Scenario: Marcar todas las visibles

- **WHEN** el constructor marca la casilla del encabezado
- **THEN** todas las filas visibles (pagina actual + filtro) quedan seleccionadas

#### Scenario: Estado indeterminado del encabezado

- **WHEN** hay filas visibles marcadas y otras sin marcar
- **THEN** la casilla del encabezado muestra el estado indeterminado

#### Scenario: Desmarcar todas las visibles

- **WHEN** el constructor desmarca la casilla del encabezado y habia filas marcadas
- **THEN** todas las filas visibles quedan sin marcar

#### Scenario: La fila nueva no se selecciona

- **WHEN** el constructor escribe una fila nueva sin guardar
- **THEN** esa fila no muestra casilla y no participa de la seleccion

### Requirement: Borrar las filas seleccionadas

Cuando hay filas seleccionadas, la barra de herramientas SHALL mostrar un boton **Borrar (N)** con el conteo. Al tocarlo SHALL abrirse un dialogo de confirmacion que pregunta por el borrado de esas filas. Tras confirmar, las filas se borran y la grilla se recarga; si la pagina queda vacia, se vuelve a la pagina anterior. La seleccion SHALL quedar vacia al cambiar de pagina, filtro o busqueda.

#### Scenario: Confirmar el borrado

- **WHEN** el constructor toca Borrar (N) y confirma el dialogo
- **THEN** se borran las filas marcadas y la grilla se recarga sin ellas

#### Scenario: Cancelar el borrado

- **WHEN** el constructor toca Borrar (N) y cancela el dialogo
- **THEN** no se borra nada y la seleccion se conserva

#### Scenario: Sin seleccion el boton esta deshabilitado

- **WHEN** no hay filas marcadas
- **THEN** el boton Borrar no esta disponible

#### Scenario: Pagina vacia tras borrar

- **WHEN** el borrado deja vacia la pagina que se estaba viendo
- **THEN** la grilla muestra la pagina anterior

#### Scenario: Cambiar de pagina limpia la seleccion

- **WHEN** el constructor cambia de pagina, filtro o busqueda con filas marcadas
- **THEN** la seleccion queda vacia

### Requirement: Elegir cuantas filas mostrar por pagina

El pie de la grilla SHALL ofrecer un selector de filas por pagina con las opciones 25, 50, 100, 500 y **Todas**. La eleccion SHALL guardarse por tabla y aplicarse al recargar la grilla.

#### Scenario: Cambiar el tamano de pagina

- **WHEN** el constructor elige una cantidad en el selector
- **THEN** la grilla muestra esa cantidad de filas por pagina y la paginacion se ajusta

#### Scenario: Mostrar todas las filas

- **WHEN** el constructor elige Todas
- **THEN** la grilla carga todas las filas de una sola vez y oculta la paginacion

#### Scenario: La eleccion se recuerda por tabla

- **WHEN** el constructor cambia el tamano de pagina y vuelve a abrir la misma tabla
- **THEN** la grilla conserva el tamano elegido

### Requirement: Ofrecer convertir una columna de texto que resulta nombrar personas

Cuando los valores de una columna de texto de una tabla coincidan con los de las personas invitadas a la aplicación, el sistema SHALL avisarlo y SHALL ofrecer convertir esa columna en columna de relación a la tabla de personas, diciendo cuántos valores coinciden. Al aceptar, la columna SHALL convertirse y sus filas SHALL quedar enlazadas con la persona que les corresponde.

El sistema SHALL NO convertir la columna sin que se acepte: cambiar el tipo de una columna es cambiar la estructura de la tabla.

La comprobación SHALL hacerse mirando el contenido de la columna, no el nombre que tenga.

#### Scenario: Las filas llegaron antes que las personas

- **WHEN** se crea una tabla con una columna de cédulas cuando todavía no hay nadie invitado, y después se invitan personas cuyas cédulas coinciden
- **THEN** el sistema avisa de cuántos valores coinciden y ofrece convertir esa columna en columna de relación a la tabla de personas

#### Scenario: Aceptar la conversión

- **WHEN** el constructor acepta convertir esa columna
- **THEN** la columna pasa a ser una relación a la tabla de personas y las filas cuyos valores identifican a una sola persona quedan enlazadas

#### Scenario: No aceptar

- **WHEN** el constructor no acepta la conversión
- **THEN** la columna sigue siendo de texto y nada de la tabla cambia

#### Scenario: Una columna que no nombra a nadie

- **WHEN** ninguna de las columnas de texto de la tabla coincide con las personas invitadas
- **THEN** no se avisa de nada
