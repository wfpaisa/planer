---
name: Planer
description: Plataforma no-code para crear aplicaciones web pequeñas y sus Base de datos, con IA.
colors:
  primary: "#007EFF"
  primary-soft-text: "#0b2a99"
  primary-content: "#ffffff"
  paper: "#ffffff"
  paper-field: "#f5f5f5"
  line: "#e4e4e4"
  line-strong: "#cfcfcf"
  ink: "#161616"
  ink-soft: "#4b4b4b"
  ink-faint: "#8a8a8a"
  paper-dark: "#161616"
  paper-page-dark: "#0b0b0b"
  line-dark: "#242424"
  line-strong-dark: "#2e2e2e"
  ink-dark: "#f2f2f2"
  ink-soft-dark: "#ababab"
  ink-faint-dark: "#6e6e6e"
  accent-dark: "#5c7cff"
  success: "#0f9f6e"
  warning: "#a06100"
  danger: "#d6273b"
typography:
  display:
    fontFamily: "Quicksand, system-ui, -apple-system, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Quicksand, system-ui, -apple-system, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Quicksand, system-ui, -apple-system, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  body:
    fontFamily: "Quicksand, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Quicksand, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.05em"
    textTransform: "uppercase"
  mono:
    fontFamily: "Reddit Mono, monospace"
rounded:
  sm: "8px"
  md: "11px"
  lg: "16px"
  xl: "20px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "40px"
components:
  button-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "38px"
    typography: "{typography.body}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-content}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "38px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "38px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "38px"
  input:
    backgroundColor: "{colors.paper-field}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.lg}"
    padding: "16px"
  badge:
    backgroundColor: "{colors.paper-field}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "4px 9px"
  switch-track:
    backgroundColor: "{colors.paper-field}"
    border: "2px solid {colors.line-strong}"
    rounded: "{rounded.full}"
    height: "26px"
    width: "46px"
---

# Design System: Planer

## Overview

Planer is a self-hosted workbench where a builder arrives with a phrase and leaves with a published app. The interface is drawn entirely by its own CSS system — no utility framework, no component library: three self-contained stylesheets (`theme.css` tokens + reset, `palettes.css` the 46 palettes, `components.css` the component catalog) plus `layout.css` (layout utilities) and `compat.css` (the bridge that keeps the page-HTML contract alive). Everything is painted from tokens, and every token can be re-pointed by a palette without touching a single component.

**Key Characteristics:**
- Pure CSS, no build step: components resolve behavior with `:checked`, `:has()`, `popover`, `@starting-style`, `anchor-name`.
- Three text levels, three surface levels, two line weights: the whole vocabulary of grays.
- One accent per context — the app's palette provides it; the panel default is a deep blue (`#007EFF` light / `#5c7cff` dark).
- Mode (light/dark) is chosen by the viewer with `data-theme`; palette is chosen by the builder with `data-palette`. Both attributes live **on the same element**, and derivation is written once via `light-dark()`.
- Requires a modern browser: `oklch()`, `light-dark()`, `oklch(from …)`, `:has()`, nested CSS, `popover` (Chrome 125+ / Safari 17.5+).

## Colors

Color is **reconfigurable by design**. `theme.css` declares the default tokens (light on `:root`/`[data-theme="light"]`, dark on `[data-theme="dark"]`); `palettes.css` only *overrides* them when an element carries `data-palette`. A palette is four raw OKLCH colors (`--palette-1…4`); everything the UI sees — accent, hover, soft, focus ring, data series, tints — is *derived* in one block with `color-mix()` and relative `oklch(from …)`. The ink over a filled accent is decided by a WCAG-matched luminance switch, not by JS.

- **46 palettes** in three groups: 15 vivid, 15 pastel, 16 monochrome. Plus `custom`: the only palette where a hex travels through JS (`--palette-1` inline); its three companions are the mono neutrals.
- **Per-app appearance** (`shared/brand.ts`): `{ palette: id | null, color?: hex, fontScale?: 0.8–1.6 }`. `palette: null` means the default; `custom` carries the hex. Old `{primary, secondary}` apps read back as `custom` with their primary color.
- **Tag colors** are the four tint classes of the active palette (`.tint-1…4`, each a `--tint-N-bg` / `--tint-N-fg` pair), handed out by hashing the label text (`colorFor()` in `web/src/lib/appTheme.ts`). They already contrast in both modes.
- **The vivid twelve** (`--vivid-*` + `-ink`) stay as an extra resource for things that *mean* a color (legends, categories, drawings). They never paint chrome.

### Named Rules
**La Regla del Mismo Elemento.** `data-theme` and `data-palette` go on the *same* element whenever the element is the app: `light-dark()` reads the `color-scheme` of the element where it is declared, so a palette on a *parent* of the theme element colors nothing. The bridge is declared on `:root, [data-theme], [data-palette]`, so an element that carries only the palette — an app's icon inside the panel chrome, which must take the app's color but the viewer's mode — recomputes both the native tokens and the bridge's `--color-*` right there, inheriting the mode from above. What does not recompute by itself is what is *inherited*: a container that flips `data-theme` restores `color` (`theme.css` does it), but its **background is the drawer's job** — without an explicit one it shows the document underneath.

**La Regla de los Tres Tonos de Tinta.** `--text-primary` (what you read first), `--text-secondary` (copy and labels), `--text-muted` (footnotes, placeholders). Never a fourth gray.

**La Regla del Token, Nunca el Literal.** No rule outside `theme.css`/`palettes.css` writes a color. If a component needs a color, a token exists or gets created.

## Typography

**Display Font:** Quicksand (Google Fonts; fallback `system-ui, -apple-system, sans-serif`)
**Body Font:** Quicksand
**Mono Font:** Reddit Mono

**Character:** one rounded, friendly sans across the board; hierarchy is won with weight (500–800) and the size scale, never with a second face. The whole sheet is in `rem`, so the root font-size (an inline `font-size` percentage on `html`, panel setting `plane-font-size`; per-app `fontScale` on the app container via `font-size: calc(1rem * var(--font-scale))`) rescales everything at once.

### Hierarchy
- **Display** (800, 1.875rem, `-0.01em`): modal titles (`modal-head h2`).
- **Headline** (700, 1.5rem): screen titles (`--text-2xl`).
- **Title** (700, 1.125rem): card titles (`card-title`, `--text-md`).
- **Body** (500–600, 0.875rem, 1.5): the working size — cells, buttons, menus, forms (`--text-sm`).
- **Label** (700, 0.75rem, uppercase on table heads): field labels and column heads (`--text-xs`).

### Named Rules
**La Regla de la Escala Corta.** Seven sizes, `--text-xs` … `--text-3xl`. New text picks one of them; no in-between measures.

## Layout

Utilities live in `layout.css` (`flex`, `grid`, `gap-*`, `items-*`…), indexed on the quarter-rem scale and multiplied by `--spacing`. Component paddings use the `--sp-*` steps (4→40) and `--card-gap` for card grids. `.container` caps content at `90rem` with 2rem of air. The builder is a full-height flex column: sticky top bar, sidebar, editing surface. Breakpoint `md`: 48rem.

## Elevation & Depth

Four shadow tokens, by how far something leaves the page: `--shadow-sm` (buttons, chips barely detach), `--shadow-md` (cards resting on the canvas), `--shadow-lg` (modal, drawer, toast — everything that floats), `--shadow-xl` (what opens *over* the content and covers it: the menu and a select's list, two layers and more ink). Those popovers also swap the card's surface and line for `--bg-float` and `--border-float`, a notch lighter and a notch stronger in dark, so a menu never melts into the card under it. The primary button and danger also carry a colored glow (`0 .5rem 1.25rem -.625rem <accent>`) instead of a gray blur.

### Named Rules
**La Regla Plana por Defecto.** Hover is a fill (`oklch(from var(--text-primary) l c h / 6%)`), not a shadow. Shadows lift what floats; borders separate what rests.

## Shapes

Radii come from `--radius-scale`: `--radius-sm` (8px, inner boxes, menu items), `--radius-md` (11px, buttons, inputs, menus), `--radius-lg` (16px, cards, drawers), `--radius-xl` (20px, modal). `62.5rem` is the pill (`tag`, `btn-rounded`, switch track). The modifiers of `.btn` / `.btn-icon` / `.mini-btn` come *after* the base class in the stylesheet on purpose: same specificity, they win by source order — the same trick the markup must respect (modifiers after the base class in `class`).

## Components

The catalog is `components.css`; markup recipes live in `.claude/skills/plane-ui/references/componentes.md`. The panel's React-free kit (`web/src/components/ui/`) wraps the catalog pieces with Svelte props and state.

### Buttons
- `.btn` — paper fill, hairline border, 38px, rounded `--radius-md`, shadow `--shadow-sm`.
- `.btn-primary` — the accent fill (the app's color, ink chosen by the WCAG switch). One per view.
- `.btn-ghost` — no fill, no border; hover is the only thing that draws it.
- `.btn-danger` — red fill, never the primary. `.btn-ghost.btn-danger` — discreet destructive (red text, red wash on hover).
- `.btn-icon` — square icon-only, `.sm` 32px; `.btn-rounded` pills any of them; `.mini-btn` (28px) lives inside rows.
- Loading: `.is-loading > i` spins, or drop a `.spinner` inside.

### Inputs / Fields
- Controls are naked elements inside a `.field` — the field dresses them (38px, `--bg-field` fill, hairline border, focus ring `--focus-ring`). Standalone controls — a toolbar's search box, a grid cell — take `.field-control`: the same dress, written next to `.field`'s in `components.css` so the two can never drift. `sm` shortens either.
- `.field-row` lines fields up; `.field-hint` speaks under the control; `.range-val` shows a slider's current value.
- The select arrow is drawn with two gradients so it follows `--text-muted`.

### Checkbox / Radio / Switch
- `<label class="choice">` + hidden input + `<i class="choice-box hgi-tick-02 ico-nudge">`; `.round` makes a radio. `.choice.switch` turns the label into a toggle: the input is the track, `::after` the knob.

### Cards
- `.card` (flex column, hairline border, `--radius-lg`) with `card-head` / `card-title` / `card-sub` / `card-head-actions` / `card-body` / `card-foot`. The foot anchors to the bottom via `margin-top: auto`, so sibling cards align.
  The settings sections (`SettingsSection.svelte`) are cards: the head only carries the title and the blurb, and every action — the Save button above all — lives in the `card-foot`, which pushes it to the right. Explanatory text in that foot is marked `foot-settings-note` so it stays on the left.
  `/demo` puts the whole catalog on one page with the same stylesheets (`routes/Demo.svelte` + `components/demo/DemoGallery.svelte`, copied from the reference dashboard). Look there after touching `components.css`: it is the only place where every state of every component is on screen at once.

### Chips (tabs & segments)
- `.chips` — one sliding pill drawn by `::before`, positioned by `:has(> :nth-child(N))`. **Max 6 options.** Buttons get `.chip`, the active one `.active`; hidden radios work too. `.tabs` + `.tab-panels` switch `max 3` panels, no JS.

### Tags
- `.tag` — pill, `--text-xs`, bold. The colour is always a class, never an inline style: `.tint-1` is the normal one, `.tint-2…4` spread categories apart, `.tag-success` / `.tag-warning` / `.tag-error` are the ones that really mean fine, careful and wrong. The bare pill — no tint class — is the **off** state, so a toggle is `.tint-1` added and removed. No size variants and no in-row variant. `.tag-remove` is the little cross that lives *inside* it and inherits its ink. In the panel the markup is never hand-written: `ui/Tag.svelte` emits it (`tone`, defaulting to `tint-1`, with `tone="off"` for the off state; `onRemove`; `onclick` + `pressed` for a toggle).
- `.badge-success` / `.badge-warning` / `.badge-error` are a different thing: a pulsing status dot on the element itself, not a pill with text.

### Menu / Dropdown
- `.menu-btn` (with `anchor-name: --menu`) opens `.menu[popover]`, positioned with `position-area: bottom span-right` under `@supports`. Items are plain buttons; `.danger` tints them red; `.menu-sep` separates groups. The panel's `Dropdown.svelte` wraps its own JS open/close.

### Modal / Drawer / Toast
- All three are popovers: the browser handles top layer, Esc and backdrop. `.modal` centers with `margin: auto` (`--modal-w` per instance), skeleton `modal-head` / `modal-body` (the scroller) / `modal-foot`. `.drawer.left|.right` slides with `@starting-style`. `.toast` is corner-fixed, tone via `.info .ok .warn .danger` (shared with `.alert`).

### Table
- `.table` inside `.table-wrap` (horizontal scroll lives there, never on the page); `.table-card` clips corners; `.table-foot` carries count + pager and goes **inside `<tfoot>`**, in a cell spanning every column — never a `<div>` after the `</table>`. Optional `.table-striped`.

## Do's and Don'ts

### Do:
- **Do** put `data-theme` and `data-palette` on the same element when that element is the app; give a container that flips the theme its own background.
- **Do** write every color as a token; the CSS own to a component goes in its scoped `<style>`.
- **Do** keep the semantic class first in `class` (`btn-open-people modal-new-app`), then the system's.
- **Do** use the four tints for labels and avatars; they are measured for both modes.

### Don't:
- **Don't** reach for Tailwind or daisyUI classes — they are gone from the repo.
- **Don't** name palette selectors with attribute matches (`[class*="theme-"]` catches `.theme-btn` too); enumerate them.
- **Don't** leave an inline `--palette-1` behind when leaving `custom` — inline beats any `[data-palette]`.
- **Don't** touch `shared/htmlContract.ts` or the server prompts without running `bun run harness`: `compat.css` and `contract.css` are what keep their variable names alive, and the harness is what proves they still do.
- A page's HTML now loads these same sheets (`/plane/estilos.css`, built in `server/pageStyles.ts`), so `.btn`, `.card`, `.table`, `.field` and the rest are the same pieces in the panel and in what gets published. A page that hand-rolls one of them gets told so by `server/htmlAudit.ts`, which runs on every write and every check.
- **Don't** paint a tag with an inline style or a class of your own: the tint classes already carry fill and ink measured against each other. `colorFor()` in `lib/appTheme.ts` returns the *name* of a tint, which is all a tag ever needs.
