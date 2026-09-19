## Context

Ver `proposal.md` — Why.

Lo que condiciona el diseño, tal como está hoy el código:

- Las tres escrituras que se hacen desde la cuadrícula pasan por `web/src/lib/dataGridEdit.ts`: `writeCell` (un PATCH suelto), `clearRange` y `pasteRange` (un lote de PATCH, y de POST cuando se piden filas nuevas).
- Las dos de bloque terminan en `writeBatches` (`web/src/lib/importSave.ts`), que hoy lee de cada respuesta solo el estado y descarta el cuerpo.
- Una columna de relación no se guarda en un campo: `relationCellValues` escribe dos —el enlace y el valor que queda a la vista cuando no encontró dueño—.
- Tras escribir en bloque, `DataGrid.svelte` vuelve a leer la tabla (`load()`): lo guardado no es lo que se pegó.
- La selección de celdas es por coordenadas a propósito y se suelta al reordenar (ver la cabecera de `gridSelection.svelte.ts`).

## Goals / Non-Goals

**Goals:**

- Que el inverso de una escritura se calcule sin pedirle nada al servidor.
- Que el inverso sea exacto en columnas de relación y en fechas, no una reconstrucción a partir del texto visible.
- Que el mecanismo quepa en la fase 2 (pila de varios niveles) sin rehacer el diseño.

**Non-Goals:**

- Persistir lo recordado entre recargas de la pantalla.
- Reconciliar con lo que otra persona haya escrito mientras tanto.
- Cubrir el borrado de filas, la importación o los cambios de estructura (ver el spec).

## Decisions

### El inverso se arma donde se arma el cuerpo del PATCH

`writeCell`, `clearRange` y `pasteRange` devuelven, junto al parte, el inverso ya listo: por cada fila tocada, su identificador y un cuerpo con **las mismas claves** que se iban a escribir, tomadas de la fila tal como estaba en memoria antes de mandarlo.

Que sea `Object.keys(body)` y no la columna es lo que hace correctas las relaciones: la columna toca dos campos y solo el cuerpo sabe cuáles. Tomarlo de la fila en memoria y no del texto de la celda es lo que hace correcta una fecha: la celda enseña "12 sept 2025" y el campo guarda otra cosa.

Alternativas descartadas:

- Releer las filas antes de escribir: una consulta de más por cada pegado, para un dato que ya está en pantalla.
- Comparar la fila recargada con la anterior: no distingue lo que cambió la escritura de lo que cambió otra persona.

### Los identificadores de las filas nacidas salen de la respuesta del lote

`writeBatches` gana una opción para recoger el identificador de cada registro creado, llenada en el sitio como ya hace `leftover`. Es aditiva: la importación, que es el otro llamador, no la pasa y no cambia.

Alternativa descartada: releer la tabla después de pegar y restar los identificadores que no estaban. Se rompe con la paginación y con cualquiera que esté escribiendo a la vez.

### Las filas nacidas se borran por el servidor

Deshacer un pegado que creó filas usa `POST /api/tables/:id/filas/borrar`, la misma puerta que el botón Borrar. Es donde vive la conducta declarada por cada columna; un DELETE directo a la colección la saltaría.

### Deshacer es una escritura hacia adelante

No hay transacción inversa ni versión anterior de la fila: se escribe otra vez el valor que había. Por eso importa más la invalidación que la comprobación: lo recordado se descarta en cuanto la cuadrícula hace cualquier otra cosa, y la ventana en la que se puede pisar a alguien es la de un clic.

### Lo recordado identifica filas por identificador, nunca por posición

Es lo contrario de la selección, que es posicional a propósito. Una vuelta atrás posicional escribiría sobre otras filas en cuanto se ordena o se filtra. Como además esos gestos descartan lo recordado, el identificador es la segunda barrera, no la única.

### La invalidación va en los manejadores, no dentro de `load()`

La propia escritura recarga la cuadrícula al terminar. Si `load()` descartara lo recordado, un pegado se olvidaría a sí mismo. Se descarta en los sitios que lo merecen —cambio de tabla, de página, filtro, búsqueda, orden, columnas, importación, borrado— y se guarda **después** de que el pegado haya recargado.

### El inverso vive en un archivo aparte

`web/src/lib/dataGridUndo.ts`: el tipo de lo recordado y la función que lo aplica. `dataGridEdit.ts` solo lo produce. Así la fase 2 cambia una variable por una pila en un sitio, sin tocar las escrituras.

### Dónde se ofrece

Botón **Deshacer** en la barra de herramientas de la tabla —a la derecha de Roles, o de Refrescar cuando la tabla no es la de personas— y `Ctrl+Z` / `Cmd+Z` en la cuadrícula. Icono y etiqueta, con la etiqueta escondiéndose cuando la barra aprieta, igual que sus vecinos.

Va en la barra y no dentro del aviso: el aviso se va solo a los pocos segundos y con él se iría la única forma visible de deshacer, justo cuando alguien está mirando lo que acaba de pasar y decidiendo. La barra está siempre en el mismo sitio.

Se muestra solo cuando hay algo que deshacer. Es la única acción de la barra que existe por algo que se acaba de hacer, y verla aparecer es parte de decir que se puede deshacer; un botón apagado de forma permanente es ruido en una barra donde todo lo demás siempre sirve.

## Risks / Trade-offs

- **Otra persona escribió la misma celda entre la escritura y el deshacer** → se pisa su valor. Mitigación: ventana de segundos e invalidación amplia. Queda declarado como límite conocido en el spec.
- **Una fila nacida al pegar ya recibió referencias de otras filas** → borrarla aplica la cascada declarada. Mitigación: ninguna; es la conducta que la aplicación ya promete para cualquier borrado, y el parte cuenta lo que pasó.
- **Deshacer un pegado grande es otro lote del mismo tamaño** → mismo límite de tasa que la escritura original. Ya está resuelto: `writeBatches` reintenta el tramo que se pasó de rápido.
- **`writeBatches` es compartido con la importación** → un cambio mal hecho ahí rompe la importación, que es el camino más usado. Mitigación: la opción es opcional y la importación no la pasa; el retorno actual no cambia de forma.
- **Una columna obligatoria** → no aparece en el inverso de un vaciado (se salta al vaciar) y en un pegado sobre fila existente solo entra si se escribió de verdad. No hay caso en que deshacer deje vacía una columna obligatoria.
