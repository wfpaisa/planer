## ADDED Requirements

### Requirement: La peticion lleva los turnos anteriores de la conversacion

Cada peticion SHALL mandar al modelo los turnos anteriores de esa conversacion --lo que se pidio y lo que respondio-- hasta un tope.

Al pasarse del tope SHALL dejarse fuera lo mas antiguo, nunca lo mas reciente.

Contestar a una pregunta de la IA SHALL NO necesitar que se le repita dentro del texto lo que se habia pedido.

#### Scenario: Seguir hablando de lo mismo

- **WHEN** quien construye pide una pantalla y en el mensaje siguiente dice "ahora ponle un buscador"
- **THEN** la IA sabe a que pantalla se refiere

#### Scenario: Una conversacion larga

- **WHEN** la conversacion pasa del tope de turnos que se mandan
- **THEN** se mandan los mas recientes
- **AND** la peticion no falla por tamano

### Requirement: La IA no declara hecho lo que no hizo

El resumen con el que la IA cierra un turno SHALL decir solo lo que quedo hecho mediante sus ordenes.

Cuando lo que se pidio no se pueda hacer con las ordenes que tiene, la IA SHALL decirlo en vez de darlo por hecho.

#### Scenario: Se pide algo que no se puede hacer

- **WHEN** quien construye pide algo que ninguna orden de la IA cubre
- **THEN** la IA dice que no puede hacerlo
- **AND** no responde que quedo hecho

## MODIFIED Requirements

### Requirement: Se puede ver a la IA trabajar

Mientras la IA trabaja, el sistema SHALL mostrar en una sola linea lo ultimo que va pensando, desplazandose sola para seguir el final del texto, de modo que se vea avanzar sin ocupar sitio. Al terminar, esa misma linea SHALL quedarse mostrando el principio del razonamiento: es una sola fila que cambia de estado, no dos.

Esa linea SHALL poder desplegarse para leer el razonamiento entero y los pasos dados, y una vez desplegada SHALL seguir desplegada mientras dure la peticion.

Al cerrar un turno con respuesta, el razonamiento y los pasos SHALL plegarse en un solo control que diga cuantos pasos se dieron, con la respuesta debajo. Un turno que termino sin respuesta --porque fallo o porque se detuvo-- SHALL NO plegar nada.

Que la IA este trabajando SHALL anunciarse tambien a quien usa un lector de pantalla.

El sistema SHALL NO obligar a esperar sin ninguna senal de avance, ni obligar a desplegar para saber por donde va.

#### Scenario: No desplegar

- **WHEN** la IA esta trabajando y quien construye no despliega nada
- **THEN** ve una linea con lo ultimo que la IA lleva pensado
- **AND** esa linea se desplaza sola siguiendo el final del texto
- **AND** al terminar recibe la respuesta completa

#### Scenario: Desplegar mientras la IA trabaja

- **WHEN** quien construye despliega el avance mientras la IA trabaja
- **THEN** ve el razonamiento completo hasta ese momento
- **AND** ve los pasos que ha dado

#### Scenario: La IA termina

- **WHEN** la IA termina de responder
- **THEN** el proceso del turno queda plegado en un solo control con la cuenta de pasos
- **AND** la respuesta queda debajo, a la vista
- **AND** el control se puede desplegar para leer el razonamiento entero

#### Scenario: La IA falla a mitad

- **WHEN** la IA falla despues de haber empezado a escribir
- **THEN** lo escrito hasta el fallo sigue visible
- **AND** el proceso de ese turno no se pliega
- **AND** se explica que fallo

### Requirement: Una sola peticion en marcha a la vez

Mientras la IA este trabajando en una pagina, el sistema SHALL NO admitir peticiones desde otra pagina de la misma aplicacion. Estando en otra pagina, el sistema SHALL decir en cual esta trabajando y SHALL ofrecer ir a ella.

En la pagina donde la IA trabaja, escribir y enviar SHALL seguir siendo posible: la peticion nueva SHALL quedar en cola y atenderse cuando termine la que esta en marcha. El campo SHALL vaciarse al enviar, y lo encolado SHALL verse y poder quitarse antes de que le llegue el turno.

El sistema SHALL NO descartar en silencio lo que se envia mientras trabaja.

Una peticion que ya termino SHALL NO contar como trabajo en curso.

#### Scenario: Pedir algo en otra pagina mientras la IA trabaja

- **WHEN** la IA esta trabajando en una pagina y quien construye abre otra y escribe una peticion
- **THEN** el sistema no la admite
- **AND** dice en que pagina esta trabajando
- **AND** ofrece ir a esa pagina

#### Scenario: La peticion termina

- **WHEN** la peticion en marcha termina
- **THEN** desde cualquier pagina se puede volver a pedir

#### Scenario: Pedir en la misma pagina que trabaja

- **WHEN** la IA esta trabajando y quien construye envia otra peticion en esa misma pagina
- **THEN** el campo se vacia
- **AND** la peticion queda a la vista, en cola
- **AND** se atiende al terminar la que estaba en marcha

#### Scenario: Arrepentirse de lo encolado

- **WHEN** quien construye quita una peticion que estaba en cola
- **THEN** no se envia
