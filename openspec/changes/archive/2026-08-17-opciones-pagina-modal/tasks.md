## 1. Componente de confirmacion compartido

- [x] 1.1 Agregar un componente `ConfirmDialog` en `web/src/components/ui.tsx` (basado en el `Modal` existente) con titulo, mensaje y botones `Cancelar` / accion danger.

## 2. Modal de opciones de pagina

- [x] 2.1 Reemplazar el `Dropdown` de "Opciones" en `PageSidebar` (`AppEditor.tsx`) por un `IconButton` que abre un modal de opciones.
- [x] 2.2 Agregar estado local de edicion en el modal: nombre, icono, roles y inicio, inicializados desde la `PageRecord`.
- [x] 2.3 Agregar campo de nombre (reemplaza el `prompt()` de `rename`).
- [x] 2.4 Agregar selector de icono con el grid de `ICON_NAMES` (patron de `Settings.tsx`, sin color).
- [x] 2.5 Mover el `RolePicker` ("Quien la ve") dentro del modal.
- [x] 2.6 Agregar el checkbox "Usar como inicio" con la invariante: bloqueado y marcado en la pagina home; marcar otra pagina la convierte en home al guardar.
- [x] 2.7 Agregar el boton "Guardar" que commitea nombre + icono + roles + inicio con un solo `update()`.
- [x] 2.8 Reemplazar el `confirm()` de `remove` por el `ConfirmDialog` propio.
- [x] 2.9 Aplicar la invariante al borrar la ultima pagina: crear una nueva "Inicio" en blanco (icono Home, isHome, sin roles) en su lugar (borrar primero y luego crear, para no chocar con el indice unico de slug), y navegar a ella.

## 3. Limpieza y verificacion

- [x] 3.1 Eliminar el modal de roles aparte y las funciones/handlers obsoletos del flujo anterior.
- [x] 3.2 Quitar imports sin uso (`Dropdown`, `MenuItem`, `Pencil`, etc. segun corresponda).
- [x] 3.3 `bun run typecheck` sin errores.
- [x] 3.4 `bun run format` y `bun run lint` solo sobre los archivos tocados.
