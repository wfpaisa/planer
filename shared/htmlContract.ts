/**
 * El texto que describe como se escribe el HTML de una pantalla de Planer.
 *
 * Una sola fuente con dos salidas: `buildHtmlContract`, el contexto que
 * recibe la inteligencia artificial en cada petición, y `buildHtmlDocs`, la
 * sección del README que lee el constructor. Si se escribiera dos veces,
 * tarde o temprano una de las dos se quedaria vieja.
 *
 * Va en ingles porque es una instruccion para el modelo, como todo lo que se
 * le pasa (ver `server/ai/aiPage/prompts.ts`). Lo que el modelo *escribe* --el texto de
 * la pantalla y su respuesta en el chat-- sigue siendo espanol, y eso se le
 * dice de forma expresa en `LANGUAGE_SECTION`.
 */
import { LINK_SUFFIX, MAX_LIST_ROWS } from "./htmlSources.ts";
import {
  ADMIN_ROLE,
  PEOPLE_NAME_FIELD,
  peopleTableOf,
  personDisplayName,
  storedFields,
} from "./people.ts";
import {
  type AppPerson,
  displayFieldOf,
  type FieldDef,
  isRelationField,
  type TableRecord,
} from "./types.ts";

/** Como se llama cada tipo de columna en el texto que lee la IA. */
const TYPE_NAMES: Record<FieldDef["type"], string> = {
  text: "short text",
  longtext: "long text",
  number: "number",
  bool: "yes/no",
  email: "email",
  url: "web address",
  date: "date (yyyy-mm-dd)",
  select: "option list",
  file: "file",
  relation: "link to another table",
};

/**
 * De donde cuelgan los tres archivos que Planer pone en cada página.
 *
 * Viven aquí, y no en `server/page/pageAssets.ts`, porque los nombran tres sitios
 * que no pueden quedarse distintos: el texto que lee la IA, quien los sirve, y
 * el panel, que los incrusta en el documento antes de meterlo en el marco (ver
 * `web/src/lib/planeAssets.ts`).
 */
export const STYLES_PATH = "/plane/estilos.css";
export const BRIDGE_PATH = "/plane/puente.js";
export const CHARTS_PATH = "/plane/graficas.js";

/**
 * Los doce colores vivos, en el orden en que se reparten.
 *
 * Aquí solo estan los nombres: el color de cada uno --y la tinta que se lee
 * encima-- vive en `web/src/styles/global.css`, que es donde el panel lo
 * calcula y desde donde viaja al documento. Esta lista nombra las variables
 * que se mandan y escribe la línea que la IA lee, para que no puedan quedarse
 * distintas.
 */
export const VIVID_NAMES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

/** Cada color vivo y su tinta, con el nombre que llevan en el documento. */
export const VIVID_VARS: readonly string[] = VIVID_NAMES.flatMap((name) => [
  `--vivid-${name}`,
  `--vivid-${name}-ink`,
]);

/** Las variables de color que el documento recibe siempre. */
export const THEME_VARS: readonly string[] = [
  "--surface-card",
  "--surface-page",
  "--surface-soft",
  "--surface-hover",
  "--line",
  "--line-strong",
  "--ink",
  "--ink-soft",
  "--ink-faint",
  "--color-primary",
  "--color-primary-content",
  "--color-primary-text",
  "--color-secondary",
  "--color-secondary-content",
  "--color-secondary-text",
  "--color-accent-50",
  "--color-accent-100",
  "--color-accent-200",
  "--color-accent-300",
  "--color-accent-400",
  "--color-accent-500",
  "--color-accent-600",
  "--color-accent-700",
  "--color-accent-800",
  "--color-accent-900",
  "--color-accent-950",
  "--color-accent-ink",
  ...VIVID_VARS,
];

/** Las separaciones, los radios y la sombra, que viajan con los colores. */
export const SPACE_VARS = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--space-8",
  "--space-10",
  "--space-12",
  "--radius-card",
  "--shadow-card",
] as const;

/** La tipografia y los tamanos de texto. */
export const TEXT_VARS = [
  "--font-sans",
  "--type-xs",
  "--type-sm",
  "--type-base",
  "--type-lg",
  "--type-xl",
  "--type-2xl",
  "--type-3xl",
] as const;

/** Para que sirve cada medida, tal como se le explica a quien escribe el HTML. */
const MEASURE_USES: Record<string, string> = {
  "--space-1": "smallest gap (4px): between an icon and its label",
  "--space-2": "small gap (8px): between the fields of a form",
  "--space-3": "medium gap (12px): padding of a button or a cell",
  "--space-4": "normal gap (16px): padding of a card",
  "--space-5": "comfortable gap (20px): padding of a roomy card",
  "--space-6": "wide gap (24px): between blocks of one section",
  "--space-8": "large gap (32px): screen margins",
  "--space-10": "larger gap (40px): between separate sections",
  "--space-12": "largest gap (48px): air around the header",
  "--radius-card": "rounded corners of cards, fields and buttons",
  "--shadow-card": "the house shadow: low and short, barely lifting a card",
  "--font-sans": "the platform typeface",
  "--type-xs": "very small text: footnotes and uppercase labels",
  "--type-sm": "small text: secondary copy and tables",
  "--type-base": "body text",
  "--type-lg": "emphasised text",
  "--type-xl": "section title",
  "--type-2xl": "screen title",
  "--type-3xl": "large figure: the number of a metric",
};

/* ------------------------------------------------------------------ */
/* Las secciones                                                        */
/* ------------------------------------------------------------------ */

/**
 * En que idioma se escribe cada cosa.
 *
 * Las instrucciones van en ingles y la aplicación es en espanol, así que hay
 * que decir donde esta la frontera. Sin esto sale una pantalla con los
 * titulos en ingles, que es exactamente lo que nadie pidio.
 */
const LANGUAGE_SECTION = `## Language

These instructions are written in English. **Everything you produce is written in Spanish**, with proper accents and ñ:

- Every word the viewer reads on the screen: titles, labels, buttons, empty states, error messages, chart labels.
- The CSS class names and the \`data-plane\` block names, as the rest of this document shows (\`cabecera\`, \`lista-clientes\`, \`tarjeta-total\`).
- Your closing message to the builder, who writes to you in Spanish.

Only the code itself stays as it is: the \`window.plane\` API, HTML attributes and CSS properties.`;

function colorSection(): string {
  return `## Colours

**Most of the time you do not write a colour at all**: the catalogue pieces already carry the app's, and they follow it when it changes. What follows is for your own CSS --the layout of this screen, a piece that only exists here.

Never hard-code a colour. Use these variables, which the platform puts in the document and updates on its own when the app's brand colour changes:

| Variable | What it is for |
|---|---|
| \`--surface-page\` | the screen background |
| \`--surface-card\` | the background of a card or panel |
| \`--surface-soft\` | the background of a table header |
| \`--surface-hover\` | the background under the pointer |
| \`--line\` / \`--line-strong\` | borders and separators |
| \`--ink\` | primary text |
| \`--ink-soft\` | secondary text |
| \`--ink-faint\` | very faint text |
| \`--color-primary\` | the brand's base colour, exactly as it was chosen: to **fill** with |
| \`--color-primary-content\` | the text that sits **on top of** \`--color-primary\` |
| \`--color-primary-text\` | the brand colour **as letters** on a surface: a title, an icon, a figure |
| \`--color-secondary\` | the components' colour: the **fill** of a button, of what gets clicked |
| \`--color-secondary-content\` | the text that sits **on top of** \`--color-secondary\` |
| \`--color-secondary-text\` | the components' colour **as letters**: a link |
| \`--color-accent-50\` to \`--color-accent-950\` | the brand colour as a scale, faintest to darkest |
| \`--color-accent-ink\` | text sitting on top of the solid brand colour (\`--color-accent-500\`) |

Write them like this: \`background: var(--surface-card);\`

The document fills the whole screen: \`var(--surface-page)\` as the \`body\` background, \`var(--surface-card)\` for what you draw on top of it.

How they divide up the work:

- **A brand colour fills or it letters, and each job has its own variable.** To fill --a band, a button, a pill, a chip, a bar-- it is \`--color-primary\` / \`--color-secondary\`: the company's hexadecimal, untouched, which may be as light as a yellow or as dark as a navy. To be read as letters over a surface --a title, a link, an icon, a figure-- it is \`--color-primary-text\` / \`--color-secondary-text\`: the same hue, already taken to a lightness that contrasts against the paper. Lettering with the fill variable is the one mistake that ruins a page: a brand-yellow title on a white card cannot be read.
- **Every solid fill carries the ink that belongs to it.** \`background: var(--color-primary)\` always with \`color: var(--color-primary-content)\`, \`background: var(--color-secondary)\` always with \`color: var(--color-secondary-content)\`. Those inks are worked out from the colour itself --white over a dark brand, black over a light one-- and they flip on their own the day the company changes its colour. So never write \`color: #fff\` or \`color: white\` over a brand fill, and never assume the brand is dark.
- **\`--color-primary\` identifies, \`--color-secondary\` acts.** The first says whose screen this is; the second is what gets clicked. A "Save" button painted with the first says the wrong thing.
- **The screen has to look like the company's.** A page in plain greys with one coloured button looks like nobody's. Give the brand, at least: the top of the screen --the title in \`--color-primary-text\`, or a hero band in \`--color-primary\` with \`--color-primary-content\` over it--, the icon of each section, the figure that matters in a totals card, the active item of a menu or a set of tabs, the initials pill of a person, and the screen's main action in \`--color-secondary\`.
- **And it still has to breathe.** Two or three brand-filled areas per screen is presence; six is noise, and a screen where everything is branded emphasises nothing. For a wide area the soft version reads better than the solid one: \`background: color-mix(in oklab, var(--color-primary) 12%, var(--surface-card)); color: var(--ink);\`, with \`border: 1px solid color-mix(in oklab, var(--color-primary) 30%, transparent);\` if it needs a rim.
- **The scale is for fills and tints, not for letters.** \`50\` to \`200\` are faint backgrounds (a pill, a highlighted row); \`500\` is the solid colour and needs \`--color-accent-ink\` on top; \`600\` to \`900\` are for rims and deep fills. Brand-coloured text is \`--color-primary-text\`, which is the only one that guarantees it can be read in both modes.
- **Everything else is ink on a surface.** Body text, table rows, card backgrounds and borders come from \`--ink\`, \`--ink-soft\`, \`--ink-faint\`, \`--surface-*\` and \`--line\`. Hierarchy comes from those, not from handing out colours.
- **A colour you invent, you also have to be able to read.** If a fill is yours --a team's colour, a state you made up-- decide the text on top of it yourself and check it holds: light text over a dark fill, dark text over a light one. Never leave the inherited colour running over a fill.
- **A state is not the brand colour.** If one row is fine and another is not, that is not the accent scale to spend: the colours that mean something are the vivid palette below, and whatever means nothing stays in \`--ink-faint\` on \`--surface-soft\`.
- **Transparency with \`color-mix\`**, never with an invented \`rgba\`: \`color-mix(in oklab, var(--ink) 8%, transparent)\`.

Light or dark mode arrives in the \`data-plane-tema\` attribute on the root element, valued \`light\` or \`dark\`. The colours already come resolved for the mode being viewed; the attribute is only needed for what changes shape rather than colour:

\`\`\`css
[data-plane-tema="dark"] .mi-caja { box-shadow: none; }
\`\`\`

### The vivid palette

Twelve colours that are neither the theme nor the brand, and reach the document the same way. They exist for what **means** a colour: the categories of a list, the state of an order, the days of a calendar, a legend, a tag, a drawing. The brand scale cannot do that job --it is all one hue, so four categories painted with it come out as a gradient, not as four things.

Each one is \`--vivid-<name>\`, and the text that goes on top of it is \`--vivid-<name>-ink\`. The names:

${VIVID_NAMES.map((name) => `\`${name}\``).join(" ")}

\`\`\`css
.etiqueta-pagado {
  background: var(--vivid-green);
  color: var(--vivid-green-ink);
}
\`\`\`

- **When something deserves colour, give it a real one.** These are saturated on purpose. Do not water one down into a grey-blue of your own, and never write a hex: if what you need is a colour that means something, it is one of these twelve.
- **Every solid fill carries its own ink.** \`--vivid-amber\` with white text on top is unreadable; \`--vivid-amber-ink\` is not. Do not guess it, do not reuse another colour's.
- **They fill, they are not letters.** A pill, a chip, a dot, a bar, a band, the background of a cell. A vivid colour as body text over a surface does not have the contrast to be read.
- **The soft version is mixed, not invented**: \`background: color-mix(in oklab, var(--vivid-teal) 14%, var(--surface-card)); color: var(--ink);\`, and the rim, if you want one, \`border: 1px solid color-mix(in oklab, var(--vivid-teal) 35%, transparent);\`.
- **The colour belongs to the thing, not to its position.** The same category is the same colour all over the screen: assign colours by the fixed order of the list, never by the position a row happens to occupy after a filter.
- **They already work in both modes.** Do not lighten or darken them for dark mode, and do not swap them with \`data-plane-tema\`: they arrive resolved.
- **They do not replace the theme.** Surfaces, text, borders, buttons and links keep coming from the table above. A screen whose panels are lime is not a colourful screen, it is a broken one: the palette colours what a screen *says*, and the theme colours the screen.
- **Green, amber and red already mean something** --fine, careful, wrong. Do not spend them on a category that means none of that. And the colour is never the only way to read something: next to it there is always a word.
- **Chart series do not come from here.** Those are \`plane.colores\`, which is a different thing and is explained further down.

If a piece of data carries a real-world colour of its own --a team's colour, the colour a product is sold in-- then do define it separately in your \`:root\`, under its own name, and use it only for that.`;
}

/**
 * El catálogo de componentes.
 *
 * Es la sección que mas cambia el resultado. Antes de existir, cada página se
 * escribia su propio botón, su propia tarjeta y su propia tabla desde cero: la
 * pantalla salia razonable y no se parecia del todo a ninguna otra, porque
 * nadie escribe dos veces el mismo `border-radius`. Ahora la pieza ya esta
 * hecha --es la MISMA hoja que viste el panel, servida en `/plane/estilos.css`,
 * ver `server/page/pageStyles.ts`-- y lo que se le pide al modelo es que la use.
 *
 * El orden de dentro no es alfabetico: primero lo que sale en toda pantalla.
 */
function catalogSection(): string {
  return `## The catalogue of components

**The page loads the platform's stylesheet.** It is the same one the panel is built with, so every piece below is already drawn, in both modes and in the app's palette, before you write a line of CSS.

This changes how you work. You do not describe what a button looks like: you write \`class="btn"\`. Your own CSS is for what the catalogue does not have --the layout of this screen, its grid, a piece that only exists here-- and it is written last, not first.

Three rules for using it:

1. **The modifier goes after the base class**, in that order: \`class="btn btn-primary"\`, never the other way round. They have the same weight and the one that wins is the one written last in the stylesheet.
2. **A class of your own goes first and is descriptive**: \`class="lista-pedidos table"\`, \`class="tarjeta-total card"\`. That way the screen can be read, and your CSS has something to hook onto that is not a catalogue name.
3. **Do not redefine a catalogue class.** If \`.btn\` does not do what you need, put your own class beside it and change only what differs.

### Buttons

\`\`\`html
<button class="btn">Cancel</button>
<button class="btn btn-primary">Save</button>
<button class="btn btn-danger">Delete</button>
<button class="btn btn-ghost">Not now</button>
<button class="btn sm">Small</button>
<button class="btn-icon" aria-label="More"><i class="hgi-stroke hgi-more-horizontal"></i></button>
<button class="btn-icon sm btn-rounded" aria-label="Close"><i class="hgi-stroke hgi-cancel-01"></i></button>
<button class="btn btn-primary is-loading" disabled aria-busy="true">
  <i class="hgi-stroke hgi-loading-03"></i>Saving…
</button>
\`\`\`

\`.btn-primary\` is the screen's main action and there is **one per screen**. \`.btn\` on its own is everything else. \`.btn-danger\` destroys something. \`.btn-icon\` is a square button with only an icon and it always needs an \`aria-label\`.

### Card

\`\`\`html
<div class="card">
  <div class="card-head">
    <div>
      <h2 class="card-title">Open orders</h2>
      <p class="card-sub">Updated a minute ago</p>
    </div>
    <div class="card-head-actions"><button class="btn sm">Export</button></div>
  </div>
  <div class="card-body">…</div>
  <div class="card-foot"><button class="btn btn-primary">Save</button></div>
</div>
\`\`\`

The foot anchors itself to the bottom, so two cards side by side line their feet up on their own without matching heights by hand. Actions go in the foot; the head carries the title and, in \`card-head-actions\`, only what accompanies --a filter, a menu.

### Hero

The opening band of a screen: the app's brand colour filled solid, with the title, one line of explanation and the actions that start the task.

\`\`\`html
<section class="hero">
  <h1 class="hero-title">Chequeo preoperacional</h1>
  <p class="hero-sub">Revisa el vehículo antes de salir. Queda a tu nombre.</p>
  <div class="hero-actions">
    <button class="btn btn-primary"><i class="hgi-stroke hgi-add-01"></i>Registrar chequeo</button>
    <button class="btn">Ver los de hoy</button>
  </div>
</section>
\`\`\`

**Write no colour of your own inside it.** It is the one piece painted with the full brand fill, and it dresses what it carries: the text already comes in the ink that reads over that colour, \`.btn\` empties out to a bordered one in that same ink, and \`.btn-primary\` lifts off the band in the house's paper. Putting \`color\` on anything inside --a surface ink like \`--ink\` or \`--ink-soft\`, or the fill itself-- is what breaks it: those are the inks of the page, not of the band, and the band's colour changes with the palette and with the mode while they do not.

One hero per screen, at the top. For a section heading inside the page use a plain \`<h2>\`.

### Table

\`\`\`html
<div class="table-card card">
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Customer</th><th style="text-align: right">Total</th><th>State</th></tr></thead>
      <tbody>
        <tr>
          <td>Lucía Marín</td>
          <td class="number" style="text-align: right">184,20 €</td>
          <td><span class="tag tint-2">Paid</span></td>
        </tr>
      </tbody>
      <tfoot><tr><td colspan="3"><div class="table-foot"><span class="pg-info">248 orders</span></div></td></tr></tfoot>
    </table>
  </div>
</div>
\`\`\`

\`.table-wrap\` is what makes a wide table scroll on a narrow screen instead of pushing the layout out; do not leave it out. The footer --the count and the pager-- is \`.table-foot\` inside a \`<tfoot>\` cell that spans every column (\`colspan\`), never a \`<div>\` hanging outside the \`<table>\`. \`class="number"\` on a cell gives it \`tabular-nums\` and a monospaced figure, which is what numbers, amounts and dates need. It does not align anything by itself --there is no catalogue class that does--, so a numeric column is right-aligned with your own \`style="text-align: right"\` on both the \`<th>\` and its \`<td>\`s.

### Fields

\`\`\`html
<div class="field">
  <label for="correo">Customer email</label>
  <input type="email" id="correo" placeholder="nombre@empresa.com">
  <span class="field-hint">We will send the invoice here.</span>
</div>

<div class="field error">
  <label for="malo">Customer email</label>
  <input type="email" id="malo" aria-invalid="true" aria-describedby="malo-msg">
  <span class="field-hint" id="malo-msg">The domain after the @ is missing.</span>
</div>

<div class="field"><label for="estado">State</label>
  <select id="estado"><option>All</option><option>Paid</option></select>
</div>

<form class="field-stack">…fields one under another…</form>
<div class="field-row">…two fields side by side…</div>

<div class="join">
  <input type="search" placeholder="Customer or reference">
  <button class="btn btn-primary"><i class="hgi-stroke hgi-search-01"></i>Search</button>
</div>
\`\`\`

**Two fields in a row do not separate on their own, and nothing puts that space in for you.** A \`.field\` only spaces its own parts --label, control, hint--, so **every container holding more than one field carries \`.field-stack\`** (one under another) or \`.field-row\` (side by side). It is a class, not a tag: a \`<form>\`, a \`<section>\` or an intermediate \`<div>\` that groups fields all need it written out --\`<form class="field-stack">\`--, and so does the container you fill from JavaScript: \`<div id="ed-campos" class="field-stack"></div>\`, never a bare \`<div>\`. Write it even where it seems unnecessary: \`.modal-body\` happens to space the fields hanging directly off it, \`.card-body\` does not, and telling the two apart is not worth the mistake. A form whose fields come out glued together is a missing \`field-stack\`.

Inside a \`.field\` the control needs no class. **Loose** --a search box in a bar, a cell being edited-- it takes \`class="field-control"\`, which is the same dress on its own; add \`sm\` for the short size. A checkbox or a radio has its own markup:

\`\`\`html
<label class="choice">
  <input type="checkbox" checked>
  <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
  <span>Paid orders</span>
</label>
<label class="choice"><input type="radio" name="envio"><i class="choice-box round"></i><span>Standard</span></label>
<label class="choice switch"><input type="checkbox"><span>Weekly report</span></label>
\`\`\`

The tick needs **both** classes, \`hgi-stroke\` and \`hgi-tick-02\`: with only one of them the box comes out empty and nothing warns you.

### Tags, states and figures

\`\`\`html
<span class="tag tint-1">Category</span>
<span class="tag tag-success"><i class="hgi-stroke hgi-checkmark-circle-02"></i>Correct</span>
<span class="tag tag-warning">Warning</span>
<span class="tag tag-error">Error</span>
<span class="tag">Off</span>
<span class="avatar">LM</span>

<div class="stat">
  <span class="s-label">Net revenue</span>
  <span class="s-val number">184.320 €</span>
  <span class="s-foot">vs. 163.980 € the period before</span>
</div>
\`\`\`

A tag is always \`class="tag"\` plus **one** colour class, and never an inline style: writing \`style="background: …"\` or \`--tag\` on a tag is wrong, and so is a colour class of your own invention. \`tint-1\` is the normal one; \`tint-2\` to \`tint-10\` exist to tell several categories apart in the same list --ten fixed colours (blue, violet, plum, red, terracotta, amber, olive, green, turquoise, slate), the same in both modes and under any palette, all ten already contrasting. \`tag-success\` / \`tag-warning\` / \`tag-error\` are for what really does mean fine, careful or wrong.

The bare pill --\`class="tag"\` with no colour class-- is the **off** state, and that is the whole mechanism of a tag that switches: on is \`tag tint-1\`, off is \`tag\`. A row of filters is written that way, adding and removing \`tint-1\`. There are no sizes and no other variants.

### Insights and KPIs

\`\`\`html
<div class="insights">
  <article class="insight a">
    <i class="deco hgi-stroke hgi-ai-magic"></i>
    <h3>Predecir la demanda del próximo trimestre</h3>
    <p>El modelo detectó estacionalidad estable en 4 categorías.</p>
  </article>
  <article class="insight b">…</article>
  <article class="insight c">…</article>
</div>

<div class="kpis">
  <article class="card kpi">
    <div class="kpi-head">
      <span class="kpi-ico"><i class="hgi-stroke hgi-dollar-circle"></i></span>
      <span class="kpi-label">Ingresos netos</span>
    </div>
    <div>
      <div class="kpi-row">
        <span class="kpi-val number">184.320 €</span>
        <span class="tag tag-success"><i class="hgi-stroke hgi-arrow-up-right-01"></i>12,4 %</span>
      </div>
      <div class="kpi-foot number">vs. 163.980 € anterior</div>
    </div>
    <div class="spark"><canvas></canvas></div>
  </article>
</div>
\`\`\`

\`.insight\` is a suggestion written by the app, not a fact from the tables --a forecast, a thing worth doing next--, so its copy is always short and it is never used for a real figure. It only ever comes **three at a time**, one each of \`a\`/\`b\`/\`c\`: those are what give each card its own tint, not a ranking. \`.kpi\` is a real number, always \`.card kpi\` together, one per metric that actually matters --four is already a full row, do not add a fifth to fill space. The trend tag beside the value is \`tag-success\`/\`tag-error\` for whether the movement is good news, never for whether it went up or down: a drop in costs is \`tag-success\` too. The \`.spark\` canvas is optional and, like every canvas, is drawn with \`plane.grafica\` --see "Charts, metrics and dashboards"-- never left empty or filled by hand.

### Lists, timeline and progress

\`\`\`html
<ul class="list">
  <li>
    <span class="avatar">LM</span>
    <span class="l-main"><span class="l-title">Lucía Marín</span><span class="l-sub">lucia@northwind.co</span></span>
    <span class="tag tint-2">Paid</span>
  </li>
</ul>

<ol class="timeline">
  <li class="done">
    <span class="t-time"><b>09:14</b><span>Today</span></span>
    <div class="t-body"><span class="t-title">Order received</span><span class="t-desc">3 items</span></div>
  </li>
</ol>

<div class="progress-label"><span>Plan events</span><span class="number">74 %</span></div>
<progress class="progress" max="100" value="74"></progress>
\`\`\`

### Tabs and filters

Same moving-pill mechanism, two names depending on what it does. \`.chips\`/\`.chip\` is a loose selector that goes nowhere --a filter, a date range. \`.tab-list\`/\`.tab\` is the same thing for actual tabs. Both take an optional icon before the label.

\`\`\`html
<!-- Filter: no navigation, .active marks the pick -->
<div class="chips" style="--n: 3">
  <button class="chip active">Summary</button>
  <button class="chip">Activity</button>
  <button class="chip">Settings</button>
</div>

<!-- Tabs with panels: no JavaScript, hidden radios -->
<div class="tabs">
  <div class="tab-list" style="--n: 3">
    <input type="radio" name="vista" id="v1" checked><label class="tab" for="v1"><i class="hgi-stroke hgi-sidebar-left"></i>Summary</label>
    <input type="radio" name="vista" id="v2"><label class="tab" for="v2">Activity</label>
    <input type="radio" name="vista" id="v3"><label class="tab" for="v3">Settings</label>
  </div>
  <div class="tab-panels">
    <p>Summary panel.</p>
    <p>Activity panel.</p>
    <p>Settings panel.</p>
  </div>
</div>
\`\`\`

\`--n\` is how many options there are and it must match: the moving pill is positioned from it. **Six options maximum** for \`.chips\`/\`.tab-list\`, **three panels maximum** for \`.tabs\` --there is no rule beyond that.

### The three states of a screen

\`\`\`html
<div class="skeleton" style="width: 70%"></div>   <!-- while it loads -->
<span class="spinner" role="status" aria-label="Loading"></span>
<div class="alert info" role="status"><i class="hgi-stroke hgi-information-circle"></i><span><strong>Nothing yet</strong>Create the first one to see it here.</span></div>
<div class="alert danger" role="alert"><i class="hgi-stroke hgi-cancel-circle"></i><span><strong>Could not load</strong>Try again in a moment.</span></div>
\`\`\`

The alert has four tones: \`info\`, \`ok\`, \`warn\`, \`danger\`.

### The rest

\`.menu\` with \`.menu-btn\` and \`.menu-sep\` for a dropdown (native \`popover\`, no JavaScript), \`.modal\` and \`.drawer\` with \`.modal-head\` / \`.modal-body\` / \`.modal-foot\` inside, \`.crumbs\` for a breadcrumb, \`.steps\` for a flow, \`.pager\` for pages of results, \`.divider\` for a separating line (\`.divider-text\` when it carries a word, like "o continúa con"), \`.link\` for a link with an outward icon, \`.fieldset\` with its \`<legend>\`, \`.tip\` with \`data-tip="…"\` for a hint on hover, \`.dots\` and \`.legend\` with \`.legend-item\` for a chart's key, \`.rating\` (hidden radios plus star labels, the same mechanism as \`.tabs\`) for a star score, \`.tag-remove\` for the little cross on a dismissible filter tag, \`.swatch\` for a small colour square beside a chart's own legend (\`<i class="swatch" style="background: var(--chart-1)">\`), \`.range-val\` for the live value beside a \`type="range"\` input, and \`.btn-warning\` for a button whose action is pending, not wrong.

\`.toast\` is a notice that appears over the screen rather than inside it, built the same \`popover\` way as \`.menu\`: give it an \`id\`, open it with \`popovertarget="ese-id"\` on the button that triggers it, and close it with a \`.close\` button carrying \`popovertargetaction="hide"\` pointed at the same id. Its tones are \`ok\`, \`info\`, \`warn\` and \`danger\`, same meaning as \`.alert\`.

\`.modal\`, \`.drawer\`, \`.menu\` and \`.toast\` are \`popover\`s: the browser draws them in a layer of its own, and they are written as **siblings of the screen's container, not inside it**. A rule of yours that begins with that container --\`.pantalla .field-control { … }\`-- therefore reaches nothing inside them: the modal quietly keeps the catalogue's own measurements while the rest of the screen carries yours, and nothing warns you. A rule that has to reach both is written without the prefix.

A small status dot that pulses --something changed and has not been looked at yet-- is \`.badge-success\` / \`.badge-warning\` / \`.badge-error\` added beside an icon or a button, not a tag of its own.

For layout there are utilities with the names you would expect --\`flex\`, \`grid\`, \`items-center\`, \`justify-between\`, \`gap-1\` to \`gap-8\`, \`flex-1\`, \`flex-col\`, \`w-full\`, \`text-center\`-- and they are for arranging, never for dressing.

### What is still yours

The screen. Which pieces there are, in what order, with how much air between them, what the grid is, what gets looked at first. That is where a screen is won, and no catalogue does it for you. What the catalogue saves you is having to decide, again, what a button looks like.`;
}

/** Las medidas: separaciones, radios y tamanos de texto. */
function measureSection(): string {
  const rows = [...SPACE_VARS, ...TEXT_VARS]
    .map((name) => `| \`${name}\` | ${MEASURE_USES[name] ?? ""} |`)
    .join("\n");

  return `## Spacing and type

The same measurements the panel uses reach the document too. Use them instead of loose numbers so the screen looks like the rest of the house:

| Variable | What it is for |
|---|---|
${rows}

Write them like this: \`padding: var(--space-4); font-size: var(--type-sm);\`

**This list is closed.** No other house variable exists. \`var(--space-5)\` exists because it is in the table; \`var(--space-7)\` and \`var(--type-3xs)\` do not, and a property pointing at a variable that does not exist ends up with no value at all: the gap vanishes, the card sticks to the one beside it, and the screen looks broken with nothing to warn you. If you need a measurement that is not here, write the number: \`gap: 1.25rem;\`. When in doubt, put the value behind the variable: \`gap: var(--space-6, 1.5rem);\`.`;
}

/**
 * Como se ve una pantalla bien hecha.
 *
 * Sin esto sale siempre la misma página: todo encerrado en tarjetas iguales,
 * el mismo peso para todo, emojis de icono y ningún sitio donde descansar la
 * vista. Las reglas van en negativo a propósito --lo que no hay que hacer--
 * porque lo que afea una pantalla son costumbres, no falta de ideas.
 */
function craftSection(): string {
  return `## What a Planer screen looks like

A house screen is recognised by three things: **air**, **a single hierarchy** and **little ornament**. The catalogue gives you the first pieces already right; what follows is what it cannot decide for you, and it is what separates a screen that looks like a product from one that looks like a form.

### Hierarchy

Before writing, decide **what gets looked at first**. A screen has one main thing and the rest keeps it company.

- Start with a header carrying the screen's name in \`var(--type-2xl)\`, weight 600, \`letter-spacing: -0.02em\`, and a line below it in \`var(--ink-soft)\` saying what it is about. The name may carry the brand --the title in \`var(--color-primary-text)\`, or its icon beside it in that colour. Nothing else: the header is not a card and carries no border.
- A figure that matters is written large and alone: \`var(--type-3xl)\`, weight 600, \`line-height: 1\`, and \`font-variant-numeric: tabular-nums\` so it does not dance as it updates. Its label goes above it, small and faint, not below.
- Never bold more than one thing per block. If everything is heavy, nothing is.

### Air

It is what changes the result the most, and the first thing habit cuts back.

- Screen margin \`var(--space-8)\`, and \`var(--space-10)\` between separate sections. Between blocks of one section, \`var(--space-6)\`.
- Card padding \`var(--space-5)\`, not \`var(--space-3)\`. A cramped card looks cheap.
- Maximum content width between \`72rem\` and \`80rem\`, centred. A long text does not go past \`65ch\`.
- Leave empty space. The screen does not have to be filled.

### Fewer boxes

This is the most common mistake: shutting every thing into a bordered card, and ending up with a grid of identical rectangles.

- **Group with space and type first.** A border is the last resort, for when two things really do have to be pulled apart.
- A section title needs no header with a rule under it: the title, its faint line, and air are enough.
- **Never a card inside a card.** If something is already inside a panel, separate it with a \`border-top: 1px solid var(--line-strong)\`, not with another rectangle.
- Borders of \`1px\` and always \`var(--line)\` or \`var(--line-strong)\`. Never \`2px\` as decoration.
- One radius across the whole screen: \`var(--radius-card)\`, which is the one the catalogue uses. Pills and dots are the only exception (\`999px\`).
- Shadows: \`var(--shadow-card)\` and nothing else, and only on what genuinely floats. No coloured shadows, no large \`blur\`.
- **A card is \`.card\`.** Writing the background, the border and the radius by hand gives you a rectangle that is nearly the same, which is worse than one that is exactly the same.

### Icons

The platform already loads an icon font in the document. **Do not draw SVG and do not bring in any library**: an icon is an empty element with two classes.

\`\`\`html
<i class="hgi-stroke hgi-user-multiple"></i>
\`\`\`

- **Never emojis.** An emoji is drawn differently on every system, does not take the theme's colour, and turns any screen into a draft.
- Being type, an icon takes \`color\` and \`font-size\` from wherever it sits: on its own it measures a little more than the text of its line (\`1.2em\`), so inside a title it already grows with the title. To make it bigger, \`font-size\`; to paint it, \`color\`. No \`width\`, \`height\` or \`fill\`, and never a size in \`px\`.
- **Size it by what it does, not by habit.** The most common mistake is an icon left at text size where it has to be seen from afar:

| Where it sits | Size |
|---|---|
| beside a label, in a row, a tag, a menu item | leave it: it follows its line |
| inside a heading (\`h1\`–\`h3\`), before the title | leave it: it follows the heading |
| the icon of a section or a card, alone in its own tile beside the title | \`var(--type-xl)\`, centred in a square of \`var(--space-10)\` with \`border-radius: var(--radius-card)\` and the brand's soft version behind (\`color-mix(in oklab, var(--color-primary) 12%, var(--surface-card))\`) |
| the icon of a feature or a shortcut, above its text | \`var(--type-2xl)\` |
| an empty state, a welcome, a confirmation, a hero | \`var(--type-3xl)\` or \`calc(var(--type-3xl) * 1.5)\` |

- Buttons, \`.kpi-ico\`, \`.alert\`, \`.tag\` and the rest of the catalogue already size their icon: do not touch it there.
- Beside text, an icon accompanies in \`var(--ink-soft)\`; where it leads --a tile, an empty state-- it may carry the brand in \`var(--color-primary-text)\`.
- If something has no obvious icon, give it none.
- **An invented name does not fail visibly: it leaves a blank gap**, and nobody notices anything is missing. The font holds more than six thousand names and none of them is listed here: **find them with "buscar_iconos"**, searching with English keywords (\`user\`, \`invoice\`, \`calendar\`, \`shopping cart\`), and use only names it returned. Never guess one.
- **Write every icon name literally in the document**, as \`hgi-<name>\` or as a quoted string holding the exact name (for example inside a map from a state to its icon). Never build a name by joining pieces of text: the frame only loads the icons it finds written in the page.
- The markup of an icon is never escaped. If you insert it with \`innerHTML\`, it goes in as it is: escaping what you wrote yourself turns it into the visible text \`<i class=...>\`. Escaping is only for what comes from the tables or from the viewer.

### Tables and lists

\`.table\` inside \`.table-card\` already does all of this --no vertical rules, a faint separator between rows, the header small and uppercase, the hover-- so what is left is what it cannot decide for you:

- **Which columns.** A table with eleven columns is a table nobody reads. Take out what can be looked up by opening the row.
- Numbers, amounts and dates take \`class="number"\` on the cell, for \`tabular-nums\` so the digits line up down the column; add your own \`style="text-align: right"\` on that \`<th>\` and its \`<td>\`s, which the catalogue does not do for you.
- The secondary part of a row --an email under a name-- goes inside the same cell, in \`var(--type-xs)\` and \`var(--ink-faint)\`; not in a column of its own. For a list of people, \`.list\` with \`.l-main\` / \`.l-title\` / \`.l-sub\` already lays that out.
- A state in a cell is a \`.tag\` with its tint, not a coloured cell.
- A row's own actions --view, edit, remove-- are \`.mini-btn\` icon buttons, smaller than \`.btn-icon\` and sized for sitting inside a row.

### The three states

Data arrives late, and sometimes it does not arrive. A screen that only draws the good case looks broken half the time.

- **Loading:** \`<div class="skeleton">\` the size of what is coming, so nothing jumps when it lands. Never the word "Cargando" alone in the middle of the screen.
- **Empty:** a sentence saying there is nothing and what can be done about it, centred, in \`var(--ink-soft)\`, with air around it. No drawings, no dashed frames.
- **Error:** the \`error.message\` text, readable, in its place --a \`.alert danger\` is what that is-- and never a blank screen.

### Motion and focus

- Transitions of \`120ms\` to \`180ms\`, only on \`color\`, \`background\`, \`border-color\`, \`opacity\` and \`transform\`. Never on \`all\`, never on measurements.
- Nothing moves as the page loads unless it was asked for.
- Reduced motion and the focus ring are already handled by the stylesheet, for the catalogue and for anything else. Something focusable of your own that is not a catalogue piece --a clickable card-- does need its own \`:focus-visible\`.

### What fits in each width

- Grids with \`repeat(auto-fit, minmax(15rem, 1fr))\`, never with a fixed number of columns.
- Widths in \`%\`, \`rem\` or \`fr\`; never fixed \`px\` for a container.
- Check the narrow width in your head: two columns become one, a wide table gets wrapped in \`overflow-x: auto\`.

### What is not done

Decorative gradients. Coloured shadows. Thick borders. Emojis. More than two typefaces. Faint text on a faint background. Whole sentences in capitals. Padding things out with fake copy: if a piece of data does not exist in the tables, do not invent it on the screen.`;
}

/**
 * Las gráficas.
 *
 * Sin esto salen dos cosas, las dos malas: una tabla de numeros donde hacia
 * falta un dibujo, o un lienzo pintado a mano con colores inventados que no
 * cambian con el tema. La libreria y el aspecto de la casa ya estan resueltos
 * en `plane.grafica`; lo que hace falta contar es cuando se usa una gráfica,
 * cuando no, y que no hay que decidir de nuevo.
 */
function chartSection(): string {
  return `## Charts, metrics and dashboards

To draw data --a dashboard, a trend, a breakdown-- the platform ships **Chart.js** already dressed in the app's colours and measurements. You use it through \`plane.grafica\`, and you bring nothing yourself: the moment you name it, the platform puts the script (\`${CHARTS_PATH}\`) in the page.

### Before drawing, choose the shape

A chart is not always the answer. Look at the work the data is doing:

| What is to be seen | What gets drawn |
|---|---|
| **A single number** (a total, an average, how many there are) | a large figure, not a chart. A two-slice pie or a lone bar is a number in disguise |
| **Comparing amounts** across categories | bars. Horizontal ones if the names are long |
| **How something changes over time** | a line. With a faint fill only if there is a single series |
| **A breakdown of a total** | \`doughnut\`, and only if there are **6 slices or fewer** and the portions are told apart at a glance. If close values have to be compared, bars |
| **Progress towards a target** | an ordinary progress bar, with a \`div\` and CSS. No chart needed |

A good dashboard opens with a row of figures --what gets looked at first-- and below them one or two charts that explain them. Not five identical charts spread over a grid.

### How it is drawn

The canvas goes inside a box **with a height of its own**; without one, the chart picks a ratio by itself:

\`\`\`html
<div class="caja-grafica" style="height: 18rem;">
  <canvas id="ventas-mes"></canvas>
</div>
\`\`\`

\`\`\`js
var g = plane.grafica("#ventas-mes", {
  type: "bar",
  data: {
    labels: ["Enero", "Febrero", "Marzo"],
    datasets: [{ label: "Ventas", data: [12, 19, 7] }]
  }
});
\`\`\`

It is the usual Chart.js configuration. What you leave unsaid, the house says: the colours, the type, the grid lines, the legend, the tooltip, the vertical guide, the number formatting and the no-data notice. **Do not repeat any of that.** What you do say wins.

Besides \`plane.grafica\` you have:

- \`plane.colores(n)\` — the colours of \`n\` series, in case you need to paint something by hand (a pill, a legend dot of your own) in the same colour as its series.
- \`plane.numero(v)\` — a number written the Spanish way.
- \`plane.paleta\` — the colours already resolved: \`series\`, \`acento\`, \`tinta\`, \`tintaSuave\`, \`tintaTenue\`, \`linea\`, \`superficie\` and \`estados\` (\`bien\`, \`aviso\`, \`serio\`, \`critico\`).

### The colours are not yours to choose

Series colours come out of \`plane.grafica\`. There are eight, in a fixed order, picked so two neighbours are told apart with colour blindness and on both light and dark backgrounds, and they rebuild themselves when the app changes its brand colour.

- **Do not write colours into the configuration.** Neither hex values nor \`var(--color-accent-500)\`: the canvas does not understand variables and the series would come out black.
- **A single series takes the app's colour.** That is automatic, do not set it.
- **The colour belongs to the thing, not to its position.** A filter that drops a series cannot repaint the ones left: if you draw a subset, pass each one's colour with \`backgroundColor\` taken from \`plane.colores\` by its usual position, not by its current one.
- **More than eight series cannot be told apart.** Keep the ones that matter and gather the rest into "Otros".
- The state colours (\`plane.paleta.estados\`) are for what **means** good or bad. Never for "series 4", and always with their label beside them.

### Filtering

A dashboard is nearly always filtered, and filters are plain HTML --a \`select\`, a few buttons--, not part of the chart:

- **A single row of filters, at the very top**, before the content. Never a filter inside each chart's card.
- **What is filtered rules everything below it:** the figures, the charts and the tables are rebuilt from the same slice, so the numbers cannot contradict each other.
- The first one is the period, with ready-made options (today, 7 days, 30 days, this month) before a hand-picked range.
- Filter by asking for the data again with \`plane.listar\`, or by trimming in memory what you already hold if there is little of it.
- **Filtering does not recreate the chart**, it changes its data:

\`\`\`js
g.data.labels = etiquetas;
g.data.datasets[0].data = valores;
g.update();
\`\`\`

Calling \`plane.grafica\` again on the same canvas wipes it and draws it from scratch: it flickers and the animation is lost. While the new data is on its way, leave the previous chart visible at a lower opacity; no blank gap, no jump in height.

### What is not done

- **Never two value axes in one chart.** Two measurements of different size go in two charts, or are both brought to a common base (100 at the start). An axis on each side invents a relationship the data does not hold.
- Never a number on top of every point or every bar. Label the end, the last value, or the one that tells the story; the axis and the tooltip say the rest.
- Text is not painted in the series colour: it goes in \`var(--ink)\`, \`var(--ink-soft)\` or \`var(--ink-faint)\`, and what says whose data it is, is the colour mark beside it.
- No fill gradients, shadows under lines, three-dimensional bars or gauge needles.
- With two or more series the legend stays. With one it is redundant: the title already says it.
- If a piece of data is not in the tables, do not invent it to fill a chart.`;
}

const DATA_SECTION = `## Data

Data is asked for through \`window.plane\`, which the platform leaves ready. Every command returns a promise.

\`\`\`js
// Listar
var r = await plane.listar("equipos", {
  filtro: { estado: "Operativo" },   // equality; several can be combined
  buscar: "compresor",               // searches the text columns
  orden: "-nombre",                  // a leading dash reverses the order
  limite: 50,
  pagina: 1
});
// r = { filas: [...], total: 120, pagina: 1, paginas: 3, limite: 50, recortado: false }

// Contar, sin traerse ninguna fila. Toma el mismo filtro y la misma busqueda.
var cuantos = await plane.contar("equipos", { filtro: { estado: "Operativo" } });
// cuantos = { total: 120 }

var uno   = await plane.obtener("equipos", "id-del-registro");
var nuevo = await plane.crear("equipos", { nombre: "Turbina", estado: "Operativo" });
await plane.actualizar("equipos", nuevo.id, { estado: "En mantenimiento" });
await plane.borrar("equipos", nuevo.id);
\`\`\`

Every row arrives as an object with \`id\` and the declared columns.

Rules:

- Only the declared sources and columns can be named. Any other one is rejected without ever being queried.
- The permissions are those of whoever is looking at the screen. An operation can fail for lack of permission: wrap the calls in \`try / catch\` and show \`error.message\`.

### How many there are

**\`limite\` has a ceiling of ${MAX_LIST_ROWS}, and one call never brings back more than that.** Asking for more is not an error: you get ${MAX_LIST_ROWS} rows, \`limite\` says how many really came, and \`recortado\` comes back \`true\`. There is no way to pull a whole table down in one go, and there is not meant to be.

That is why counting has one rule with no exceptions:

- **\`r.total\` is how many rows there are. \`r.filas.length\` is how many arrived.** They are the same number only while the table is smaller than one page. Writing \`filas.length\` into a "total" figure paints the page size, and on a table of 410 rows the screen says 200 and looks right.
- **To count anything the filter can express, use \`plane.contar\`.** How many are operativo, how many this month, how many of one person: a filter and a count, with nothing travelling. It is exact whatever the table's size.
- **To count something the filter cannot express** --distinct values, a grouping, a deduplication-- walk the pages with \`pagina\` until \`pagina === paginas\`, accumulating as you go. Do it because the figure needs it, never to paint: what gets painted is one page at a time.
- **Never explain a figure that does not add up by guessing at the data.** If a number looks short, it is the page size before it is anything else. Rows that were saved do not vanish, and an import that did not finish is not something you can tell from here.
- Wait for \`plane\` before asking for anything:

\`\`\`js
window.addEventListener("plane:listo", async function () {
  var r = await plane.listar("equipos");
  // pinta r.filas
});
\`\`\``;

/** Quien esta mirando, que roles tiene y quien puede abrir la página. */
function viewerSection(opts: {
  pageRoles?: string[];
  appRoles?: string[];
  people?: AppPerson[];
  /** Las tablas de la aplicación, para nombrar las columnas propias de las personas. */
  tables?: TableRecord[];
}): string {
  const parts = [
    `## Who is looking`,
    `\`plane.usuario\` carries \`{ id, nombre, correo, roles }\` for whoever is looking, or \`null\` if they came in without a session. \`nombre\` is already their real name, taken from the app's people table, so greet them with it directly: never look the person up again to find it, and never fall back to \`correo\` when \`nombre\` is there. \`roles\` are the roles that person holds in the app.`,
  ];

  /*
   * Y las columnas que esta aplicación le haya puesto a su tabla de personas.
   * Se nombran una a una porque son con lo que se filtra "lo mio", y un filtro
   * es para una columna que existe: una lista fija haria escribir
   * `plane.usuario.documento` en una aplicación que la llamo `cedula`.
   *
   * La del nombre no se repite: ya esta arriba, y es de donde sale `nombre`.
   * Ver `viewer` en `web/src/components/HtmlFrame.svelte`.
   */
  const peopleTable = peopleTableOf(opts.tables ?? []);
  if (peopleTable) {
    const own = storedFields(peopleTable.fields).filter((f) => f.name !== PEOPLE_NAME_FIELD);
    parts.push(
      own.length
        ? `It carries this app's own columns of its people table too, at the same level --\`plane.usuario.cedula\`, never \`plane.usuario.campos.cedula\`--: ${own
            .map((f) => `\`${f.name}\` (${f.label || f.name})`)
            .join(
              ", ",
            )}. Any of them can arrive empty, because nobody filled it in for that person: the screen has to draw properly without it.`
        : `Beyond those four there is nothing else on \`plane.usuario\`: this app has added no column of its own to its people table. Do not invent one.`,
    );
  }

  const named = (list?: string[]) => (list ?? []).map((r) => `\`${r}\``).join(", ");

  parts.push(`### Who is writing

Whoever writes the request is the app's **owner**, and inside the app their role is \`${ADMIN_ROLE}\`. Every app defines \`${ADMIN_ROLE}\` from the moment it is born and it cannot be taken away, so that equivalence holds in any app, including one that never named a role of its own.

It is a fact about the platform, not an instruction. What gives the builder the power to build the app is **owning it**, not the name of the role: giving \`${ADMIN_ROLE}\` to an invited person opens nothing of the panel to them, it only puts them in the group of people that role names.`);

  const roles = opts.appRoles ?? [];
  parts.push(
    roles.length
      ? `The app defines these roles: ${named(roles)}. Compare them against \`plane.usuario.roles\` to decide what is shown.`
      : `The app has named no role of its own beyond \`${ADMIN_ROLE}\`, so \`plane.usuario.roles\` arrives empty for the people invited to it. Do not invent role names.`,
  );

  const people = opts.people ?? [];
  if (people.length) {
    const rows = people
      .map(
        (person) =>
          `| ${personDisplayName(person) || "--"} | ${person.email || "--"} | ${
            person.roles.length ? named(person.roles) : "--"
          } |`,
      )
      .join("\n");
    parts.push(`### Who is invited

These people are invited to the app. It is the builder's own app and these are their own guests, so nothing here is somebody else's data.

| Person | Account | Roles |
|---|---|---|
${rows}

The roles say which screens each of them gets. There is no second column saying what they may do with the data: saving requires a signed-in account and nothing else.

This list is here so you can name a real person when a change of access is asked for. Do not paint it on the screen: the people are the platform's and there is already a place to see them.`);
  }

  parts.push(`### Naming a person

When the builder has not said otherwise, a person is shown by their **name** --\`nombre\`, plus their surname if the app keeps a column for it--. A second datum --their document, their account-- goes in only when it tells apart two people who read alike, or when the screen is about that datum itself, and then it goes underneath, in smaller and dimmer type (\`var(--ink-faint)\`). The identifier is never shown: it says nothing to anybody reading.

Whatever the builder asked to be shown wins over this.

The panel's own grid does the opposite on purpose --the value in front and the person behind-- because there the value is what gets corrected, and a document is the only thing a cell can be fixed with. That is not an inconsistency to carry over: a grid is for correcting and a page is for reading.`);

  const limited = (opts.pageRoles ?? []).length > 0;
  parts.push(
    limited
      ? `This page is limited to these roles: ${named(opts.pageRoles)}. Whoever opens it signed in and holds at least one of them, so \`plane.usuario\` never comes back \`null\`.`
      : `This page is open to everybody who reaches the app. If the app is public, \`plane.usuario\` may come back \`null\`: draw something sensible in that case, without asking them to sign in.`,
  );

  return parts.join("\n\n");
}

/** Lo que el HTML no puede hacer, dicho de forma expresa. */
function limitsSection(): string {
  const away = `Navigation between pages is drawn by the platform around the document.`;

  return `## Limits

Three things are not the page HTML's to do. The frame it lives in prevents them anyway, so attempting them only breaks the screen:

- **No sign-in of your own.** No login screens, user tables, passwords, tokens or invented roles. The session, the people and the roles are the platform's: to know who is in front of you use \`plane.usuario\`, and to decide what they get shown, \`plane.usuario.roles\`.
- **No storing in the browser.** No \`localStorage\`, \`sessionStorage\`, cookies or IndexedDB. Whatever has to last is saved in a table with \`plane.crear\` or \`plane.actualizar\`.
- **No leaving the screen.** No \`location.href\`, \`location.replace\`, \`location.assign\` or forms posting to another address. ${away}

Do not use \`fetch\` against the database either, nor any data library of your own: everything goes through \`window.plane\`.`;
}

/**
 * Los nombres de bloque: que son, quien los pone y para que sirven.
 *
 * Solo se cuenta donde hay herramientas para editar un trozo. Quien recibe
 * este texto para escribir un documento entero --la varita, el arreglo de una
 * página rota-- no gana nada sabiendolo.
 */
function blocksSection(): string {
  return `## Block names

An element of the document can carry a stable name in the \`data-plane\` attribute:

\`\`\`html
<section data-plane="lista-clientes"> ... </section>
\`\`\`

That name is what makes it possible to edit that piece without redoing the whole page. It is unique within the document, and it survives any other part being edited.

How they are given:

- **Only what you touch gets named.** An element receives its name the first time you edit it, not in advance. Do not walk the document stamping \`data-plane\` everywhere: HTML reads worse full of attributes nobody asked for.
- **Give it meaning.** \`lista-clientes\`, \`cabecera\`, \`tarjeta-total\`; never \`b7x2k9\` or \`bloque-1\`. Whoever opens "Código HTML" has to be able to read it and know what it refers to.
- **Uniqueness is not yours to decide.** You propose the name and the platform checks it is free; if another block holds it, it derives one that is free. It never overwrites the block that was already there.
- **Do not drop it.** If you replace a block, the HTML you return keeps its \`data-plane\`. If it does not carry it, it gets put back: losing the name would turn an edit into a delete-and-create.

## Editing a piece or redoing the page

They are two different things and the choice matters:

- **A local change** --changing a title, adding a column to a table, putting a search box next to a list that already exists-- is done by **editing the block it belongs to**. What you do not touch is not generated again, so it cannot come out different from how it was when it was right.
- **Redoing the whole document** is kept for when **the structure of the screen changes**: a different layout, different sections, a different page. When you do it that way, say so.

When in doubt, edit the block. Rewriting a long page to change one sentence is slow and risks what already worked.`;
}

/**
 * Como se deduce para quien es la pantalla a partir de las palabras del pedido.
 *
 * Solo entra en el contexto del modelo: es una regla de lectura de frases, no
 * algo que quien construye tenga que saber para escribir HTML a mano. Por eso
 * va detras de un interruptor, como `blocksSection()`, y no en `buildHtmlDocs`.
 */
function audienceSection(): string {
  return `## Who the screen is for

Nobody says it outright, so it is read from the words of the request.

**"I", "me", "my", "I want"** mean the \`${ADMIN_ROLE}\` role **only when the request also names other people**. *"I want to see the list of all the users and which of them read the manual"* sets whoever is writing against everybody else, and that listing is theirs. *"I want to see who read the manual"* names nobody else: it is just the ordinary way of asking for something, so **assume no audience at all** and build for whoever can open the page.

**A word naming a group of people** is read like this:

- **Generic** --"usuarios", "personas", "todos", "la gente", "gente"--: everybody invited to the app. The screen does not filter by role.
- **It matches one of the app's roles**: that role. The match tolerates plural and accents, because "los odontólogos" does not read literally the same as \`odontologo\`.
- **It matches no role**: build for everybody and **say so**. Do not ask. Filtering by role inside the HTML protects nothing, so getting it wrong costs a correction, not a hole in the access.

**An audience you read as a role is acted on, not just noticed.** When the whole screen is for that role, limit the page to it in the page's own options: that is the only thing that keeps the data out of anybody else's browser. When only a part of it is, check the role before drawing that part --see *Roles are for fitting the screen*--. Everybody invited is not a role and filters nothing: there the audience only gets said in the reply.

Only weigh a word against the role names when the word **names people**. In *"who read the manual"*, "manual" is a thing that was read, not a group, and an app with a role called \`manual\` must not make it one.

**Whenever you assume an audience, name it in the reply that closes the turn** --the role, or the set of people-- so it can be corrected in one sentence instead of the screen being built again.`;
}

function shapeSection(): string {
  return `## What to return

A single complete HTML file, with its \`<head>\` and its \`<body>\`, and its \`<style>\` and its \`<script>\` inside. No separate files and no external libraries: no CSS frameworks, no scripts pulled from a CDN. Everything needed is already in the document or is put there by the platform before drawing it --the styles, the data, the charts and the icon font--, and that is the only thing coming from outside the file. The icon font in particular is **already loaded**: do not link it again.

The stylesheet goes in a single \`<style>\`, in this order: the few values of your own that you need, then the layout of the screen, then each piece. Classes are named in Spanish and with meaning --\`cabecera\`, \`lista-citas\`, \`tarjeta-total\`--, never \`div1\` or \`col-md-6\`.

Do not repeat what the platform already provides: the \`box-sizing\`, the typeface, the text colour and the starting look of buttons, fields and tables arrive in Planer's stylesheet. Write only what changes.

The type scale is the clearest case. **Do not rewrite the size of a field, a label, a button or a table cell**, neither with a literal (\`font-size: 1.0625rem\`) nor with a token: the catalogue already sizes them all, together. If the screen reads too small, the control for that is the app's own *Tamaño de letra*, which scales every rem at once; a size rewritten by hand stops answering to it. Type of your own belongs to what the catalogue does not dress --the screen's title, a figure that matters, a caption-- and even there it is written with \`var(--type-*)\`.

The same goes for the height of a control: \`.field-control\` sets it with \`height\`, so adding \`padding\` to make a field taller changes nothing.`;
}

/** La lista de tablas, con el nombre logico que usara el HTML. */
function tablesSection(tables: TableRecord[]): string {
  if (!tables.length) {
    return `## Tables

This page does not use any table yet. Do not call \`plane.listar\` or the other data commands.`;
  }

  let hasRelations = false;

  const blocks = tables.map((table) => {
    const rows = (table.fields ?? [])
      .map((f) => {
        const options =
          f.type === "select" && f.options?.length ? ` — options: ${f.options.join(", ")}` : "";
        const required = f.required ? " (required)" : "";

        // Una relación necesita decir a que apunta y que enseña: sin eso, quien
        // escribe la página no sabe que hay en esa celda ni como agrupar por ella.
        if (isRelationField(f) && f.multiple !== true) {
          hasRelations = true;
          const target = `the table "${
            tables.find((t) => t.id === f.relationTableId)?.label ?? "another"
          }"`;
          const display = displayFieldOf(f) || "its first text column";
          return (
            `- \`${f.name}\`: points at ${target} and shows \`${display}\`${required}. ` +
            `It arrives as text and **always has a value**, including when the row is not linked. ` +
            `The link travels separately, in \`${f.name}${LINK_SUFFIX}\` (\`{ id, roto, registro }\`).`
          );
        }

        return `- \`${f.name}\`: ${TYPE_NAMES[f.type] ?? f.type}${required}${options}`;
      })
      .join("\n");
    return `### ${table.label}\n\nSource name: \`${table.name}\`\n\n${rows}`;
  });

  return `## Tables\n\n${blocks.join("\n\n")}${hasRelations ? `\n\n${relationsSection()}` : ""}`;
}

/**
 * Para que sirven los roles de quien mira, y para que no.
 *
 * Va en las dos salidas: la IA lo necesita para no escribir una página que cree
 * estar protegiendo algo, y quien construye, para saber que esconder un botón
 * no esconde los datos.
 */
function rolesSection(): string {
  return `## Roles are for fitting the screen

Whoever can open a page reaches **every row** of the tables that page declares. The server does not trim rows by who is asking: the total beside a list counts them all, and a row somebody else created arrives the same as your own.

\`plane.usuario.roles\` is for **deciding what is shown** --the approve button for whoever approves, the whole board for a supervisor and only their own week for everybody else-- and it is done inside the page, comparing against those roles.

**What you hide by role is not protected.** The data of the declared tables reaches the browser of anyone who can open the page, whatever the screen chooses to paint. Hiding a button is a presentation decision, never a barrier.

So when somebody asks that "only such-and-such a role may see" something:

1. Write it: check the role before painting.
2. Say plainly that hiding it does not stop the data from reaching the browser.
3. Explain that what does stop it is limiting the whole page to that role, in the page's own options.

**Decide the visibility before drawing the content, never after.** Check the role first and draw the section only if it belongs to whoever is looking; do not write a section that starts out \`hidden\` and gets shown once it is filled in.

The reason is what happens when something goes wrong halfway: an error while the section is being filled leaves it hidden with nothing to say so, and the screen looks empty instead of broken --which reads like a matter of permissions when it is a bug.

**When something is hidden, it is hidden with the \`hidden\` attribute** --\`seccion.hidden = true\`, or written in the markup when the role decides it at once. It hides whatever carries it, catalogue piece or not: the platform's stylesheet already sees to that, so **do not write a rule of your own** --no \`.card[hidden] { display: none }\`, no class of yours called \`oculto\`-- and do not write \`display\` from the script: a \`.card\` put back with \`display: block\` has lost the column it was drawn with, and nothing says so.

Showing "mine" is a different matter, and it is **filtered on the server**, inside the listing command:

\`\`\`js
var r = await plane.listar("excesos", { filtro: { conductor: plane.usuario.cedula } });
\`\`\`

Never bring every row down and drop the others while painting. That pulls the whole table into the browser to throw almost all of it away, and the total beside the list would go on counting everybody's rows.

**The value you filter by is the person's datum that matches that table's key, and the key is not the same in every table.** Each table's section says which column its relation shows: if \`chequeos\` points at the people table showing \`correo\`, filter it with \`plane.usuario.correo\`; if \`excesos\` points at it showing \`cedula\`, filter that one with \`plane.usuario.cedula\`. Do not filter by \`plane.usuario.id\`: what a row keeps is a link, and what the filter compares is the value on show. Filtering by the value also finds the rows that never got linked --an imported document of somebody who had not been invited yet-- which the identifier never sees.

**That filter decides what is shown, not what can be reached**, exactly like the roles above: whoever knows how to look from the browser can ask for somebody else's rows. Write the screen, and say so plainly when it is asked for. What does close the door is marking the app as private in its own options: then the server demands a session and an invitation before handing over any data.

A page opened without a session has no \`plane.usuario\`, so there is no "mine" to show --draw the general case instead.`;
}

/**
 * Que guardar exige cuenta iniciada, y que el aviso lo pone la plataforma.
 *
 * Va aparte de los roles a propósito: es la única frontera que el servidor si
 * aplica sobre los datos, y confundirla con los roles es lo que hace que una
 * página escriba su propio "inicia sesión" donde no hace falta.
 */
function savingSection(): string {
  return `## Saving requires an account

Reading does not need a session: a page open to everybody hands its data to whoever arrives without one. **Creating, updating and deleting do**: the server refuses those three when whoever is asking has no session, whatever the page's access.

**The platform puts up the notice itself.** When one of those three is refused for want of a session, a message asking the viewer to sign in appears on the screen without the page doing anything. Do not write your own "inicia sesión" message and do not try to detect the case to show one: there would be two.

The command is still refused with an error, so \`await plane.crear(...)\` rejects and you can catch it if you want to do something better --leave the form filled in, keep the draft-- but you do not have to.

When you build a page that saves data and can be opened without an account, **say so**: name what happens when somebody without a session tries to save.`;
}

/**
 * Como se usa una columna que apunta a otra tabla.
 *
 * Va aparte y solo cuando hace falta: si la aplicación no tiene ninguna, no hay
 * por que gastarle atencion a quien escribe la página.
 */
function relationsSection(): string {
  return `### Columns pointing at another table

A cell like that arrives **in two pieces**:

\`\`\`js
fila.conductor          // "1098765432" — what is seen. There is always something here.
fila.conductor_enlace   // { id: "rec_8x2k", roto: false, registro: { nombre: "Ana" } }
\`\`\`

- **\`fila.conductor\`** is the value of the column that relation shows. It is text and it is always there, including when the row found nobody to point at.
- **\`fila.conductor_enlace.registro\`** carries the columns of the linked record that this page has declared, or \`null\` when there is no link. A column you did not declare does not arrive.
- **\`fila.conductor_enlace.roto\`** is \`true\` when there is a stored link whose record no longer exists or is out of the viewer's reach.

**To group, count, add up or compare, always use \`fila.conductor\`, never \`fila.conductor_enlace.id\`.** A row can hold a value and hold no link --the speeding ticket happened even if that ID number is not on the list--, and grouping by the id would drop those rows out of the chart in silence: the total would not match the table's and nobody would notice.

**A row with no link is always drawn the same way**, everywhere in the app: its value is written as it is and, where the record's data would go, a dash. No red, no "error", no hiding the row. It is not a breakage: it is a value that does not have a record yet.

\`\`\`js
var nombre = fila.conductor_enlace.registro ? fila.conductor_enlace.registro.nombre : "—";
\`\`\`

When **creating or updating** a row you write the value, never the id: \`plane.crear("multas", { conductor: "1098765432" })\`. The platform finds who it belongs to and makes the link itself; if it finds nobody, it saves the row anyway with that value in plain sight.`;
}

/* ------------------------------------------------------------------ */
/* Las dos salidas                                                      */
/* ------------------------------------------------------------------ */

/**
 * El contexto que recibe la inteligencia artificial, armado en el momento con
 * el estado actual de la aplicación. `request` es lo que el constructor quiere
 * pedir, si ya lo escribio.
 */
export function buildHtmlContract(opts: {
  /** El contrato completo sigue siendo la referencia del harness y la documentación. */
  profile?: "compact" | "plan";
  sourceIds?: string[];
  appName?: string;
  tables: TableRecord[];
  request?: string;
  /** Roles que tiene marcados la página que se esta escribiendo. Vacío: `Todos`. */
  pageRoles?: string[];
  /** Todos los roles que define la aplicación. */
  appRoles?: string[];
  /**
   * Las personas invitadas, con sus roles. Sin ellas la IA no puede nombrar a
   * nadie al contar la consecuencia de un cambio de acceso.
   */
  people?: AppPerson[];
  /**
   * Quien lee esto puede editar un trozo del documento en vez de rehacerlo
   * entero. Solo lo puede la IA de una página: la varita y el arreglo de una
   * página rota devuelven siempre un documento completo.
   */
  blocks?: boolean;
  /**
   * Anadir la regla de como leer para quien es la pantalla. Es una regla de
   * lectura de frases: solo sirve cuando al otro lado hay un modelo leyendo un
   * pedido escrito, no cuando el texto se convierte en documentacion.
   */
  audience?: boolean;
}): string {
  const inApp = opts.appName ? ` of the app "${opts.appName}"` : "";

  const intro = `# Writing the HTML of a Planer page

Planer is a platform where apps are put together without programming. A page is a complete screen written by hand${inApp}, with the platform's database, people and permissions behind it.

The HTML is drawn in isolation from the panel. It has no access to the session, to cookies or to browser storage. Everything it needs from outside is handed to it by \`window.plane\`.`;

  if (opts.profile) {
    const index = opts.tables
      .map((table) => `- ${table.label}: ${table.name} (${table.id})`)
      .join("\n");
    const relevant = opts.tables.filter((table) => opts.sourceIds?.includes(table.id));
    const access = viewerSection({
      pageRoles: opts.pageRoles,
      appRoles: opts.appRoles,
      people: opts.people,
      tables: relevant,
    });
    const core = [
      intro,
      LANGUAGE_SECTION,
      access,
      rolesSection(),
      `## Available sources\n${index || "No tables yet."}\nUse consultar_tablas to read current fields before using a source not detailed below.`,
      tablesSection(relevant),
    ];
    if (opts.profile === "compact")
      core.push(
        shapeSection(),
        DATA_SECTION,
        limitsSection(),
        blocksSection(),
        `## Styles and reference\nUse the built-in stylesheet, bridge and component classes; never write colours or measures by hand and never invent a variable. Buttons are class="btn", fields class="field" with class="field-control", a card is class="card". Surfaces --surface-card / --surface-page, text --ink / --ink-soft / --ink-faint, borders --line, brand --color-primary, spacing the --space-* scale (see medidas). For anything else call consultar_guia: componentes (class catalogue), colores, medidas, oficio (what a Planer screen looks like), datos, graficas, bloques. Icon names come from buscar_iconos. Documentation is available on demand; never guess an API or a name.`,
      );
    return core.join("\n\n---\n\n");
  }

  const parts = [
    intro,
    LANGUAGE_SECTION,
    catalogSection(),
    colorSection(),
    measureSection(),
    craftSection(),
    DATA_SECTION,
    chartSection(),
    viewerSection({
      pageRoles: opts.pageRoles,
      appRoles: opts.appRoles,
      people: opts.people,
      tables: opts.tables,
    }),
    rolesSection(),
    savingSection(),
    tablesSection(opts.tables),
    limitsSection(),
    shapeSection(),
  ];

  if (opts.audience) parts.push(audienceSection());
  if (opts.blocks) parts.push(blocksSection());

  const request = opts.request?.trim();
  if (request) parts.push(`## What I need\n\n${request}`);

  return parts.join("\n\n---\n\n");
}

/** Baja un nivel los titulos de un trozo, para poder anidarlo bajo otro. */
const demote = (text: string) => text.replace(/^(#{1,5}) /gm, "#$1 ");

/**
 * La misma explicacion, en forma de sección de documentacion para el
 * constructor. Sin las tablas de una aplicación concreta: aquí se cuenta como
 * se conecta una página con la base de datos, no que hay dentro de una.
 *
 * `scripts/docs.ts` la escribe en el README.
 */
export function buildHtmlDocs(): string {
  const intro = `## Escribir el HTML de una página

Una página es un archivo HTML completo que se dibuja aislado del panel: sin acceso a la sesión, a las cookies ni al almacenamiento del navegador. Todo lo que necesita del exterior se lo da \`window.plane\`.

Esto es lo mismo que recibe la inteligencia artificial en cada petición, generado desde la misma fuente (\`shared/htmlContract.ts\`). Va en inglés porque es una instrucción para el modelo; lo que el modelo escribe --la pantalla y su respuesta-- sigue siendo español. A este texto se le añaden, en el momento, las tablas de la aplicación con sus columnas, y las columnas propias de su tabla de personas, que son las que llegan a \`plane.usuario\`.`;

  const parts = [
    intro,
    LANGUAGE_SECTION,
    catalogSection(),
    colorSection(),
    measureSection(),
    craftSection(),
    DATA_SECTION,
    chartSection(),
    viewerSection({}),
    rolesSection(),
    savingSection(),
    limitsSection(),
    shapeSection(),
  ];

  return [parts[0], ...parts.slice(1).map(demote)].join("\n\n");
}

/** Secciones de la misma referencia, recuperables sin cargar el catálogo entero. */
export function htmlGuide(topic: string): string | null {
  switch (topic) {
    case "estilos":
      return [catalogSection(), colorSection(), measureSection(), craftSection()].join("\n\n");
    // Partes de "estilos", para leer solo lo que hace falta.
    case "componentes":
      return catalogSection();
    case "colores":
      return colorSection();
    case "medidas":
      return measureSection();
    case "oficio":
      return craftSection();
    case "datos":
      return [DATA_SECTION, savingSection(), relationsSection()].join("\n\n");
    case "graficas":
      return chartSection();
    case "bloques":
      return [shapeSection(), blocksSection()].join("\n\n");
    case "iconos":
      return iconsGuide();
    default:
      return null;
  }
}

/** Cómo se usan los iconos, sin lista: los nombres se buscan con `buscar_iconos`. */
function iconsGuide(): string {
  return `An icon is \`<i class="hgi-stroke hgi-NAME"></i>\`. The font holds more than six thousand names; none is listed here. Find them with "buscar_iconos" using English keywords --several at once if you need icons for several things-- and use only names it returned. Write each name literally in the document (\`hgi-NAME\` or a quoted string with the exact name); a name built by joining text is not loaded. Icons take colour and size from their line (1.2em of it); where an icon leads --a section tile, a feature, an empty state-- give it its own size with the --type-* scale (xl for a tile, 2xl for a feature, 3xl for an empty state), never px. Never emojis, never hand-drawn SVG.`;
}
