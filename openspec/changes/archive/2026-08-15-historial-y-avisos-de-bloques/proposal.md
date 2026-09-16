## Why

Hoy cada ajuste del diseno se ve al instante en el enlace publico: no existe borrador, ni historial, ni forma de volver atras. Y cuando una columna se renombra o se borra, los bloques que la usaban la dejan de mostrar en silencio, asi que el constructor se entera tarde y sin saber que paso.

## What Changes

**Historial y publicacion**

- El diseno de una app deja de publicarse solo: lo que se edita es un **borrador**, y el enlace publico sirve la **version publicada**.
- Cada publicacion crea una version en el historial. Ademas se puede crear un **punto de guardado manual** con nombre mientras se trabaja.
- Panel de historial: lista de versiones con fecha, autor, nombre opcional y marca de cual esta en vivo.
- **Previsualizar** el borrador o cualquier version desde el panel, con la misma vista que ve un visitante.
- **Restaurar** una version: vuelve como borrador, nunca directo al publico.
- **Eliminar** y **fijar** versiones. La version en vivo no se puede borrar. Las no fijadas se recortan solas pasado un tope.
- Una version guarda solo presentacion (colores, paginas, bloques, roles, etiquetas y orden de columnas). Nunca guarda ni restaura datos ni estructura real de tablas.
- **BREAKING** (interno): `GET /api/public/{slug}` pasa a servir la version publicada en vez del estado vivo cuando la app tiene una. Las apps ya publicadas sin version siguen sirviendo su estado vivo hasta la primera publicacion.

**Avisos en los bloques**

- Renombrar una columna **corrige solos** los bloques que la usaban y deja un aviso informativo en la app.
- Una columna que ya no existe deja un **hueco marcado** en el bloque dentro del editor, en vez de desaparecer.
- Una tabla borrada muestra "la tabla ya no existe", distinto de "todavia no hay tabla elegida".
- Panel de revision con todos los avisos de la app agrupados por pantalla, y acceso directo al bloque afectado.
- Los avisos solo se ven en el editor y en la previsualizacion. El visitante ve el bloque limpio.
- Al publicar y al restaurar una version se corre la revision y se informa antes de confirmar.

## Capabilities

### New Capabilities

- `app-versions`: borrador frente a version publicada, historial, previsualizacion, restauracion y borrado de versiones.
- `block-checks`: deteccion de referencias rotas en los bloques, correccion automatica de renombrados, avisos y panel de revision.

### Modified Capabilities

<!-- No hay specs previos en openspec/specs. -->

## Impact

- `shared/types.ts`: tipos nuevos (`AppVersion`, `DesignSnapshot`, `BlockIssue`, `AppReview`, `AppNotice`) y campos nuevos en `AppRecord` (`liveVersion`, `notices`).
- `server/config.ts`: nueva coleccion interna `app_versions`.
- `server/bootstrap.ts`: crea `app_versions` y suma `liveVersion` y `notices` a `apps`.
- `server/versions.ts` (nuevo): armar, guardar, comparar, restaurar y podar versiones.
- `server/review.ts` (nuevo): revisar referencias de bloques y renombrar columnas dentro de las paginas.
- `server/routes.ts`: endpoints de versiones, revision, vista previa; `publicBundle` sirve la version publicada; `updateTable` corrige renombrados.
- `server/index.ts`: rutas nuevas.
- `web/src/routes/Published.tsx`: se separa la vista de la carga para reutilizarla en la previsualizacion.
- `web/src/routes/Preview.tsx` (nuevo), `web/src/components/HistoryPanel.tsx` (nuevo), `web/src/components/ReviewPanel.tsx` (nuevo), `web/src/components/PublishMenu.tsx`, `web/src/routes/Builder.tsx`, `web/src/blocks/render.tsx`, `web/src/App.tsx`.
- `scripts/smoke.ts`: cubre publicar, historial, restaurar y revision.
