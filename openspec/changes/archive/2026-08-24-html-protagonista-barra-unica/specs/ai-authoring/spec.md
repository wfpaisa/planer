## ADDED Requirements

### Requirement: Cerrar no borra lo escrito ni lo conversado

Al cerrar la superficie de la IA, el sistema SHALL conservar el texto sin enviar y la conversacion en curso. Al volver a abrirla SHALL aparecer tal como se dejo.

Empezar una conversacion nueva SHALL ser un acto explicito de quien construye. El sistema SHALL NO empezar una nueva por el hecho de cerrar y volver a abrir.

#### Scenario: Cerrar con algo escrito sin enviar

- **WHEN** quien construye escribe una peticion, no la envia y cierra
- **THEN** al volver a abrir el texto sigue ahi

#### Scenario: Cerrar con una conversacion en curso

- **WHEN** quien construye cierra despues de haber intercambiado varias peticiones
- **THEN** al volver a abrir la conversacion sigue completa

#### Scenario: Empezar una conversacion nueva

- **WHEN** quien construye pide una conversacion nueva
- **THEN** la anterior queda guardada en la lista de conversaciones
- **AND** la superficie queda en blanco

#### Scenario: Cambiar de pagina

- **WHEN** quien construye abre otra pagina de la aplicacion
- **THEN** la conversacion de la pagina anterior no aparece mezclada con la nueva

### Requirement: Se puede ver a la IA trabajar

Mientras la IA trabaja, el sistema SHALL indicar que esta trabajando y SHALL ofrecer desplegar lo que va produciendo: el texto que va escribiendo y los pasos que va dando. Ese despliegue SHALL empezar cerrado, para no obligar a mirarlo.

El sistema SHALL NO obligar a esperar sin ninguna senal de avance.

#### Scenario: Desplegar mientras la IA trabaja

- **WHEN** quien construye despliega el avance mientras la IA trabaja
- **THEN** ve el texto que la IA lleva escrito hasta ese momento
- **AND** ve los pasos que ha dado

#### Scenario: No desplegar

- **WHEN** quien construye no despliega el avance
- **THEN** solo ve que la IA esta trabajando
- **AND** al terminar recibe la respuesta completa

#### Scenario: La IA falla a mitad

- **WHEN** la IA falla despues de haber empezado a escribir
- **THEN** lo escrito hasta el fallo sigue visible
- **AND** se explica que fallo

### Requirement: La respuesta se entrega a medida que se produce

El servidor SHALL entregar la respuesta de la IA por partes, a medida que se produce, en lugar de esperar a tenerla entera. Lo que la pagina recibe al final SHALL ser lo mismo que recibia antes: el mensaje, los pasos, los avisos y el impacto en los datos si lo hay.

Irse a mitad SHALL NO cancelar la peticion: SHALL seguir hasta terminar. Antes del primer cambio SHALL quedar guardado un punto al que volver, con el nombre de la peticion.

#### Scenario: Una respuesta larga

- **WHEN** la IA tarda en escribir una pagina larga
- **THEN** el texto va llegando mientras se escribe

#### Scenario: Cerrar el navegador a mitad

- **WHEN** se cierra el navegador mientras la IA trabaja
- **THEN** la peticion termina igual
- **AND** queda guardado el punto anterior, para poder deshacerla entera
