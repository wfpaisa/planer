## Context

El editor de tablas (`DatabaseEditor.tsx`) carga filas con `pb.collection(...).getList(page, PAGE_SIZE)` con `PAGE_SIZE = 50` fijo. La columna izquierda fija de la grilla hoy aloja un boton de borrado por fila (visible al pasar el mouse, sin confirmacion). La exportacion corre `getFullList()` y pasa todas las filas a `rowsToCsv`/`rowsToJson`. Borrar y exportar van directos a PocketBase desde el cliente; no hay intermediarios de servidor. Ver `proposal.md` para el motivo.

## Goals / Non-Goals

**Goals:**
- Seleccion por casillas en la grilla, con "todos los visibles" en el encabezado.
- Borrado masivo con confirmacion y manejo del paginado despues de borrar.
- Exportacion de solo las filas marcadas.
- Tamano de pagina configurable y recordado por tabla.

**Non-Goals:**
- Seleccion que sobreviva a cambios de pagina/filtro (el usuario pidio solo las visibles).
- Borrado/exportacion en el servidor ni via `/api`: siguen yendo directo a PocketBase.
- Cascada de borrado en relaciones o validacion de integridad referencial.

## Decisions

**Seleccion como `Set<string>` dentro del `Grid`.**
Un `useState<Set<string>>` de ids de fila visible. La fila nueva (`NEW_ROW`) nunca entra. El "todos" del encabezado marca todas las filas de `rows` (los visibles de la pagina + filtro ya cargados), no `total`. Se limpia en `load()` cuando cambian `page`, `search` o `sort`, salvo el caso "recargar despues de borrar" donde se recalcula sobre lo que queda (ver borrado).

**Estado indeterminado con `indeterminate` nativo.**
La checkbox del encabezado usa la propiedad `indeterminate` de la checkbox nativa via `ref`, cuando `selected.size > 0 && selected.size < rows.length`. Se necesita sincronizar en un `useEffect` porque `indeterminate` no es atributo JSX de React.

**Borrado masivo secuencial en el cliente.**
Se borra fila a fila con `delete` de PocketBase y se cuenta fallos; si algunos fallan, el error reporta cuantas quedaron. Tras borrar se pide `total` para ajustar `page` si la pagina quedo vacia (`setPage(max(1, page - 1))`) y se llama a `load()`. Se usa un modal propio (`Modal` de `ui.tsx`) con el conteo, en lugar del `confirm()` nativo, para que el conteo y los errores se vean bien y se pueda deshabilitar el boton mientras se borra.

**Exportacion selectiva reutilizando el codigo existente.**
`exportTable` recibe las filas a exportar; si hay seleccion el menu muestra la seccion "Seleccionadas (N)" que llama a la misma funcion con `rows.filter((r) => selected.has(r.id))`. No se re-fetchanea nada: se exporta lo que ya esta cargado. Las opciones "Exportar todo" conservan `getFullGrid()`.

**Selector de pagina persistido en `TableMeta.pageSize`.**
Se agrega `pageSize?: number` a `TableMeta` (nuevo, opcional: no rompe nada previo). El pie de la grilla muestra un `<select>` con 25/50/100/500/Todas. "Todas" usa un centinela (`"all"`) que hace `getFullGrid()`. Se persiste con `patch` a `/api/tables/:id` (`meta: { ...table.meta, pageSize }`), igual que `hidden`/`systemVisible`. La barra de paginacion deja de condicionarse a `total > 50` y se muestra siempre salvo con `pageSize` "all".

## Risks / Trade-offs

- [Borrado masivo lento con muchas filas] → Es un borrado por request; aceptable para tablas pequenas/medianas (filosofia self-hosted). No se agrega lote en el servidor por ahora.
- [`indeterminate` fuera de React] → Sincronizar con `useEffect` tras setear la checkbox; es el patron estandar de React 19.
- [`pageSize` compartido entre usuarios de la misma tabla] → Es meta de tabla, igual que `hidden`; se acepta por consistencia con el resto de presentacion.
- [La fila nueva y las filas borradas pueden quedar como ids huerfanas en `selected`] → Se limpian tras borrar y al recargar; al ser un `Set` y reasignado, los calculos de conteo siempre miran `rows` actuales.
- [Todas + tabla gigante] → `getFullGrid` con miles de filas puede tardar; es una eleccion explicita del usuario con el selector, mitigada por el filtro de busqueda.