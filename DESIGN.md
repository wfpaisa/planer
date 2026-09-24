---
name: Planer
description: Plataforma no-code para crear aplicaciones web pequeñas y sus bases de datos, con IA.
colors:
  accent: "oklch(60% 0.3 256)"
  accent-hover: "oklch(66% 0.3 256)"
  accent-text: "oklch(1 0 0)"
  accent-soft: "oklch(0.938 0.025 271.1)"
  accent-soft-text: "oklch(20% 0.3 256)"
  canvas: "oklch(1 0 0)"
  surface: "oklch(1 0 0)"
  field: "oklch(0.99 0 0)"
  hover: "oklch(0.955 0 0)"
  ink: "oklch(0.2 0 286)"
  ink-soft: "oklch(0.413 0 0)"
  ink-muted: "oklch(0.53 0 0)"
  line: "oklch(0.919 0 0)"
  line-strong: "oklch(0.855 0 0)"
  canvas-dark: "oklch(0.15 0 0)"
  surface-dark: "oklch(0.2 0 0)"
  float-dark: "oklch(0.245 0 0)"
  field-dark: "oklch(0.12 0 0 / 0.5)"
  ink-dark: "oklch(0.961 0 0)"
  ink-soft-dark: "oklch(0.741 0 0)"
  ink-muted-dark: "oklch(0.64 0 0)"
  line-dark: "oklch(0.28 0 0)"
  line-float-dark: "oklch(0.36 0 0)"
  success: "oklch(0.622 0.133 162.3)"
  success-bg: "oklch(0.96 0.018 166.4)"
  warning: "oklch(66% 0.14 65)"
  warning-bg: "oklch(0.95 0.035 80)"
  danger: "oklch(0.569 0.207 21.8)"
  danger-bg: "oklch(0.936 0.026 11.9)"
typography:
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 300
    lineHeight: 1.5
  control:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
  mono:
    fontFamily: "Reddit Mono, monospace"
rounded:
  sm: "0.5rem"
  md: "0.6875rem"
  lg: "1rem"
  xl: "1.25rem"
  pill: "62.5rem"
spacing:
  sp-4: "0.25rem"
  sp-8: "0.5rem"
  sp-12: "0.75rem"
  sp-14: "0.875rem"
  sp-16: "1rem"
  sp-18: "1.125rem"
  sp-20: "1.25rem"
  sp-24: "1.5rem"
  sp-28: "1.75rem"
  sp-40: "2.5rem"
components:
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.875rem"
    height: "2.375rem"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.875rem"
    height: "2.375rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-text}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "2.375rem"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.accent-text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "2.375rem"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2.375rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.lg}"
    padding: "1.125rem 1.25rem"
  tag:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.5625rem"
  menu:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.3125rem"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    width: "26.25rem"
---

# Design System: Planer

## Overview

**Creative North Star: "El Banco de Trabajo"**

Planer es un banco de trabajo: una mesa ordenada, de grises exactos, donde lo único que tiene color es lo que se está construyendo. El panel no compite con la aplicación que arma el usuario; le pone luz encima. Por eso la casa habla en tres grises de tinta, tres planos de superficie y dos grosores de línea, y deja un solo acento por contexto: el azul del panel, o la paleta de la aplicación que se está editando, que pisa ese azul sin tocar un solo componente.

La densidad es de herramienta, no de revista. El tamaño de trabajo es 0.875rem, los controles miden 2.375rem de alto y el cuerpo va en Inter ligera (300), así que la jerarquía la ganan el peso (600 en los controles, 700–800 en los títulos) y la tinta, no el tamaño. La interfaz está entera en español y el sistema está escrito a mano, sin framework de utilidades ni librería de componentes: siete hojas en `web/src/styles/` (`theme.css`, `palettes.css`, `components.css`, `layout.css`, `compat.css`, `contract.css`, `global.css`) y una octava, `page.css`, que sólo viaja a las páginas publicadas.

Las mismas hojas visten el panel y lo que se publica (`/plane/estilos.css`, que arma `server/page/pageStyles.ts`), así que `.btn`, `.card`, `.field` o `.table` son la misma pieza en los dos lados. Lo que la IA escribe en una página lo revisa `server/html/htmlAudit.ts`, y `bun run harness` comprueba que las hojas, el contrato del HTML (`shared/htmlContract.ts`) y esa auditoría digan lo mismo.

**Key Characteristics:**
- Un acento por contexto; todo lo demás es gris y línea.
- Modo (claro/oscuro) lo elige quien mira, con `data-theme`; el color lo elige quien construye, con `data-palette`. Los dos van en el mismo elemento.
- Plano en reposo: el hover es un relleno, las sombras sólo levantan lo que flota.
- Todo en `rem`: mover el tamaño de letra de la raíz (o el `--font-scale` de una app) reescala cajas y texto a la vez.
- Navegador moderno obligatorio: `oklch()`, `light-dark()`, `oklch(from …)`, `:has()`, CSS anidado, `popover`, `@starting-style`, `anchor-name`.

## Colors

Un azul eléctrico sobre grises neutros sin matiz; el color es reconfigurable y la fuente de verdad está en OKLCH.

`theme.css` declara los tokens por defecto (claro en `:root` y en `[data-theme="light"]`, oscuro en `[data-theme="dark"]`). `palettes.css` sólo los pisa cuando un elemento lleva `data-palette`: una paleta son cuatro colores crudos (`--palette-1…4`) y de ellos se deriva, en un único bloque con `light-dark()`, `color-mix()` y `oklch(from …)`, todo lo demás: acento, hover, suave, anillo de foco, series de gráficas. La tinta sobre un acento lleno la decide un interruptor de luminosidad, no JavaScript. Hay 46 paletas en tres grupos (vivas, pasteles, monocromas) más `custom`, la única en la que viaja un hex (`--palette-1` en línea).

### Primary
- **Azul Banco** (`accent`): el único color de la casa. El botón principal, el enlace, la selección, el foco. En oscuro es el mismo azul; lo que cambia en oscuro es el hover (un punto más claro) y el suave (`accent-soft`, un fondo índigo profundo).
- **Azul Banco Suave** (`accent-soft` / `accent-soft-text`): el fondo tenue del ítem activo y de lo seleccionado, con su tinta oscura para que se lea.

### Neutral
- **Lienzo** (`canvas`, `--bg-level1`): lo que se ve entre tarjetas.
- **Superficie** (`surface`, `--bg-level2`): lo que se levanta del lienzo: tarjeta sólida, modal, menú, botón.
- **Hundido** (`field`, `--bg-field`): dentro de una superficie: campos, cabecera de tabla, pista de un control. En oscuro es translúcido.
- **Bajo el Cursor** (`hover`, `--bg-hover`): la fila o la celda señalada, un punto por encima del hundido.
- **Flotante** (`float-dark`, `--bg-float`): lo que se abre tapando lo de debajo (menú, lista de un select). En claro es el mismo blanco; en oscuro sube un punto para no fundirse con la tarjeta.
- **Tinta, Tinta Suave, Tinta Tenue** (`ink`, `ink-soft`, `ink-muted`): lo que se lee primero; el texto corrido y las etiquetas; notas, marcadores de posición y metadatos.
- **Línea y Línea Fuerte** (`line`, `line-strong`): separar lo que reposa; la fuerte, para el hover de un borde y lo que flota (`--border-float`).

### Named Rules
**La Regla del Mismo Elemento.** `data-theme` y `data-palette` van en el *mismo* elemento cuando ese elemento es la app: `light-dark()` lee el `color-scheme` de donde se declara, así que una paleta en un ancestro del tema no colorea nada. Un contenedor que cambia de tema recibe su propio fondo; el `color` lo repone `theme.css`, el fondo no.

**La Regla de los Tres Tonos de Tinta.** `--text-primary`, `--text-secondary`, `--text-muted`. Nunca un cuarto gris. `--text-muted` es el suelo y pasa 4.5:1 sobre lienzo, superficie, hundido y fila bajo el cursor en los dos modos; lo que "casi no se lee" no existe (el antiguo `--text-subtle` se quitó por eso).

**La Regla del Token, Nunca el Literal.** Ningún componente escribe un color. Si hace falta uno, existe un token o se crea en `theme.css`.

**La Regla del Color que Significa.** Los diez tintes de etiqueta (`.tint-1…10`, repartidos por `colorFor()` a partir del texto) y los doce vivos (`--vivid-*` con su `-ink`) son para lo que *significa* un color: una categoría, un estado, una leyenda. Nunca pintan cromo: ni fondos, ni texto corrido, ni bordes, ni botones.

## Typography

**Body Font:** Inter (variable, 100–900, autoalojada en `web/public/fuentes/`; con `system-ui, -apple-system, sans-serif` de respaldo)
**Mono Font:** Reddit Mono (variable, autoalojada igual; código, identificadores, valores técnicos)

Las dos se sirven desde el propio servidor, nunca desde Google Fonts: el panel las lee de `/fuentes/fuentes.css`, y el marco de una página —que no tiene origen propio— las recibe por mensaje y las registra con `FontFace` (`web/src/lib/planeAssets.ts`). Así el panel y lo publicado son la misma letra.

**Character:** una sola sans neutra y precisa para todo. El cuerpo va ligero (300) para que los controles (600) y los títulos (700–800) se despeguen sin subir de tamaño. Nunca una segunda familia de texto.

### Hierarchy
- **Headline** (700, 1.5rem, `--text-2xl`): el título de una pantalla y los encabezados grandes de una página publicada.
- **Title** (700–800, 1.25rem, `--text-xl`, −0.01em a −0.02em): el titular de un bloque destacado y la cifra de un indicador.
- **Subtitle** (700, 1.125rem, `--text-md`): el título de una tarjeta; el de un modal sube a 800.
- **Body** (300, 0.875rem, 1.5, `--text-sm`): el tamaño de trabajo: celdas, menús, texto de tarjeta (con interlínea 1.55).
- **Control** (600, 0.875rem): botones, pestañas, lo que se pulsa.
- **Label** (600–700, 0.75rem, `--text-xs`): etiquetas de campo, pastillas, metadatos; en mayúsculas sólo las cabeceras de tabla.

### Named Rules
**La Regla de la Escala Corta.** El texto toma un paso de `--text-xs … --text-3xl`, nunca una medida intermedia. (`--text-md` y `--text-lg` valen lo mismo, 1.125rem, porque el contrato de las páginas los documenta así.)

**La Regla del Peso, No del Tamaño.** Para destacar algo en una pantalla de trabajo se sube el peso o la tinta antes que el tamaño.

## Layout

El modelo espacial es el del banco: columna flexible a toda altura, con barra superior pegajosa, barra lateral y superficie de edición. Las utilidades viven en `layout.css` (`flex`, `grid`, `gap-*`, `items-*`…) y se indexan en cuartos de rem multiplicados por `--spacing` (0.25rem). Los rellenos de los componentes usan los pasos `--sp-*` (de 4 a 40 px) y las rejillas de tarjetas `--card-gap` (1rem). `.container` limita el contenido a 90rem. El único punto de corte de las utilidades es `md` (48rem); los componentes que lo necesitan se reordenan con sus propias consultas (38.75rem, 30rem). El desplazamiento horizontal vive dentro de `.table-wrap`, nunca en la página.

Las capas siguen una escala de cinco peldaños (`global.css`): 10 cromo pegajoso y menús, 20 modales y velos, 30 el cajón de fila, 40 avisos, 50 globos de ayuda. Lo que es `popover` o `<dialog>` va en la capa superior del navegador y no entra en la escala.

## Elevation & Depth

Plano por defecto y con capas por tono: el lienzo, la superficie y lo hundido se distinguen por su gris, y las líneas separan lo que reposa. Las sombras son casi imperceptibles (5 % de negro) y sólo crecen para lo que flota o tapa. El botón principal y el de peligro llevan un halo de su propio color en vez de un desenfoque gris.

### Shadow Vocabulary
- **Apenas** (`--shadow-sm`, `0 2px 4px oklch(0 0 0 / 0.05)`): botones que se despegan un pelo.
- **Reposo** (`--shadow-md`, `0 4px 8px oklch(0 0 0 / 0.05)`): lo que se posa sobre el lienzo.
- **Flota** (`--shadow-lg`, `0 8px 16px oklch(0 0 0 / 0.05)`): modal, cajón, aviso.
- **Tapa** (`--shadow-xl`, dos capas, 8 % y 18 %): menú y lista de un select, lo que se abre encima del contenido; va con `--bg-float` y `--border-float`.
- **Halo** (`0 0.5rem 1.25rem -0.625rem <color>`): el botón principal (acento) y el de peligro (rojo).
- **Anillo de foco** (`0 0 0 0.1875rem var(--focus-ring)`): todo lo que recibe foco.

### Named Rules
**La Regla Plana por Defecto.** El hover es un relleno (`oklch(from var(--text-primary) l c h / 6%)`), no una sombra. Las sombras levantan lo que flota; las líneas separan lo que reposa.

## Shapes

Esquinas suaves y consistentes, escaladas por `--radius-scale`: 0.5rem para lo interior (ítems de menú, cajas pequeñas), 0.6875rem para lo que se pulsa o se escribe (botones, campos, menús), 1rem para tarjetas y cajones, 1.25rem para el modal. La píldora (62.5rem) es para etiquetas, interruptores y botones redondos. Los bordes son de un pixel (`--border-width`); las etiquetas y los tintes dibujan su contorno con una sombra interior para no cambiar de tamaño al encenderse.

## Components

El catálogo es `components.css`; las recetas de marcado están en `.claude/skills/plane-ui/references/componentes.md` y el kit Svelte (`web/src/components/ui/`) envuelve cada pieza. `/demo` muestra todos los estados de todas las piezas en una sola página: es donde se mira después de tocar el catálogo.

### Buttons
- **Shape:** esquinas de control (0.6875rem), 2.375rem de alto, texto 600.
- **Default** (`.btn`): superficie apenas teñida hacia la tinta, línea fina, `--shadow-sm`. Es la mayoría.
- **Primary** (`.btn-primary`): el acento lleno con su halo; hover al `accent-hover`. Uno por vista. Deshabilitado deja de ser acento: fondo hundido, tinta tenue, sin halo.
- **Ghost** (`.btn-ghost`): sin relleno ni línea, tinta suave; el hover es lo único que lo dibuja.
- **Danger** (`.btn-danger`): rojo lleno con halo rojo, nunca la primaria. `.btn-ghost.btn-danger` es el destructivo discreto.
- **Warning** (`.btn-warning`): sin relleno, ámbar en la letra y el borde: algo quedó a medias, no es un error.
- **Icono** (`.btn-icon`, 2.375rem cuadrado; `.sm` 2rem) y `.mini-btn` (1.75rem) dentro de filas. Los modificadores van después de la clase base: ganan por orden, no por especificidad.
- **Hover / Focus:** relleno al 6 % de la tinta y borde fuerte; anillo de foco de 0.1875rem. Deshabilitado: 50 % de opacidad (el principal, como se dice arriba).
- **Nombre:** un botón de solo icono (`.btn-icon`) toma su `tip` como `aria-label` en `ui/Button`; nunca queda un botón sin nombre.

### Inputs / Fields
- **Style:** hundidos (`--bg-field`), línea fina, esquinas de control, 2.375rem. Dentro de `.field` el campo los viste; sueltos (buscador, celda) llevan `.field-control`, escrito junto a `.field` para que no diverjan.
- **Focus:** borde de acento y anillo de foco. **Error:** anillo rojo al 28 %.
- Casillas, radios e interruptores son `<label class="choice">`; `.choice.switch` convierte la etiqueta en interruptor.

### Cards / Containers
- **Corner Style:** 1rem. **Border:** línea fina. **Background:** `--bg-card`, que en oscuro es translúcido (lo que quiere una página publicada); en el panel, `.card-solid` la vuelve opaca.
- **Internal Padding:** cabecera 1.125rem × 1.25rem, cuerpo 0.875rem × 1.25rem; el pie empuja sus acciones a la derecha y se ancla abajo, así que las tarjetas hermanas se alinean. En ajustes, toda acción —Guardar sobre todo— vive en el pie.

### Chips
- **Etiquetas** (`.tag`): píldora, 0.75rem, 700. El color es siempre una clase: `.tint-1` la normal, `.tint-2…10` para repartir categorías, `.tag-success` / `.tag-warning` / `.tag-error` para lo que significa algo. Sin clase de color es el estado apagado (sólo el anillo). En el panel no se escriben a mano: las emite `ui/Tag.svelte`.
- **Pestañas y segmentos** (`.chips`): una píldora que se desliza, dibujada por `::before`; máximo seis opciones.

### Navigation
- Menús (`.menu[popover]`, anclados con `anchor-name`): superficie flotante, ítems planos con relleno al pasar, `.danger` en rojo, `.menu-sep` entre grupos. Modal, cajón y aviso también son `popover`: el navegador resuelve capa, Esc y velo. El modal mide 26.25rem por defecto (`--modal-w`) con cabecera, cuerpo desplazable y pie.

### Ficha de aplicación
El tablero (`routes/Home.svelte`) es donde la regla del Banco de Trabajo se ve entera: el panel en grises y cada ficha con la paleta de **su** aplicación (`paletteAttrs()` en la propia ficha, sin `data-theme`, así que el modo lo pone quien mira). Arriba, una portada de 4.5rem en `--accent-soft` de esa paleta, con el icono relleno del acento (con su halo) centrado dentro de ella y los cuatro colores crudos de la paleta como muestra; sin paleta propia, caen el acento y las series del tema. Debajo, el nombre a 1.125rem/700. Al pasar, el borde toma el acento de la app y la portada se aviva. Es la única pantalla del panel donde el color ocupa una región: lo justifica que ese color es de lo construido, no de la casa.

### Table
La rejilla es la pieza firma del banco: `.table` dentro de `.table-wrap`, cabeceras en mayúsculas pequeñas sobre fondo hundido, fila con `--bg-hover` al pasar. El conteo y el paginador (`.table-foot`) van **dentro de `<tfoot>`**, en una celda que abarca todas las columnas.

## Do's and Don'ts

### Do:
- **Do** pon `data-theme` y `data-palette` en el mismo elemento cuando ese elemento es la app, y dale fondo propio a todo contenedor que cambie de tema.
- **Do** escribe cada color como token nativo (`--bg-level2`, `--text-primary`, `--accent`); lo propio de un componente va en su `<style>`.
- **Do** pon la clase semántica primero en `class` (`btn-open-people`, `modal-new-app`) y después las del sistema.
- **Do** usa los tintes para etiquetas y avatares: están medidos a 4.5:1 en los dos modos.
- **Do** corre `bun run harness` después de tocar las hojas, `shared/htmlContract.ts` o la auditoría, y reinicia el servidor: las hojas se leen al arrancar.

### Don't:
- **Don't** uses clases de Tailwind ni de daisyUI: ya no existen en el repositorio.
- **Don't** pintes una etiqueta con un estilo en línea ni con una clase propia.
- **Don't** nombres selectores de paleta o de tinte con coincidencias de atributo (`[class*="tint-"]`); enuméralos.
- **Don't** dejes un `--palette-1` en línea al salir de `custom`: en línea le gana a cualquier `[data-palette]`.
- **Don't** uses los vivos ni los tintes para fondos, texto corrido, bordes o botones.
- **Don't** pongas más de un botón principal por vista.
