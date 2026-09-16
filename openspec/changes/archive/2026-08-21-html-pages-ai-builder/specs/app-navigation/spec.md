## Purpose

Define el sidebar que lleva de una pagina a otra dentro de una aplicacion, lo que ve el visitante frente a lo que ve solo quien construye, y donde se ajusta su posicion y comportamiento.

## ADDED Requirements

### Requirement: Sidebar de paginas

Toda pagina de una aplicacion SHALL mostrar un sidebar con la lista de paginas y su icono. Elegir una pagina SHALL llevar a ella.

#### Scenario: Navegar entre paginas

- **WHEN** alguien elige otra pagina en el sidebar
- **THEN** se abre esa pagina
- **AND** el sidebar sigue visible

#### Scenario: La pagina abierta se distingue

- **WHEN** hay una pagina abierta
- **THEN** el sidebar la marca como la actual

### Requirement: El visitante ve menos que el constructor

El sidebar SHALL mostrar a quien construye las acciones de crear pagina, borrar pagina y decidir quien puede verla. SHALL NO mostrarlas a un visitante.

#### Scenario: El constructor abre la aplicacion

- **WHEN** quien construye abre una pagina de su aplicacion
- **THEN** el sidebar ofrece crear, borrar y decidir quien ve cada pagina

#### Scenario: El visitante abre la aplicacion

- **WHEN** un visitante abre una pagina de la aplicacion publicada
- **THEN** el sidebar solo lista las paginas y permite navegar

### Requirement: El sidebar solo lista lo que se puede abrir

El sidebar SHALL listar a cada persona unicamente las paginas que tiene permiso de abrir.

#### Scenario: Visitante sin un rol

- **WHEN** un visitante sin el rol `Ventas` abre la aplicacion y hay una pagina limitada a ese rol
- **THEN** esa pagina no aparece en su sidebar

#### Scenario: El constructor las ve todas

- **WHEN** quien construye abre la aplicacion
- **THEN** el sidebar lista todas las paginas, con su nivel de acceso a la vista

### Requirement: Salida al panel de aplicaciones

El sidebar SHALL ofrecer a quien construye la salida al panel de aplicaciones. Esa salida SHALL vivir solo en el sidebar y no repetirse en la barra Todo En Uno.

#### Scenario: Volver al panel

- **WHEN** quien construye elige la salida del sidebar
- **THEN** llega al panel de aplicaciones

### Requirement: Posicion y comportamiento se ajustan una vez

La posicion (izquierda o derecha) y el comportamiento (fijo o flotante) del sidebar SHALL elegirse en los ajustes de la aplicacion y SHALL valer para todos. Dentro de la pagina, cualquiera SHALL poder plegarlo y desplegarlo.

#### Scenario: Cambiar la posicion

- **WHEN** quien construye pone el sidebar a la derecha en los ajustes de la aplicacion
- **THEN** todas las paginas lo muestran a la derecha, tambien para los visitantes

#### Scenario: Plegar el sidebar

- **WHEN** alguien pliega el sidebar
- **THEN** el contenido de la pagina gana ese espacio
- **AND** queda una forma visible de desplegarlo

### Requirement: El sidebar sigue la paleta de la aplicacion

El sidebar SHALL usar los colores de la paleta de la aplicacion, en modo claro y oscuro.

#### Scenario: Cambiar la paleta

- **WHEN** se cambia la paleta de una aplicacion
- **THEN** el sidebar se repinta con los colores nuevos
