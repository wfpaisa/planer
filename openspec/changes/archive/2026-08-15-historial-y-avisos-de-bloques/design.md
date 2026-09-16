## Context

Ver `proposal.md` - Why. Estado actual relevante:

- El diseno vive repartido en tres colecciones internas: `apps` (tema, roles, marca), `pages` (bloques) y `tables` (etiquetas, `meta`, `fields`). No hay copia intermedia.
- `publicBundle` en `server/routes.ts` arma el `AppBundle` leyendo esos registros en vivo.
- Las tablas del usuario son colecciones reales de PocketBase (`d_*`). Sus filas y su estructura no son versionables sin destruir datos.
- `FieldDef.id` es el id que PocketBase asigno a la columna. Un rename conserva el id (ver AGENTS.md - "Field identities and renames"). Los bloques, en cambio, guardan **nombres** de columna (`fields: string[]`, `sort`, `titleField`, `StatItem.field`).
- `bootstrap.ts` no tiene migraciones: si una coleccion existe, solo agrega los campos que falten.

## Goals / Non-Goals

**Goals**

- Que publicar sea un acto explicito y reversible.
- Que la deteccion de referencias rotas viva en un solo lugar, reutilizable por el editor, la publicacion y la restauracion.
- No romper apps ya publicadas ni `demo.ts` / `smoke.ts`.

**Non-Goals**

- Versionar filas o estructura de tablas.
- Comparar dos versiones lado a lado (diff visual).
- Enlaces de previsualizacion para terceros sin sesion de constructor.
- Revisar las expresiones de `filter`, que son texto libre y darian falsos positivos.

## Decisions

### 1. Una version es una fotografia completa en un registro

Coleccion interna nueva `app_versions` con un campo `snapshot` JSON que guarda todo el diseno de la app.

**Por que**: es autocontenida, asi previsualizar, restaurar y borrar son operaciones triviales sobre un registro. La alternativa (versionar cada pagina por separado, o guardar diffs encadenados) multiplica los estados invalidos y no aporta nada a esta escala (decenas de paginas, no miles).

`apps.liveVersion` es un **texto** con el id de la version en vivo, no una relacion: `bootstrap.ts` crea `apps` antes que `app_versions`, y una relacion cruzada obligaria a reordenar el arranque.

### 2. El borrador es el estado vivo; lo publicado es la fotografia

No se agrega un campo `draft`. El editor sigue escribiendo directo en `apps`, `pages` y `tables` como hoy; lo que cambia es que `publicBundle` deja de leer eso y lee la version en vivo.

**Por que**: es la opcion con menos superficie de cambio en el panel (cero cambios en el editor) y elimina la doble escritura. La alternativa (guardar el borrador en un JSON aparte) obligaria a reescribir `AppEditor`, `DatabaseEditor` y `Settings`.

### 3. La fotografia guarda presentacion; las tablas se resuelven en vivo al servir

El snapshot guarda por tabla `{ id, label, icon, order, meta, fieldLabels }` — nunca `fields` completos. Al servir una version, se toman las tablas **vivas** (estructura real) y se les aplican esos valores encima.

**Por que**: es la unica forma de que una version antigua no mienta sobre la estructura real de la base. Si el snapshot llevara `fields`, el visor intentaria leer columnas que ya no existen en PocketBase y las peticiones fallarian.

Consecuencia buscada: restaurar nunca puede perder datos, porque no toca estructura.

### 4. Detectar cambios sin publicar: huella del snapshot

Cada version guarda un `hash` (SHA-256 del snapshot serializado de forma estable). "Hay cambios sin publicar" es comparar la huella del borrador con la de la version en vivo.

**Por que**: mas barato y mas fiable que comparar fechas de `updated` repartidas en tres colecciones.

### 5. Los renombrados se corrigen en el momento del rename, no despues

`updateTable` ya recibe la lista de columnas con sus ids. Ahi se comparan ids contra `table.fields` y se obtiene el mapa `nombre viejo -> nombre nuevo`. Con ese mapa se reescriben los bloques de todas las paginas de la app.

**Por que**: es el unico momento en el que existe la informacion para distinguir "se llama distinto" de "ya no esta". La alternativa (guardar ids de columna dentro de cada bloque) obliga a migrar seis tipos de bloque y a mantener dos identificadores en paralelo para siempre.

Coste: un rename hecho por fuera de la API (directo en PocketBase) no se corrige. Aceptable — el panel no ofrece esa via.

### 6. Los avisos automaticos se guardan en `apps.notices`

Array JSON acotado (50 entradas) con `{ id, level, message, pageId, blockId, created }`. Los arreglos automaticos escriben ahi; el panel de revision los muestra junto a los problemas detectados en vivo y permite descartarlos.

**Por que**: un aviso "se arreglo solo" es un hecho pasado — no se puede recalcular revisando el estado actual, porque el estado ya esta sano. Necesita persistirse. Una coleccion propia seria mas de lo que este volumen justifica.

### 7. La revision es una funcion pura sobre paginas + tablas

`reviewDesign(pages, tables)` en `server/review.ts`. La usan el endpoint de revision, publicar y restaurar. El frontend no reimplementa la deteccion: solo pinta lo que llega.

Excepcion deliberada: `render.tsx` si necesita saber, columna por columna, cual falta para dibujar el hueco. Ahi la comprobacion es local y trivial (`find` por nombre), no una segunda implementacion de las reglas.

### 8. Editor y publicado comparten renderer, se separan por una bandera

`RuntimeProvider` gana `showIssues: boolean`. El editor y la previsualizacion lo ponen en `true`; `Published.tsx` en `false`.

**Por que**: mantiene un solo renderer (asi esta hoy) y hace explicito el requisito de que el visitante no vea nada roto.

### 9. Previsualizar reutiliza la vista publicada

`Published.tsx` se parte en dos: el componente que carga por slug y un `AppView` presentacional. La ruta nueva `/a/:appId/vista/:source` monta `AppView` con el bundle que devuelve `GET /api/apps/:id/vista/:source` (autenticado como constructor) y el cliente `pb` en vez de `pbApp`.

`source` es `borrador` o el id de una version.

**Por que usar `pb`**: el constructor es dueno de las tablas, asi que las reglas de acceso ya le permiten leer los datos. Un token de previsualizacion anonimo seria una via nueva de acceso a datos privados sin necesidad.

## Risks / Trade-offs

- **El snapshot puede crecer** (paginas con muchos bloques) → el campo JSON se dimensiona a 3 MB, y el recorte automatico limita el historial a 30 versiones por app.
- **Compatibilidad con apps ya publicadas**: quedarian sirviendo una version inexistente → `publicBundle` cae al estado vivo cuando `liveVersion` esta vacio, y `updateApp` con `published: true` crea la version inicial. `demo.ts` y `smoke.ts` siguen funcionando sin tocarlos.
- **Sorpresa de flujo**: quien esta acostumbrado a que todo salga al instante puede no publicar → el boton de publicar muestra un contador de cambios sin publicar en la barra superior.
- **Restaurar una version vieja puede dejar bloques rotos** → la restauracion devuelve la revision y el panel la muestra antes de que el constructor publique.
- **`apps.notices` puede llenarse de ruido** → tope de 50 y boton de descartar.
- **Escritura concurrente de dos pestanas** → no se resuelve; gana la ultima. Mismo comportamiento que hoy en el resto del editor.

## Migration Plan

1. `bootstrap.ts` crea `app_versions` y agrega `liveVersion` y `notices` a `apps` en el siguiente arranque. Es idempotente y no toca datos existentes.
2. Las apps existentes quedan con `liveVersion` vacio: siguen sirviendo el estado vivo hasta la primera publicacion.
3. Rollback: revertir el codigo. La coleccion `app_versions` y los campos nuevos quedan sin uso; nada del estado anterior se perdio.

## Open Questions

Ninguna.
