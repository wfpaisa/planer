## Purpose

A qué tabla pertenece un archivo de datos que se suelta en el constructor, y qué se hace cuando no pertenece a ninguna. Sin esta decisión un archivo que salió de una tabla vuelve como tabla nueva y duplicada, con los mismos datos y sin ninguna relación con la original.

## ADDED Requirements

### Requirement: La tabla de un archivo soltado se busca en tres capas

Al soltar un archivo de datos en el constructor, el sistema SHALL buscar a qué tabla pertenece aplicando tres capas en orden, y SHALL detenerse en la primera que decida:

1. **Por los identificadores.** Si el archivo trae una columna `id` cuyos valores existen ya como filas de una tabla, es esa tabla.
2. **Por las columnas.** Si las columnas del archivo son exactamente las de una tabla, sin contar la columna `id`, es esa tabla.
3. **Por el nombre.** Si el nombre del archivo, sin su cola de fecha o de versión, coincide con el nombre técnico **o** con la etiqueta de una tabla, es esa tabla.

La comparación de nombres y de columnas SHALL ignorar mayúsculas, tildes y separadores.

#### Scenario: Un archivo exportado vuelve a su tabla aunque se le cambie el nombre

- **WHEN** se exporta una tabla, se renombra el archivo y se vuelve a soltar en el constructor
- **THEN** el sistema lo reconoce como el archivo de esa tabla por los identificadores de su columna `id`

#### Scenario: Un archivo exportado vuelve a su tabla aunque se le añada una columna

- **WHEN** se exporta una tabla, se le añade una columna en una hoja de cálculo y se vuelve a soltar
- **THEN** el sistema lo reconoce como el archivo de esa tabla, porque la capa de los identificadores decide antes que la de las columnas

#### Scenario: Un archivo hecho a imagen de una tabla, sin identificadores

- **WHEN** se suelta un archivo sin columna `id` cuyas columnas son exactamente las de una tabla
- **THEN** el sistema lo reconoce como el archivo de esa tabla

#### Scenario: Una columna de más o de menos no basta

- **WHEN** se suelta un archivo sin columna `id` al que le falta una columna de la tabla, o que trae una que la tabla no tiene
- **THEN** la capa de las columnas no decide, y se pasa a la del nombre

#### Scenario: El nombre técnico también cuenta

- **WHEN** se suelta un archivo cuyo nombre coincide con el nombre técnico de una tabla pero no con su etiqueta
- **THEN** el sistema lo reconoce como el archivo de esa tabla

#### Scenario: Un archivo que no es de ninguna tabla

- **WHEN** ninguna de las tres capas encuentra una tabla
- **THEN** el sistema ofrece crear una tabla nueva con ese archivo

### Requirement: Un empate no se resuelve adivinando

Cuando una capa encuentra más de una tabla, esa capa SHALL NO elegir ninguna: el sistema SHALL pasar a la capa siguiente. Si ninguna capa decide, el archivo SHALL tratarse como un archivo que no pertenece a ninguna tabla. El sistema SHALL NO escribir en una tabla elegida entre varias candidatas.

#### Scenario: Dos tablas con la misma etiqueta

- **WHEN** la aplicación tiene dos tablas con la misma etiqueta y se suelta un archivo cuyo nombre coincide con ella
- **THEN** el sistema no importa en ninguna de las dos y ofrece crear una tabla nueva

#### Scenario: Un empate en una capa lo resuelve la siguiente

- **WHEN** dos tablas tienen exactamente las mismas columnas y el archivo trae identificadores de una de ellas
- **THEN** decide la capa de los identificadores, que se aplica antes

### Requirement: Un archivo de personas se importa en la tabla de personas

Un archivo que el sistema reconozca como el de la tabla de personas SHALL importarse en ella, con el camino que crea las cuentas. El sistema SHALL NO crear una tabla nueva con el contenido de un archivo de personas.

#### Scenario: Soltar el archivo exportado de la tabla de personas

- **WHEN** se exporta la tabla de personas y ese archivo se suelta en el constructor
- **THEN** se ofrece importarlo en la tabla de personas, y no crear una tabla nueva

#### Scenario: No nace una tabla de personas paralela

- **WHEN** el archivo de personas se importa
- **THEN** la aplicación sigue teniendo una sola tabla de personas
