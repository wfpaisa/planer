## MODIFIED Requirements

### Requirement: Borrador separado de lo publicado

El diseno que el constructor edita (colores, paginas con su HTML, roles, etiquetas y orden de columnas) SHALL ser un borrador. El enlace publico SHALL servir la version publicada, no el borrador.

#### Scenario: Editar no cambia el enlace publico

- **WHEN** una app tiene una version publicada y el constructor cambia el HTML de una pagina
- **THEN** el enlace publico sigue mostrando la version publicada
- **AND** el borrador guarda el cambio

#### Scenario: App publicada sin historial previo

- **WHEN** una app esta marcada como publicada pero no tiene ninguna version en su historial
- **THEN** el enlace publico sirve el estado vivo del diseno
- **AND** la primera publicacion crea la version inicial y pasa a servirla

#### Scenario: App sin publicar

- **WHEN** una app no esta publicada
- **THEN** el enlace publico responde que la aplicacion todavia no esta publicada

### Requirement: Una version guarda presentacion, nunca datos

Una version SHALL guardar unicamente presentacion: colores y tema, paginas con el HTML de cada una y su lista de tablas declaradas, roles de la app, y por cada tabla su etiqueta, icono, orden, presentacion de columnas y las etiquetas de sus columnas. Restaurar SHALL NO crear, borrar ni cambiar el tipo de ninguna columna, y SHALL NO tocar las filas.

#### Scenario: Restaurar no devuelve datos borrados

- **WHEN** se borran filas de una tabla y luego se restaura una version anterior
- **THEN** las filas siguen borradas

#### Scenario: Restaurar no revive una columna eliminada

- **WHEN** se elimina una columna y luego se restaura una version que la nombraba
- **THEN** la columna sigue sin existir
- **AND** las paginas que la declaraban dejan de recibirla

#### Scenario: Restaurar sobre una estructura que cambio

- **WHEN** se restaura una version cuyo HTML espera columnas que ya no existen
- **THEN** el sistema avisa antes de restaurar de que la estructura de tablas cambio desde esa version

## ADDED Requirements

### Requirement: El HTML de las paginas se guarda por contenido

Una version SHALL referenciar el documento HTML de cada pagina por la huella de su contenido, no copiarlo. Un documento SHALL conservarse mientras lo nombre el borrador o cualquier version viva, y SHALL borrarse cuando ya no lo nombre nadie.

#### Scenario: Varias versiones sin cambios en una pagina

- **WHEN** se crean varias versiones sin tocar el HTML de una pagina
- **THEN** ese documento se guarda una sola vez

#### Scenario: Un documento se queda sin duenos

- **WHEN** se elimina la ultima version que nombraba un documento y el borrador tampoco lo nombra
- **THEN** ese documento se borra
