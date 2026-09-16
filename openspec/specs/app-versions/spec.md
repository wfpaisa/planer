# app-versions Specification

## Purpose

Separa lo que el constructor esta editando de lo que ven los visitantes, y guarda un historial de publicaciones que se puede previsualizar, restaurar y limpiar sin tocar los datos de la aplicacion.

## Requirements

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

### Requirement: Publicar crea una version

Publicar SHALL tomar una fotografia del borrador, guardarla en el historial y marcarla como la version en vivo.

#### Scenario: Publicar con cambios pendientes

- **WHEN** el constructor publica y el borrador es distinto de la version en vivo
- **THEN** se crea una version nueva con la fecha y el autor
- **AND** esa version queda marcada como la que esta en vivo
- **AND** la aplicacion queda publicada

#### Scenario: Publicar sin cambios

- **WHEN** el constructor publica y el borrador es identico a la version en vivo
- **THEN** no se crea una version repetida
- **AND** la aplicacion queda publicada

### Requirement: Puntos de guardado manuales

El constructor SHALL poder crear un punto de guardado con nombre mientras trabaja, sin publicar.

#### Scenario: Guardar un punto

- **WHEN** el constructor crea un punto de guardado con el nombre "antes de cambiar los colores"
- **THEN** aparece una version nueva en el historial con ese nombre
- **AND** la version en vivo no cambia
- **AND** el enlace publico no cambia

### Requirement: Historial visible

El sistema SHALL ofrecer el historial de versiones de una app con fecha, autor, nombre opcional, tipo (publicacion o punto de guardado) y cual esta en vivo, y SHALL indicar si el borrador tiene cambios sin publicar.

#### Scenario: Consultar el historial

- **WHEN** el constructor abre el historial de su app
- **THEN** ve las versiones ordenadas de la mas reciente a la mas antigua
- **AND** la version en vivo aparece marcada
- **AND** ve si hay cambios sin publicar

#### Scenario: Historial de otra persona

- **WHEN** alguien que no es el dueno de la app pide su historial
- **THEN** la peticion es rechazada

### Requirement: Previsualizar el borrador y las versiones

El constructor SHALL poder ver el borrador o cualquier version del historial con la misma presentacion que ve un visitante, sin publicarla.

#### Scenario: Previsualizar una version antigua

- **WHEN** el constructor previsualiza una version del historial
- **THEN** ve las paginas, bloques y colores tal como estaban en esa version
- **AND** el enlace publico no cambia

#### Scenario: Previsualizar sin ser el dueno

- **WHEN** alguien que no es el dueno pide la previsualizacion
- **THEN** la peticion es rechazada

#### Scenario: Salir de la previsualizacion deja el editor como estaba

- **WHEN** el constructor abre la previsualizacion desde el historial y despues sale de ella
- **THEN** vuelve al editor tal como lo dejo
- **AND** el historial sigue abierto, sin tener que abrirlo de nuevo

### Requirement: Publicar y compartir son acciones separadas

Publicar y compartir el enlace SHALL ser dos acciones distintas. Publicar SHALL NO abrir lo que sirve para compartir, y compartir SHALL NO publicar nada.

El estado del borrador SHALL verse en la accion de publicar: mientras haya cambios sin publicar SHALL distinguirse a simple vista, y al publicar SHALL volver a su aspecto normal.

#### Scenario: Compartir no publica

- **WHEN** el constructor abre lo que sirve para compartir
- **THEN** ve el enlace y quien tiene acceso
- **AND** no se publica ninguna version

#### Scenario: Publicar no abre el enlace

- **WHEN** el constructor publica y no hay bloques con problemas
- **THEN** la version sale publicada
- **AND** no se le muestra lo de compartir

#### Scenario: El aviso de cambios aparece al editar

- **WHEN** el constructor cambia algo del diseno
- **THEN** la accion de publicar se distingue a simple vista y anuncia que hay cambios sin publicar
- **AND** no hace falta recargar ni abrir ningun panel para que se entere

#### Scenario: Al publicar se apaga el aviso

- **WHEN** el constructor publica esos cambios
- **THEN** la accion de publicar vuelve a su aspecto normal

### Requirement: Restaurar una version

Restaurar una version SHALL copiar su contenido al borrador y SHALL NO publicarla.

#### Scenario: Restaurar

- **WHEN** el constructor restaura una version antigua
- **THEN** el borrador queda con el contenido de esa version
- **AND** el enlace publico sigue mostrando la version que estaba en vivo
- **AND** se informa de los avisos que deja esa restauracion

#### Scenario: Publicar despues de restaurar

- **WHEN** el constructor publica despues de restaurar
- **THEN** se crea una version nueva con ese contenido y pasa a estar en vivo

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

### Requirement: Nombrar, fijar y eliminar versiones

El constructor SHALL poder ponerle nombre a una version, fijarla y eliminarla. La version en vivo SHALL NO poder eliminarse. Las versiones no fijadas SHALL recortarse automaticamente cuando el historial supera el tope de la app.

#### Scenario: Eliminar una version

- **WHEN** el constructor elimina una version que no esta en vivo
- **THEN** desaparece del historial

#### Scenario: Intentar eliminar la version en vivo

- **WHEN** el constructor intenta eliminar la version que esta en vivo
- **THEN** la peticion es rechazada con un mensaje que lo explica

#### Scenario: Recorte automatico

- **WHEN** el historial supera el tope de versiones
- **THEN** se eliminan las mas antiguas que no esten fijadas ni en vivo

### Requirement: Aviso antes de publicar o restaurar

Al publicar y al restaurar, el sistema SHALL informar cuantos bloques quedan con problemas de referencia.

#### Scenario: Publicar con bloques rotos

- **WHEN** el constructor publica y hay bloques que nombran columnas o tablas que no existen
- **THEN** la respuesta incluye el resumen de esos avisos

### Requirement: El HTML de las paginas se guarda por contenido

Una version SHALL referenciar el documento HTML de cada pagina por la huella de su contenido, no copiarlo. Un documento SHALL conservarse mientras lo nombre el borrador o cualquier version viva, y SHALL borrarse cuando ya no lo nombre nadie.

#### Scenario: Varias versiones sin cambios en una pagina

- **WHEN** se crean varias versiones sin tocar el HTML de una pagina
- **THEN** ese documento se guarda una sola vez

#### Scenario: Un documento se queda sin duenos

- **WHEN** se elimina la ultima version que nombraba un documento y el borrador tampoco lo nombra
- **THEN** ese documento se borra
