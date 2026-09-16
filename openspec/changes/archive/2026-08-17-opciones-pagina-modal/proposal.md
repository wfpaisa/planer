## Why

El menu de "Opciones" de una pagina en el builder usa un dropdown con acciones dispersas (cambiar nombre con `prompt()`, roles en un modal aparte, borrar con `confirm()`), y el icono no se puede cambiar. Un modal unico que reuna todas las opciones hace la edicion mas clara y consistente, y la invariante de "siempre una pagina de inicio" evita dejar una app publicada sin pagina inicial.

## What Changes

- Reemplazar el dropdown "Opciones" de las paginas por un modal unico con: nombre, icono, quien la ve (roles) y borrar.
- El icono pasa a ser editable desde el builder (grid de `ICON_NAMES`, sin selector de color).
- El guardado es con un boton "Guardar" que commitea nombre + icono + roles + inicio juntos.
- Reemplazar los `prompt()` y `confirm()` nativos por UI propia; el borrado usa un modal de confirmacion nuevo y compartido.
- Nueva invariante: siempre existe exactamente una pagina de inicio.
  - La pagina de inicio no se puede desmarcar.
  - Borrar la ultima pagina crea una nueva "Inicio" en blanco (icono Home, marcada como inicio, sin roles) en su lugar.
- El enforcement de la invariante es solo en el frontend (UI del builder).

## Capabilities

### New Capabilities

- `builder/pages`: Gestion de paginas en el builder: modal de opciones (nombre, icono, roles, inicio, borrar) y la invariante de que siempre existe una pagina de inicio.

### Modified Capabilities

<!-- Ninguna: no cambian requisitos de capabilities existentes (app-versions, block-checks). -->

## Impact

- `web/src/routes/AppEditor.tsx`: reemplaza el dropdown de paginas por el modal de opciones; elimina `prompt()`/`confirm()` de `rename`/`remove`; aplica la invariante de pagina de inicio.
- `web/src/components/ui.tsx`: agrega un componente `ConfirmDialog` compartido para el borrado (sin `confirm()` nativo).
- `web/src/lib/icons.tsx`: se reutiliza `ICON_NAMES` para el grid de iconos (sin cambios).
- No cambia el modelo de datos (`PageRecord` ya tiene `name`, `icon`, `roles`, `isHome`).
