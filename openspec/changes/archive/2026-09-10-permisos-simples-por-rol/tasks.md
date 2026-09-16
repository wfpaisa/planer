## 1. Modelo compartido

- [x] 1.1 Mover `AccessOp` (las cinco órdenes) a `shared/types.ts` y eliminar `shared/access.ts` entero
- [x] 1.2 En `shared/types.ts`: quitar `PageAccess`, `TableRecord.ownerField` y `TableRecord.access`; ajustar `SnapshotPage` para que no guarde `access`
- [x] 1.3 Reescribir `canOpenPage` y `pageDenial` en `shared/pages.ts` contra `roles` (vacío = `Todos`) y la exigencia de sesión de la aplicación
- [x] 1.4 En `shared/people.ts`: quitar `LEVELS`, `levelLabel`, `levelValue` y la columna de sistema `nivel`; dejar `PEOPLE_SYSTEM_FIELDS` en dos
- [x] 1.5 Añadir a `shared/people.ts` la función que normaliza el nombre de un rol (minúsculas, sin tildes ni signos, espacios a guiones, guiones colapsados)
- [x] 1.6 En `shared/relations.ts`: quitar `ownerMustLink` y lo que dependa de la columna de dueño de fila

## 2. Servidor: retirar el reparto de filas

- [x] 2.1 En `server/access.ts`: quitar `effectiveAccess`, `allows`, `withScope`, `scopeFilter`, `rowInScope`, `notAllowed` y `asRole`; conservar `resolveViewer`, `peopleOf`, `personOf` y `setPersonAccess` sin el nivel
- [x] 2.2 En `server/pageData.ts`: quitar el filtrado de las cinco órdenes (alcance de lectura, alcance de escritura y el corte por peldaño), conservando manifiesto, relaciones y columnas de persona
- [x] 2.3 En `server/schema.ts`: quitar los parámetros que `accessRules` ya no usa, eliminar `legacyAccessRules` y ajustar `syncAppRules`
- [x] 2.4 En `server/routes.ts`: quitar de `pruneRoles` la limpieza de alcances de tabla y retirar las rutas del ajuste de quién ve qué
- [x] 2.5 En `server/bootstrap.ts`, `server/peopleTable.ts` y `server/dataImpact.ts`: dejar de tratar la columna de dueño de fila y el nivel de persona
- [x] 2.6 Comprobar que no queda ninguna lectura de `ownerField`, `TableRecord.access` ni del nivel en todo el repositorio

## 3. Servidor: guardar exige cuenta iniciada

- [x] 3.1 En `server/pageData.ts`: rechazar `crear`, `actualizar` y `borrar` cuando quien pregunta llega sin sesión, con un código de error propio distinguible
- [x] 3.2 En `server/htmlBridge.ts`: propagar ese código hasta el navegador sin perderlo
- [x] 3.3 En `web/src/components/HtmlFrame.svelte`: reconocer el código y mostrar el aviso de iniciar sesión para guardar
- [x] 3.4 Comprobar que la orden sigue rechazándose con un error que el HTML de la página puede capturar

## 4. Servidor y panel: ver como rol, persona o sin sesión

- [x] 4.1 Añadir a `server/access.ts` la función que compone quien mira a partir de rol, persona y la marca de sin sesión
- [x] 4.2 En `server/pageData.ts`: aceptar la persona y la marca de sin sesión junto al rol, sólo de quien es dueño de la aplicación
- [x] 4.3 En `web/src/routes/PageStage.svelte`: selector de rol sin la opción de mirar con los ojos propios, empezando en `admin`, más la opción de mirar sin sesión
- [x] 4.4 Añadir el segundo selector, con las personas que tienen el rol elegido, opcional y vacío por defecto
- [x] 4.5 Pasar la persona elegida por `PageView` y `HtmlFrame` hasta la petición de datos

## 5. Roles

- [x] 5.1 Aplicar la normalización en vivo en el campo de `web/src/components/RolesModal.svelte`, para que se vea el nombre tal como va a quedar
- [x] 5.2 Rechazar como repetido un rol que se normalice a uno que ya existe, explicándolo
- [x] 5.3 Usar la normalización en `sanitizeRoles` de `server/routes.ts` y en `server/peopleImport.ts`
- [x] 5.4 Añadir `admin` a los roles al crear una aplicación, e impedir quitarlo desde la pantalla de roles

## 6. Panel: pantallas

- [x] 6.1 Eliminar `web/src/components/AccessModal.svelte`
- [x] 6.2 Quitar de `web/src/components/DataGrid.svelte` la entrada "Quien ve cada fila" y el ajuste de la columna de dueño de fila
- [x] 6.3 Reescribir `web/src/components/PageAccessPicker.svelte` como lista de marcas: `Todos` más un renglón por rol, con la exclusión entre ambos
- [x] 6.4 Quitar la columna del nivel de la cuadrícula de personas y de su panel lateral
- [x] 6.5 Cambiar la etiqueta del ajuste de la aplicación a "pública" / "requiere iniciar sesión"
- [x] 6.6 Ajustar el sidebar para que liste las páginas con el modelo nuevo

## 7. Lo que lee la IA

- [x] 7.1 En `shared/htmlContract.ts`: quitar `reachSection` y `tableReach`
- [x] 7.2 Añadir al contrato que los roles sirven para ajustar la pantalla, que esconder por rol no protege, y qué roles define la aplicación y cuáles tiene marcados la página
- [x] 7.3 Añadir al contrato que guardar exige cuenta y que el aviso lo pone la plataforma, no la página
- [x] 7.4 En `server/aiPage.ts`: quitar el nivel de la herramienta `cambiar_acceso`
- [x] 7.5 Añadir la herramienta que cambia los roles que pueden abrir una página
- [x] 7.6 Hacer que la IA advierta al construir una página que guarda datos y puede abrirse sin cuenta, y al cambiar quién abre una página

## 8. Paso de lo viejo a lo nuevo

- [x] 8.1 En `server/bootstrap.ts`: normalizar los roles de cada aplicación, fundiendo los que colisionen, y reescribir las referencias en personas y páginas
- [x] 8.2 Añadir `admin` a las aplicaciones que ya existen
- [x] 8.3 Traducir el acceso de cada página: `anyone` y las que no lo tengan guardado a lista vacía; `signed` a todos los roles de la aplicación; `roles` conserva los suyos
- [x] 8.4 Detectar nombres de rol escritos dentro del HTML de una página que hayan cambiado al normalizar, y avisarlo a quien construye sin tocar el documento
- [x] 8.5 Comprobar que correr el arranque dos veces no cambia nada

## 9. Pruebas

- [x] 9.1 Reemplazar `scripts/smoke-permisos.ts` por uno que compruebe el modelo nuevo
- [x] 9.2 Cubrir: página abierta a `Todos` en aplicación pública, página con roles marcados, y aplicación que exige sesión
- [x] 9.3 Cubrir: leer sin sesión funciona, guardar sin sesión se rechaza y avisa, guardar con sesión funciona
- [x] 9.4 Cubrir: mirar como rol, mirar como persona concreta y mirar sin sesión
- [x] 9.5 Cubrir el paso de lo viejo a lo nuevo: que ninguna página quede abierta a más gente de la que la abría
- [x] 9.6 `bun run typecheck` y `bun run check` sin errores

## 10. Documentación

- [x] 10.1 Reescribir en `AGENTS.md` las secciones de acceso, roles y visibilidad, que describen el modelo viejo
- [x] 10.2 Actualizar el `## Purpose` de `openspec/specs/access-control/spec.md`, que describe el reparto de filas retirado
- [x] 10.3 Regenerar la documentación del contrato con `bun run docs`
