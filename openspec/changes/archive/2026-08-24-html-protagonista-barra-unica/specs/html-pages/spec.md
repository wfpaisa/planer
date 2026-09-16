## ADDED Requirements

### Requirement: La pagina se dibuja a pantalla completa

El documento HTML de una pagina SHALL ocupar el alto y el ancho completos de la ventana, tanto en la pantalla de quien construye como en la del publico. Ningun elemento de Planer SHALL restarle espacio: el sidebar y la barra Todo En Uno se dibujan encima del documento, nunca a su lado ni por encima de su borde superior.

#### Scenario: El constructor abre una pagina

- **WHEN** quien construye abre una pagina con contenido
- **THEN** el documento ocupa toda la ventana de lado a lado y de arriba abajo
- **AND** el sidebar y la barra se ven superpuestos sobre el

#### Scenario: Un visitante abre una pagina publicada

- **WHEN** un visitante abre una pagina de la aplicacion publicada
- **THEN** el documento ocupa toda la ventana
- **AND** el sidebar se ve superpuesto sobre el

#### Scenario: La misma pagina en las dos pantallas

- **WHEN** se compara una pagina en el panel y en su enlace publico
- **THEN** el documento tiene el mismo tamano en las dos
