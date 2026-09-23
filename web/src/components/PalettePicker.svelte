<!--
  Elegir la paleta de una aplicación.

  Son las 46 de `palettes.css` en sus tres grupos (Vivos / Pasteles /
  Monocromos), la de partida de `theme.css` ("Por defecto", suelta y siempre
  a la vista) y el color a mano ("Personalizado"). Los cuatro se navegan con
  chips -- el mismo mecanismo de `paletteTabs` en el panel de referencia
  (`/home/projects/ia/dashboard`) -- para no tener que bajar por 46 muestras
  a la vez. "Personalizado" va primero y es el que se abre sin nada elegido
  todavía: es el punto de partida mas rápido, y de ahi sale el color a mano
  con el que arranca "Por defecto" (`DEFAULT_BRAND_COLOR`), para que las dos
  muestras coincidan. Cada muestra del catálogo es una rampa con los cuatro
  colores crudos de la paleta -- el principal manda y los tres acompanan.

  Detalle fino: el `data-palette` va en la RAMPA, no en el botón. La marca de
  "elegida" se pinta con el acento de la paleta puesta; si el atributo fuera
  del botón, cada muestra pintaria su marca con su propio acento y la
  elegida no se distinguiria de las demas.
-->
<script lang="ts">
  import { DEFAULT_BRAND_COLOR } from "@shared/brand";
  import type { PaletteGroup, PaletteInfo } from "@shared/palettes";
  import { CUSTOM_PALETTE, PALETTE_GROUPS, PALETTES } from "@shared/palettes";
  import type { AppTheme } from "@shared/types";

  import { cx } from "../lib/cx";
  import PaletteCustomPanel from "./PaletteCustomPanel.svelte";

  let { value, onChange }: { value: AppTheme; onChange: (next: AppTheme) => void } = $props();

  /* La de partida, pintada con sus colores fijos: ningún data-palette la
     activa, asi que la rampa no puede salir de una variable. */
  const DEFAULT_COLORS = [
    "oklch(60% 0.3 256)",
    "oklch(0.349 0 0)",
    "oklch(0.633 0 0)",
    "oklch(0.368 0 0)",
  ] as const;

  const byGroup = $derived(
    Object.fromEntries(
      PALETTE_GROUPS.map((g) => [g.id, PALETTES.filter((p) => p.group === g.id)]),
    ) as unknown as Record<PaletteGroup, readonly PaletteInfo[]>,
  );

  type Tab = "custom" | PaletteGroup;
  const TABS: { id: Tab; label: string }[] = [
    { id: "custom", label: "Personalizado" },
    ...PALETTE_GROUPS.map((g) => ({ id: g.id as Tab, label: g.label })),
  ];

  // Sin paleta puesta ("Por defecto") se entra al color a mano: es el punto
  // de partida mas rápido, y ahi mismo se ve resaltada la de partida.
  const tabOf = (palette: string | null): Tab => {
    if (palette === CUSTOM_PALETTE || palette === null) return "custom";
    return PALETTES.find((p) => p.id === palette)?.group ?? "custom";
  };

  // Se entra al grupo de la paleta puesta -- también si `value` llega
  // después del montaje, como al cargar los ajustes de una aplicación --;
  // desde ahi cada quien navega los chips a su gusto (el derived se deja
  // sobreescribir) sin que la paleta que ya tenia le vuelva a mover el
  // grupo por debajo, y solo se recalcula si `value.palette` cambia de
  // verdad.
  let activeTab = $derived<Tab>(tabOf(value.palette));

  // Elegir una paleta no se lleva el tamaño de letra: son dos mandos.
  const pick = (palette: string | null) => onChange({ ...value, palette });
</script>

<div class="picker-palette flex flex-col gap-3">
  <button
    type="button"
    aria-pressed={value.palette === null}
    onclick={() => pick(null)}
    class={cx(
      "btn-palette-default",
      "swatch-palette opt-tile",
      value.palette === null && "selected",
    )}
  >
    <span class="ramp-palette">
      {#each DEFAULT_COLORS as color, j (j)}<i style="background:{color}"></i>{/each}
    </span>
    <span class="name-palette">Por defecto</span>
  </button>

  <div class="chips" id="paletteTabs">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        class={cx("btn-palette-tab", "chip", activeTab === tab.id && "active")}
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if activeTab === "custom"}
    <PaletteCustomPanel
      value={value.color ?? DEFAULT_BRAND_COLOR}
      onChange={(color) => onChange({ ...value, palette: CUSTOM_PALETTE, color })}
    />
  {:else}
    <div class="grid-palette">
      {#each byGroup[activeTab] as palette (palette.id)}
        <button
          type="button"
          aria-pressed={value.palette === palette.id}
          onclick={() => pick(palette.id)}
          class={cx(
            `btn-pick-palette-${activeTab}`,
            "swatch-palette opt-tile",
            value.palette === palette.id && "selected",
          )}
        >
          <span class="ramp-palette" data-palette={palette.id}>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span class="name-palette">{palette.name}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker-palette {
    & .grid-palette {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
      gap: var(--sp-10);
    }

    /* Rampa: el color principal manda, los tres de apoyo acompanan */
    & .ramp-palette {
      display: flex;
      height: 2rem;
      border-radius: calc(var(--radius-sm) + 0.0625rem);
      overflow: hidden;

      & i {
        display: block;
        flex: 1;
        background: var(--palette-1);

        &:nth-child(2) {
          background: var(--palette-2);
        }
        &:nth-child(3) {
          background: var(--palette-3);
        }
        &:nth-child(4) {
          background: var(--palette-4);
        }

        &:first-child {
          flex: 2.4;
        }
      }
    }

    /* La muestra es `.opt-tile` del catálogo --el cerco grueso, el pelo de
       levante y el halo de la elegida--; aqui solo su reparto: la rampa
       encima del nombre. */
    & .swatch-palette {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--sp-8);
      padding: var(--sp-8) var(--sp-8) var(--sp-9);
      background: var(--bg-level2);
      text-align: left;
    }

    /* La elegida entra con la marca al final del nombre, no solo el borde */
    & .swatch-palette.selected .name-palette::after {
      content: "\2713";
      margin-left: auto;
      width: 0.9375rem;
      height: 0.9375rem;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--accent);
      color: var(--accent-text);
      font-size: var(--text-xs);
      font-weight: 800;
    }

    & .name-palette {
      display: flex;
      align-items: center;
      gap: 0.3125rem;
      padding-left: 0.125rem;
      font-size: var(--text-xs);
      font-weight: 700;
    }

    & .btn-palette-default {
      width: fit-content;
      min-width: 8rem;
    }
  }
</style>
