## Why

Cuando un invitado (member) con una sesion previa en el cliente `pbApp` abre una aplicacion publicada a la que ya no tiene permiso, la vista publicada muestra el mensaje "No tienes acceso a esta aplicacion" pero no ofrece forma de salir: la sesion queda guardada en el localStorage. La unica salida es recargar o borrar datos manualmente, lo cual confunde al usuario que quiere entrar con otra cuenta.

## What Changes

- Agregar un boton "Cerrar sesion" en la vista de error de la aplicacion publicada cuando el motivo es falta de acceso (`PublishedError` en `noAccess`).
- El boton limpia la sesion de miembro (`pbApp.authStore.clear()`) y recarga la aplicacion para que el usuario pueda volver a iniciar sesion con otra cuenta.
- El boton solo se muestra en el caso de "no tiene acceso", no en los otros errores (no publicada, no existe, generico), porque en esos casos no hay una sesion que cerrar.
- Sin cambios de servidor, de datos ni de API: es un ajuste de la vista publicada.

## Capabilities

### New Capabilities
- `published/member-session`: Gestion de la sesion del miembro desde la vista de la aplicacion publicada, incluida la posibilidad de cerrar la sesion cuando una sesion previa ya no tiene acceso a la aplicacion.

### Modified Capabilities
<!-- Ninguna: no cambia ningun requisito de los spec actuales (builder, block-checks, app-versions). Es comportamiento nuevo de la vista publicada. -->

## Impact

- `web/src/routes/Published.tsx`: componente `PublishedError` (escritura de codigo).
- Ningun cambio de API, base de datos, esquema o proceso de servidor.
- Reutiliza el patron de cierre de sesion ya existente (`pbApp.authStore.clear()` usado en el footer de la vista).
