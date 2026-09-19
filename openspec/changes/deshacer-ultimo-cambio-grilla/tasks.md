## 1. Recoger los identificadores de las filas creadas

- [ ] 1.1 En `web/src/lib/importSave.ts`, añadir a las opciones de `writeBatches` un recolector opcional de creados (`created?: Map<number, string>`), llenado en el sitio como ya se hace con `leftover`. Sin cambiar la forma del retorno.
- [ ] 1.2 Leer el cuerpo de cada respuesta del lote cuando el pedido fue un POST y guardar `row → id` en ese mapa. Los errores se siguen contando igual.
- [ ] 1.3 Comprobar que la importación (`ImportModal.svelte`) no pasa la opción y sigue compilando y funcionando sin cambios.

## 2. El registro de lo que se puede deshacer

- [ ] 2.1 Crear `web/src/lib/dataGridUndo.ts` con el tipo de lo recordado: la tabla a la que pertenece, los cuerpos a reponer por identificador de fila, los identificadores de las filas a borrar y las columnas que existían cuando se guardó.
- [ ] 2.2 Escribir la cabecera del archivo explicando por qué se guarda el cuerpo crudo y no el texto de la celda, y por qué se identifica por fila y no por posición.
- [ ] 2.3 Añadir en ese archivo la función que aplica lo recordado: manda los PATCH por `writeBatches`, borra las filas nacidas por `POST /api/tables/:id/filas/borrar` y devuelve un `RangeReport` con lo que entró y lo que no.

## 3. Producir el inverso en las escrituras

- [ ] 3.1 En `clearRange`, armar el inverso junto a cada pedido: por cada fila, las claves del cuerpo tomadas de la fila previa en memoria. Devolverlo junto al parte.
- [ ] 3.2 Hacer lo mismo en `pasteRange`, y añadir al inverso los identificadores que devuelva el recolector de creados para las filas nacidas.
- [ ] 3.3 Hacer lo mismo en `writeCell`, sobre las claves que realmente viajan tras `resolveRowValues`.
- [ ] 3.4 No producir inverso cuando la columna es de las que se escriben por la API de miembros (`isOverlayField`): ahí `writeCell` no pasa por la colección.
- [ ] 3.5 Comprobar con una columna de relación que el inverso lleva los dos campos que escribe `relationCellValues`, y con una de fecha que lleva el valor guardado y no el que se ve.

## 4. La cuadrícula

- [ ] 4.1 En `DataGrid.svelte`, guardar lo recordado en un estado nuevo, asignado **después** del `load()` que hacen `runPaste` y `clearCells`, y tras guardar una celda.
- [ ] 4.2 Descartarlo al cambiar de tabla, de página, de tamaño de página, de filtro, de búsqueda y de orden; al importar; al borrar filas seleccionadas; y cuando cambian las columnas de la tabla.
- [ ] 4.3 Añadir la función que deshace: llama a la de `dataGridUndo.ts`, muestra el parte en `editNote`, recarga con `load()` y deja lo recordado vacío. Mientras corre, marcar `writing` como cualquier otra escritura.
- [ ] 4.4 Añadir `Ctrl+Z` / `Cmd+Z` en `gridKeys`, después del atajo de seleccionar todo. No hace nada si no hay nada recordado; no se atiende con una celda abierta (ya hay salida temprana por `editing`).
- [ ] 4.5 Añadir el botón **Deshacer** dentro del aviso de `editNote`, pasándolo como contenido a `SuccessNote` y `WarnNote`.
- [ ] 4.6 Redactar los textos en español con tildes y ñ: el botón, y el parte de deshacer contando celdas repuestas, filas borradas y filas que no entraron.

## 5. Comprobación

- [ ] 5.1 `bun run typecheck` y `bun run check` sin errores.
- [ ] 5.2 En el panel: pegar un rango sobre filas existentes, deshacer y verificar que cada celda vuelve a su valor, incluidas una de relación y una de fecha.
- [ ] 5.3 Pegar creando filas, deshacer y verificar que las filas nacidas desaparecen y las demás vuelven.
- [ ] 5.4 Vaciar un rango con Delete y deshacer; escribir una celda y deshacer con `Ctrl+Z`.
- [ ] 5.5 Verificar que deshacer dos veces seguidas no hace nada la segunda, y que cambiar de página, de orden o de tabla quita la opción.
- [ ] 5.6 Verificar que con una celda abierta `Ctrl+Z` deshace lo tecleado y no la última escritura guardada.
- [ ] 5.7 Verificar en la tabla de personas que cambiar el correo o los roles desde su celda no ofrece deshacer, y que una columna propia de esa tabla sí.
- [ ] 5.8 Hacer una importación para confirmar que el cambio en `writeBatches` no la afectó.
