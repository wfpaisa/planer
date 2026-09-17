## Why

`server/aiPage.ts` (2604 líneas) y varios componentes del panel (`AiPanel.svelte` 2282, `ImportModal.svelte` 2330, `DataGrid.svelte` 2173, `DemoGallery.svelte` 2565) mezclan, cada uno en un solo archivo, varias responsabilidades que hoy son fáciles de nombrar por separado (prompts vs. ejecución de herramientas; carga de datos vs. exportación vs. visibilidad de columnas; cada paso de un asistente). Además `server/` es una carpeta plana de 30 archivos que ya usa prefijos (`ai*`, `html*`, `page*`) como sustituto informal de carpetas. Nada de esto es un bug: es fricción para ubicar código y para que un cambio pequeño quede en un diff pequeño.

## What Changes

- Dividir los archivos grandes por responsabilidad real (no un archivo por función): cada pieza extraída agrupa varias funciones que ya trabajan juntas.
  - `server/aiPage.ts` → subcarpeta `server/aiPage/` con módulos por responsabilidad: prompts del sistema, definición de herramientas, ejecución de herramientas (el `switch` de `runTool`, hoy ~640 líneas, se parte en una función por familia de herramienta), construcción de contexto/adjuntos, validación de campos de tabla. El archivo raíz queda como orquestador (`runPageRequest`, `explainPageUse`, `fixPage`, `priorTurns`, etc.).
  - `web/src/components/AiPanel.svelte` → se extrae el ciclo de vida de una petición en marcha (la función `listen()`, ~190 líneas, y su estado de progreso) a un módulo `.svelte.ts`, siguiendo el mismo patrón que ya usan `aiRun.svelte.ts` / `aiConversation.svelte.ts`.
  - `web/src/components/DataGrid.svelte` → se extrae exportación (`exportTable`/`exportAll`/`exportSelected`) y visibilidad de columnas (`toggleHidden`/`toggleSystemVisible`) a módulos de `lib/`; se evalúa un subcomponente para el cuerpo de filas si la extracción no complica el paso de estado.
  - `web/src/components/ImportModal.svelte` → se reorganiza como pasos de asistente bajo `web/src/components/import/` (ya existe esa carpeta con `ImportColumnHead.svelte`/`ImportStructureModal.svelte`), con el estado compartido del asistente en un módulo `.svelte.ts`.
  - `web/src/components/demo/DemoGallery.svelte` → se divide por sección del catálogo (botones, campos, tarjetas, tablas, menús...) en archivos hermanos bajo `demo/`; es el de menor riesgo porque casi no tiene lógica, es la galería de referencia de `/demo`.
- Encarpetar `server/` agrupando por el prefijo que ya usan los nombres de archivo: `server/ai/`, `server/html/`, `server/page/`. Lo que no encaja en ninguno de esos tres (el núcleo de la plataforma: rutas, esquema, auth, bootstrap, config) se queda en la raíz.
- Evaluar, por separado y al final, un agrupamiento por dominio de `web/src/components/` para los archivos sueltos que hoy conviven en la raíz de `components/` (edición de base de datos, publicación/versiones, páginas) — se deja para el final porque el nombre de esas carpetas es más subjetivo y conviene validarlo antes de mover archivos.
- Actualizar cada referencia a una ruta de archivo movida en `AGENTS.md` y `docs/COMO-FUNCIONA.md`, que hoy nombran rutas exactas (`server/pageData.ts`, `server/htmlAudit.ts`, etc.).

No es parte de este cambio: no se toca ninguna lógica ni comportamiento observable. Cada paso es mover/dividir código manteniendo el mismo comportamiento, verificado con `bun run typecheck`, `bun run lint`, `bun run harness` (cuando toque algo relacionado con `htmlContract`/`htmlAudit`/estilos) y una pasada manual por la app en el navegador.

## Capabilities

Sin capacidades nuevas ni modificadas: es una reorganización interna, no cambia comportamiento observable. `skip_specs: true` en `.openspec.yaml`.

## Impact

- `server/aiPage.ts` y todo lo que lo importa (`server/routes.ts`, scripts de smoke si aplica).
- `server/ai.ts`, `aiChats.ts`, `aiDebug.ts`, `aiFiles.ts`, `aiModels.ts`, `aiRuns.ts` (mueven de carpeta).
- `server/htmlAudit.ts`, `htmlBlocks.ts`, `htmlBridge.ts`, `htmlCharts.ts`, `htmlDocs.ts`, `htmlProbe.ts` (mueven de carpeta).
- `server/pageAssets.ts`, `pageConvert.ts`, `pageData.ts`, `pageStyles.ts` (mueven de carpeta).
- `web/src/components/AiPanel.svelte`, `DataGrid.svelte`, `ImportModal.svelte`, `demo/DemoGallery.svelte` y los módulos nuevos que se creen a partir de ellos.
- Cualquier import, en cualquier archivo del repo, que apunte a una ruta que se mueve.
- `AGENTS.md` y `docs/COMO-FUNCIONA.md` (referencias a rutas exactas).
- `scripts/harness-estilos.ts` como verificación si se toca algo de `html*`/estilos.
