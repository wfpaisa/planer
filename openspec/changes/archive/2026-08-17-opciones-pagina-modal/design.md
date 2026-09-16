## Context

En `AppEditor.tsx` la lista de paginas usa un `Dropdown` (lineas 434-488) con cuatro acciones: cambiar nombre (via `prompt()` en `rename`, linea 371), quien la ve (abre un modal `RolePicker` aparte, lineas 493-509), usar como inicio (`setHome`, linea 378) y borrar (via `confirm()` en `remove`, linea 391). El icono nace como `FileText` en `create` y no se puede editar. No existe ningun componente de confirmacion propio: los 6 usos de `confirm()`/`prompt()` en el codigo son nativos.

El modelo `PageRecord` ya tiene `name`, `icon`, `roles` e `isHome`, asi que no hace falta cambiar el schema ni el backend: las paginas se editan directo contra PocketBase (`pb.collection("pages").update`).

## Goals / Non-Goals

**Goals:**
- Un unico modal de opciones por pagina con nombre, icono, roles, inicio y borrado.
- Guardado conjunto con un boton "Guardar".
- Borrado con un modal de confirmacion propio (sin `confirm()` nativo).
- Garantizar en la UI que siempre existe una pagina de inicio.

**Non-Goals:**
- No se cambia el modelo de datos ni el backend.
- No se aplica la invariante en el servidor (solo frontend; los caminos no-UI como el tool AI o `smoke.ts` quedan fuera de alcance).
- No se agrega selector de color al icono de pagina.

## Decisions

### Modal unico en lugar de dropdown + prompt + modal de roles
Se sustituye el `Dropdown` por un `IconButton` (⋯) que abre un modal. El modal mantiene un form local (`name`, `icon`, `roles`, `isHome`) inicializado desde `PageRecord`; el boton "Guardar" commitea los cuatro campos con un solo `pb.collection("pages").update`. Esto unifica la UX y elimina los `prompt()`/`confirm()` nativos del flujo.

- Alternativa descartada: seguir con dropdown pero agregar el icono. No resuelve la dispersion ni la UX inconsistente que motiva el cambio.

### Checkbox "Usar como inicio" con invariante
En lugar de la accion puntual "usar como inicio" (que hoy solo se muestra cuando la pagina NO es home), el modal usa un checkbox. Por la invariante de "siempre una pagina de inicio":
- En la pagina que es home el checkbox queda marcado y bloqueado (no se puede desmarcar).
- Marcar el checkbox en otra pagina la convierte en home al guardar (y limpia las demas, replicando el comportamiento de `setHome` que hace `isHome: p.id === page.id`).

### Borrar ultima pagina crea "Inicio"
En `remove()`, al confirmar el borrado: si `pages.length === 1`, primero se borra la pagina original y luego se crea la de reemplazo. El orden importa: crear antes de borrar colisiona con el indice unico `idx_pages_app_slug` cuando la pagina a borrar ya es la "Inicio" por defecto (slug `inicio`), devolviendo `validation_not_unique` (400). La pagina nueva replica el patron de `createApp` (`routes.ts:224`): `name: "Inicio"`, `icon: "Home"`, `isHome: true`, `roles: []`, `slug: "inicio"`, `blocks: []`. Luego `onChanged()` vuelve a cargar y se navega a la nueva pagina de inicio.

### Componente compartido `ConfirmDialog`
Se agrega un `ConfirmDialog` a `web/src/components/ui.tsx` (reutilizando el `Modal` existente): titulo, mensaje, y botones `Cancelar`/`Borrar` (danger). Esto sirve tanto al flujo nuevo como, a futuro, a los otros usos de `confirm()` (ColumnModal, Home, DatabaseEditor), que quedan fuera de alcance.

### Grid de iconos sin color
El selector de iconos copia el patron de `Settings.tsx:121` (grid de `ICON_NAMES`), pero sin la parte de colores.

## Risks / Trade-offs

- [La invariante solo en frontend] → Los caminos no-UI (tool AI, llamadas directas) pueden dejar una app sin pagina de inicio; la app publicada ya hace fallback a `pages[0]` (`Published.tsx:120`), asi que no rompe. Se documenta como limite asumido (decision 2 del usuario: opcion A).
- [Bloquear el checkbox de home puede confundir] → Se compensa con una hint visible en el modal explicando que siempre debe haber una pagina de inicio.
- [Crear antes de borrar cambia el `order`] → Se asigna `order: 0` y `isHome: true` a la pagina nueva; el resto de paginas mantiene su orden.

## Open Questions

- Ninguna. Las decisiones de UX (nombre "Inicio", enforcement solo frontend) quedaron resueltas con el usuario.
