## MODIFIED Requirements

### Requirement: Una sola entrada a la IA

El campo de texto del dock SHALL ser la unica entrada a la IA. El boton de la barra superior SHALL traer el dock con la conversacion tal como se dejo; si no habia ninguna, en blanco. Empezar una conversacion nueva SHALL seguir siendo un acto que se pide, dentro del dock.

#### Scenario: Escribir en el campo

- **WHEN** quien construye escribe una peticion en el campo del dock y confirma
- **THEN** la peticion se envia y aparece en la conversacion

#### Scenario: Pulsar el boton de IA

- **WHEN** quien construye pulsa el boton de IA de la barra superior
- **THEN** el dock aparece con la conversacion de esa pagina tal como se dejo
- **AND** puede llegar desde ahi a las conversaciones anteriores

### Requirement: Cerrar no borra lo escrito ni lo conversado

Al esconder el dock, el sistema SHALL conservar el texto sin enviar y la conversacion en curso. Al traerlo de vuelta SHALL aparecer tal como se dejo.

Empezar una conversacion nueva SHALL ser un acto explicito de quien construye. El sistema SHALL NO empezar una nueva por el hecho de esconder y traer el dock.

#### Scenario: Cerrar con algo escrito sin enviar

- **WHEN** quien construye escribe una peticion, no la envia y esconde el dock
- **THEN** al traerlo de vuelta el texto sigue ahi

#### Scenario: Cerrar con una conversacion en curso

- **WHEN** quien construye esconde el dock despues de haber intercambiado varias peticiones
- **THEN** al traerlo de vuelta la conversacion sigue completa

#### Scenario: Empezar una conversacion nueva

- **WHEN** quien construye pide una conversacion nueva
- **THEN** la anterior queda guardada en la lista de conversaciones
- **AND** el dock queda en blanco

#### Scenario: Cambiar de pagina

- **WHEN** quien construye abre otra pagina de la aplicacion
- **THEN** la conversacion de la pagina anterior no aparece mezclada con la nueva

### Requirement: Se puede ver a la IA trabajar

Mientras la IA trabaja, el sistema SHALL mostrar en una sola linea lo ultimo que va pensando, desplazandose sola para seguir el final del texto, de modo que se vea avanzar sin ocupar sitio. Al terminar, esa linea SHALL quedarse en el principio del razonamiento.

Esa linea SHALL poder desplegarse para leer el razonamiento entero y los pasos dados, y una vez desplegada SHALL seguir desplegada mientras dure la peticion.

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
- **THEN** la linea deja de desplazarse y muestra el principio del razonamiento
- **AND** sigue pudiendo desplegarse para leerlo entero

#### Scenario: La IA falla a mitad

- **WHEN** la IA falla despues de haber empezado a escribir
- **THEN** lo escrito hasta el fallo sigue visible
- **AND** se explica que fallo

## ADDED Requirements

### Requirement: Lo que llega se dibuja a un ritmo que no ahoga

Mientras la respuesta de la IA llega por partes, el sistema SHALL agrupar los redibujados de la conversacion por intervalos, en vez de redibujar en cada trozo recibido. Seguir el final de la conversacion SHALL obedecer al mismo ritmo.

#### Scenario: Una respuesta larga y rapida

- **WHEN** la IA devuelve una respuesta larga a gran velocidad
- **THEN** la conversacion sigue respondiendo al desplazamiento y a los clics
- **AND** el texto se ve crecer sin saltos
