## 1. Tipos y almacenamiento

- [x] 1.1 Agregar a `shared/types.ts` los tipos `DesignSnapshot`, `SnapshotPage`, `SnapshotTable`, `AppVersion`, `AppVersionSummary`, `AppNotice`, `BlockIssue`, `AppReview`, `VersionsView`; sumar `liveVersion` y `notices` a `AppRecord`
- [x] 1.2 Agregar `versions: "app_versions"` a `INTERNAL` en `server/config.ts`
- [x] 1.3 Crear la coleccion `app_versions` en `server/bootstrap.ts` (app, number, label, kind, hash, snapshot, author, pinned, timestamps, indice por app+number, reglas solo-servidor) y sumar `liveVersion` y `notices` a `apps`

## 2. Revision de bloques (servidor)

- [x] 2.1 Crear `server/review.ts` con `reviewDesign(pages, tables)` que detecte tabla inexistente (`broken`), columna inexistente en listados, fichas, formularios y tarjetas (`warning`), indicador con tabla o columna invalida y columna de orden inexistente
- [x] 2.2 Agregar en `server/review.ts` `renameInBlocks(blocks, tableId, renames)` que reescriba `fields`, `sort`, los campos de tarjeta y los indicadores
- [x] 2.3 Agregar en `server/review.ts` `pushNotices(app, notices)` con tope de 50

## 3. Versiones (servidor)

- [x] 3.1 Crear `server/versions.ts` con `buildSnapshot(app, pages, tables)` y `hashSnapshot(snapshot)` (serializacion estable + SHA-256)
- [x] 3.2 Agregar `bundleFromSnapshot(snapshot, tables, roles)` que combine la fotografia con las tablas vivas y filtre por roles
- [x] 3.3 Agregar `saveVersion(app, kind, label, authorId)` con deteccion de duplicado por huella y `pruneVersions(appId)` con tope de 30
- [x] 3.4 Agregar `restoreSnapshot(app, snapshot)` que escriba paginas, tema, roles, marca y presentacion de tablas sin tocar `fields`, tipos ni filas

## 4. API

- [x] 4.1 `GET /api/apps/:id/versiones` — lista sin fotografia, con estado del borrador (huella y si hay cambios sin publicar)
- [x] 4.2 `POST /api/apps/:id/publicar` — crea la version, la marca en vivo, publica y devuelve la revision
- [x] 4.3 `POST /api/apps/:id/versiones` — punto de guardado manual con nombre
- [x] 4.4 `PATCH /api/apps/:id/versiones/:vid` — nombre y fijada
- [x] 4.5 `DELETE /api/apps/:id/versiones/:vid` — rechaza la version en vivo
- [x] 4.6 `POST /api/apps/:id/versiones/:vid/restaurar` — restaura al borrador y devuelve la revision
- [x] 4.7 `GET /api/apps/:id/vista/:source` — bundle del borrador o de una version, solo para el dueno
- [x] 4.8 `GET /api/apps/:id/revision` — revision del borrador mas los avisos guardados; `DELETE /api/apps/:id/avisos` para descartarlos
- [x] 4.9 Cambiar `publicBundle` para servir la version en vivo, con caida al estado vivo cuando no hay ninguna
- [x] 4.10 Cambiar `updateApp` para crear la version inicial cuando se marca `published: true` sin historial
- [x] 4.11 Cambiar `updateTable` para detectar renombrados por id, corregir los bloques y guardar los avisos informativos
- [x] 4.12 Registrar todas las rutas nuevas en `server/index.ts`

## 5. Renderizado de bloques

- [x] 5.1 Agregar `showIssues` a `RuntimeProvider` en `web/src/blocks/render.tsx`
- [x] 5.2 Distinguir en `MissingTable` entre "sin tabla elegida" y "la tabla ya no existe", y no dibujar nada en la vista publicada
- [x] 5.3 Que `pick()` devuelva huecos marcados para las columnas que faltan, visibles solo con `showIssues`
- [x] 5.4 Marcar los indicadores y los campos de tarjeta que apuntan a columnas inexistentes

## 6. Panel

- [x] 6.1 Crear `web/src/components/HistoryPanel.tsx`: lista de versiones, marca de la que esta en vivo, previsualizar, restaurar, nombrar, fijar, eliminar y punto de guardado manual
- [x] 6.2 Crear `web/src/components/ReviewPanel.tsx`: avisos agrupados por pantalla, avisos informativos descartables y acceso directo al bloque
- [x] 6.3 Cambiar `PublishMenu.tsx`: publicar llama al endpoint nuevo, muestra si hay cambios sin publicar y abre historial y revision
- [x] 6.4 Separar `Published.tsx` en `AppView` presentacional mas la carga por slug
- [x] 6.5 Crear `web/src/routes/Preview.tsx` y registrar `/a/:appId/vista/:source` en `web/src/App.tsx`
- [x] 6.6 Mostrar en `Builder.tsx` el indicador de cambios sin publicar y el contador de avisos

## 7. Verificacion

- [x] 7.1 `bun run typecheck` sin errores
- [x] 7.2 Ampliar `scripts/smoke.ts`: publicar crea version, editar no cambia el enlace publico, restaurar deja el borrador, borrar la version en vivo falla, renombrar una columna corrige el bloque, borrar una columna deja aviso
- [x] 7.3 Correr `bun run dev` y `bun run smoke` contra el servidor encendido
