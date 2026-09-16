# published/member-session Specification

## Purpose
Gestiona la sesion del miembro (invitado) desde la vista de la aplicacion publicada, y permite cerrar la sesion cuando una sesion previa ya no tiene acceso a la aplicacion.

## Requirements

### Requirement: Cerrar sesion en la vista sin acceso

La vista de error de acceso de la aplicacion publicada SHALL mostrar un boton "Cerrar sesion" que borre la sesion del miembro y recargue la aplicacion, para que el usuario pueda iniciar sesion con otra cuenta.

#### Scenario: Miembro sin acceso cierra la sesion

- **WHEN** un miembro con una sesion guardada abre la aplicacion publica y ve el mensaje "No tienes acceso a esta aplicacion"
- **THEN** la vista muestra un boton "Cerrar sesion"
- **AND** al pulsarlo, la sesion del miembro se borra y la aplicacion se recarga mostrando la pantalla de inicio de sesion

#### Scenario: Cerrar sesion limpiamente

- **WHEN** el miembro pulsa "Cerrar sesion" en la vista sin acceso
- **THEN** la sesion guardada en el cliente de la aplicacion publicada queda vacia (el miembro ya no esta autenticado tras la recarga)

### Requirement: El boton solo aparece ante falta de acceso

La vista de error de la aplicacion publicada SHALL mostrar el boton "Cerrar sesion" unicamente cuando el motivo del error es falta de acceso, no en otros casos de error (aplicacion no publicada, no existe o error generico).

#### Scenario: Error no relacionado con acceso

- **WHEN** la vista de error se muestra por un motivo que no es falta de acceso (por ejemplo, aplicacion no publicada o no existe)
- **THEN** la vista no muestra el boton "Cerrar sesion" y conserva su comportamiento actual
