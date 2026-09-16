## Why

La conversacion con la IA y la pagina que la IA escribe no estan atadas. Las conversaciones se guardan en la aplicacion, asi que la lista mezcla las de todas las paginas: para encontrar lo que se pidio en la pagina que se tiene delante hay que leer la etiqueta de cada entrada. Y peor: abrir una conversacion hecha en otra pagina la carga en la conversacion de la pagina actual, asi que seguir escribiendo ahi modifica una pagina distinta de la que el hilo nombra.

Mientras la IA trabaja, la senal de que trabaja vive dentro del dock de la pagina donde se pidio. Al cambiar de pagina no queda nada: ni que hay algo en marcha, ni sobre que pagina, ni como volver. El servidor admite una peticion por pagina y varias paginas a la vez, asi que quien construye puede dejar dos trabajando sin saberlo.

Cuando una peticion sale mal, lo que haria falta para entender por que --el contexto que se le mando al modelo-- solo existe si el modo debug estaba encendido, y solo en la memoria del navegador: recargar lo borra. El fallo que no se puede reproducir es justo el que no se puede depurar.

Y en la conversacion ya guardada no queda constancia de con que se pidio: los archivos adjuntos se ven mientras dura la visita pero no se guardan, y los elementos senalados con el cursor no se ven en ningun momento despues de enviar.

## What Changes

- **BREAKING** Las conversaciones pasan a ser de la pagina, no de la aplicacion. La lista muestra solo las de la pagina abierta, desaparece la etiqueta "esta pagina" y deja de ser posible abrir una conversacion de otra pagina.
- Abierta hay una sola conversacion en toda la aplicacion: la ultima en la que se hablo. La pagina que la tiene la repone al abrirse; las demas empiezan en blanco, y lo de antes se busca en las conversaciones anteriores. Cual es se guarda en la aplicacion, asi que entrar desde otro navegador encuentra delante la misma.
- Al borrar una pagina se van con ella sus conversaciones y su registro de depuracion.
- La fila de la pagina en el sidebar dice que la IA esta trabajando ahi. Un clic en esa fila lleva a la pagina, que es lo que la fila ya hacia.
- El panel deja pedir en una sola pagina a la vez: estando en otra, el campo de texto no admite peticiones y ofrece ir a la pagina que trabaja. El servidor no cambia --sigue admitiendo una peticion por pagina-- para que levantar el limite sea quitar el bloqueo del panel y nada mas.
- Cada peticion deja un registro de depuracion en la base de datos: uno por pagina, sobrescrito en cada peticion. Guarda lo que se pidio, el contexto enviado tal cual, el razonamiento, la respuesta, el modelo y cuanto tardo. Se guarda siempre, no solo con el modo debug encendido.
- Los ajustes generales ganan una accion que borra todos los registros de depuracion de la instalacion.
- La burbuja de la peticion muestra los archivos adjuntos y los elementos senalados, y los dos se guardan en la conversacion: los nombres de los archivos y la etiqueta legible de lo senalado. No se guarda el contenido de ninguno de los dos.

## Capabilities

### New Capabilities
- `ai-debug`: el registro de depuracion de la ultima peticion de cada pagina --que se guarda, cuanto vive, quien lo ve y como se borra.

### Modified Capabilities
- `ai-authoring`: las conversaciones pertenecen a la pagina; una sola peticion en marcha por aplicacion desde el panel; cada peticion deja constancia de su contexto.
- `builder-ai-dock`: el dock de una pagina ajena a la que trabaja no admite peticiones y ofrece volver; la burbuja de la peticion dice con que se pidio.
- `app-navigation`: la fila de una pagina en el sidebar dice si la IA esta trabajando en ella.
- `page-picker`: lo senalado sigue visible en la burbuja despues de enviar, y sobrevive a reabrir la conversacion.
- `builder/pages`: borrar una pagina se lleva sus conversaciones y su registro de depuracion.

## Impact

- `server/bootstrap.ts`: `ai_chats.page` pasa de texto a relacion con `pages` con borrado en cascada --hoy es texto suelto, y por eso una conversacion sobrevive a su pagina--. Se anade la coleccion del registro de depuracion, tambien en cascada por pagina y por aplicacion.
- `server/bootstrap.ts`, `server/aiChats.ts`, `server/routes.ts`: `apps.openChat` apunta a la conversacion abierta --texto, como `liveVersion`, porque "apps" se crea antes que "ai_chats"--; guardar una peticion la deja abierta, y dos rutas la leen y la mueven (`GET`/`PUT /api/apps/:id/conversaciones/abierta`).
- `server/aiChats.ts`: `listChats` filtra por pagina. `pageName` deja de tener uso --existia para nombrar paginas borradas, y esas conversaciones ahora se borran--. `AiMessage` gana los nombres de archivo y las etiquetas de lo senalado.
- `server/aiRuns.ts`: sin cambios de comportamiento. Se anade leer que peticiones tiene en marcha una aplicacion.
- `server/aiPage.ts`, `server/routes.ts`, `server/index.ts`: el registro de depuracion se escribe al cerrar el turno; rutas nuevas para las peticiones en marcha de una aplicacion, para leer el registro de una pagina y para borrarlos todos; la ruta de conversaciones acepta la pagina.
- `web/src/components/AiPanel.svelte`: lista filtrada, bloqueo en paginas ajenas, badges de lo senalado en la burbuja.
- `web/src/components/ai/ChatList.svelte`: sin etiqueta de pagina ni nombre de pagina.
- `web/src/components/AppSidebar.svelte`: la senal en la fila de la pagina.
- `web/src/lib/`: de donde lee el panel que hay algo en marcha en la aplicacion.
- `web/src/routes/AiSettings.svelte`: la accion de borrar los registros.
- `shared/types.ts`: `AiChat` sin `pageName`, `AiMessage` con lo adjuntado, y los tipos del registro de depuracion y de las peticiones en marcha.
- Las conversaciones que ya existen quedan atadas a su pagina por el id que ya guardaban; las de paginas que ya no existen no seran alcanzables.
