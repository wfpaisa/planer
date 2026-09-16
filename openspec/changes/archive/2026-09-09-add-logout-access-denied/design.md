## Context

Ver `proposal.md` - Why. El cambio toca solo la vista publicada. `PublishedError` (`web/src/routes/Published.tsx:87`) recibe un `message` y decide icono/titulo/descripcion a partir de substrings. La sesion de miembro vive en el cliente `pbApp` (auth store `plane_member`); el patron de cierre de sesion ya existe en el footer de la vista (`pbApp.authStore.clear()` + `load()`), en `Published.tsx:64-78`. `PublishedError` se renderiza en `Published.tsx:50` cuando hay un error.

## Goals / Non-Goals

**Goals:**
- Ofrecer "Cerrar sesion" en la vista "No tienes acceso a esta aplicacion".
- Reusar el patron de logout de la sesion de miembro ya existente.

**Non-Goals:**
- No cambia autenticacion, autorizacion, API ni servidor.
- No toca otras pantallas de error ni el footer de la vista normal.
- No agrega flujo de "solicitar acceso" (solo se muestra el mensaje que ya existe).

## Decisions

- **Mostrar el boton solo cuando `noAccess`.** `PublishedError` ya tiene la variable `noAccess = message.includes("no tiene acceso")`. El boton se muestra bajo esa condicion; en los demas errores no hay sesion que cerrar (el usuario no llego a tener una sesion de miembro valida alcanzando ese estado). Alternativa considerada: mostrarlo siempre que `pbApp.authStore.isValid`; se descarto porque solo el caso de acceso garantiza sentido al cerrar sesion y evita distraccion en errores de publicacion/inexistencia.
- **Cerrar sesion con el mismo patron del footer.** Pasar un callback `onLogout` a `PublishedError` (o leer `pbApp` directamente) que ejecute `pbApp.authStore.clear()` y luego recargue la aplicacion (p. ej. `window.location.reload()` o `window.location.href = window.location.pathname`). El footer ya hace `clear()` + `load()`; para la pantalla de error conviene recargar la pagina entera para volver al estado de login limpio. Alternativa: re-montar via estado; se descarta por simplicidad y porque la recarga restablece la pantalla de login.
- **UI consistente con la vista de error.** Usar un segundo `Button variant="ghost"` (junto al existente "Recargar") con el icono `LogOut` ya importado (`lucide-react`), texto "Cerrar sesion", y estilo `text-soft`. Se conserva el estilo y la composicion actual de `PublishedError`.

## Risks / Trade-offs

- [Verificar que la vista de error siempre se alcanza con `error` seteado] → No aplica riesgo real: ya se renderiza con mensaje.
- [Cerrar sesion podria dejar al usuario con una pantalla vacia si no hay flujo de login visible] → Tras la recarga, `bundle.requiresAuth` vuelve a ser `true` si la app es privada, mostrando `MemberLogin`; si es una app publica con permiso, el usuario simplemente vuelve a ver el contenido al que aun tiene acceso, sin perjuicio.
- [Falsa confianza de que `noAccess` captura todos los casos de acceso] → La condicion usa el mismo substring que ya distingue el titulo "No tienes acceso a esta aplicacion"; si el mensaje cambia, se actualiza junto con el resto de la logica de `PublishedError`.

## Migration Plan

- Cambio puramente de interfaz; sin pasos de migracion ni rollback especial (revertir el commit de `Published.tsx` basta).

## Open Questions

- Ninguna.
