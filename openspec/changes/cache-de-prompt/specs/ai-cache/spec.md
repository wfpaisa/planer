## Purpose

Hace que la parte de una peticion a la IA que se repite ronda tras ronda --el contrato, las herramientas, los turnos previos y los resultados ya leidos-- se cobre como ya enviada en vez de pagarse entera cada vez, y da la forma de comprobar que eso sigue ocurriendo.

## ADDED Requirements

### Requirement: Las peticiones marcan donde termina la parte repetida

Cada peticion a la IA SHALL marcar hasta donde llega lo que ya se envio antes, para que el proveedor lo reconozca y no lo cobre entero.

Las marcas SHALL ser tres:

1. Al final de las secciones del contrato que no dependen de ninguna aplicacion. Ese bloque SHALL ser identico en toda peticion de toda pagina de toda aplicacion.
2. Al final del texto de sistema, que cubre ademas lo propio de la pagina que se esta editando.
3. Al final de la ultima ronda, que avanza segun crecen los resultados de herramientas.

El bloque de la primera marca SHALL NO contener ningun dato de la aplicacion, de la pagina ni de quien mira.

La marca SHALL durar cinco minutos desde la peticion que la pone o la lee.

Marcar SHALL ser automatico. No hay ajuste que encender ni condicion que cumplir.

#### Scenario: Un turno de varias rondas

- **WHEN** un turno necesita varias rondas de herramientas
- **THEN** la primera ronda deja marcada la parte repetida
- **AND** las siguientes la reciben como ya enviada en vez de pagarla entera

#### Scenario: Dos turnos seguidos en la misma conversacion

- **WHEN** se hace una peticion menos de cinco minutos despues de la anterior en la misma pagina
- **THEN** la parte que no cambio sigue reconocida como ya enviada

#### Scenario: Una sola ronda

- **WHEN** un turno se resuelve en una sola ronda
- **THEN** la peticion se marca igual
- **AND** el turno termina con normalidad

#### Scenario: Peticiones en paginas y aplicaciones distintas

- **WHEN** se hacen peticiones seguidas en paginas de aplicaciones distintas
- **THEN** el bloque comun del contrato se reconoce como ya enviado en todas
- **AND** lo propio de cada pagina se manda nuevo

### Requirement: Marcar no cambia lo que se le manda al modelo

Marcar SHALL afectar solo a como se cobra la peticion. El sistema SHALL NO cambiar el contenido, el orden ni la cantidad de lo que se manda para que la marca funcione mejor.

#### Scenario: El mismo prompt de siempre

- **WHEN** se compara una peticion marcada con la misma peticion sin marcar
- **THEN** el texto de sistema, las herramientas y los mensajes son identicos

### Requirement: Un proveedor que no reconoce la marca no rompe la peticion

El sistema SHALL marcar en la forma que entiende cada camino de proveedor. Un servidor que no reconozca la marca SHALL atender la peticion igual, sin error y sin coste adicional.

#### Scenario: Servidor local

- **WHEN** la peticion se atiende contra un servidor local que no reconoce la marca
- **THEN** la peticion se responde con normalidad
- **AND** el recuento dice que no se reutilizo nada

#### Scenario: Servidor que cachea por su cuenta

- **WHEN** el servidor decide por su cuenta que parte reutiliza y lo informa en su respuesta
- **THEN** el sistema recoge ese dato igual que el de los demas

### Requirement: El recuento distingue lo nuevo de lo reutilizado

El recuento de una peticion SHALL guardar por separado los tokens nuevos, los reconocidos como ya enviados y los que quedaron marcados para la siguiente.

El total de entrada SHALL seguir sumandolos todos: lo reutilizado ocupa contexto igual que lo nuevo, y la medida del contexto no cambia por esta funcion.

Cuando el proveedor no informe de ese desglose, el sistema SHALL contar todo como nuevo en vez de inventarlo.

#### Scenario: Ronda que reutiliza

- **WHEN** una ronda recibe como ya enviada la mayor parte de lo que manda
- **THEN** el recuento lo refleja repartido entre nuevo y reutilizado
- **AND** el total de entrada es el mismo que seria sin marcar

#### Scenario: Proveedor que no informa

- **WHEN** el servidor responde sin decir cuanto reutilizo
- **THEN** el recuento cuenta todo como nuevo

### Requirement: El reuso se puede comprobar

El desglose del recuento SHALL quedar en la constancia de depuracion de la pagina --ver `ai-debug`-- y SHALL verse en el medidor de contexto del dock.

El medidor SHALL decir cuanto de lo que el modelo tuvo delante venia de lo ya enviado, y SHALL distinguirlo en su barra de la parte que se mando nueva.

Esto existe porque dejar de reconocer la parte repetida no produce ningun error: la peticion se responde igual y solo cambia lo que cuesta. Sin esta comprobacion la averia seria invisible.

#### Scenario: Turno que reutiliza

- **WHEN** termina un turno donde la mayor parte se reconocio como ya enviada
- **THEN** el medidor lo dice con un numero
- **AND** la barra distingue esa parte de la que se mando nueva

#### Scenario: Deja de reutilizarse

- **WHEN** un cambio hace que la parte repetida deje de reconocerse
- **THEN** la barra pasa a ensenar toda la entrada como nueva
- **AND** la constancia de depuracion lo confirma con el desglose
