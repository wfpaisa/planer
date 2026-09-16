## Purpose

Hace visible cuando un bloque apunta a una tabla o a una columna que cambio o desaparecio, corrige solo los cambios de nombre y lleva al constructor al punto exacto donde arreglarlo.

## ADDED Requirements

### Requirement: Renombrar una columna corrige los bloques

Cuando una columna cambia de nombre conservando su identidad, el sistema SHALL actualizar solo todos los bloques de la app que la nombraban y SHALL dejar constancia del arreglo.

#### Scenario: Renombrar una columna usada en un listado

- **WHEN** la columna `precio` de una tabla pasa a llamarse `valor` y hay un bloque de listado que la mostraba
- **THEN** el bloque pasa a nombrar `valor`
- **AND** el bloque la sigue mostrando
- **AND** queda un aviso informativo que dice que se corrigio solo

#### Scenario: Renombrar una columna usada en un indicador

- **WHEN** una columna que usa un indicador cambia de nombre
- **THEN** el indicador pasa a nombrar la columna nueva

#### Scenario: Renombrar la columna de orden

- **WHEN** una columna usada para ordenar un bloque cambia de nombre
- **THEN** el orden del bloque pasa a nombrar la columna nueva

### Requirement: Revision de referencias

El sistema SHALL poder revisar una app entera y devolver la lista de bloques cuyas referencias no existen, indicando pagina, bloque, que falta y con que gravedad.

Los niveles SHALL ser:

- `broken`: el bloque no puede mostrarse (su tabla ya no existe).
- `warning`: al bloque le falta algo pero se muestra (una columna, un indicador, un orden).

#### Scenario: Tabla eliminada

- **WHEN** se elimina una tabla que usaba un bloque y se revisa la app
- **THEN** aparece un aviso de nivel `broken` con el nombre de la pagina y del bloque

#### Scenario: Columna eliminada

- **WHEN** se elimina una columna que mostraba un bloque y se revisa la app
- **THEN** aparece un aviso de nivel `warning` que nombra esa columna

#### Scenario: Indicador con columna que no sirve

- **WHEN** un indicador suma una columna que ya no es numerica
- **THEN** aparece un aviso de nivel `warning` que lo explica

#### Scenario: App sana

- **WHEN** todas las referencias de los bloques existen
- **THEN** la revision no devuelve ningun aviso

### Requirement: Hueco marcado en vez de columna escondida

En el editor y en la previsualizacion, un bloque que nombra una columna inexistente SHALL mostrarla como un hueco marcado y SHALL seguir mostrando el resto. En la app publicada esa columna SHALL omitirse sin ninguna marca.

#### Scenario: Ver el hueco en el editor

- **WHEN** el constructor abre una pagina con un bloque que nombra una columna eliminada
- **THEN** ve una marca en el lugar de esa columna
- **AND** el resto de las columnas se muestra normal

#### Scenario: El visitante no ve la marca

- **WHEN** un visitante abre esa misma pagina en el enlace publico
- **THEN** no ve ninguna marca ni mensaje de error
- **AND** ve el resto de las columnas

### Requirement: Tabla ausente frente a tabla sin elegir

Un bloque sin tabla elegida y un bloque cuya tabla fue eliminada SHALL mostrar mensajes distintos en el editor.

#### Scenario: Bloque recien creado

- **WHEN** un bloque todavia no tiene tabla elegida
- **THEN** el editor dice que falta elegir una tabla

#### Scenario: Bloque con la tabla eliminada

- **WHEN** la tabla que usaba el bloque fue eliminada
- **THEN** el editor dice que esa tabla ya no existe

#### Scenario: El visitante no ve el bloque roto

- **WHEN** un visitante abre una pagina con un bloque cuya tabla ya no existe
- **THEN** el bloque no se muestra
- **AND** el resto de la pagina se muestra normal

### Requirement: Panel de revision con acceso al bloque

El sistema SHALL ofrecer al constructor la lista de avisos de la app agrupada por pantalla, y cada aviso SHALL llevar al bloque afectado.

#### Scenario: Ir al bloque desde el aviso

- **WHEN** el constructor abre el panel de revision y elige un aviso
- **THEN** se abre la pantalla de ese bloque
- **AND** el bloque queda a la vista

### Requirement: Avisos informativos de la app

Los arreglos automaticos SHALL guardarse como avisos informativos de la app, el constructor SHALL poder descartarlos, y SHALL conservarse solo los mas recientes hasta un tope.

#### Scenario: Descartar los avisos

- **WHEN** el constructor descarta los avisos informativos
- **THEN** dejan de aparecer en el panel de revision
