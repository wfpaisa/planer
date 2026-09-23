<!--
  El color a mano, completo: la muestra que anticipa el acento derivado
  (`data-palette="custom"`, igual que lo hace la aplicación de verdad), la
  rueda + el hexadecimal -- los presta `PaletteCustomField`, que ya resuelve
  lo delicado de escribir a medias -- y una fila de accesos rapidos para
  elegir sin saber ningún hexadecimal de memoria.

  El `data-palette="custom"` va en la RAÍZ del panel, no solo en la muestra:
  el anillo del acceso rápido elegido también pinta con `var(--accent)`, y si
  el atributo se quedará solo en la muestra ese anillo heredaria el acento
  ambiente del panel (el de quien construye, no el que se esta eligiendo) en
  vez del exacto que ya se ve en la muestra y en el hexadecimal.

  Vive aparte de `PaletteCustomField` porque ese es el campo suelto que basta
  al crear una aplicación (`CreateAppModal`); este panel es la versión larga,
  para cuando ya hay un catálogo entero al lado (`PalettePicker`).
-->
<script lang="ts">
  import { cx } from "../lib/cx";
  import PaletteCustomField from "./PaletteCustomField.svelte";

  let { value, onChange }: { value: string; onChange: (hex: string) => void } = $props();

  /* Accesos rapidos: un tono por familia, sueltos del catálogo de 46 --aqui
     no hace falta paleta entera, solo un punto de partida rápido. Los
     nombres son los mismos de los "Monocromos" de `shared/palettes.ts`: son
     la misma familia de color, asi que el hover dice "Esmeralda" y no
     "#00bc7d", que no le dice nada a quien no vive en hexadecimales. */
  const PRESETS = [
    { name: "Rojo", hex: "#fb2c36" },
    { name: "Naranja", hex: "#ff6900" },
    { name: "Ámbar", hex: "#fe9a00" },
    { name: "Amarillo", hex: "#f0b100" },
    { name: "Lima", hex: "#7ccf00" },
    { name: "Verde", hex: "#00c950" },
    { name: "Esmeralda", hex: "#00bc7d" },
    { name: "Turquesa", hex: "#00bba7" },
    { name: "Cielo", hex: "#00a6f4" },
    { name: "Azul", hex: "#2b7fff" },
    { name: "Índigo", hex: "#615fff" },
    { name: "Violeta", hex: "#8e51ff" },
    { name: "Púrpura", hex: "#ad46ff" },
    { name: "Rosa", hex: "#f6339a" },
    { name: "Carmín", hex: "#ff2056" },
    { name: "Pizarra", hex: "#62748e" },
  ] as const;
</script>

<div
  class="panel-palette-custom flex flex-col gap-3"
  data-palette="custom"
  style="--palette-1: {value}"
>
  <div class="custom-head-palette flex items-center gap-3">
    <div class="custom-preview-palette" aria-hidden="true">Aa</div>
    <div class="custom-field-palette flex-1">
      <PaletteCustomField
        label="Color principal"
        hint="Define el acento y los colores de las gráficas. El texto se ajusta para mantener el contraste."
        {value}
        {onChange}
      />
    </div>
  </div>

  <div
    class="custom-presets-palette flex flex-wrap gap-2"
    role="group"
    aria-label="Colores rapidos"
  >
    {#each PRESETS as preset (preset.hex)}
      <button
        type="button"
        class={cx(
          "btn-preset-palette",
          "swatch-preset-palette opt-tile swatch-color",
          value.toLowerCase() === preset.hex && "selected",
        )}
        style="background: {preset.hex}"
        data-tip={preset.name}
        aria-label="Usar {preset.name}"
        aria-pressed={value.toLowerCase() === preset.hex}
        onclick={() => onChange(preset.hex)}
      ></button>
    {/each}
  </div>
</div>

<style>
  .panel-palette-custom {
    & .custom-preview-palette {
      flex: none;
      display: grid;
      width: 5rem;
      height: 6rem;
      place-items: center;
      border-radius: var(--radius-md);
      border: var(--border-width) solid var(--border);
      background: var(--accent);
      color: var(--accent-text);
      font-size: var(--text-sm);
      font-weight: 800;
    }

    /* La muestra es `.opt-tile` del catálogo --el cerco y la marca de
       elegido-- con la medida de `.swatch-color`, la misma que el cuadro
       del color puesto ahi arriba. Nada propio que anadir. */
  }
</style>
