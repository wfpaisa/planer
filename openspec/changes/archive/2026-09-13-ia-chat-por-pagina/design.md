## Context

Ver `proposal.md` - Why. Lo que condiciona el como:

- `ai_chats.page` es un campo de texto, no una relacion (`server/bootstrap.ts`). Por eso una conversacion sobrevive a su pagina, y por eso existe `pageName`: nombrar una pagina que ya no esta.
- Las paginas se borran desde el navegador, directo contra PocketBase (`web/src/components/PagePanel.svelte`). No hay ruta de servidor en la que colgar una limpieza.
- Una peticion vive en la memoria del servidor (`server/aiRuns.ts`), una por pagina, y se puede volver a ella con `followPageRun`. El hilo de avisos que la escucha sobrevive a que el panel se desmonte: lo dice `aiConversation.ts` y lo sostiene `listening`.
- Una peticion terminada se conserva diez minutos esperando a que alguien recoja el resultado (`KEEP_DONE`). Estar en la memoria no significa estar trabajando.
- El contexto que se manda al modelo lleva el HTML entero de la pagina: cientos de kilobytes en una pagina grande.

## Goals / Non-Goals

**Goals:**

- Que la conversacion y la pagina que la IA escribe sean siempre la misma cosa, sin que haga falta leer una etiqueta para saberlo.
- Que desde cualquier pagina se sepa si la IA trabaja, en cual, y se vuelva con un clic.
- Que el contexto de la ultima peticion de cada pagina exista despues del fallo, sin haber tenido que preverlo.
- Que el limite de una peticion a la vez se pueda levantar borrando codigo, no reescribiendolo.

**Non-Goals:**

- Historial de peticiones. Se guarda una por pagina, la ultima, y se sobrescribe.
- Ver el registro de depuracion de otra pagina desde la pagina actual.
- Cambiar como se pide, como se responde o como se escucha una peticion.
- Mover el borrado de paginas al servidor.

## Decisions

### La conversacion pertenece a la pagina

`listChats` filtra por pagina y la ruta de conversaciones acepta la pagina. Desaparecen `pageName` del registro y la etiqueta "esta pagina" de la lista.

Se descarto conservar las conversaciones en la aplicacion con un filtro o agrupadas por pagina: mientras se pueda abrir una conversacion de otra pagina, sigue siendo posible cargarla en la conversacion de la pagina actual y escribir sobre la pagina equivocada, que es la mitad del problema. Filtrar la lista sin atar la conversacion lo esconde en vez de quitarlo.

### El borrado lo hace la cascada de PocketBase, no el servidor

`ai_chats.page` pasa a ser relacion con `pages` y `cascadeDelete: true`, igual que ya hace `app`. El registro de depuracion nace con las dos relaciones en cascada.

La alternativa era mover el borrado de una pagina a una ruta de servidor que limpiara a mano. Es mas codigo y una ruta nueva para algo que la base de datos ya sabe hacer, y dejaria el borrado desde el navegador como un camino que se salta la limpieza.

Con las conversaciones atadas a la pagina, `pageName` no protege nada: una conversacion de una pagina borrada no se alcanza desde ningun sitio.

### La senal de que la IA trabaja vive en la fila del sidebar

La fila de la pagina lleva la senal. Es donde ya esta la respuesta a "en cual", y volver es el clic que la fila ya hacia. Cuando el dock esta escondido, el boton de IA de la barra de direccion se enciende --ya tiene el anillo (`aura aura-ia`)-- para que ningun estado se quede sin senal.

Se descarto la banda dentro del dock: repite lo que la fila ya dice y solo se ve con el dock traido.

### Quien esta trabajando se sabe sin sondear

Dos piezas:

1. Una ruta nueva por aplicacion que responde que paginas tienen una peticion sin terminar. Es la fuente de verdad y se pregunta al entrar en la aplicacion. Tambien es lo que hace que un reinicio del servidor apague la senal: si no hay peticiones, no hay nada que decir.
2. Un estado compartido en el navegador --un modulo con runas, como `pagePicker`-- que escribe quien escucha el hilo de avisos. El hilo ya sobrevive al desmontaje del panel, asi que al cambiar de pagina sigue contando lo que pasa en la que quedo atras.

Tras recargar, la respuesta de (1) dice que paginas siguen en marcha y a cada una se le engancha el hilo que ya existe (`followPageRun`). Eso deja la senal viva y, de paso, deja la conversacion de esa pagina al dia, que es lo que se querria de todos modos.

Se descarto sondear cada pocos segundos: seria trafico constante para un estado que el hilo de avisos ya cuenta en el momento exacto en que cambia.

Solo cuenta una peticion sin terminar. Una terminada esperando a que alguien la recoja no es trabajo en curso, y encenderia la senal diez minutos de mas.

### El limite de una peticion a la vez vive en el panel

El servidor no cambia: `startRun` sigue admitiendo una peticion por pagina y varias paginas a la vez. El panel es el que, estando en una pagina distinta de la que trabaja, no admite peticiones y ofrece ir a ella.

El campo no se atenua ni se deshabilita pieza a pieza: se le pone encima un velo opaco con la unica salida que hay. Un campo apagado sigue pareciendo un sitio donde escribir, y dejar entrever lo que hay debajo invita a intentarlo. Debajo del velo el campo va `inert`, para que el teclado no se cuele por detras. Lo escrito sin enviar no se toca --vive en la conversacion de esa pagina-- y vuelve a estar delante en cuanto el bloqueo se levanta.

Asi el limite es una condicion en un sitio. Levantarlo el dia que se quiera trabajar en paralelo es quitar esa condicion, no reconstruir lo que se habia quitado del servidor.

### El registro de depuracion es uno por pagina y se escribe siempre

Una coleccion nueva, una fila por pagina, sobrescrita en cada peticion. Guarda lo que se pidio, el contexto enviado tal cual, el razonamiento, la respuesta, el modelo y cuanto tardo.

Se escribe al cerrar el turno, tanto si termino bien como si fallo: el fallo es el caso que justifica guardar esto.

Se escribe siempre, no solo con el modo debug encendido, porque el fallo que vale depurar es el que no se puede reproducir; si hay que encenderlo y repetir, llega tarde. El tamano no crece con las peticiones: lo acota el numero de paginas, y cada fila se sobrescribe.

Se descarto la memoria del servidor --se pierde justo cuando se reinicia por algo que fallo-- y el navegador --dos o tres contextos llenan el hueco disponible--.

### El registro se lee donde ya se leia el contexto

El despliegue "Contexto enviado" que ya existe en el dock pasa a poder leer el registro guardado cuando lo de la visita ya no esta. Asi recargar deja de perderlo y no hace falta una pantalla nueva para mirar algo que ya tenia sitio.

En los ajustes generales solo va la accion que los borra todos: es una operacion de instalacion, no de una aplicacion.

### Lo adjuntado se guarda como texto, no como contenido

En el mensaje guardado van los nombres de los archivos y la etiqueta legible de lo senalado (`PickedBlock.label`, que ya es texto del tipo "tabla Clientes"). Ni el contenido de los archivos ni el HTML senalado: eso ya viajo, y lo que hace falta para depurar esta en el registro de depuracion.

Es texto corto, asi que cabe en `messages` sin acercarse a su tope.

## Risks / Trade-offs

- **Cambiar `ai_chats.page` de texto a relacion puede rechazar filas cuyo valor no apunte a ninguna pagina** → Antes de cambiar el campo se borran las conversaciones cuya pagina ya no existe. Con el modelo nuevo esas conversaciones no serian alcanzables de todos modos.
- **Las conversaciones de paginas borradas desaparecen, y hoy se podian leer** → Es el precio de atar la conversacion a la pagina, y lo decidido. Queda dicho en la propuesta.
- **Un contexto enorme podria pasarse del tope del campo** → Se guarda recortado con la marca de que va recortado, como ya se hace con el HTML de lo senalado.
- **Escribir el registro podria hacer fallar una peticion que salio bien** → Se escribe despues de entregar el resultado y un fallo al guardarlo no cambia lo que recibe quien construye.
- **Bloquear por una peticion que en realidad ya termino** → Solo bloquea una peticion sin terminar; las que esperan a ser recogidas no cuentan.
- **La senal podria quedarse encendida si el hilo de avisos se corta sin decir nada** → La ruta por aplicacion es la fuente de verdad y se vuelve a preguntar al entrar en la aplicacion.
