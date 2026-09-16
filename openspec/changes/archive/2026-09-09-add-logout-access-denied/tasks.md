## 1. Implementacion del boton de cierre de sesion

- [x] 1.1 En `web/src/routes/Published.tsx`, permitir que `PublishedError` reciba un callback opcional `onLogout` (o lea `pbApp` directamente) para cerrar la sesion de miembro
- [x] 1.2 En `PublishedError`, mostrar un boton "Cerrar sesion" (con icono `LogOut` de lucide-react) solo cuando `noAccess` es verdadero, junto al boton "Recargar" existente
- [x] 1.3 Hacer que el boton ejecute `pbApp.authStore.clear()` y luego recargue la aplicacion (p. ej. `window.location.reload()`) para volver a la pantalla de inicio de sesion
- [x] 1.4 Pasar el callback/logica de logout al render de `PublishedError` en el flujo de error de `Published`

## 2. Verificacion

- [x] 2.1 Ejecutar `bun run typecheck` y confirmar que compila sin errores
- [x] 2.2 Ejecutar `bun run lint` (o `bun run check`) sobre los archivos tocados y confirmar que Biome queda limpio
- [x] 2.3 Verificar de forma manual (con un miembro sin acceso a una aplicacion publicada) que aparece "Cerrar sesion", que al pulsarlo la sesion se limpia y que la vista vuelve a la pantalla de login
