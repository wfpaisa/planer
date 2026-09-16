## MODIFIED Requirements

### Requirement: Modal de opciones de una pagina

Al pulsar "Opciones" en una pagina del builder, el sistema SHALL abrir un modal con todos los ajustes de esa pagina en lugar de un menu desplegable.

El ajuste de quien abre la pagina SHALL ser una lista de marcas: `Todos` y un renglon por cada rol que la aplicacion define. El modal SHALL NO ofrecer ningun otro ajuste de acceso.

#### Scenario: Abrir las opciones de una pagina

- **WHEN** el constructor pulsa el boton de opciones de una pagina
- **THEN** se abre un modal con los campos de nombre, icono, quien la abre, inicio y un boton para borrar

#### Scenario: Cambiar el nombre de la pagina

- **WHEN** el constructor cambia el nombre de la pagina en el modal
- **THEN** al guardar, la pagina conserva su identidad y solo cambia su nombre

#### Scenario: Cambiar el icono de la pagina

- **WHEN** el constructor elige un icono distinto en el modal
- **THEN** al guardar, la pagina usa el icono elegido

#### Scenario: Elegir quien ve la pagina

- **WHEN** el constructor marca los roles que pueden abrir la pagina
- **THEN** al guardar, solo esos roles pueden abrirla, y el resto ni siquiera la ve en el menu

#### Scenario: Dejar la pagina abierta a todos

- **WHEN** el constructor abre las opciones de una pagina recien creada
- **THEN** `Todos` aparece marcada y ningun rol lo esta

#### Scenario: Guardar conjunto de opciones

- **WHEN** el constructor cambia varios campos y pulsa "Guardar"
- **THEN** todos los cambios se guardan juntos
