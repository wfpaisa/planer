## 1. Base de datos

- [x] 1.1 Borrar las conversaciones cuya pagina ya no existe, antes de tocar el campo: la relacion no puede aceptar un valor que no apunta a nada.
- [x] 1.2 En `server/bootstrap.ts`, `ai_chats.page` pasa de texto a relacion con `pages`, `cascadeDelete: true`, `maxSelect: 1`, requerido.
- [x] 1.3 Quitar `pageName` de la coleccion `ai_chats`.
- [x] 1.4 Crear la coleccion del registro de depuracion: relacion con la aplicacion y con la pagina, las dos en cascada; lo que se pidio, el contexto, el razonamiento, la respuesta, el modelo, la duracion y la marca de recortado. Sin reglas de acceso: solo entra el servidor.
- [x] 1.5 Anadir el id de la coleccion nueva a `INTERNAL` en `server/config.ts`.

## 2. Tipos compartidos

- [x] 2.1 `AiChat` sin `pageName`. `AiMessage` gana los nombres de los archivos adjuntos y las etiquetas de lo senalado.
- [x] 2.2 Tipo del registro de depuracion y de lo que se devuelve al leerlo.
- [x] 2.3 Tipo de la respuesta de "que paginas tienen algo en marcha".

## 3. Conversaciones por pagina

- [x] 3.1 `listChats` filtra por pagina; la ruta de conversaciones acepta la pagina y la exige.
- [x] 3.2 `appendToChat` deja de escribir y de arrastrar `pageName`.
- [x] 3.3 `readMessages` acepta y devuelve los nombres de archivo y las etiquetas de lo senalado, descartando lo que no sea texto.
- [x] 3.4 `AiPanel` pide la lista con la pagina abierta; `ChatList` pierde `currentPage`, la etiqueta "esta pagina" y el nombre de pagina.
- [x] 3.5 `openChat` repone en cada entrada los archivos y lo senalado que el mensaje guardaba.

## 3bis. Una sola conversacion abierta

- [x] 3bis.1 `apps.openChat` en `server/bootstrap.ts`: la conversacion abierta de la aplicacion, texto y no relacion porque "apps" se crea antes que "ai_chats".
- [x] 3bis.2 `appendToChat` la deja abierta al guardar: pedir algo en una pagina cierra la de la otra.
- [x] 3bis.3 Rutas para leerla y para moverla; mover a una que no es de la aplicacion se rechaza.
- [x] 3bis.4 El panel la pregunta una vez por visita y repone solo en su pagina; empezar una nueva y abrir una de la lista la mueven.
- [x] 3bis.5 Dentro de la visita, hablar en una pagina suelta lo que las otras tenian delante, sin tocar lo escrito sin enviar ni lo que esta escuchando una peticion.

## 4. Que hay en marcha en la aplicacion

- [x] 4.1 En `server/aiRuns.ts`, leer las peticiones sin terminar de una aplicacion. Una terminada esperando a ser recogida no cuenta.
- [x] 4.2 Ruta nueva por aplicacion que las devuelve, con el id de la pagina y cuando empezo. Solo para el dueno.
- [x] 4.3 Modulo con runas en `web/src/lib/` que guarda que paginas trabajan: se siembra con la ruta al entrar en la aplicacion y lo escribe quien escucha el hilo de avisos al empezar y al terminar.
- [x] 4.4 Tras sembrar, enganchar el hilo de avisos a las peticiones de otras paginas que sigan en marcha, para que la senal siga viva despues de recargar.

## 5. La senal y el bloqueo

- [x] 5.1 `AppSidebar` marca la fila de la pagina donde la IA trabaja. Con el sidebar plegado la marca se retira con el.
- [x] 5.2 `UrlBar` enciende el boton de la IA cuando el dock esta escondido y hay algo en marcha.
- [x] 5.3 `AiPanel` no admite enviar cuando lo que trabaja es otra pagina: dice cual y ofrece ir a ella, conservando lo escrito.
- [x] 5.4 El bloqueo se levanta solo al terminar la peticion, sin recargar ni volver a entrar.

## 6. Registro de depuracion

- [x] 6.1 Escribir el registro al cerrar el turno en `server/aiPage.ts`, tanto al terminar bien como al fallar; recortar el contexto que no quepa y marcarlo. Un fallo al guardar no altera la respuesta.
- [x] 6.2 Sobrescribir el de esa pagina si ya habia uno, en vez de anadir otro.
- [x] 6.3 Ruta para leer el registro de una pagina, solo para el dueno de la aplicacion.
- [x] 6.4 Ruta que borra todos los registros de la instalacion.
- [x] 6.5 El despliegue "Contexto enviado" del dock lee el registro guardado cuando no hay contexto de esta visita.
- [x] 6.6 Accion de limpieza en `AiSettings`, con su confirmacion, diciendo que es de toda la instalacion.

## 7. Lo adjuntado en la burbuja

- [x] 7.1 La burbuja de la peticion pinta las etiquetas de lo senalado junto a los nombres de archivo que ya pintaba.
- [x] 7.2 Al enviar, los nombres de archivo y las etiquetas quedan en la entrada y viajan al mensaje guardado.

## 8. Borrado de una pagina

- [x] 8.1 Comprobar que borrar una pagina se lleva sus conversaciones y su registro por la cascada, sin tocar el borrado del navegador.
- [x] 8.2 La confirmacion de borrado dice que tambien se borran las conversaciones de la pagina.

## 9. Comprobaciones

- [x] 9.1 `bun run smoke:ia`: una conversacion solo aparece en la lista de su pagina; una peticion en una pagina bloquea el envio en otra; la peticion deja registro aunque falle; los nombres de archivo y las etiquetas sobreviven a reabrir la conversacion.
- [x] 9.1bis `bun run smoke:ia`: pedir en una pagina deja abierta la suya y cierra la de la otra; una peticion que falla no deja ninguna abierta; mover la abierta a una de la lista, dejar la aplicacion sin ninguna, y el rechazo de una que no existe.
- [x] 9.2 `bun run smoke`: borrar una pagina se lleva sus conversaciones y su registro.
- [x] 9.3 `bun run typecheck` y `bun run check`.
- [x] 9.4 Actualizar `docs/CHAT.md` si describe las conversaciones como de la aplicacion.
