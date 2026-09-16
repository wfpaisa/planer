## Purpose

Guarda la ultima peticion a la IA de cada pagina --lo que se le mando y lo que devolvio-- para poder entender despues un fallo que no se puede reproducir, y da una forma de borrar todo lo guardado.

## ADDED Requirements

### Requirement: Se guarda la ultima peticion de cada pagina

El sistema SHALL guardar, por cada pagina, la constancia de su ultima peticion a la IA. Cada peticion nueva SHALL sustituir la anterior de esa pagina. El sistema SHALL NO acumular un historial de peticiones.

La constancia SHALL incluir lo que se pidio, el contexto que se mando al modelo, el razonamiento, la respuesta, el modelo usado y cuanto tardo.

#### Scenario: Segunda peticion en la misma pagina

- **WHEN** quien construye hace una peticion en una pagina donde ya habia hecho otra
- **THEN** queda guardada la nueva
- **AND** la anterior ya no esta

#### Scenario: Peticiones en dos paginas

- **WHEN** se hace una peticion en cada una de dos paginas
- **THEN** cada pagina tiene su propia constancia

### Requirement: Un contexto enorme se guarda recortado

Cuando el contexto mandado al modelo no quepa entero, el sistema SHALL guardarlo recortado y SHALL indicar que va recortado.

#### Scenario: Una pagina muy grande

- **WHEN** la peticion llevaba un contexto que no cabe entero
- **THEN** se guarda la parte que cabe
- **AND** queda dicho que va recortado

### Requirement: La constancia se lee donde se lee el contexto

Quien construye SHALL poder leer el contexto guardado de la ultima peticion de la pagina desde la conversacion, en el mismo sitio donde ya se lee el contexto de la peticion en curso. Recargar la pagina SHALL NO perder ese acceso.

#### Scenario: Recargar despues de un fallo

- **WHEN** una peticion falla y quien construye recarga la pagina
- **THEN** sigue pudiendo leer el contexto que se habia mandado

### Requirement: Solo lo ve quien es dueno de la aplicacion

La constancia SHALL ser legible unicamente por quien construye la aplicacion a la que pertenece. La vista publicada SHALL NO exponerla de ninguna forma.

#### Scenario: Alguien que no es el dueno

- **WHEN** alguien que no construye esa aplicacion pide su constancia
- **THEN** no la recibe

### Requirement: Se pueden borrar todas de una vez

Los ajustes generales de la instalacion SHALL ofrecer borrar todas las constancias guardadas. Borrarlas SHALL NO afectar a las conversaciones ni a las paginas.

#### Scenario: Limpieza general

- **WHEN** quien construye pide borrar las constancias desde los ajustes generales
- **THEN** no queda ninguna guardada
- **AND** las conversaciones siguen intactas

### Requirement: La constancia muere con su pagina

Al borrar una pagina, su constancia SHALL borrarse con ella. Al borrar una aplicacion, SHALL borrarse la de todas sus paginas.

#### Scenario: Borrar una pagina

- **WHEN** se borra una pagina que tenia constancia guardada
- **THEN** esa constancia deja de existir
