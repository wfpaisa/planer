## Purpose

Reune en un modal unico las opciones de una pagina del builder (nombre, icono, quien la ve, inicio y borrado) y garantiza que la aplicacion siempre tenga exactamente una pagina de inicio.

## ADDED Requirements

### Requirement: Modal de opciones de una pagina

Al pulsar "Opciones" en una pagina del builder, el sistema SHALL abrir un modal con todos los ajustes de esa pagina en lugar de un menu desplegable.

#### Scenario: Abrir las opciones de una pagina

- **WHEN** el constructor pulsa el boton de opciones de una pagina
- **THEN** se abre un modal con los campos de nombre, icono, quien la ve, inicio y un boton para borrar

#### Scenario: Cambiar el nombre de la pagina

- **WHEN** el constructor cambia el nombre de la pagina en el modal
- **THEN** al guardar, la pagina conserva su identidad y solo cambia su nombre

#### Scenario: Cambiar el icono de la pagina

- **WHEN** el constructor elige un icono distinto en el modal
- **THEN** al guardar, la pagina usa el icono elegido

#### Scenario: Elegir quien ve la pagina

- **WHEN** el constructor marca los roles que pueden abrir la pagina
- **THEN** al guardar, solo esos roles pueden verla, y el resto ni siquiera la ve en el menu

#### Scenario: Guardar conjunto de opciones

- **WHEN** el constructor cambia varios campos y pulsa "Guardar"
- **THEN** todos los cambios se guardan juntos

### Requirement: Invariante de pagina de inicio

El sistema SHALL garantizar que una aplicacion siempre tenga exactamente una pagina de inicio.

#### Scenario: La pagina de inicio no se puede desmarcar

- **WHEN** el constructor edita la pagina que es inicio
- **THEN** la opcion de inicio aparece marcada y no puede quedar sin pagina de inicio

#### Scenario: Cambiar la pagina de inicio

- **WHEN** el constructor marca otra pagina como inicio
- **THEN** esa pagina pasa a ser la unica de inicio al guardar

#### Scenario: Borrar la ultima pagina

- **WHEN** el constructor borra la unica pagina que queda en la aplicacion
- **THEN** la aplicacion queda con una pagina nueva llamada "Inicio", con icono de inicio, marcada como inicio y sin roles

### Requirement: Confirmacion de borrado de pagina

El sistema SHALL pedir confirmacion antes de borrar una pagina, sin usar el cuadro de confirmacion nativo del navegador.

#### Scenario: Confirmar el borrado

- **WHEN** el constructor pulsa borrar en el modal de opciones
- **THEN** se muestra un dialogo de confirmacion propio
- **AND** la pagina solo se borra si el constructor lo confirma
