# app-navigation Specification

## Purpose
Define el sidebar que lleva de una pagina a otra dentro de una aplicacion, lo que ve el visitante frente a lo que ve solo quien construye, y como se ajusta su comportamiento.

## Requirements

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

El sidebar SHALL listar a cada persona unicamente las paginas que tiene permiso de abrir, segun lo que la aplicacion exija --cuenta o no-- y los roles que cada pagina tenga marcados.

#### Scenario: Visitante sin un rol

- **WHEN** un visitante sin el rol `ventas` abre la aplicacion y hay una pagina que tiene marcado ese rol
- **THEN** esa pagina no aparece en su sidebar

#### Scenario: Visitante sin cuenta en una aplicacion publica

- **WHEN** alguien sin cuenta abre una aplicacion publica que tiene paginas con roles marcados
- **THEN** el sidebar solo lista las paginas que tienen `Todos` marcada

#### Scenario: El constructor las ve todas

- **WHEN** quien construye abre la aplicacion
- **THEN** el sidebar lista todas las paginas, con los roles que cada una admite a la vista

### Requirement: Salida al panel de aplicaciones

El sidebar SHALL ofrecer a quien construye la salida al panel de aplicaciones. Esa salida SHALL vivir solo en el sidebar y no repetirse en la barra Todo En Uno.

#### Scenario: Volver al panel

- **WHEN** quien construye elige la salida del sidebar
- **THEN** llega al panel de aplicaciones

### Requirement: El sidebar vive siempre a la izquierda

El sidebar SHALL dibujarse siempre a la izquierda, sin ajuste que lo cambie de lado. El comportamiento (anclado o flotante) SHALL ser una preferencia de cada persona, elegida desde el propio sidebar y recordada por aplicacion en su navegador. Anclado SHALL ocupar su espacio junto al documento; flotante SHALL dibujarse encima sin quitarle espacio. Dentro de la pagina, cualquiera SHALL poder plegarlo y desplegarlo.

#### Scenario: No hay donde cambiar el lado

- **WHEN** quien construye abre los ajustes de la aplicacion
- **THEN** no se ofrece elegir de que lado va el sidebar
- **AND** todas las paginas lo muestran a la izquierda, tambien para los visitantes

#### Scenario: Anclar el sidebar

- **WHEN** alguien ancla el sidebar desde el propio sidebar
- **THEN** ocupa su espacio y el documento se dibuja en lo que queda
- **AND** sigue anclado la proxima vez que esa persona abra esa aplicacion

#### Scenario: Desplegar el sidebar flotante

- **WHEN** alguien despliega el sidebar sin anclarlo
- **THEN** aparece encima del documento
- **AND** el documento no cambia de tamano

#### Scenario: Plegar el sidebar

- **WHEN** alguien pliega el sidebar
- **THEN** queda una forma visible de desplegarlo
- **AND** el documento ocupa toda la ventana

### Requirement: El sidebar sigue la paleta de la aplicacion

El sidebar SHALL usar los colores de la paleta de la aplicacion, en modo claro y oscuro.

#### Scenario: Cambiar la paleta

- **WHEN** se cambia la paleta de una aplicacion
- **THEN** el sidebar se repinta con los colores nuevos

### Requirement: El sidebar empieza plegado

El sidebar SHALL empezar plegado la primera vez que alguien abre una aplicacion, para que el documento se vea completo. Despues SHALL recordar por aplicacion si esa persona lo dejo plegado o desplegado.

#### Scenario: Primera visita a una aplicacion

- **WHEN** alguien abre una aplicacion por primera vez
- **THEN** el sidebar aparece plegado

#### Scenario: Se recuerda la eleccion

- **WHEN** alguien despliega el sidebar y vuelve mas tarde a la misma aplicacion
- **THEN** el sidebar aparece desplegado

### Requirement: Elegir una pagina pliega el sidebar flotante

Cuando el sidebar esta flotando encima del documento y alguien elige una pagina, el sidebar SHALL plegarse solo, para devolver la vista completa al documento. Anclado SHALL quedarse donde esta: para eso se anclo.

#### Scenario: Navegar con el sidebar flotante desplegado

- **WHEN** alguien elige otra pagina con el sidebar flotante desplegado
- **THEN** se abre esa pagina
- **AND** el sidebar se pliega

#### Scenario: Navegar con el sidebar anclado

- **WHEN** alguien elige otra pagina con el sidebar anclado
- **THEN** se abre esa pagina
- **AND** el sidebar sigue visible en su sitio

### Requirement: El sidebar dice en que pagina esta trabajando la IA

Mientras la IA trabaje en una pagina, la fila de esa pagina en el sidebar SHALL indicarlo. Elegir esa fila SHALL llevar a esa pagina, como cualquier otra.

La marca SHALL desaparecer cuando la peticion termine, y SHALL NO quedarse encendida si la peticion deja de existir por cualquier motivo.

#### Scenario: Ver desde otra pagina que la IA trabaja

- **WHEN** la IA esta trabajando en una pagina y quien construye esta en otra
- **THEN** el sidebar marca la fila de la pagina donde trabaja

#### Scenario: Volver a la pagina que trabaja

- **WHEN** quien construye elige la fila marcada
- **THEN** se abre esa pagina
- **AND** ve el avance de la peticion

#### Scenario: La peticion termina

- **WHEN** la peticion termina
- **THEN** la fila deja de estar marcada

#### Scenario: El servidor pierde la peticion

- **WHEN** la peticion deja de existir en el servidor sin haber entregado nada
- **THEN** la fila deja de estar marcada
