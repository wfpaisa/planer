## Purpose

Guarda por pagina las reglas funcionales que debe cumplir --quien puede hacer que, que datos son obligatorios, que prohibe el negocio-- para que sobrevivan al recorte del historial y al cambio de conversacion, y para que la IA las tenga delante en cada peticion en vez de deducirlas del HTML.

## ADDED Requirements

### Requirement: Cada pagina tiene una memoria de reglas funcionales

Cada pagina SHALL tener una memoria propia: un texto en markdown plano donde cada vineta es una regla funcional de esa pagina.

Una regla funcional es lo que seguiria siendo cierto si la pagina se reconstruyera desde cero: quien puede hacer que, que datos son obligatorios, que prohibe el negocio, para quien es la pantalla. La memoria SHALL NO guardar apariencia, correcciones de errores, preferencias de redaccion ni el relato de lo que se pidio.

Esa exclusion vale para lo que el sistema decide por su cuenta. Cuando quien construye pide expresamente que algo se recuerde, esa peticion SHALL guardarse aunque no sea una regla funcional. Ver "Lo que se pide recordar expresamente se recuerda".

La memoria pertenece a la pagina: borrar la pagina SHALL llevarse su memoria.

#### Scenario: Una regla de negocio

- **WHEN** quien construye pide una agenda donde solo los auxiliares crean citas
- **THEN** la memoria de esa pagina recoge que solo los auxiliares crean citas

#### Scenario: Un ajuste de apariencia

- **WHEN** quien construye pide que los botones se vean azules
- **THEN** la memoria no cambia

#### Scenario: Ese mismo ajuste, pedido para recordar

- **WHEN** quien construye pide que se recuerde que los botones van azules
- **THEN** la memoria recoge que los botones van azules

#### Scenario: Cada pagina la suya

- **WHEN** se escribe una regla en la memoria de la pagina de agendas
- **THEN** la memoria de las demas paginas de la aplicacion sigue igual

### Requirement: La memoria se lee y se edita desde los ajustes de la pagina

Los ajustes de una pagina SHALL ofrecer un item llamado `Memorias` con la memoria de esa pagina en una caja de texto editable. Quien construye SHALL poder cambiar, agregar o borrar cualquier parte del texto y guardarlo.

Una pagina sin memoria SHALL ensenar la caja vacia, no un error.

#### Scenario: Leer la memoria

- **WHEN** quien construye abre los ajustes de una pagina y elige `Memorias`
- **THEN** ve el texto completo de la memoria de esa pagina

#### Scenario: Corregir una regla a mano

- **WHEN** quien construye edita el texto y guarda
- **THEN** la memoria queda con lo que escribio
- **AND** la siguiente peticion a la IA lleva ese texto

### Requirement: La memoria viaja en cada peticion a la IA

Cada peticion a la IA SHALL llevar la memoria de la pagina que se esta editando, junto al resto del contexto.

#### Scenario: Conversacion nueva

- **WHEN** quien construye empieza una conversacion nueva y pide un cambio
- **THEN** la IA recibe la memoria de la pagina aunque no reciba ningun turno anterior

#### Scenario: Conversacion larga

- **WHEN** una conversacion pasa del numero de turnos que se le mandan a la IA
- **THEN** la IA sigue recibiendo la memoria completa

### Requirement: La memoria se escribe sola al cerrar el turno

Al terminar un turno, el sistema SHALL ejecutar una pasada aparte que recibe el intercambio completo --lo que se pidio, lo que contesto la IA-- y la memoria actual, y devuelve las operaciones que el intercambio deje acordadas, que pueden ser ninguna.

Quien construye SHALL NO tener que pedir que se guarde nada.

La pasada SHALL correr despues de entregar la respuesta: no retrasa lo que se ve.

#### Scenario: El pedido trae una regla nueva

- **WHEN** termina un turno donde se pidio que el telefono del paciente sea obligatorio
- **THEN** la memoria queda con esa regla, sin que nadie la pidiera guardar

#### Scenario: El pedido no trae ninguna regla

- **WHEN** termina un turno donde solo se pidio cambiar el color de un boton
- **THEN** la memoria no cambia

#### Scenario: La pasada falla

- **WHEN** la pasada no se puede completar
- **THEN** la memoria queda como estaba
- **AND** el turno se considera terminado igual

### Requirement: La pasada solo opera sobre vinetas nombradas

La pasada SHALL poder agregar una vineta, reemplazar una vineta existente o borrar una vineta existente, nombrando siempre cual. La pasada SHALL NO poder devolver la memoria entera reescrita.

Lo que la pasada no nombra SHALL quedar intacto.

La pasada SHALL poder devolver cuantas operaciones juzgue necesarias en un mismo turno, y el sistema SHALL NO limitar su numero ni decidir por ella como reparte las reglas entre vinetas. Las operaciones SHALL aplicarse en el orden en que vienen, cada una sobre el resultado de la anterior.

Una operacion que nombre una vineta que ya no existe SHALL descartarse sin impedir que las demas se apliquen.

La pasada SHALL poder operar sobre cualquier vineta, no solo sobre la relacionada con el pedido del momento: puede fundir dos vinetas que dicen lo mismo.

#### Scenario: El turno deja acordadas varias reglas

- **WHEN** un turno deja acordadas diez reglas de funcionamiento
- **THEN** la memoria recoge las diez, sin que el sistema recorte la lista

#### Scenario: Una operacion nombra una vineta que ya no esta

- **WHEN** la pasada devuelve varias operaciones y una nombra una vineta que ya no existe
- **THEN** esa operacion se descarta
- **AND** las demas se aplican igual

#### Scenario: Una regla cambia

- **WHEN** la pasada actualiza la regla de quien crea citas
- **THEN** esa vineta queda con el texto nuevo
- **AND** las demas vinetas quedan con el texto que tenian

#### Scenario: Dos vinetas repetidas

- **WHEN** la pasada detecta dos vinetas que dicen lo mismo
- **THEN** puede dejar una y borrar la otra

### Requirement: Lo que se pide recordar expresamente se recuerda

Cuando quien construye pida expresamente que algo se recuerde --"recuerda que...", "memoriza esto", "que no se te olvide", "agregalo a las memorias"-- la pasada SHALL guardarlo, y SHALL guardarlo aunque por su cuenta no lo habria considerado una regla funcional.

Una orden directa de quien construye manda sobre el criterio de la pasada: la lista de lo que la memoria no guarda existe para que el sistema no adivine solo, no para desautorizar a quien es dueno de la aplicacion.

La IA SHALL decir que queda guardado, y SHALL escribir en su respuesta aquello que se le pidio recordar. La pasada solo ve el intercambio de ese turno, asi que lo acordado en conversaciones anteriores solo llega hasta ella si la respuesta lo trae.

Pedir que se recuerde algo SHALL NO hacer que la IA lo escriba dentro de la pagina.

#### Scenario: Se pide recordar una regla

- **WHEN** quien construye escribe "recuerda que solo se reserva en dias futuros"
- **THEN** la memoria recoge que solo se reserva en dias futuros
- **AND** la IA contesta que queda guardado, sin tocar la pagina

#### Scenario: Se pide recordar algo de antes

- **WHEN** quien construye pide que se recuerde el funcionamiento que se acordo en turnos anteriores
- **THEN** la IA lo escribe en su respuesta
- **AND** la memoria lo recoge desde ahi

#### Scenario: Se pide recordar un funcionamiento entero

- **WHEN** quien construye pide que se recuerde el funcionamiento de la pantalla y la IA lo escribe en su respuesta como una lista de reglas
- **THEN** la memoria recoge ese funcionamiento entero, y no solo una parte

#### Scenario: Se pide recordar algo que no es una regla funcional

- **WHEN** quien construye pide que se recuerde una preferencia de como se ve o de como se escribe
- **THEN** la memoria la recoge igual

#### Scenario: Administrar la memoria no se hace por chat

- **WHEN** quien construye le pide a la IA que borre una regla guardada o que reescriba la memoria entera
- **THEN** la IA dice que eso se hace en los ajustes de la pagina, en `Memorias`
- **AND** ni la memoria ni la pagina cambian

### Requirement: La memoria no tiene tope

El sistema SHALL NO recortar la memoria ni rechazar una escritura por tamano. Ninguna regla guardada SHALL desaparecer por el crecimiento de la memoria.

Lo que mantiene la memoria corta es como escribe la pasada: en presente y en una linea, reemplazando una vineta existente antes que agregar una parecida, fundiendo las que digan lo mismo y sin escribir nada cuando hay duda. El texto de sistema de la pasada SHALL decir con detalle que clase de cosas se guardan y cuales no; el sistema SHALL NO sustituir ese criterio por un limite mecanico.

#### Scenario: Una memoria larga

- **WHEN** una pagina acumula muchas reglas funcionales
- **THEN** todas siguen guardadas y todas viajan en la peticion

#### Scenario: Un tema ya cubierto

- **WHEN** el pedido trae una regla sobre un tema que ya tiene vineta
- **THEN** la pasada reemplaza esa vineta en vez de agregar otra

### Requirement: La IA pregunta antes de contradecir una regla guardada

Cuando lo pedido contradiga una regla de la memoria, la IA SHALL preguntar antes de construir, nombrando la regla guardada, y SHALL cerrar el turno con esa pregunta.

Si quien construye confirma el cambio, la IA lo implementa y la memoria queda con la regla nueva. Si no lo confirma, ni la pagina ni la memoria cambian.

#### Scenario: El pedido choca con una regla

- **WHEN** la memoria dice que solo los auxiliares crean citas y se pide que los recepcionistas tambien puedan
- **THEN** la IA pregunta si se cambia ese comportamiento antes de tocar la pagina

#### Scenario: Se confirma el cambio

- **WHEN** quien construye confirma el cambio de la regla
- **THEN** la IA implementa lo pedido
- **AND** la memoria queda con la regla nueva en lugar de la anterior

#### Scenario: No se confirma el cambio

- **WHEN** quien construye elige dejarlo como estaba
- **THEN** la pagina no cambia
- **AND** la memoria queda con la regla anterior

### Requirement: La caja de memorias se bloquea mientras la IA trabaja

Mientras haya una peticion a la IA en marcha sobre la pagina, la caja de texto de `Memorias` SHALL estar bloqueada y SHALL decir por que.

Al terminar la peticion, la caja SHALL volver a ser editable con el texto que haya quedado, incluida la escritura de la pasada.

#### Scenario: Editar durante una peticion

- **WHEN** quien construye abre `Memorias` con una peticion a la IA en marcha
- **THEN** ve el texto pero no lo puede editar
- **AND** entiende que es porque la IA esta trabajando

#### Scenario: Termina la peticion

- **WHEN** la peticion termina y la pasada agrego una vineta
- **THEN** la caja se desbloquea mostrando el texto ya con esa vineta

### Requirement: Las paginas que ya existen nacen con la memoria vacia

Una pagina creada antes de que existiera la memoria SHALL empezar con la memoria vacia. El sistema SHALL NO deducir reglas del HTML que esa pagina ya tenga.

#### Scenario: Pagina construida antes

- **WHEN** se abren los ajustes de una pagina anterior a esta funcion
- **THEN** la memoria esta vacia

#### Scenario: Primer pedido despues

- **WHEN** se le pide algo a la IA sobre esa pagina y el pedido trae una regla
- **THEN** la memoria empieza a llenarse desde ese pedido

### Requirement: La memoria es del constructor

La memoria SHALL NO viajar a la pagina publicada ni ser alcanzable desde el HTML de la pagina. Solo la ve quien puede abrir los ajustes de la pagina.

#### Scenario: Pagina publicada

- **WHEN** alguien abre la aplicacion publicada
- **THEN** no hay forma de leer la memoria de ninguna pagina
