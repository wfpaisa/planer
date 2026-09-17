Cada grupo es una fase independiente (ver `design.md` - Migration Plan): se puede implementar, verificar y commitear sola. Verificación mínima después de cada grupo: `bun run typecheck`. Se agrega `bun run lint` y/o `bun run harness` donde aplica. `AGENTS.md` y `docs/COMO-FUNCIONA.md` se actualizan en el mismo grupo que mueve el archivo que nombran, no al final.

## 1. `server/aiPage.ts` → `server/aiPage/`

- [ ] 1.1 Crear `server/aiPage/prompts.ts`: mover `TOOL_GUIDE`, `PLAN_MODE_GUIDE`, `UNNAMED_PAGE`, `USE_SYSTEM`, `FIX_SYSTEM_TAIL`, `systemPrompt()`.
- [ ] 1.2 Crear `server/aiPage/tools.ts`: mover `FIELD_SCHEMA`, `BLOCK_REF`, `BLOCK_NAME`, `BLOCK_SOURCES`, `TOOLS`, `PLAN_MODE_WRITE_TOOLS`, `CERRAR_PLAN_TOOL`, `toolsFor()`.
- [ ] 1.3 Crear `server/aiPage/context.ts`: mover `sourcesFor`, `pickedSection`, `filesSection`, `weigh`, `withSources`, `missingFile`, `findTable`, `titleFromHtml`, `unescapeHtml`.
- [ ] 1.4 Crear `server/aiPage/fields.ts`: mover `FIELD_TYPES`, `RETYPE_TYPES`, `normalizeFieldDefs`, `planFill`, `accessDirection`.
- [ ] 1.5 Crear `server/aiPage/toolRuntime.ts`: mover `runTool()` y `hold()`. Dentro de `runTool`, nombrar como función propia cada `case` largo del switch (p. ej. `runCrearTabla`, `runEscribirPagina`, `runReemplazarBloque`...) para que el switch quede como índice de una línea por herramienta; el cuerpo de cada handler es el mismo código que hoy, sin cambios de lógica.
- [ ] 1.6 Dejar en `server/aiPage.ts` (o renombrarlo a `server/aiPage/index.ts`, decidir según qué import quede más limpio en `routes.ts`) solo el orquestador: `appPages`, `appTables`, `runPageRequest`, `explainPageUse`, `fixPage`, `writePageDoc`, `priorTurns`, `stepBefore`, `MAX_HISTORY_*`, importando de los módulos de arriba.
- [ ] 1.7 Actualizar el único import externo (`server/routes.ts`) y cualquier otro que aparezca al correr `bun run typecheck`.
- [ ] 1.8 Actualizar las rutas mencionadas en `AGENTS.md` (busca `server/aiPage.ts`) y en `docs/COMO-FUNCIONA.md` (busca `TOOL_GUIDE`, `server/aiPage.ts`).
- [ ] 1.9 `bun run typecheck` y `bun run lint` limpios. Probar en el navegador: pedirle a la IA un cambio simple en una página y confirmar que responde igual que antes.

## 2. `server/ai.ts` y compañía → `server/ai/`

- [ ] 2.1 Mover `ai.ts`, `aiChats.ts`, `aiDebug.ts`, `aiFiles.ts`, `aiModels.ts`, `aiRuns.ts` a `server/ai/` (mover tal cual, sin dividir contenido).
- [ ] 2.2 Mover la carpeta `server/aiPage/` (creada en el grupo 1) dentro de `server/ai/aiPage/`, o evaluar si conviene que sus archivos queden sueltos directamente en `server/ai/` — decidir según cuál lectura es más clara antes de mover.
- [ ] 2.3 Actualizar todos los imports que rompan (`server/routes.ts` es el principal).
- [ ] 2.4 Actualizar rutas mencionadas en `AGENTS.md` y `docs/COMO-FUNCIONA.md`.
- [ ] 2.5 `bun run typecheck` y `bun run lint` limpios.

## 3. `server/html*.ts` → `server/html/`

- [ ] 3.1 Mover `htmlAudit.ts`, `htmlBlocks.ts`, `htmlBridge.ts`, `htmlCharts.ts`, `htmlDocs.ts`, `htmlProbe.ts` a `server/html/` (mover tal cual).
- [ ] 3.2 Actualizar todos los imports que rompan.
- [ ] 3.3 Actualizar rutas en `AGENTS.md` y `docs/COMO-FUNCIONA.md` (busca `htmlAudit.ts`, `htmlBlocks.ts`, `KNOWN_VARS`).
- [ ] 3.4 `bun run typecheck`, `bun run lint` y **`bun run harness`** limpios (el harness depende de rutas relacionadas con estilos/contrato).

## 4. `server/page*.ts` → `server/page/`

- [ ] 4.1 Mover `pageAssets.ts`, `pageConvert.ts`, `pageData.ts`, `pageStyles.ts` a `server/page/` (mover tal cual).
- [ ] 4.2 Actualizar todos los imports que rompan.
- [ ] 4.3 Actualizar rutas en `AGENTS.md` (busca `server/pageData.ts`, `server/pageStyles.ts`) y `docs/COMO-FUNCIONA.md`.
- [ ] 4.4 `bun run typecheck`, `bun run lint` y `bun run harness` limpios (`pageStyles.ts` sirve `/plane/estilos.css`).

## 5. `DataGrid.svelte`: exportación y visibilidad de columnas a `lib/`

- [ ] 5.1 Crear `web/src/lib/dataGridExport.ts` con `exportTable`, `exportAll`, `exportSelected` (y sus tipos/imports asociados).
- [ ] 5.2 Crear `web/src/lib/dataGridColumns.ts` con `toggleHidden`, `toggleSystemVisible`, `isSystem`, `systemFieldDef`.
- [ ] 5.3 `DataGrid.svelte` importa y llama a esas funciones en vez de definirlas.
- [ ] 5.4 `bun run typecheck` y `bun run lint` limpios. Probar en el navegador: exportar una tabla (descarga y copiar), ocultar/mostrar una columna.

## 6. `ImportModal.svelte`: pasos de asistente

- [ ] 6.1 Crear `web/src/lib/importWizard.svelte.ts` con el estado compartido del asistente (columnas mapeadas, reglas por columna, filas convertidas, paso actual) que hoy vive como `$state` local de `ImportModal.svelte`.
- [ ] 6.2 Extraer el paso de lectura/parseo de archivo (`readFile` y alrededores) a un subcomponente o a `web/src/lib/importModal.ts` si no necesita markup propio.
- [ ] 6.3 Extraer el paso de mapeo de columnas a `components/import/` como subcomponente, usando `ImportColumnHead.svelte` ya existente como pieza.
- [ ] 6.4 Extraer el paso de previsualización/confirmación (`statusOf`, `buildBody`, `save`, `guardar`) a subcomponente o módulo, lo que separe mejor markup de lógica sin fragmentar en exceso.
- [ ] 6.5 `ImportModal.svelte` queda como el contenedor del asistente: wiring del estado de `importWizard.svelte.ts` con cada paso.
- [ ] 6.6 `bun run typecheck` y `bun run lint` limpios. Probar en el navegador: importar un CSV completo, de subida a guardado, incluyendo un caso con filas que fallan.

## 7. `AiPanel.svelte`: extraer el ciclo de vida de una petición en marcha

- [ ] 7.1 Crear un módulo `.svelte.ts` (nombre a definir según lo que ya usa `aiRun.svelte.ts`/`aiConversation.svelte.ts`) que contenga `listen()` completa: abrir el stream, acumular progreso, aterrizar el resultado (`land`).
- [ ] 7.2 `AiPanel.svelte` llama a ese módulo en vez de definir `listen()` inline; `dispatch()` se queda en el componente.
- [ ] 7.3 `bun run typecheck` y `bun run lint` limpios. Probar en el navegador: una petición completa a la IA, cortarla a mitad, y que una pregunta (`preguntar`) se conteste bien.

## 8. `demo/DemoGallery.svelte`: dividir por sección del catálogo

- [ ] 8.1 Identificar las secciones del catálogo que ya lista `DESIGN.md` (botones, campos, checkbox/radio/switch, cards, chips, tags, menú, modal/drawer/toast, tabla...) y confirmar cuáles corresponden a bloques de markup ya delimitados en el archivo actual.
- [ ] 8.2 Extraer cada sección a un archivo hermano bajo `web/src/components/demo/` (nombre a definir, p. ej. `DemoButtons.svelte`, `DemoCards.svelte`...), moviendo el snippet/markup correspondiente tal cual.
- [ ] 8.3 `DemoGallery.svelte` compone las secciones extraídas.
- [ ] 8.4 `bun run typecheck` y `bun run lint` limpios. Abrir `/demo` en el navegador y confirmar que se ve igual que antes.

## 9. Reagrupar `web/src/components/` por dominio

- [ ] 9.1 Confirmar con el usuario los nombres de carpeta antes de mover nada: `database/` (DataGrid + piezas de la base de datos) y `app/` (sidebar, publicar, roles, versiones) — ver `design.md`, decisión 2.
- [ ] 9.2 Crear `web/src/components/database/` y mover `DataGrid.svelte`, `ColumnModal.svelte`, `RowDrawer.svelte`, `OrphanPanel.svelte`, `ImportModal.svelte`, `ImportStructureModal.svelte`, y la carpeta `import/` ya existente.
- [ ] 9.3 Crear `web/src/components/app/` y mover `AppSidebar.svelte`, `CreateAppModal.svelte`, `PublishPanel.svelte`, `RolesModal.svelte`, `PasswordForm.svelte`, `HistoryPanel.svelte`, `VersionRow.svelte`.
- [ ] 9.4 Actualizar todos los imports que rompan en `web/src/`.
- [ ] 9.5 `bun run typecheck` y `bun run lint` limpios. Probar en el navegador: abrir la base de datos de una tabla, publicar una app, ver el histórico de versiones.

## 10. Verificación final

- [ ] 10.1 `bun run typecheck`, `bun run lint`, `bun run harness` limpios sobre el repo completo.
- [ ] 10.2 `bun run dev` + `bun run smoke` pasa completo.
- [ ] 10.3 Revisar que ningún archivo de `AGENTS.md` o `docs/COMO-FUNCIONA.md` quedó con una ruta vieja (`grep` de cada ruta movida contra ambos archivos).
