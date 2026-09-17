# ai-authoring Specification

## Purpose
Define como se le pide algo a la IA, donde quedan guardadas esas peticiones y hasta donde puede llegar la IA en una sola peticion.

## Requirements

### Requirement: Una sola entrada a la IA

El campo de texto del dock SHALL ser la unica entrada a la IA. El boton de la barra superior SHALL traer el dock con la conversacion tal como se dejo; si no habia ninguna, en blanco. Empezar una conversacion nueva SHALL seguir siendo un acto que se pide, dentro del dock.

#### Scenario: Escribir en el campo

- **WHEN** quien construye escribe una peticion en el campo del dock y confirma
- **THEN** la peticion se envia y aparece en la conversacion

#### Scenario: Pulsar el boton de IA

- **WHEN** quien construye pulsa el boton de IA de la barra superior
- **THEN** el dock aparece con la conversacion de esa pagina tal como se dejo
- **AND** puede llegar desde ahi a las conversaciones anteriores

### Requirement: Las conversaciones pertenecen a la aplicacion

Cada conversacion SHALL guardarse en la pagina donde se hizo. La lista de conversaciones SHALL mostrar unicamente las de la pagina abierta. El sistema SHALL NO ofrecer abrir una conversacion hecha en otra pagina.

Al cambiar de pagina, el dock SHALL mostrar la conversacion de la pagina que se abre, y SHALL NO conservar delante la de la pagina de la que se venia. Lo que cada pagina llevaba --lo conversado y lo escrito sin enviar-- SHALL seguir siendo suyo: volver a ella lo devuelve tal como estaba.

Abierta SHALL haber una sola conversacion en toda la aplicacion: la ultima en la que se hablo, en la pagina que fuera. El sistema SHALL guardar cual es, de modo que quien entre desde otro navegador se encuentre delante esa misma y ninguna otra.

Al abrir una pagina, el dock SHALL reponer la conversacion abierta solo si es de esa pagina, y SHALL seguir escribiendo en ella. Cualquier otra pagina SHALL empezar en blanco, aunque tenga conversaciones suyas guardadas: para volver a ellas esta la lista de conversaciones anteriores.

Pedir algo en una pagina SHALL dejar abierta la conversacion de esa pagina, y con ello SHALL NO quedar ninguna otra abierta. Empezar una conversacion nueva SHALL dejar la aplicacion sin ninguna abierta. Abrir una conversacion de la lista SHALL dejarla abierta.

Lo mirado SHALL NO quitarse de delante: una peticion que termina en otra pagina SHALL NO borrar lo que quien construye esta leyendo.

Una respuesta que llegue cuando ya se cambio de pagina SHALL quedar en la conversacion donde se pidio, no en la que se este mirando.

#### Scenario: Ver las conversaciones anteriores

- **WHEN** quien construye abre la lista de conversaciones
- **THEN** ve solo las conversaciones hechas en la pagina abierta
- **AND** ninguna entrada necesita decir en que pagina se hizo

#### Scenario: Cambiar de pagina y volver a mirar

- **WHEN** quien construye abre otra pagina y mira la lista de conversaciones
- **THEN** ve las de esa otra pagina
- **AND** no ve las de la pagina de la que venia

#### Scenario: Cambiar de pagina con una conversacion delante

- **WHEN** quien construye tiene una conversacion delante y abre otra pagina
- **THEN** el dock ensena la conversacion de la pagina que acaba de abrir
- **AND** al volver a la primera, la suya sigue como estaba

#### Scenario: Volver a la pagina donde se hablo la ultima vez

- **WHEN** quien construye entra en la aplicacion --incluso desde otro navegador-- y abre la pagina donde hablo por ultima vez
- **THEN** el dock repone esa conversacion
- **AND** lo que pida a continuacion sigue en esa misma conversacion

#### Scenario: Volver a una pagina donde se hablo antes

- **WHEN** quien construye conversa en una pagina, luego conversa en otra y vuelve a la primera
- **THEN** el dock de la primera empieza en blanco
- **AND** lo que se hablo ahi sigue alcanzable desde las conversaciones anteriores

#### Scenario: Empezar de cero y volver

- **WHEN** quien construye empieza una conversacion nueva en una pagina, se va a otra y vuelve
- **THEN** sigue viendo la conversacion nueva, en blanco
- **AND** la anterior no se repone encima, ni en esta visita ni desde otro navegador

#### Scenario: Cambiar de pagina mientras la IA trabaja

- **WHEN** la IA esta trabajando en una pagina y quien construye vuelve a ella
- **THEN** ve la conversacion en curso, con el avance de la peticion
- **AND** desde cualquier otra pagina no se cuenta ese avance como si fuera suyo

#### Scenario: Abrir una conversacion nueva sin perder la anterior

- **WHEN** hay una conversacion en curso y quien construye abre una nueva
- **THEN** la anterior queda guardada y se puede volver a ella

### Requirement: La IA toca una sola pagina por peticion

En una peticion, la IA SHALL escribir unicamente sobre la pagina abierta. SHALL NO crear ni modificar otras paginas, salvo que quien construye lo autorice de forma expresa en el dialogo de impacto.

#### Scenario: Peticion normal

- **WHEN** quien construye pide un cambio estando en una pagina
- **THEN** solo esa pagina cambia

#### Scenario: Peticion que abarca varias paginas

- **WHEN** quien construye pide algo que exigiria cambiar tambien otras paginas
- **THEN** la IA hace lo que puede en la pagina abierta
- **AND** dice que quedo fuera y por que

### Requirement: La IA recibe el contexto de la pagina

Cada peticion SHALL mandar a la IA el contexto armado en ese momento, con los colores, espaciados, tablas, ordenes, quien esta mirando y los limites.

Cuando quien construye haya senalado uno o mas elementos del documento, la peticion SHALL llevarlos ademas como contexto: donde estan y el HTML que tienen ahora.

#### Scenario: Peticion despues de cambiar una tabla

- **WHEN** se cambia una tabla y a continuacion se le pide algo a la IA
- **THEN** la IA trabaja con la tabla tal como quedo

#### Scenario: Peticion con un elemento senalado

- **WHEN** quien construye senala un elemento y pide un cambio sobre el
- **THEN** la IA recibe ese elemento con la peticion
- **AND** no necesita releer la pagina entera para saber cual es

### Requirement: La IA edita trozos en vez de rehacer la pagina

La IA SHALL poder leer un bloque nombrado, reemplazarlo, insertar uno nuevo antes o despues de el, y quitarlo, sin tocar el resto del documento.

Rehacer la pagina entera SHALL seguir siendo posible, para cuando de verdad se necesita. El contexto SHALL empujar a la IA a preferir el bisturi cuando el cambio es localizado, y a decir por que cuando rehace la pagina entera.

#### Scenario: Un cambio pequeno sobre una pagina grande

- **WHEN** se le pide a la IA cambiar el titulo de una seccion de una pagina larga
- **THEN** edita solo esa seccion
- **AND** el resto de la pagina no se vuelve a generar

#### Scenario: Un cambio que sí necesita rehacer

- **WHEN** se le pide a la IA rehacer la pantalla completa con otra estructura
- **THEN** puede reescribir el documento entero
- **AND** dice que lo hizo asi

#### Scenario: Anadir algo a lo que ya existe

- **WHEN** se le pide un buscador sobre una lista que ya esta construida
- **THEN** lo inserta junto a esa lista
- **AND** la lista sigue tal como estaba

### Requirement: Consultar los datos desde la conversacion

Cuando quien construye pregunta por los datos de la aplicacion, la IA SHALL poder consultarlos y responder dentro de la conversacion, sin modificar la pagina.

#### Scenario: Preguntar para que se usa una columna

- **WHEN** quien construye pregunta para que usa una pagina una columna concreta
- **THEN** la IA lo consulta y lo responde
- **AND** la pagina no cambia

### Requirement: Cada peticion queda como un paso de los cambios

Lo que la IA escriba en una peticion SHALL quedar registrado como un solo paso en los cambios de la pagina, con el texto que lo pidio.

#### Scenario: Deshacer lo que hizo la IA

- **WHEN** quien construye no quiere el resultado de la ultima peticion
- **THEN** puede volver al paso anterior de una sola vez

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

### Requirement: Lo que llega se dibuja a un ritmo que no ahoga

Mientras la respuesta de la IA llega por partes, el sistema SHALL agrupar los redibujados de la conversacion por intervalos, en vez de redibujar en cada trozo recibido. Seguir el final de la conversacion SHALL obedecer al mismo ritmo.

#### Scenario: Una respuesta larga y rapida

- **WHEN** la IA devuelve una respuesta larga a gran velocidad
- **THEN** la conversacion sigue respondiendo al desplazamiento y a los clics
- **AND** el texto se ve crecer sin saltos

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

### Requirement: Para quién es la pantalla se deduce de la petición

La IA SHALL deducir para quién es lo que construye a partir de las palabras de la petición, con estas reglas.

"Yo", "quiero" o "mi" SHALL significar el rol `admin` **solo cuando la petición nombra también a otras personas**. Cuando la petición no nombra a nadie más, la IA SHALL NO asumir público ninguno y construir para quien pueda abrir la página.

Una palabra que nombra un grupo de personas SHALL leerse así:

- Genérica --"usuarios", "personas", "todos", "la gente"--: son todas las personas invitadas, y la pantalla no filtra por rol.
- Coincide con un rol de la aplicación: es ese rol. La coincidencia SHALL tolerar plural y tildes, porque "los odontólogos" no coincide literalmente con `odontologo`.
- No coincide con ningún rol: la IA SHALL construir para todos y decirlo. SHALL NOT preguntar, porque filtrar por rol dentro del HTML no protege nada y equivocarse cuesta una corrección, no un fallo de acceso.

#### Scenario: Petición que contrapone a quien escribe con otras personas

- **WHEN** se pide "quiero ver el listado de todos los usuarios y cuáles leyeron el manual"
- **THEN** la pantalla que construye la IA reserva ese listado al rol `admin`

#### Scenario: Petición que no nombra a nadie más

- **WHEN** se pide "quiero ver quién leyó el manual"
- **THEN** la IA no reserva la pantalla a `admin`
- **AND** la construye para quien pueda abrir la página

#### Scenario: Nombre de grupo que no coincide con ningún rol

- **WHEN** se pide algo para "los doctores" en una aplicación cuyos roles son `conductor`, `auxiliar`, `odontologo` y `admin`
- **THEN** la IA construye la pantalla para todos y dice el supuesto
- **AND** no abre una pregunta

#### Scenario: Nombre de grupo en plural y con tilde

- **WHEN** se pide algo para "los odontólogos" y la aplicación define el rol `odontologo`
- **THEN** la IA lo entiende como ese rol

### Requirement: El público que se asume se dice en el resumen

Cuando la IA asuma para quién es una pantalla, SHALL decirlo en el resumen con el que cierra el turno, nombrando el rol o el conjunto de personas que asumió.

#### Scenario: Turno que asumió un público

- **WHEN** la IA construye una pantalla habiendo asumido a quién va dirigida
- **THEN** el resumen del turno nombra ese público
- **AND** quien construye puede corregirlo con una frase en vez de rehacer la pantalla

### Requirement: Un filtro por rol se resuelve antes de pintar

Cuando la IA escriba una pantalla que muestra u oculta algo según el rol de quien mira, SHALL decidir esa visibilidad antes de dibujar el contenido.

La IA SHALL NOT escribir contenido que arranque oculto y se muestre al terminar de dibujarlo: un error a mitad de camino dejaría la sección oculta sin que nada avise, y la pantalla se vería vacía en vez de rota.

#### Scenario: Pantalla con una sección reservada a un rol

- **WHEN** la IA escribe una pantalla con una sección que solo ve un rol
- **THEN** la visibilidad de esa sección queda decidida antes de dibujar su contenido

#### Scenario: Error mientras se dibuja la sección

- **WHEN** falla el guion que rellena una sección reservada a un rol de quien sí tiene ese rol
- **THEN** la sección sigue estando a la vista
- **AND** el fallo se puede ver en vez de quedar como una pantalla vacía

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
### Requirement: Cada peticion deja constancia de su contexto

Toda peticion a la IA SHALL dejar guardado lo que se le mando al modelo y lo que devolvio, para poder entender despues una peticion que salio mal. Esa constancia SHALL guardarse tanto si la peticion termino bien como si fallo, y SHALL NO depender de haber encendido nada antes.

Guardar esa constancia SHALL NO cambiar ni retrasar lo que recibe quien construye, y un fallo al guardarla SHALL NO hacer fallar la peticion.

#### Scenario: Una peticion falla

- **WHEN** una peticion a la IA falla a mitad
- **THEN** queda guardado el contexto que se le habia mandado y lo que alcanzo a devolver

#### Scenario: No se guardo nada antes de pedir

- **WHEN** quien construye pide algo sin haber encendido ninguna opcion de depuracion
- **THEN** la constancia se guarda igual

#### Scenario: Guardar la constancia falla

- **WHEN** la peticion termina bien pero la constancia no se puede guardar
- **THEN** quien construye recibe la respuesta igual
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
