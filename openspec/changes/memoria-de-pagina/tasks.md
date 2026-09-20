## 1. Datos y tipos

- [ ] 1.1 Agregar el campo de la memoria a la coleccion `pages` en `server/bootstrap.ts`, junto a `doc`, `sources` y `roles`: texto, opcional, con `max` holgado y un comentario que diga que son las reglas funcionales de la pagina y que no viaja a la publicada (D2).
- [ ] 1.2 Agregar el campo correspondiente a `PageRecord` en `shared/types.ts`, opcional, con el comentario de que vacio significa que la pagina todavia no tiene reglas guardadas.
- [ ] 1.3 Comprobar que `AppBundle` y todo lo que se manda a una app publicada no arrastra el campo nuevo (`page-memory`: "La memoria es del constructor").

## 2. Servidor -- leer y guardar la memoria

- [ ] 2.1 En `server/routes.ts`, aceptar la memoria en la ruta que ya actualiza una pagina, con el mismo control de acceso que el resto de sus campos.
- [ ] 2.2 Normalizar lo que llega antes de guardar: texto plano, sin recorte por tamano (D6), conservando los saltos de linea que separan las vinetas.

## 3. Panel -- el item Memorias

- [ ] 3.1 Agregar el item `Memorias` a los ajustes de la pagina en `web/src/components/PagePanel.svelte`, junto a nombre, icono y quien la ve.
- [ ] 3.2 Pintar la memoria en una caja de texto editable, con el estado vacio resuelto como caja vacia y no como error (`page-memory`: "La memoria se lee y se edita desde los ajustes de la pagina").
- [ ] 3.3 Guardar lo editado contra la ruta de 2.1 y refrescar la pagina en memoria del panel.
- [ ] 3.4 Bloquear la caja mientras haya una peticion a la IA en marcha sobre esa pagina, diciendo por que, y desbloquearla al terminar con el texto ya actualizado (D8).

## 4. La memoria en el contexto de la IA

- [ ] 4.1 En `server/ai/aiPage/prompts.ts`, agregar la seccion de la memoria a `systemPrompt()`, despues de `## This page`, solo cuando la pagina tenga alguna regla guardada.
- [ ] 4.2 Redactar esa seccion de forma que la IA entienda que son reglas vigentes que debe respetar, no historial de lo que se pidio.
- [ ] 4.3 Comprobar que la memoria llega igual en una conversacion recien empezada y en una que ya paso del recorte de turnos (`page-memory`: "La memoria viaja en cada peticion a la IA").

## 5. Contradiccion y confirmacion

- [ ] 5.1 Agregar a la guia del `systemPrompt()` la regla de comparar el pedido con la memoria antes de construir y, ante una contradiccion, cerrar el turno con `preguntar` nombrando la regla guardada (D5).
- [ ] 5.2 Ampliar la descripcion de la herramienta `preguntar` en `server/ai/aiPage/tools.ts` para admitir este caso, que hoy queda excluido por la prohibicion de preguntar por decisiones de diseno.
- [ ] 5.3 Comprobar el camino completo con `choice`: confirmar implementa y actualiza la regla; no confirmar deja la pagina y la memoria como estaban.

## 6. La pasada de extraccion

- [ ] 6.1 Escribir el texto de sistema de la pasada, con las reglas de D6: solo lo que sobrevive a reconstruir la pagina desde cero, una regla por vineta, en presente y en una linea, reemplazar antes que agregar algo parecido, y `sin cambios` ante la duda.
- [ ] 6.2 Definir la forma de la respuesta: `sin cambios`, o una operacion `agregar` / `reemplazar` / `borrar` que nombra la vineta por su texto exacto (D4).
- [ ] 6.3 Implementar la aplicacion de esa operacion sobre el texto guardado: si el texto nombrado ya no aparece, se descarta la operacion y la memoria queda como estaba (D4).
- [ ] 6.4 Ejecutar la pasada al cerrar el turno en `server/ai/aiPage/index.ts`, despues de entregar la respuesta, pasandole el intercambio completo --pedido, pregunta y respuesta si las hubo, y lo que la IA hizo-- y la memoria actual (D3, D5).
- [ ] 6.5 Tratar el fallo de la pasada como no fatal: se registra, la memoria queda como estaba y el turno termina igual (`page-memory`: "La pasada falla").

## 7. Ajuste del modelo de la pasada

- [ ] 7.1 Agregar el ajuste a la configuracion de IA: por defecto el modelo de la peticion, con la opcion de senalar otro (D7).
- [ ] 7.2 Exponerlo en `web/src/routes/AiSettings.svelte` siguiendo el patron de los ajustes que ya existen ahi.

## 8. Verificacion

- [ ] 8.1 `bun run typecheck` en cero errores y cero avisos.
- [ ] 8.2 `bun run lint` limpio y `bun run format` sobre los archivos tocados.
- [ ] 8.3 Prueba manual del ciclo: pedir algo con una regla funcional, comprobar que aparece en `Memorias`; pedir un cambio de apariencia y comprobar que la memoria no cambia; empezar una conversacion nueva y comprobar que la IA sigue respetando la regla.
- [ ] 8.4 Prueba manual de la contradiccion: pedir algo que choque con una regla guardada y comprobar la pregunta, y los dos desenlaces.
- [ ] 8.5 Comprobar que borrar la pagina se lleva su memoria y que la aplicacion publicada no la expone.
