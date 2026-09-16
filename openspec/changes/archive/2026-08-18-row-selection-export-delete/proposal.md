## Why

La grilla del editor de tablas solo permite borrar fila por fila con un icono que aparece al pasar el mouse, sin confirmacion, y exportar siempre la tabla completa. Con tablas grandes es tedioso (o riesgoso) borrar en lote o compartir solo un subconjunto de filas.

## What Changes

- Una casilla de seleccion por fila en la columna izquierda fija de la grilla, que **reemplaza** al boton de borrado individual.
- Una casilla en el encabezado que marca/desmarca **todas las visibles** (pagina actual + filtro activo), con estado indeterminado cuando hay mezcla.
- Un boton **Borrar (N)** en la barra de herramientas, activo solo con seleccion, que abre un dialogo de confirmacion con el conteo antes de borrar.
- El menu **Exportar** gana una seccion **Seleccionadas (N)** (descargar/copiar CSV y JSON) cuando hay filas marcadas; el resto de las opciones siguen exportando la tabla completa.
- Un selector de **filas por pagina** en el pie de la grilla con opciones 25 / 50 / 100 / 500 / Todas, recordado por tabla en `table.meta.pageSize`.
- La fila nueva sin guardar no participa de la seleccion.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `builder/tables`: la seleccion por fila cambia el borrado individual de la grilla, agrega borrado masivo con confirmacion, permite exportar solo las filas marcadas (modifica la regla "Exportar datos de una tabla") y agrega un selector de filas por pagina.

## Impact

- `web/src/routes/DatabaseEditor.tsx`: columna de seleccion en `Grid`, estado de seleccion, borrado masivo con dialogo, seccion de exportacion selectiva y selector de pagina.
- `shared/types.ts`: `TableMeta.pageSize` (nuevo campo opcional).
- No hay cambios de API ni de servidor: el borrado y la exportacion siguen yendo directo a PocketBase desde el cliente.