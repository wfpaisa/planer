## MODIFIED Requirements

### Requirement: Contenido de la barra

La barra SHALL ofrecer, en este orden: el boton de IA, el campo de texto, publicar, compartir, los ajustes de la aplicacion y los ajustes de la pagina. SHALL NO ofrecer una zona de arrastre propia ni la salida al panel de aplicaciones.

La barra SHALL ser la unica superficie de mando de quien construye. Toda accion de construccion que no viva en el sidebar SHALL alcanzarse desde ella.

#### Scenario: Soltar un archivo

- **WHEN** se suelta un archivo en cualquier parte de la pagina
- **THEN** el sistema lo acepta sin que haya que apuntar a una zona concreta

#### Scenario: Buscar una accion de construccion

- **WHEN** quien construye busca cualquier accion sobre su aplicacion o su pagina
- **THEN** la encuentra en la barra o en el sidebar, y en ningun otro sitio

### Requirement: Dos iconos de ajustes con dueno claro

La barra SHALL separar los ajustes en dos iconos. Los ajustes de la aplicacion SHALL cubrir nombre, icono, paleta, base de datos, personas y roles, e importar HTML. Los ajustes de la pagina SHALL cubrir nombre e icono de la pagina, quien puede verla, ver su codigo HTML, sus cambios, traer un HTML de fuera y borrarla.

#### Scenario: Buscar la base de datos

- **WHEN** quien construye abre los ajustes de la aplicacion
- **THEN** encuentra la base de datos, las personas y los roles

#### Scenario: Cambiar el nombre de la aplicacion

- **WHEN** quien construye abre los ajustes de la aplicacion
- **THEN** puede cambiar ahi el nombre y el icono de la aplicacion

#### Scenario: Buscar el codigo de la pagina

- **WHEN** quien construye abre los ajustes de la pagina
- **THEN** encuentra el codigo HTML, quien puede verla y sus cambios

#### Scenario: El icono de la aplicacion

- **WHEN** una aplicacion tiene un icono elegido por quien construye
- **THEN** ese mismo icono identifica los ajustes de la aplicacion en la barra

## REMOVED Requirements

### Requirement: Los dialogos nacen de la barra

**Reason**: La barra deja de abrir dialogos. Ahora se transforma en su sitio, asi que no hay nada que nazca de ella ni que vuelva a ella. Lo sustituye el requisito "La barra se transforma en su sitio".

**Migration**: No hay datos que migrar. Todo lo que se abria como dialogo pasa a dibujarse dentro de la barra, sin perder ninguna entrada.

## ADDED Requirements

### Requirement: La barra se transforma en su sitio

La barra SHALL transformarse en lugar de abrir una ventana aparte. Al elegir una entrada, la barra SHALL crecer desde el tamano que tiene hasta el que necesita ese contenido, y el contenido SHALL dibujarse dentro de ella. Al cerrar, SHALL encogerse hasta su tamano minimo.

El crecer y el encoger SHALL ser un movimiento continuo, para que se entienda que sigue siendo la misma barra. La barra SHALL crecer desde su borde inferior, que SHALL quedarse quieto.

La barra transformada SHALL NO oscurecer ni tapar el resto de la ventana con un fondo. El documento SHALL seguir visible alrededor.

La tecla de escape SHALL devolver siempre la barra a su tamano minimo. Un clic fuera de la barra SHALL hacer lo mismo, y ese clic SHALL NO llegar al documento.

#### Scenario: Abrir una entrada de la barra

- **WHEN** quien construye elige compartir en la barra
- **THEN** la barra crece y muestra los enlaces dentro de si misma
- **AND** no aparece ninguna ventana encima de la pagina
- **AND** el documento se sigue viendo alrededor

#### Scenario: La barra crece con la pagina en blanco

- **WHEN** la pagina esta en blanco y se abre una entrada de la barra
- **THEN** la barra crece sin dejar de estar centrada

#### Scenario: La barra crece con la pagina llena

- **WHEN** la pagina tiene contenido y se abre una entrada de la barra
- **THEN** la barra crece hacia arriba
- **AND** su borde inferior no se mueve

#### Scenario: Cerrar con escape

- **WHEN** la barra esta transformada y se pulsa la tecla de escape
- **THEN** la barra se encoge hasta su tamano minimo con un movimiento visible

#### Scenario: Cerrar con un clic fuera

- **WHEN** la barra esta transformada y se hace clic sobre el documento
- **THEN** la barra se encoge hasta su tamano minimo
- **AND** el documento no recibe ese clic

#### Scenario: Volver a lo que se estaba escribiendo

- **WHEN** la barra se encoge despues de haber estado transformada
- **THEN** el texto que hubiera en el campo sigue ahi

### Requirement: Publicar vive en la barra

La barra SHALL ofrecer publicar la aplicacion, y SHALL indicar si hay cambios sin publicar. Elegirlo SHALL transformar la barra para mostrar ahi mismo el enlace publico y la decision de publicar.

#### Scenario: Hay cambios sin publicar

- **WHEN** se guarda un cambio en una pagina
- **THEN** la barra indica que hay cambios sin publicar

#### Scenario: Publicar

- **WHEN** quien construye elige publicar en la barra
- **THEN** la barra crece y muestra ahi la decision de publicar
- **AND** no se abre ninguna ventana aparte

### Requirement: La conversacion con la IA vive dentro de la barra

Escribir en el campo o pulsar el boton de IA SHALL transformar la barra en la conversacion, con la peticion, la respuesta y lo que se propone cambiar. SHALL NO abrirse una ventana aparte.

Mientras la IA trabaja, el documento SHALL seguir visible, para ver el resultado en cuanto llegue.

#### Scenario: Pedir un cambio

- **WHEN** quien construye escribe una peticion y la envia
- **THEN** la barra crece y muestra la conversacion dentro
- **AND** el documento se sigue viendo alrededor

#### Scenario: Empezar una conversacion nueva

- **WHEN** quien construye pulsa el boton de IA
- **THEN** la barra crece con una conversacion nueva

### Requirement: El codigo y los cambios viven dentro de la barra

Ver el codigo HTML de la pagina, ver sus cambios anteriores y traer un HTML de fuera SHALL transformar la barra. En estos casos la barra SHALL poder crecer hasta ocupar la mayor parte de la ventana, porque su contenido lo necesita, y SHALL conservar su forma de barra y su camino de vuelta.

#### Scenario: Ver el codigo

- **WHEN** quien construye elige ver el codigo HTML
- **THEN** la barra crece hasta un tamano en el que el codigo se puede leer y editar
- **AND** se encoge hasta la barra al cerrarse

#### Scenario: Ver los cambios

- **WHEN** quien construye elige ver los cambios de la pagina
- **THEN** la barra crece y los muestra dentro

### Requirement: El aviso de impacto en los datos vive dentro de la barra

Cuando un cambio pedido a la IA puede romper algo en la base de datos, el aviso de impacto y la decision SHALL mostrarse dentro de la barra, encadenados con la conversacion que los provoco.

#### Scenario: Un cambio con riesgo

- **WHEN** la IA propone borrar una columna que usan otras paginas
- **THEN** la barra muestra dentro el impacto y la decision
- **AND** se entiende que viene de la peticion que se acaba de hacer

### Requirement: Una sola cosa abierta a la vez

La barra SHALL mostrar un solo contenido transformado a la vez. Elegir otra entrada SHALL sustituir el contenido sin encoger y volver a crecer.

#### Scenario: Cambiar de entrada

- **WHEN** la barra muestra compartir y se eligen los ajustes de la pagina
- **THEN** el contenido cambia dentro de la misma barra
- **AND** la barra no se cierra y se vuelve a abrir

### Requirement: Borrar sigue preguntando aparte

Borrar una pagina SHALL seguir pidiendo confirmacion en una pregunta que interrumpe. Es la unica excepcion a que todo ocurra dentro de la barra.

#### Scenario: Borrar una pagina

- **WHEN** quien construye elige borrar una pagina
- **THEN** aparece una pregunta de confirmacion que hay que responder
