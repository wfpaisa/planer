## MODIFIED Requirements

### Requirement: Se guarda la ultima peticion de cada pagina

El sistema SHALL guardar, por cada pagina, la constancia de su ultima peticion a la IA. Cada peticion nueva SHALL sustituir la anterior de esa pagina. El sistema SHALL NO acumular un historial de peticiones.

La constancia SHALL incluir lo que se pidio, el contexto que se mando al modelo, el razonamiento, la respuesta, el modelo usado y cuanto tardo.

La constancia SHALL incluir ademas el desglose del recuento de entrada: cuantos tokens fueron nuevos, cuantos se reconocieron como ya enviados y cuantos quedaron marcados para la siguiente peticion. Ver `ai-cache`.

#### Scenario: Segunda peticion en la misma pagina

- **WHEN** quien construye hace una peticion en una pagina donde ya habia hecho otra
- **THEN** queda guardada la nueva
- **AND** la anterior ya no esta

#### Scenario: Peticiones en dos paginas

- **WHEN** se hace una peticion en cada una de dos paginas
- **THEN** cada pagina tiene su propia constancia

#### Scenario: Comprobar el reuso despues del fallo

- **WHEN** se abre la constancia de una peticion
- **THEN** dice cuanto de su entrada fue nuevo y cuanto se reconocio como ya enviado
