# builder-omnibar (delta)

## MODIFIED Requirements

### Requirement: Los dialogos nacen de la barra

Al abrir cualquier panel de la barra (IA, publicar, compartir, ajustes de la aplicacion, ajustes de la pagina, cambios, importar HTML e impacto en los datos), la barra SHALL viajar desde la posicion que ocupa hasta el centro de la ventana y convertirse en un modal centrado, con el documento de atras oscurecido y desenfocado. La fila de botones de la barra SHALL viajar con el modal y conservarse en su parte inferior. Al cerrarse o guardarse, el modal SHALL encogerse hasta la posicion que ocupaba la barra y el fondo desenfocado SHALL disolverse. La tecla de escape SHALL cerrar siempre el panel abierto.

El panel de codigo HTML SHALL NO viajar: SHALL crecer en su sitio, sin fondo desenfocado.

#### Scenario: Abrir un dialogo con la barra centrada

- **WHEN** la pagina esta en blanco y se abre un panel desde la barra
- **THEN** el modal aparece centrado en la ventana
- **AND** el documento de atras queda oscurecido y desenfocado

#### Scenario: Abrir un dialogo con la barra abajo

- **WHEN** la pagina tiene contenido y se abre un panel desde la barra
- **THEN** la barra viaja desde la parte inferior hasta el centro de la ventana
- **AND** se entiende que es la misma barra

#### Scenario: La base de la barra se conserva

- **WHEN** un panel esta abierto como modal
- **THEN** la fila de botones de la barra se ve en la parte inferior del modal

#### Scenario: Cerrar con escape

- **WHEN** hay un panel abierto y se pulsa la tecla de escape
- **THEN** el modal se encoge hasta la posicion de la barra y el fondo se disuelve

#### Scenario: Cerrar con un clic en el fondo

- **WHEN** hay un panel abierto y se hace clic en el fondo desenfocado
- **THEN** el modal se encoge hasta la posicion de la barra y el fondo se disuelve

#### Scenario: El codigo no viaja

- **WHEN** se abre el panel de codigo HTML
- **THEN** crece en su sitio, sin fondo desenfocado y sin desplazarse al centro

## ADDED Requirements

### Requirement: El viaje no se rompe sin la animacion

Si el navegador no soporta la animacion del viaje, el cambio entre la barra y el modal SHALL hacerse al instante, sin perder ninguna funcion. Si el sistema del usuario tiene activa la opcion de reducir animaciones, el cambio SHALL hacerse al instante.

#### Scenario: Navegador sin la animacion

- **WHEN** se abre un panel en un navegador que no soporta la animacion
- **THEN** el panel aparece al instante como modal centrado con su fondo desenfocado

#### Scenario: Reducir animaciones del sistema

- **WHEN** el sistema del usuario tiene activa la opcion de reducir animaciones
- **THEN** el cambio entre la barra y el modal se hace sin viaje
