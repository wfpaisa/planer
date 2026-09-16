## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Una sola peticion en marcha a la vez

Mientras la IA este trabajando en una pagina, el sistema SHALL NO admitir peticiones desde otra pagina de la misma aplicacion. Estando en otra pagina, el sistema SHALL decir en cual esta trabajando y SHALL ofrecer ir a ella.

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

- **WHEN** la IA esta trabajando y quien construye pide algo en esa misma pagina
- **THEN** se comporta como siempre: la peticion anterior se reemplaza por la nueva

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
