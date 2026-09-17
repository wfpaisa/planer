## Context

Ver `proposal.md` - Why. Dos problemas separados que se atacan juntos porque comparten la misma pregunta ("¿qué pertenece con qué?"): archivos individuales que mezclan responsabilidades, y una carpeta `server/` plana que ya usa el nombre del archivo (`ai*`, `html*`, `page*`) para decir a qué grupo pertenece cada cosa, en vez de una carpeta.

Regla que gobierna todo este cambio, pedida explícitamente: **el encarpetado y la división de archivos son por responsabilidad, no exhaustivos.** Nunca "una carpeta por función" ni "un archivo por función". La prueba de una carpeta o de un archivo nuevo es: al ver la estructura, ¿se entiende de un vistazo dónde está qué? Si hace falta abrir el archivo para saber por qué existe como pieza separada, es demasiado fino.

## Goals / Non-Goals

**Goals:**
- Que la estructura de carpetas de `server/` se lea sin abrir archivos: tres grupos por prefijo ya existente (`ai`, `html`, `page`) más un núcleo en la raíz.
- Que cada archivo grande quede dividido en piezas con una responsabilidad cada una, nombrada por lo que hace (no por qué función contiene).
- Cero cambio de comportamiento observable en cada paso: esto es mover y dividir código, no reescribirlo.
- Cada paso verificable de forma aislada (`bun run typecheck` como mínimo) para poder revertir un paso sin arrastrar los demás.

**Non-Goals:**
- No dividir nada "hasta el final": ninguna pieza nueva propuesta aquí baja de ~100-150 líneas. Un archivo de 40 líneas con una sola función no es una pieza, es ruido.
- No tocar lógica, nombres de herramientas de la IA, rutas de la API, ni ningún contrato (`shared/htmlContract.ts`, `shared/types.ts`) — son movimientos y extracciones mecánicas.
- No reorganizar `shared/` (17 archivos, ya razonable, sin el problema de prefijos repetidos que sí tiene `server/`).
- No mover archivos que ya están en una subcarpeta lógica (`web/src/components/ai/`, `ui/`, `settings/`, `demo/`, `import/`) — esas ya cumplen la regla.

## Decisions

### 1. `server/` se agrupa por el prefijo que ya usa cada nombre de archivo

En vez de inventar una taxonomía nueva, se formaliza la que ya existe en los nombres:

```
server/
  ai/           ai.ts, aiChats.ts, aiDebug.ts, aiFiles.ts, aiModels.ts, aiRuns.ts, aiPage/ (ver decisión 3)
  html/         htmlAudit.ts, htmlBlocks.ts, htmlBridge.ts, htmlCharts.ts, htmlDocs.ts, htmlProbe.ts
  page/         pageAssets.ts, pageConvert.ts, pageData.ts, pageStyles.ts
  index.ts, routes.ts, config.ts, auth.ts, bootstrap.ts, pb.ts, schema.ts,
  access.ts, dataImpact.ts, filter.ts, peopleImport.ts, peopleTable.ts,
  rowDelete.ts, versions.ts          -- el núcleo: arranque, rutas, esquema,
                                        acceso; lo que no es de la IA, ni de
                                        auditar/servir HTML, ni de una página
```

Alternativa descartada: una carpeta por feature más fina (`server/ai/chat/`, `server/ai/files/`, `server/ai/models/`...). Se descarta porque ninguno de esos archivos individuales tiene el tamaño ni la cantidad de responsabilidades internas que justifique otro nivel — son ya piezas de un tamaño legible (73 a 410 líneas), el problema es solo que están sueltas en la raíz.

Alternativa descartada: agrupar por capa técnica (`server/routes/`, `server/services/`, `server/models/`). Se descarta porque el código ya está organizado por dominio (la IA, el HTML de una página, la página en sí), no por capa, y forzar una capa nueva encima sería la taxonomía inventada que este cambio evita.

### 2. `web/src/components/` gana como máximo dos o tres carpetas de dominio nuevas, no una por archivo

Los archivos sueltos en la raíz de `components/` que no son ya de un dominio con carpeta propia se agrupan en, como mucho, dos o tres carpetas de dominio evidentes:

```
web/src/components/
  database/     DataGrid.svelte (+ piezas nuevas, ver decisión 4), ColumnModal.svelte,
                RowDrawer.svelte, OrphanPanel.svelte, ImportModal.svelte,
                ImportStructureModal.svelte, import/ (ya existe, queda dentro)
  app/          AppSidebar.svelte, CreateAppModal.svelte, PublishPanel.svelte,
                RolesModal.svelte, PasswordForm.svelte, HistoryPanel.svelte,
                VersionRow.svelte
  (raíz)        el resto: PagePanel.svelte, TableSidebar.svelte, HtmlFrame.svelte,
                PageProbe.svelte, ConvertDialog.svelte, UrlBar.svelte, Icon.svelte,
                Toast.svelte, PersonColumnOffer.svelte, IconPickerModal.svelte -- se
                quedan en la raíz: son de "página publicada" y de piezas sueltas de
                uso general, y forzar una tercera carpeta ("pages/") para un grupo
                heterogéneo sería exactamente la fragmentación que se quiere evitar
  ai/, ui/, settings/, demo/   sin cambios, ya son carpetas de dominio
```

Esta parte tiene más criterio de gusto que la de `server/` (no hay un prefijo de nombre de archivo que la determine sola), así que se ejecuta al final y se confirma con una pregunta corta antes de mover nada — ver `tasks.md`.

### 3. `server/aiPage.ts` se divide por responsabilidad dentro de `server/aiPage/`

El archivo hoy mezcla, en orden: prompts del sistema (~340 líneas de texto), el esquema de las 11 herramientas de la IA (~320 líneas), funciones de contexto (armar qué tablas/archivos ve el modelo), validación de campos de tabla, y el ejecutor de herramientas (`runTool`, un `switch` de ~640 líneas con un `case` por herramienta). Split:

```
server/aiPage/
  prompts.ts       TOOL_GUIDE, PLAN_MODE_GUIDE, UNNAMED_PAGE, USE_SYSTEM,
                    FIX_SYSTEM_TAIL, systemPrompt()
  tools.ts          FIELD_SCHEMA, BLOCK_REF/BLOCK_NAME/BLOCK_SOURCES, TOOLS,
                    PLAN_MODE_WRITE_TOOLS, CERRAR_PLAN_TOOL, toolsFor()
  toolRuntime.ts    runTool() y hold() -- el switch se mantiene como despachador
                    fino; cada case sigue siendo el mismo código que hoy, solo
                    que los cases largos (crear_tabla, escribir_pagina,
                    reemplazar_bloque...) se nombran como función propia
                    (runCrearTabla, runEscribirPagina...) para que el switch
                    se lea como un índice
  context.ts        sourcesFor, pickedSection, filesSection, weigh, withSources,
                    missingFile, findTable, titleFromHtml, unescapeHtml
  fields.ts         FIELD_TYPES, RETYPE_TYPES, normalizeFieldDefs, planFill,
                    accessDirection
index.ts (o aiPage.ts en la raíz de server/ai/)
                    appPages, appTables, runPageRequest, explainPageUse,
                    fixPage, writePageDoc, priorTurns, stepBefore -- el
                    orquestador; importa de las piezas de arriba
```

No se propone dividir `toolRuntime.ts` en un archivo por herramienta (11 archivos de ~50 líneas cada uno): el `switch` es lo que hace legible cuál es la lista completa de herramientas de un vistazo, y partirlo en 11 archivos obligaría a saltar entre ellos para ver esa lista. Nombrar cada `case` largo como función aparte ya resuelve el problema real (un `switch` de 640 líneas ilegible), sin perder esa vista de conjunto.

### 4. Los componentes grandes de `web/` se dividen por lo mismo: estado con nombre propio sale a `lib/`, markup repetido sale a subcomponente

- **`AiPanel.svelte`**: `listen()` (~190 líneas, el ciclo de vida completo de una petición en marcha: abre el stream, acumula progreso, aterriza el resultado) sale a un módulo `.svelte.ts` nuevo, mismo patrón que `aiRun.svelte.ts`/`aiConversation.svelte.ts` ya establecen. `dispatch()` se queda porque es corto y es lo que de verdad orquesta el componente.
- **`DataGrid.svelte`**: exportación (`exportTable`/`exportAll`/`exportSelected`, ~50 líneas) y visibilidad de columnas (`toggleHidden`/`toggleSystemVisible`/`isSystem`/`systemFieldDef`, ~35 líneas) salen a `lib/dataGridExport.ts` y `lib/dataGridColumns.ts`. Carga/selección/orden/búsqueda de filas se quedan: es la responsabilidad central del componente, no una pieza aparte.
- **`ImportModal.svelte`**: se reorganiza en pasos de asistente (subir archivo → mapear columnas → previsualizar/confirmar) como subcomponentes de `components/import/`, con el estado compartido (columnas mapeadas, reglas, filas convertidas) en `lib/importWizard.svelte.ts`.
- **`DemoGallery.svelte`**: es casi solo markup (226 de 2565 líneas son script). Se divide por sección del catálogo de `/demo` en archivos hermanos; sin cambio de lógica porque casi no la tiene.

## Risks / Trade-offs

- **Un import mal actualizado rompe el build** → cada movimiento de archivo va seguido de `bun run typecheck` antes de seguir al siguiente; el compilador señala cualquier import que falte.
- **`AGENTS.md` y `docs/COMO-FUNCIONA.md` nombran rutas exactas** (`server/pageData.ts`, `server/htmlAudit.ts`, `server/aiPage.ts`, etc.) → se actualizan en el mismo paso que mueve cada archivo, no al final, para que nunca queden desincronizados.
- **`scripts/harness-estilos.ts` y el propio `bun run lint`** dependen de rutas fijas si alguna las tiene hardcodeadas → se corre `bun run harness` después de mover cualquier archivo `html*`/de estilos, y `bun run lint` después de cada fase.
- **Historia de git más ruidosa** (mover un archivo grande aparece como borrado+creado si el contenido cambia demasiado en el mismo commit) → cada extracción se hace en dos pasos cuando sea razonable: primero mover el archivo tal cual (git ve un rename limpio), después dividir su contenido en el commit siguiente.
- **La carpeta `.claude/worktrees/sad-kowalevski-96afc0/` ya rompe `bun run lint` hoy**, sin relación con este cambio → se resuelve aparte (no es parte de este plan; es limpieza de entorno local, ya señalada en la conversación).

## Migration Plan

Orden de fases, cada una verificable y revertible sola (ver `tasks.md` para el detalle marcable):

1. `server/aiPage.ts` → `server/aiPage/*.ts` (el split más grande y el que más se beneficia de hacerse primero, sin interferencia de las otras fases).
2. `server/ai.ts` y compañía → `server/ai/` (mover, sin dividir: ya son archivos de tamaño razonable).
3. `server/html*.ts` → `server/html/` (mover, sin dividir).
4. `server/page*.ts` → `server/page/` (mover, sin dividir).
5. `web/src/components/DataGrid.svelte` → extraer `lib/dataGridExport.ts` + `lib/dataGridColumns.ts`.
6. `web/src/components/ImportModal.svelte` → pasos de asistente + `lib/importWizard.svelte.ts`.
7. `web/src/components/AiPanel.svelte` → extraer el ciclo de vida de `listen()`.
8. `web/src/components/demo/DemoGallery.svelte` → dividir por sección del catálogo.
9. Reagrupar `web/src/components/` por dominio (decisión 2) — al final, y solo tras confirmar los nombres de carpeta.

Rollback: cada fase es uno o pocos commits de solo movimiento/extracción mecánica; revertir es `git revert` de esos commits, sin efecto en las fases ya mergeadas porque no dependen unas de otras (excepto que la 2-4 asumen que la 1 ya movió `aiPage.ts` fuera de la raíz de `server/`, para no mover ese archivo dos veces).

## Open Questions

Ninguna que cambie el enfoque o el desglose de tareas: el único punto con criterio abierto (nombres de carpeta de dominio en `web/src/components/`, decisión 2) ya queda resuelto arriba con una propuesta concreta, y su confirmación es un paso explícito de `tasks.md`, no algo que se difiera sin más.
