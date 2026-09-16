## Purpose

Permite al constructor cargar y descargar datos de una tabla en bloque (CSV o JSON) desde el editor, con previsualizacion y control sobre como se guardan las filas, y deja ver las columnas del sistema de la grilla.

## ADDED Requirements

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

Las columnas del archivo SHALL emparejarse con las columnas de la tabla. Las columnas del archivo que no existan en la tabla SHALL poder crearse como columnas nuevas. Las columnas de la tabla que no vengan en el archivo SHALL quedar sin valor en las filas nuevas.

#### Scenario: Coincidencia por nombre

- **WHEN** una columna del archivo coincide con el nombre o la etiqueta de una columna de la tabla
- **THEN** los valores de esa columna se destinan a la columna de la tabla correspondiente

#### Scenario: Crear una columna nueva

- **WHEN** una columna del archivo no existe en la tabla
- **THEN** se ofrece crearla como columna nueva de la tabla

#### Scenario: Columna de la tabla sin datos en el archivo

- **WHEN** una columna de la tabla no viene en el archivo
- **THEN** esa columna queda sin valor en las filas importadas

### Requirement: Convertir valores segun el tipo de columna

Al importar SHALL convertirse los valores segun el tipo de la columna: numeros, si/no y fechas (a un formato de fecha comun). Las columnas de tipo archivo, persona y relacion SHALL NO convertirse; si el valor parece un id se guarda tal cual, y si no, queda vacio. Un valor que no se puede convertir al tipo de su columna SHALL marcarse como error de esa fila.

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

#### Scenario: Id sin convertir en relacion

- **WHEN** una celda destinada a una columna de persona o relacion trae un id
- **THEN** el id se guarda tal cual, sin convertir

### Requirement: Previsualizar antes de guardar

El constructor SHALL poder ver una previsualizacion a pantalla completa con todos los datos del archivo, el total de filas y, cuando hay errores, el listado de errores. En el modo Sobrescribir SHALL marcarse cada fila como **nueva** o **actualizara la fila X**.

#### Scenario: Ver la previsualizacion

- **WHEN** hay contenido importable y el constructor toca Previsualizar
- **THEN** se abre la previsualizacion a pantalla completa con las filas y el total

#### Scenario: Ver los errores

- **WHEN** hay filas con errores
- **THEN** la previsualizacion muestra cuantas hay y el listado de errores

#### Scenario: Marcar el destino de cada fila

- **WHEN** el modo es Sobrescribir
- **THEN** cada fila del archivo aparece marcada como nueva o como actualizara la fila con la que coincide por id

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

El editor SHALL ofrecer un boton **Exportar** con cuatro opciones: exportar CSV, copiar CSV, exportar JSON y copiar JSON. Todas SHALL incluir la columna id y el contenido completo de la tabla. El separador del CSV SHALL poder elegirse entre coma y punto y coma, con punto y coma por defecto.

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

### Requirement: Columnas del sistema en la grilla

Las columnas del sistema **id**, **created** y **updated** SHALL aparecer en la lista "Mostrar columnas" del editor, ocultas por defecto y de solo lectura. Al activarlas SHALL mostrarse como columnas de la grilla que no se pueden editar.

#### Scenario: Aparecen ocultas

- **WHEN** el constructor abre "Mostrar columnas"
- **THEN** ve las columnas id, created y updated, ocultas por defecto

#### Scenario: Activar una columna del sistema

- **WHEN** el constructor activa la columna id en "Mostrar columnas"
- **THEN** la grilla la muestra como una columna de solo lectura
