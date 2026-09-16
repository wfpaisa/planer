## Purpose

Define la barra Todo En Uno: la superficie flotante desde la que quien construye escribe, ajusta y comparte, y la forma en que sus dialogos nacen de la barra y vuelven a ella.

## ADDED Requirements

### Requirement: La barra es solo para quien construye

La barra Todo En Uno SHALL mostrarse unicamente a quien construye la aplicacion. Un visitante SHALL NO verla en ninguna pagina.

#### Scenario: Visitante en una pagina publicada

- **WHEN** un visitante abre una pagina de la aplicacion publicada
- **THEN** no ve la barra Todo En Uno

### Requirement: Contenido de la barra

La barra SHALL ofrecer, en este orden: el boton de IA, el campo de texto, compartir, los ajustes de la aplicacion y los ajustes de la pagina. SHALL NO ofrecer una zona de arrastre propia ni la salida al panel de aplicaciones.

#### Scenario: Soltar un archivo

- **WHEN** se suelta un archivo en cualquier parte de la pagina
- **THEN** el sistema lo acepta sin que haya que apuntar a una zona concreta

### Requirement: Posicion segun el contenido de la pagina

La barra SHALL colocarse centrada en vertical y horizontal cuando la pagina esta en blanco, y en la parte inferior cuando la pagina tiene contenido. El paso de una posicion a la otra SHALL ser un movimiento continuo.

#### Scenario: Pagina en blanco

- **WHEN** se abre una pagina sin contenido
- **THEN** la barra aparece centrada

#### Scenario: La pagina recibe su primer contenido

- **WHEN** una pagina en blanco pasa a tener contenido
- **THEN** la barra se desplaza hasta la parte inferior con un movimiento visible
- **AND** se entiende que es la misma barra

### Requirement: Los dialogos nacen de la barra

Al abrir cualquier dialogo desde la barra, el dialogo SHALL crecer desde la posicion que ocupa la barra en ese momento. Al cerrarse o guardarse, SHALL encogerse hasta la barra. La tecla de escape SHALL cerrar siempre el dialogo abierto.

#### Scenario: Abrir un dialogo con la barra centrada

- **WHEN** la pagina esta en blanco y se abre un dialogo
- **THEN** el dialogo crece desde el centro

#### Scenario: Abrir un dialogo con la barra abajo

- **WHEN** la pagina tiene contenido y se abre un dialogo
- **THEN** el dialogo crece desde la parte inferior

#### Scenario: Cerrar con escape

- **WHEN** hay un dialogo abierto y se pulsa la tecla de escape
- **THEN** el dialogo se encoge hasta la barra y se cierra

### Requirement: Dos iconos de ajustes con dueno claro

La barra SHALL separar los ajustes en dos iconos. Los ajustes de la aplicacion SHALL cubrir nombre, icono, paleta, base de datos, personas y roles, e importar HTML. Los ajustes de la pagina SHALL cubrir nombre e icono de la pagina, quien puede verla, ver su codigo HTML y sus cambios.

#### Scenario: Buscar la base de datos

- **WHEN** quien construye abre los ajustes de la aplicacion
- **THEN** encuentra la base de datos, las personas y los roles

#### Scenario: Buscar el codigo de la pagina

- **WHEN** quien construye abre los ajustes de la pagina
- **THEN** encuentra el codigo HTML, quien puede verla y sus cambios

#### Scenario: El icono de la aplicacion

- **WHEN** una aplicacion tiene un icono elegido por quien construye
- **THEN** ese mismo icono identifica los ajustes de la aplicacion en la barra

### Requirement: Historiales con nombres distintos

Lo que guarda las peticiones a la IA SHALL llamarse "Conversaciones". Lo que guarda las versiones de una pagina SHALL llamarse "Cambios". El sistema SHALL NO usar la palabra "Historial" para ninguno de los dos.

#### Scenario: Buscar una peticion anterior a la IA

- **WHEN** quien construye busca lo que le pidio antes a la IA
- **THEN** lo encuentra bajo "Conversaciones"

#### Scenario: Buscar una version anterior de la pagina

- **WHEN** quien construye busca como estaba la pagina antes
- **THEN** lo encuentra bajo "Cambios"

### Requirement: Compartir ofrece los dos enlaces con su alcance

El dialogo de compartir SHALL ofrecer el enlace de la aplicacion y el enlace de la pagina abierta, cada uno con la indicacion de quien puede abrirlo y con la posibilidad de copiarlo.

#### Scenario: Compartir una pagina limitada

- **WHEN** se abre compartir en una pagina limitada al rol `Ventas`
- **THEN** junto al enlace de la pagina se indica que solo la abre ese rol

#### Scenario: Compartir una pagina abierta

- **WHEN** se abre compartir en una pagina que puede ver cualquiera
- **THEN** junto al enlace de la pagina se indica que la abre cualquiera

#### Scenario: Copiar un enlace

- **WHEN** se elige copiar uno de los dos enlaces
- **THEN** ese enlace queda copiado
- **AND** se confirma cual de los dos fue

### Requirement: La barra sigue la paleta de la aplicacion

La barra y sus dialogos SHALL usar los colores de la paleta de la aplicacion, en modo claro y oscuro.

#### Scenario: Cambiar la paleta

- **WHEN** se cambia la paleta de una aplicacion
- **THEN** la barra y sus dialogos se repintan con los colores nuevos
