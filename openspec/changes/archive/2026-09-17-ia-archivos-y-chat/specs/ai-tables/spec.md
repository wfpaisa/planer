## ADDED Requirements

### Requirement: La IA llena una tabla con los datos de un archivo adjunto

La IA SHALL poder llenar una tabla existente con las filas de un archivo adjuntado a la conversacion, diciendo a que columna de la tabla va cada columna del archivo.

Lo que la IA manda SHALL ser ese emparejamiento, no los datos: el sistema lee el archivo guardado, convierte cada celda al tipo de su columna y escribe las filas.

Una columna del archivo que no se empareje con ninguna de la tabla SHALL quedarse fuera. Una fila cuyas celdas no se puedan convertir SHALL quedarse fuera. Todo lo que quede fuera SHALL contarse y decirse en la respuesta.

La cantidad de filas que entran de una vez SHALL respetar el mismo tope que la importacion manual. Un archivo con mas filas que el tope SHALL NO escribirse a medias: no entra nada y se dice cuantas traia.

#### Scenario: Llenar una tabla recien creada desde el CSV que la origino

- **WHEN** quien construye adjunta un CSV, pide crear la tabla y llenarla
- **THEN** la tabla queda creada y con sus filas dentro
- **AND** la respuesta dice cuantas filas entraron

#### Scenario: El archivo trae una columna que la tabla no tiene

- **WHEN** el archivo trae una columna que no existe en la tabla y no se empareja con ninguna
- **THEN** esa columna se queda fuera
- **AND** la respuesta lo dice

#### Scenario: Celdas que no se pueden convertir

- **WHEN** algunas filas traen una fecha que no se entiende
- **THEN** esas filas se quedan fuera
- **AND** la respuesta dice cuantas

#### Scenario: Un archivo mas grande que el tope

- **WHEN** el archivo trae mas filas que el tope de una importacion
- **THEN** no se escribe ninguna fila
- **AND** se dice cuantas traia y cual es el tope

#### Scenario: Llenar no cambia la estructura

- **WHEN** la IA llena una tabla
- **THEN** las columnas de la tabla quedan como estaban

#### Scenario: Llenar una tabla que ya tiene filas

- **WHEN** la IA llena una tabla que ya tenia filas dentro
- **THEN** las filas nuevas se anaden
- **AND** ninguna de las que habia se borra ni se reemplaza
- **AND** se avisa de que la tabla ya tenia datos
