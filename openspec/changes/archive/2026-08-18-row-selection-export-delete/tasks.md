## 1. Seleccion por casillas

- [x] 1.1 Agregar estado `selected: Set<string>` en `Grid` (excluyendo `NEW_ROW`) y limpiarlo en `load()` cuando cambian `page`, `search` o `sort`.
- [x] 1.2 Reemplazar la columna izquierda fija: checkbox por fila (reemplazando el boton de borrado) y checkbox de encabezado con estado `indeterminate` sincronizado via `ref` en un `useEffect`.
- [x] 1.3 Quitar el boton de borrado individual (`removeRow`) de la grilla y su uso en la columna izquierda.

## 2. Borrado masivo con confirmacion

- [x] 2.1 Agregar estado de dialogo (abierto + contando) y un boton **Borrar (N)** en la toolbar deshabilitado cuando la seleccion esta vacia.
- [x] 2.2 Crear el modal de confirmacion con el conteo de filas, que borra secuencialmente las seleccionadas, cuenta fallos y muestra el error (cantidad que no se pudo borrar).
- [x] 2.3 Despues de borrar: ajustar `page` si quedo vacia, limpiar la seleccion y llamar a `load()`.

## 3. Exportacion selectiva

- [x] 3.1 Refactorizar `exportTable` para recibir las filas exactas a exportar (cambiar `getFullList()` por la lista pasada).
- [x] 3.2 Agregar la seccion **Seleccionadas (N)** al menu Exportar (Descargar/Copiar CSV y JSON) solo cuando hay seleccion, reutilizando `rowsToCsv`/`rowsToJson`.

## 4. Tamano de pagina

- [x] 4.1 Agregar `pageSize?: number` opcional a `TableMeta` en `shared/types.ts`.
- [x] 4.2 Reemplazar `PAGE_SIZE` fijo por estado `pageSize` (default 50) y cargar con `getList(page, pageSize)`; soporte al centinela "Todas" usando `getFullList()`.
- [x] 4.3 Mostrar selector 25/50/100/500/Todas en el pie de la grilla, persistido con `patch` a `/api/tables/:id` en `meta.pageSize`, y mostrar la paginacion siempre que `pageSize` no sea "Todas".
- [x] 4.4 Recordar `pageSize` al volver a abrir la tabla (leer `table.meta.pageSize`).

## 5. Verificacion

- [x] 5.1 `bun run typecheck`.
- [x] 5.2 `bun run lint` sobre los archivos tocados.
- [x] 5.3 `bun run dev` + `bun run smoke` contra el servidor corriendo.