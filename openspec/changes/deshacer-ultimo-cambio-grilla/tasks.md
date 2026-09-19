## 1. Recoger los identificadores de las filas creadas

- [x] 1.1 En `web/src/lib/importSave.ts`, añadir a las opciones de `writeBatches` un recolector opcional de creados (`created?: Map<number, string>`), llenado en el sitio como ya se hace con `leftover`. Sin cambiar la forma del retorno.
- [x] 1.2 Leer el cuerpo de cada respuesta del lote cuando el pedido fue un POST y guardar `row → id` en ese mapa. Los errores se siguen contando igual.
- [x] 1.3 Comprobar que la importación (`ImportModal.svelte`) no pasa la opción y sigue compilando y funcionando sin cambios.

## 2. El registro de lo que se puede deshacer

- [x] 2.1 Crear `web/src/lib/dataGridUndo.ts` con el tipo de lo recordado: la tabla a la que pertenece, los cuerpos a reponer por identificador de fila, los identificadores de las filas a borrar y las columnas que existían cuando se guardó.
- [x] 2.2 Escribir la cabecera del archivo explicando por qué se guarda el cuerpo crudo y no el texto de la celda, y por qué se identifica por fila y no por posición.
- [x] 2.3 Añadir en ese archivo la función que aplica lo recordado: manda los PATCH por `writeBatches`, borra las filas nacidas por `POST /api/tables/:id/filas/borrar` y devuelve un `RangeReport` con lo que entró y lo que no.

## 3. Producir el inverso en las escrituras

- [x] 3.1 En `clearRange`, armar el inverso junto a cada pedido: por cada fila, las claves del cuerpo tomadas de la fila previa en memoria. Devolverlo junto al parte.
- [x] 3.2 Hacer lo mismo en `pasteRange`, y añadir al inverso los identificadores que devuelva el recolector de creados para las filas nacidas.
- [x] 3.3 Hacer lo mismo en `writeCell`, sobre las claves que realmente viajan tras `resolveRowValues`.
- [x] 3.4 No producir inverso cuando la columna es de las que se escriben por la API de miembros (`isOverlayField`): ahí `writeCell` no pasa por la colección.
- [x] 3.5 Comprobar con una columna de relación que el inverso lleva los dos campos que escribe `relationCellValues`, y con una de fecha que lleva el valor guardado y no el que se ve.

## 4. La cuadrícula

- [x] 4.1 En `DataGrid.svelte`, guardar lo recordado en un estado nuevo, asignado **después** del `load()` que hacen `runPaste` y `clearCells`, y tras guardar una celda.
- [x] 4.2 Descartarlo al cambiar de tabla, de página, de tamaño de página, de filtro, de búsqueda y de orden; al importar; al borrar filas seleccionadas; y cuando cambian las columnas de la tabla.
- [x] 4.3 Añadir la función que deshace: llama a la de `dataGridUndo.ts`, muestra el parte en `editNote`, recarga con `load()` y deja lo recordado vacío. Mientras corre, marcar `writing` como cualquier otra escritura.
- [x] 4.4 Añadir `Ctrl+Z` / `Cmd+Z` en `gridKeys`, después del atajo de seleccionar todo. No hace nada si no hay nada recordado; no se atiende con una celda abierta (ya hay salida temprana por `editing`).
- [x] 4.5 Añadir el botón **Deshacer** en la barra de herramientas, a la derecha de Roles (o de Refrescar donde no hay roles), con icono `undo-02` y etiqueta: se muestra solo cuando hay algo que deshacer, y deshabilitado mientras se escribe.
- [x] 4.6 Redactar los textos en español con tildes y ñ: el botón, y el parte de deshacer contando celdas repuestas, filas borradas y filas que no entraron.

- [x] 4.7 Subir el tamaño de letra de los avisos a `--text-base` (`Toast.svelte`). Se pidió durante la implementación y afecta a todos los avisos del panel, no solo a los de la cuadrícula.

## 5. Comprobación

- [x] 5.1 `bun run typecheck` y `bun run check` sin errores.
- [ ] 5.2 En el panel: pegar un rango sobre filas existentes, deshacer y verificar que cada celda vuelve a su valor, incluidas una de relación y una de fecha.
- [ ] 5.3 Pegar creando filas, deshacer y verificar que las filas nacidas desaparecen y las demás vuelven.
- [ ] 5.4 Vaciar un rango con Delete y deshacer; escribir una celda y deshacer con `Ctrl+Z`.
- [ ] 5.5 Verificar que deshacer dos veces seguidas no hace nada la segunda, y que cambiar de página, de orden o de tabla quita el botón.
- [ ] 5.6 Verificar que con una celda abierta `Ctrl+Z` deshace lo tecleado y no la última escritura guardada.
- [ ] 5.7 Verificar en la tabla de personas que cambiar el correo o los roles desde su celda no ofrece deshacer, y que una columna propia de esa tabla sí.
- [ ] 5.8 Hacer una importación para confirmar que el cambio en `writeBatches` no la afectó.
