## Purpose

Define la retirada de la barra superior del panel de construccion y donde queda cada una de las entradas que ofrecia, para que ninguna se pierda y ninguna quede duplicada.

## ADDED Requirements

### Requirement: El panel no tiene barra superior

El panel de construccion SHALL NO mostrar ninguna barra fija sobre el documento de la pagina. Todo el alto de la ventana SHALL quedar para el documento.

#### Scenario: Abrir una pagina en el panel

- **WHEN** quien construye abre una pagina de su aplicacion
- **THEN** no hay ninguna barra sobre el documento
- **AND** el documento empieza en el borde superior de la ventana

### Requirement: Ninguna entrada se pierde al retirar la barra superior

Cada entrada que ofrecia la barra superior SHALL seguir alcanzandose. Volver al panel de aplicaciones y el modo claro u oscuro SHALL vivir en el sidebar. Publicar, el nombre y el icono de la aplicacion, la base de datos y los ajustes de la aplicacion SHALL vivir en la barra Todo En Uno.

#### Scenario: Volver al panel de aplicaciones

- **WHEN** quien construye quiere salir a su lista de aplicaciones
- **THEN** encuentra la salida en el sidebar

#### Scenario: Publicar

- **WHEN** quien construye quiere publicar
- **THEN** encuentra publicar en la barra Todo En Uno

#### Scenario: Cambiar el nombre de la aplicacion

- **WHEN** quien construye quiere renombrar la aplicacion
- **THEN** lo hace en los ajustes de la aplicacion, dentro de la barra

#### Scenario: Ir a la base de datos

- **WHEN** quien construye quiere ver sus tablas
- **THEN** llega a ellas desde los ajustes de la aplicacion, dentro de la barra

### Requirement: Ninguna entrada esta en dos sitios

Cada accion de construccion SHALL tener un solo lugar donde vive. El sistema SHALL NO ofrecer la misma accion desde el sidebar y desde la barra a la vez.

#### Scenario: Buscar el modo claro u oscuro

- **WHEN** quien construye busca cambiar entre claro y oscuro
- **THEN** lo encuentra solo en el sidebar

#### Scenario: Buscar la salida al panel

- **WHEN** quien construye busca la salida al panel de aplicaciones
- **THEN** la encuentra solo en el sidebar

### Requirement: La base de datos se abre encima de la pagina

La base de datos SHALL abrirse como una capa encima de la pagina y SHALL cerrarse devolviendo a la misma pagina que estaba abierta. SHALL NO ser una seccion hermana a la que se navega perdiendo el sitio.

#### Scenario: Abrir y cerrar la base de datos

- **WHEN** quien construye abre la base de datos desde una pagina y luego la cierra
- **THEN** vuelve a la misma pagina que estaba abierta
