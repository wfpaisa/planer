## 1. Datos y tipos

- [x] 1.1 Agregar el campo de la memoria a la coleccion `pages` en `server/bootstrap.ts`, junto a `doc`, `sources` y `roles`: texto, opcional, con `max` holgado y un comentario que diga que son las reglas funcionales de la pagina y que no viaja a la publicada (D2).
- [x] 1.2 Agregar el campo correspondiente a `PageRecord` en `shared/types.ts`, opcional, con el comentario de que vacio significa que la pagina todavia no tiene reglas guardadas.
- [x] 1.3 Comprobar que `AppBundle` y todo lo que se manda a una app publicada no arrastra el campo nuevo (`page-memory`: "La memoria es del constructor").

## 2. Servidor -- leer y guardar la memoria

- [x] 2.1 En `server/routes.ts`, aceptar la memoria en la ruta que ya actualiza una pagina, con el mismo control de acceso que el resto de sus campos.
- [x] 2.2 Normalizar lo que llega antes de guardar: texto plano, sin recorte por tamano (D6), conservando los saltos de linea que separan las vinetas.

## 3. Panel -- el item Memorias

- [x] 3.1 Agregar el item `Memorias` a los ajustes de la pagina en `web/src/components/PagePanel.svelte`, junto a nombre, icono y quien la ve.
- [x] 3.2 Pintar la memoria en una caja de texto editable, con el estado vacio resuelto como caja vacia y no como error (`page-memory`: "La memoria se lee y se edita desde los ajustes de la pagina").
- [x] 3.3 Guardar lo editado contra la ruta de 2.1 y refrescar la pagina en memoria del panel.
- [x] 3.4 Bloquear la caja mientras haya una peticion a la IA en marcha sobre esa pagina, diciendo por que, y desbloquearla al terminar con el texto ya actualizado (D8).

## 4. La memoria en el contexto de la IA

- [x] 4.1 En `server/ai/aiPage/prompts.ts`, agregar la seccion de la memoria a `systemPrompt()`, despues de `## This page`. Va tambien con la memoria vacia: si no, la palabra no esta en el contexto y a quien pide "agrega esto a las memorias" la IA le contesta escribiendo la explicacion dentro de la pagina. Vacia dice que todavia no hay ninguna regla, y en los dos casos dice que no las escribe ella y donde se corrigen a mano.
- [x] 4.2 Redactar esa seccion de forma que la IA entienda que son reglas vigentes que debe respetar, no historial de lo que se pidio.
- [x] 4.3 Comprobar que la memoria llega igual en una conversacion recien empezada y en una que ya paso del recorte de turnos (`page-memory`: "La memoria viaja en cada peticion a la IA").

## 5. Contradiccion y confirmacion

- [x] 5.1 Agregar a la guia del `systemPrompt()` la regla de comparar el pedido con la memoria antes de construir y, ante una contradiccion, cerrar el turno con `preguntar` nombrando la regla guardada (D5).
- [x] 5.2 Ampliar la descripcion de la herramienta `preguntar` en `server/ai/aiPage/tools.ts` para admitir este caso, que hoy queda excluido por la prohibicion de preguntar por decisiones de diseno.
- [ ] 5.3 Comprobar el camino completo con `choice`: confirmar implementa y actualiza la regla; no confirmar deja la pagina y la memoria como estaban.

## 6. La pasada de extraccion

- [x] 6.1 Escribir el texto de sistema de la pasada, con las reglas de D6: solo lo que sobrevive a reconstruir la pagina desde cero, una regla por vineta, en presente y en una linea, reemplazar antes que agregar algo parecido, y `sin cambios` ante la duda.
- [x] 6.2 Definir la forma de la respuesta: una lista de operaciones `agregar` / `reemplazar` / `borrar`, cada una nombrando su vineta por el texto exacto, y la lista vacia cuando no hay nada que guardar (D4).
- [x] 6.3 Implementar la aplicacion de esas operaciones sobre el texto guardado, en orden y cada una sobre lo que dejo la anterior: si el texto nombrado ya no aparece, esa operacion se descarta y las demas siguen aplicandose (D4).
- [x] 6.4 Ejecutar la pasada al cerrar el turno en `server/ai/aiPage/index.ts`, despues de entregar la respuesta, pasandole el intercambio completo --pedido, pregunta y respuesta si las hubo, y lo que la IA hizo-- y la memoria actual (D3, D5).
- [x] 6.5 Tratar el fallo de la pasada como no fatal: se registra, la memoria queda como estaba y el turno termina igual (`page-memory`: "La pasada falla").
- [x] 6.6 Agregar a la pasada el caso de lo que se pide recordar expresamente (D11): una orden directa de quien construye manda sobre la lista de lo que la memoria no guarda, y se guarda aunque la pasada no lo habria considerado una regla.
- [x] 6.7 En el texto de sistema del turno principal, distinguir pedir que algo se recuerde --se confirma y la IA reescribe en su respuesta lo que hay que recordar, para que la pasada lo alcance-- de administrar la memoria --borrar, reescribir, leer: eso es la caja de los ajustes-- (D11).
- [x] 6.8 Permitir cuantas operaciones juzgue necesarias en un mismo turno, sin limitarle el numero ni decidirle como reparte las reglas entre vinetas: con una sola operacion por turno, pedir que se recuerde un funcionamiento entero devuelve un parrafo en lugar de reglas y D11 no se puede cumplir (D4).
- [x] 6.10 Detallar en el texto de sistema de la pasada que va en la memoria y que no, con ejemplos de cada clase de regla y una prueba para las dudosas: es lo que sustituye al limite mecanico que se quito en 6.8 (D4, D6).
- [x] 6.9 Dar sitio al razonamiento en el tope de escritura de `askAi`: un modelo que piensa lo gasta del mismo tope y devuelve una respuesta vacia, que se lee como "no hay nada que guardar" y deja la memoria sin escribir sin que nadie se entere. Registrar tambien la pasada que vuelve sin escribir nada.

## 7. Ajuste del modelo de la pasada

- [x] 7.1 Agregar el ajuste a la configuracion de IA: por defecto el modelo de la peticion, con la opcion de senalar otro (D7).
- [x] 7.2 Exponerlo en `web/src/routes/AiSettings.svelte` siguiendo el patron de los ajustes que ya existen ahi.

## 8. Verificacion

- [ ] 8.1 `bun run typecheck` en cero errores y cero avisos.
- [ ] 8.2 `bun run lint` limpio y `bun run format` sobre los archivos tocados.
- [ ] 8.3 Prueba manual del ciclo: pedir algo con una regla funcional, comprobar que aparece en `Memorias`; pedir un cambio de apariencia y comprobar que la memoria no cambia; empezar una conversacion nueva y comprobar que la IA sigue respetando la regla.
- [ ] 8.4 Prueba manual de la contradiccion: pedir algo que choque con una regla guardada y comprobar la pregunta, y los dos desenlaces.
- [ ] 8.5 Comprobar que borrar la pagina se lleva su memoria y que la aplicacion publicada no la expone.
- [ ] 8.6 Prueba manual de lo que se pide recordar: escribir "recuerda que ..." y comprobar que la IA lo confirma sin tocar la pagina y que la regla aparece en `Memorias`; pedirle que borre una regla y comprobar que remite a los ajustes sin cambiar nada (D11).
- [ ] 8.7 Prueba manual de varias reglas de golpe: pedir que se recuerde el funcionamiento de una pantalla ya construida y comprobar que en `Memorias` queda una vineta por regla, no un parrafo (D4).
