# Migración de React 19 a Svelte 5

Plan para reescribir el panel (`web/`) de React a Svelte 5 con runas. Escrito
sobre el código real: los tamaños, el grafo de importaciones y los
acoplamientos que aparecen aquí salen de medir, no de estimar.

> Lo que **no** entra: `server/`, `shared/`, PocketBase y el HTML que generan
> las páginas. Nada de eso importa React hoy. Ver [Alcance](#alcance).

## Estado

Una fase marcada con ✅ está migrada, verificada y commiteada en la rama.
**Las ocho están hechas: en `web/src` no queda ni un archivo de React.**

| Fase | Estado |
|---|---|
| 0 — Refactores previos | ✅ |
| 1 — Infraestructura | ✅ |
| 2 — Base compartida | ✅ |
| 3 — Rutas ligeras | ✅ |
| 4 — Cascarón del Builder | ✅ |
| 5 — Páginas y HTML | ✅ |
| 6 — Rejilla de datos | ✅ |
| 7 — IA | ✅ |
| 8 — Cierre | ✅ |

## Alcance

La superficie es solo `web/src`: **73 archivos, 20.711 líneas**.

| Grupo | Líneas | Qué pasa con ellas |
|---|---|---|
| `.tsx` (54 archivos) | 17.698 | Se reescriben |
| `.ts` sin React (17 archivos) | ~2.900 | Se copian tal cual |
| `.ts` atados a React (`useAsync`, `frameThrottle`, `monaco`) | 120 | Se reescriben |
| `styles/*.css` | — | Intactas |

Fuera del panel no se toca nada:

- El servidor Bun, `shared/` y PocketBase no importan React. El único match de
  "react" fuera de `web/` es una entrada del catálogo de iconos.
- **Las páginas que construye el usuario son HTML plano dentro de un iframe
  aislado** (`components/HtmlFrame.tsx`). El producto no genera JSX, así que el
  formato de salida, el puente de datos y el contrato de seguridad son
  agnósticos al framework.
- `chart.js` se inyecta en el HTML generado desde `server/pageAssets.ts`. No se
  usa en el panel.
- Tailwind v4 y daisyUI funcionan igual con Svelte, con el mismo plugin
  `@tailwindcss/vite`. Las cuatro hojas de `styles/` no cambian.
- `bun run smoke` es HTTP contra el servidor: sigue validando el sistema
  completo durante toda la migración. Es la principal red de seguridad.

## Decisiones

1. **Svelte 5 con runas.** `$state`, `$derived`, `$effect`. Los stores clásicos
   solo donde haga falta un valor observable fuera de un componente.
2. **Vite se queda.** Solo cambia `@vitejs/plugin-react` por
   `@sveltejs/vite-plugin-svelte`. El build sigue saliendo a `web/dist`.
3. **SPA, no SvelteKit.** El servidor Bun es el que abre el puerto 3000, proxea
   `/pb/*` y `/api/*`, y sirve `web/dist` en producción. SvelteKit traería su
   propio modelo de build y de rutas de servidor que chocaría con eso sin
   aportar nada: el panel no necesita SSR.
4. **Router propio, ~150 líneas.** Hay cinco rutas de primer nivel y dos
   anidadas. Escribirlo evita apostar por la compatibilidad con Svelte 5 de una
   librería de terceros, y sobre todo permite reproducir el patrón de
   *background location* que el Builder ya usa (ver
   [El router](#el-router-lo-que-tiene-que-saber-hacer)).
5. **Monaco sin envoltorio de terceros.** `@monaco-editor/react` desaparece; se
   instancia `monaco.editor.create` en un componente propio con `onMount`.
6. **Portales por acción.** Svelte no tiene portal nativo; se resuelve con una
   `action` de una decena de líneas.
7. **De una vez, en rama.** Ver [Por qué no incremental](#por-qué-no-incremental).

### Por qué no incremental

React y Svelte pueden convivir en un mismo build de Vite, pero aquí la frontera
sale cara. Cuatro contextos globales —`session`, `theme`, `fontSize`,
`people`— cruzan casi toda la aplicación, y el contexto del Builder es un
concentrador: **seis archivos importan `routes/Builder.tsx` solo para usar
`useBuilder`** (`DatabaseEditor`, `AppTopBar`, `HistoryPanel`, `PageStage`,
`Settings`, `RolesModal`). Cualquier corte deja contextos duplicados a los dos
lados y sincronizándose a mano.

La rama larga tiene su propio riesgo: `main` sigue moviéndose. Mitigación:
mantener las fases cortas, rebasear al terminar cada una, y no aceptar en `main`
cambios grandes de UI mientras dure.

## Fase 0 — Tres refactores previos, todavía en React ✅

Esta fase no escribe una sola línea de Svelte. Deshace los tres acoplamientos
que hoy hacen imposible migrar en orden. Al terminar, `bun run typecheck` y
`bun run smoke` pasan y la aplicación sigue siendo React.

**0.1 — Romper el ciclo `ui` ↔ `icons`.**
`lib/icons.tsx` importa `cx` de `components/ui.tsx`, y `ui.tsx` importa `Icon`
de `lib/icons.tsx`. Mover `cx` a `lib/cx.ts` (es una función pura de cinco
líneas) y actualizar los importadores.

**0.2 — Sacar los valores de celda de `cells.tsx`.**
`lib/tableExport.ts` importa el valor `relationCell` y el tipo `Row` desde
`components/cells.tsx`, y `lib/peopleGrid.ts` importa el tipo. Son dos archivos
de lógica pura (415 líneas juntos) atados a un componente. Mover `Row` y
`relationCell` a `lib/cellValues.ts`. Con esto, `tableExport` y `peopleGrid`
pasan al grupo "se copia tal cual".

**0.3 — Sacar `BuilderContext` de `routes/Builder.tsx`.**
Es el refactor que decide la viabilidad del resto. Hoy el contexto y el hook
`useBuilder` viven dentro del archivo de la ruta, que a su vez importa
`AppEditor`, `DatabaseEditor`, `Preview` y `Settings`. Resultado: un ciclo entre
la ruta y sus hijas. Mover el contexto, el tipo `BuilderValue` y `useBuilder` a
`lib/builderContext.ts`, sin cambiar la lógica.

**Verificación de la fase:** `bun run typecheck`, `bun run check`, `bun run dev`
+ `bun run smoke`. Estos tres commits pueden entrar en `main` directamente, sean
cuales sean los planes de migración: mejoran el código tal como está.

## Fase 1 — Infraestructura y arranque ✅

Objetivo: la aplicación arranca en Svelte y se puede iniciar sesión. Nada más.

- `package.json`: fuera `react`, `react-dom`, `react-router`,
  `@monaco-editor/react`, `@vitejs/plugin-react`, `@types/react`,
  `@types/react-dom`. Dentro `svelte`, `@sveltejs/vite-plugin-svelte`,
  `svelte-check`, y `monaco-editor` como dependencia directa (hoy entra
  arrastrada por el envoltorio de React).
- `web/vite.config.ts`: cambiar el plugin. El resto de la configuración
  (alias `@shared`, Tailwind, workers de Monaco) no cambia.
- `main.tsx` → `main.ts` con `mount(App, { target })`. Desaparece `StrictMode`,
  y con él el doble montaje en desarrollo: algunos efectos escritos para
  sobrevivirlo se pueden simplificar (anotarlo, no hacerlo aún).
- `App.svelte`: el árbol de proveedores del `App.tsx` actual pasa a
  `setContext` en el `<script>`.
- `lib/router.ts` + `Router.svelte`: ver abajo.
- `lib/portal.ts`: la acción `use:portal` que sustituye a los cinco
  `createPortal` (`Toast`, `Tooltip`, `RowDrawer`, `PanelKit`, `ui`).
- `Login.svelte` (88 líneas) como primera ruta real, con `lib/session.ts` y
  `ThemePicker.svelte`.
- Verificación: `svelte-check` sustituye a `tsc --noEmit` para los `.svelte`;
  actualizar el script `typecheck` para correr los dos.
- **Decidir el formateo.** El soporte de Biome para `.svelte` cubre los bloques
  de `<script>`, no el marcado. Comprobar qué hace exactamente la versión
  instalada (`biome check` sobre un `.svelte` de prueba) y decidir entre
  aceptar el marcado sin formatear o añadir `prettier-plugin-svelte` solo para
  plantillas. Afecta a `biome.json`, a `lint-staged` y al hook de husky, así que
  se resuelve aquí y no al final.

### El router: lo que tiene que saber hacer

Cinco rutas de primer nivel (`App.tsx`) y dos anidadas bajo `/a/:appId/*`
(`Builder.tsx`). Tres requisitos que no son negociables:

- **Parámetros y comodín:** `/p/:slug/:pageSlug`, `/a/:appId/*`.
- **Guardia de sesión:** el componente `Private`, que espera a `ready` antes de
  redirigir a `/entrar`.
- **Ubicación de fondo:** el Builder abre `/ajustes` y `/vista/:source` como
  capas sobre la ruta que ya estaba, leyendo `location.state.background`.
  Es el requisito que descarta a la mayoría de routers pequeños, y la razón
  principal para escribirlo. El estado de historial tiene que sobrevivir a
  `pushState`/`popstate`.

## Fase 2 — Base compartida ✅

Todo lo que importa el resto. Al terminar hay que poder pintar una pantalla
cualquiera sin faltar nada.

| Archivo | Líneas | Nota |
|---|---|---|
| `lib/theme.tsx` → `.svelte.ts` | 65 | `$state` + `$effect`; el `redraw` artificial del `matchMedia` desaparece |
| `lib/fontSize.tsx` | 52 | Igual |
| `lib/session.tsx` | 59 | El `onChange` de `pb.authStore` encaja directo en `$effect` |
| `lib/people.tsx` | 74 | |
| `lib/appTheme.tsx` | 125 | Casi todo lógica pura; solo el marcado se mueve |
| `lib/icons.tsx` | 102 | Pasa a `Icon.svelte` + `lib/iconName.ts` |
| `lib/fieldTypes.tsx` | 30 | |
| `lib/useAsync.ts` | 39 | Se rehace como función con runas; el `biome-ignore` de dependencias desaparece |
| `lib/frameThrottle.ts` | 53 | Ver nota abajo |
| `components/ui.tsx` | 738 | Se parte en ~20 `.svelte`: `Button`, `Input`, `Modal`, `Dropdown`, `Field`, `Switch`, `Badge`… |
| `components/Toast.tsx` | 145 | Primer usuario de `use:portal` |
| `components/Tooltip.tsx` | 193 | Sin dependencias internas; se puede hacer aislado |
| `components/PanelKit.tsx` | 120 | |
| `components/OmniPanel.tsx` | 63 | |

`ui.tsx` es la pieza de mayor apalancamiento de todo el plan: la importan 30 de
los 54 componentes. Conviene hacerla despacio y revisarla dos veces.

Sobre `frameThrottle`: existe porque React redibuja la conversación entera con
cada token de la IA. Con reactividad granular puede sobrar, pero **no quitarlo
en esta fase**. Se traduce tal cual y se evalúa en la Fase 7, con el panel de IA
ya funcionando y midiendo.

## Fase 3 — Rutas ligeras ✅

Vertical completo, de lo simple a lo complejo. Cada una deja la aplicación
usable.

`Home` (250) · `Settings` (247) · `BrandPicker` (230) · `PersonPassword` (173) ·
`PersonLinkModal` (154) · `IconPicker` (147) · `RolesModal` (117) ·
`PageAccessPicker` (85) · `SettingsSection` (55) · `RolePicker` (55) ·
`AccessModal` (253) · `ThemePicker` (33).

## Fase 4 — Cascarón del Builder ✅

`Builder.tsx` (866) queda reducido: la Fase 0.3 ya le sacó el contexto. Aquí se
migran el cascarón, la navegación y la zona de arrastre.

`Builder` (866) · `AppTopBar` (485) · `AppSidebar` (463) · `AppEditor` (34) ·
`UrlBar` (248).

Punto de atención: el arrastre de archivos usa eventos nativos del DOM y un
`useRef` que guarda el manejador vigente (`onFiles`). En Svelte ese ref es una
variable normal de módulo o de componente; no hace falta ref ninguno.

## Fase 5 — Páginas y HTML ✅

La frontera de seguridad. Se migra con el smoke corriendo después de cada
archivo.

`HtmlFrame` (552) · `PageView` (89) · `PageProbe` (143) · `PageStage` (308) ·
`Preview` (144) · `Published` (346) · `PageSettings` (269) · `PageCodePanel`
(139) · `HistoryPanel` (368) · `ConvertDialog` (220).

`HtmlFrame` merece revisión aparte, no por Svelte sino por lo que hace: valida
que cada orden del documento esté declarada en el manifiesto antes de tocar las
tablas, controla los reintentos de un documento que se va (`MAX_RESTORES`) y
bloquea las operaciones de escritura en ensayo (`WRITE_OPS`). Traducir el ciclo
de vida del iframe a `$effect` es mecánico; **lo que no puede cambiar es qué se
deja pasar**. Comparar el archivo migrado con el original línea por línea sobre
esas tres reglas, además del smoke.

`PageCodePanel` y `ConvertDialog` son los dos consumidores de Monaco: aquí entra
el componente propio de la Decisión 5.

## Fase 6 — La rejilla de datos ✅

La parte más pesada del plan: 5.550 líneas, el 27% del panel.

`DatabaseEditor` (2167) · `ImportModal` (1532) · `cells` (631) ·
`OrphanPanel` (407) · `RowDrawer` (369) · `ColumnModal` (339) ·
`ImportStructureModal` (218).

`DatabaseEditor` no virtualiza filas: pinta la tabla entera. En React eso obliga
a memoizar; en Svelte esas optimizaciones sobran, así que la traducción debería
salir bastante más corta. **No aprovechar la migración para meter
virtualización**: es un cambio de comportamiento, y va después.

`cells.tsx` conviene migrarlo primero dentro de la fase: lo usan `RowDrawer`,
`ImportModal`, `peopleGrid` y `tableExport`.

## Fase 7 — IA ✅

`AiPanel` (1869) · `AiSettings` (1085) · `AiDock` (255) · `ImpactPanel` (210) ·
`lib/markdown.tsx` (211).

`markdown.tsx` no tiene dependencias internas y se puede adelantar a cualquier
fase anterior si conviene repartir el trabajo.

Aquí se cierra la pregunta de `frameThrottle`: con el panel funcionando, medir
el redibujado durante una respuesta larga y decidir si el agrupado por frames
sigue haciendo falta. Si sobra, quitarlo es un commit aparte, después de la
migración.

**Pendiente**: la medida no se hizo. Exige una petición real a un servidor de
IA de pago, y eso se pide antes de gastarlo. El agrupado se tradujo tal cual
—`Working` y el seguimiento del final de la conversación lo siguen usando— así
que quitarlo sigue siendo un commit aparte cuando se mida.

## Fase 8 — Cierre ✅

- Borrados de `package.json` y del `bun.lock` los siete paquetes de React:
  `react`, `react-dom`, `react-router`, `@monaco-editor/react`, `@types/react`,
  `@types/react-dom` y `@vitejs/plugin-react`.
- `tsconfig.json` pierde `"jsx": "react-jsx"`, `biome.json` pierde el dominio
  `react` y las dos reglas que solo valían para él (`useExhaustiveDependencies`
  y `noArrayIndexKey`), y `web/tsconfig.json` pierde la exclusión de los
  `.tsx`: ya no queda ninguno.
- `bun run build` y `bun run start` comprobados con el paquete limpio: la
  aplicación arranca desde `web/dist` sin un solo error de consola, y el
  servidor devuelve el índice para `/entrar`, `/ajustes` y `/p/:slug`.
- Las tres suites de humo pasan, menos dos asertos de `smoke:permisos` sobre el
  texto del contrato que arma el servidor. Vienen fallando de antes de la
  migración y no tocan al panel.
- `AGENTS.md` actualizado: la línea del stack, las rutas de archivo que
  cambiaron de nombre, el párrafo de las páginas de bloques --que ya no
  existen-- y dos convenciones nuevas: las runas y los módulos `.svelte.ts`
  frente al contexto, y los dos formateadores. El `README.md` no nombraba a
  React en ningún sitio: no hubo nada que cambiar.
- `openspec/specs/` no menciona React en ningún requisito. Sí lo hacen los
  cambios ya archivados, que son actas de lo que se decidió entonces y se
  dejan como están.
- Los comentarios que quedan nombrando a React en `web/src` son deliberados:
  explican por qué una pieza es como es --`HtmlFrame`, `CodeEditor`,
  `pagePicker`, `frameThrottle`-- y se quedan mientras esa explicación sirva.

## Traducciones mecánicas

Referencia rápida para no decidir dos veces lo mismo.

| React | Svelte 5 |
|---|---|
| `useState` (288) | `$state` |
| `useMemo` (44) | `$derived` — la mayoría se pueden borrar |
| `useCallback` (42) | Borrar: no hay re-render que evitar |
| `useEffect` (101) | `$effect` — **leer la advertencia de abajo** |
| `useLayoutEffect` (6) | `$effect.pre`, o `await tick()` |
| `useRef` a un nodo | `bind:this` |
| `useRef` como caja mutable | Una variable normal |
| `useSyncExternalStore` (5) | Un store; es literalmente para esto |
| `createContext` / `useContext` (10) | `setContext` / `getContext` |
| `createPortal` (5) | `use:portal` |
| `children` | `{@render children()}` |
| `className` | `class` |
| `onClick` | `onclick` |
| `key` en listas | `{#each items as item (item.id)}` |

**La advertencia sobre los efectos.** `$effect` rastrea sus dependencias
automáticamente, leyendo lo que se lee dentro. No hay array. Traducir un
`useEffect` con dependencias explícitas a un `$effect` palabra por palabra
produce efectos que se reejecutan de más, porque acaban rastreando cosas que el
array excluía a propósito. Con 101 efectos, esta es la fuente número uno de
bugs sutiles de toda la migración.

Regla para el equipo: ante cada efecto, preguntarse primero si es un
`$derived`. La mayoría de los `useEffect` que solo calculan lo son. Los que
quedan (suscripciones, temporizadores, DOM imperativo) se escriben mirando qué
se lee dentro, no qué decía el array.

## Riesgos

**No hay pruebas de UI.** No existe framework de tests unitarios (`AGENTS.md`).
Se reescriben 17.698 líneas de interfaz con `typecheck` y el smoke como única
verificación automática. Es el riesgo dominante, por encima de cualquier detalle
de Svelte. Mitigación: fases cortas, smoke al final de cada una, y una lista de
comprobación manual por ruta escrita **antes** de migrarla, mirando el
componente React que todavía funciona.

**La rama se separa de `main`.** Rebasear al cerrar cada fase.

**Regresiones silenciosas en el iframe.** Cubierto en la Fase 5.

**Formateo del marcado.** Cubierto en la Fase 1; si se deja para el final,
aparece un diff enorme de formato encima del diff de la migración.

## Estimación

Supuesto, no medida: no hay forma de saberlo sin hacer la primera fase. Como
orden de magnitud, con una persona a tiempo completo y contando la verificación
manual, el peso relativo se reparte así:

| Fase | Peso |
|---|---|
| 0 — Refactores previos | 3% |
| 1 — Infraestructura | 8% |
| 2 — Base compartida | 18% |
| 3 — Rutas ligeras | 8% |
| 4 — Cascarón del Builder | 10% |
| 5 — Páginas y HTML | 15% |
| 6 — Rejilla de datos | 25% |
| 7 — IA | 10% |
| 8 — Cierre | 3% |

La Fase 1 es el mejor termómetro: al terminarla se sabe cuánto cuesta de verdad
un archivo, y con eso ya se puede fechar el resto.
