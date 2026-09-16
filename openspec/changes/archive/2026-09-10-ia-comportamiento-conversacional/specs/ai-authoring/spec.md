## ADDED Requirements

### Requirement: La revision de estilo y consola es obligatoria al cerrar el turno

Antes de dar por terminada una peticion que escribio o cambio la pagina, el sistema SHALL revisar el estilo y, si hay panel abierto, la consola del navegador - sin depender de que la IA lo pida por su cuenta. Si la revision encuentra un fallo, la IA SHALL corregir y revisar de nuevo, hasta un maximo de dos veces.

#### Scenario: La IA termina sin pedir la revision

- **WHEN** la IA da por escrita una pagina sin haber llamado a la revision
- **THEN** el sistema la ejecuta igual antes de entregar la respuesta

#### Scenario: La revision encuentra un fallo

- **WHEN** la revision encuentra un fallo de estilo o de consola
- **THEN** la IA corrige y vuelve a revisar
- **AND** despues de la segunda revision fallida, la IA deja de intentarlo y lo dice en la respuesta

### Requirement: Preguntar antes de construir se limita a elegir entre lo que ya existe

La IA SHALL preguntar antes de construir solo cuando la ambiguedad se resuelve eligiendo entre opciones que ya existen en la aplicacion (por ejemplo, entre varias tablas). La IA SHALL NO preguntar por decisiones de diseno abierto (como se ve, que columnas, que orden): esas se resuelven mostrando un primer resultado.

#### Scenario: Pedido ambiguo con varias tablas posibles

- **WHEN** quien construye pide un dashboard y la aplicacion tiene mas de una tabla que podria ser la fuente
- **THEN** la IA pregunta cual de las tablas existentes usar antes de construir

#### Scenario: Pedido ambiguo de diseno

- **WHEN** quien construye pide una pantalla sin decir que columnas o que orden
- **THEN** la IA construye un primer resultado en vez de preguntar

### Requirement: La IA puede proponer una mejora no solicitada, acotada

Al terminar de construir, la IA SHALL poder proponer como maximo una mejora no solicitada por turno, y solo cuando detecta alguna de estas situaciones: un alcance implicito sin resolver, una capacidad de la plataforma que los datos piden y no se usa, una contradiccion entre lo pedido y lo que ya existe, o un dato visible a mas gente de la que el pedido sugiere. La IA SHALL NO proponer cambios de estetica o de diseno visual, funciones que el pedido no insinuo, ni reorganizar algo que quien construye no toco.

#### Scenario: Alcance implicito

- **WHEN** el pedido usa una palabra amplia como "todos" y la tabla tiene una columna que distingue estados o duenos sin usarse en la pagina
- **THEN** la IA propone, en una sola frase, si el alcance deberia limitarse

#### Scenario: Nada que proponer

- **WHEN** no se cumple ninguna de las situaciones definidas
- **THEN** la IA no agrega ninguna propuesta a su respuesta

#### Scenario: Correccion pequena en curso

- **WHEN** quien construye pide un ajuste puntual sobre algo ya construido
- **THEN** la IA no propone una mejora adicional en esa respuesta

### Requirement: El tono de la IA es profesional y sin nombre

Toda respuesta de la IA SHALL usar un tono profesional y respetuoso, sin dirigirse a quien construye por su nombre, y sin recurrir a un registro ludico o de interrogatorio.

#### Scenario: Respuesta de cierre

- **WHEN** la IA termina una peticion
- **THEN** el mensaje final no incluye el nombre de quien construye
- **AND** el tono es profesional, sin bromas ni preguntas encadenadas de interrogatorio
