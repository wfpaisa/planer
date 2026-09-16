## MODIFIED Requirements

### Requirement: Exportar datos de una tabla

El editor SHALL ofrecer un boton **Exportar** con cuatro opciones: exportar CSV, copiar CSV, exportar JSON y copiar JSON. Todas SHALL incluir la columna id y el contenido completo de la tabla. El separador del CSV SHALL poder elegirse entre coma y punto y coma, con punto y coma por defecto. Cuando hay filas seleccionadas, el menu SHALL ofrecer ademas una seccion **Seleccionadas (N)** con las mismas cuatro opciones aplicadas solo a las filas marcadas.

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

## ADDED Requirements

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