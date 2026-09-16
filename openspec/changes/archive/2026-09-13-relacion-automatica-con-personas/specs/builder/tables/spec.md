## ADDED Requirements

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

## MODIFIED Requirements

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
