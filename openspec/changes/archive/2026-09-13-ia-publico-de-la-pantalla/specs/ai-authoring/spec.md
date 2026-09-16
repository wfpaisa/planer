## ADDED Requirements

### Requirement: Para quién es la pantalla se deduce de la petición

La IA SHALL deducir para quién es lo que construye a partir de las palabras de la petición, con estas reglas.

"Yo", "quiero" o "mi" SHALL significar el rol `admin` **solo cuando la petición nombra también a otras personas**. Cuando la petición no nombra a nadie más, la IA SHALL NO asumir público ninguno y construir para quien pueda abrir la página.

Una palabra que nombra un grupo de personas SHALL leerse así:

- Genérica --"usuarios", "personas", "todos", "la gente"--: son todas las personas invitadas, y la pantalla no filtra por rol.
- Coincide con un rol de la aplicación: es ese rol. La coincidencia SHALL tolerar plural y tildes, porque "los odontólogos" no coincide literalmente con `odontologo`.
- No coincide con ningún rol: la IA SHALL construir para todos y decirlo. SHALL NOT preguntar, porque filtrar por rol dentro del HTML no protege nada y equivocarse cuesta una corrección, no un fallo de acceso.

#### Scenario: Petición que contrapone a quien escribe con otras personas

- **WHEN** se pide "quiero ver el listado de todos los usuarios y cuáles leyeron el manual"
- **THEN** la pantalla que construye la IA reserva ese listado al rol `admin`

#### Scenario: Petición que no nombra a nadie más

- **WHEN** se pide "quiero ver quién leyó el manual"
- **THEN** la IA no reserva la pantalla a `admin`
- **AND** la construye para quien pueda abrir la página

#### Scenario: Nombre de grupo que no coincide con ningún rol

- **WHEN** se pide algo para "los doctores" en una aplicación cuyos roles son `conductor`, `auxiliar`, `odontologo` y `admin`
- **THEN** la IA construye la pantalla para todos y dice el supuesto
- **AND** no abre una pregunta

#### Scenario: Nombre de grupo en plural y con tilde

- **WHEN** se pide algo para "los odontólogos" y la aplicación define el rol `odontologo`
- **THEN** la IA lo entiende como ese rol

### Requirement: El público que se asume se dice en el resumen

Cuando la IA asuma para quién es una pantalla, SHALL decirlo en el resumen con el que cierra el turno, nombrando el rol o el conjunto de personas que asumió.

#### Scenario: Turno que asumió un público

- **WHEN** la IA construye una pantalla habiendo asumido a quién va dirigida
- **THEN** el resumen del turno nombra ese público
- **AND** quien construye puede corregirlo con una frase en vez de rehacer la pantalla

### Requirement: Un filtro por rol se resuelve antes de pintar

Cuando la IA escriba una pantalla que muestra u oculta algo según el rol de quien mira, SHALL decidir esa visibilidad antes de dibujar el contenido.

La IA SHALL NOT escribir contenido que arranque oculto y se muestre al terminar de dibujarlo: un error a mitad de camino dejaría la sección oculta sin que nada avise, y la pantalla se vería vacía en vez de rota.

#### Scenario: Pantalla con una sección reservada a un rol

- **WHEN** la IA escribe una pantalla con una sección que solo ve un rol
- **THEN** la visibilidad de esa sección queda decidida antes de dibujar su contenido

#### Scenario: Error mientras se dibuja la sección

- **WHEN** falla el guion que rellena una sección reservada a un rol de quien sí tiene ese rol
- **THEN** la sección sigue estando a la vista
- **AND** el fallo se puede ver en vez de quedar como una pantalla vacía
