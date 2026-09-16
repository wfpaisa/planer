<!--
  El color a mano de una paleta personalizada.

  Vive aparte de `PalettePicker` porque al crear una aplicacion no hace falta
  el catalogo entero: se elige un color y afinar la paleta viene despues en
  los ajustes.

  El color se pinta como se elige: `palettes.css` deriva de el el acento y sus
  tintes, midiendo la tinta de encima para que contraste (igual que hace con
  las 46 del catalogo). Por eso el hexadecimal se admite entero, sin
  regatear.
-->
<script lang="ts">
  import { parseBrandColor } from "@shared/brand";

  import Field from "./ui/Field.svelte";

  let {
    label = "Color personalizado",
    hint,
    value,
    onChange,
  }: {
    label?: string;
    hint?: string;
    value: string;
    onChange: (hex: string) => void;
  } = $props();

  /*
   * Mientras el campo tiene el foco manda lo escrito; en cuanto lo pierde manda
   * el valor de verdad. Eso es lo que hace `draft`, y `null` quiere decir "no se
   * esta escribiendo": asi elegir la rueda de color se ve en el campo al
   * momento, y a la vez nada reescribe lo que alguien tiene a medias.
   *
   * Es la parte delicada. Sincronizar el campo con el valor en un efecto parecia
   * lo mismo y no lo era: al teclear "#e2e72d", en "#e2e" ya hay un color valido
   * --el atajo de tres digitos-- y el campo saltaba solo a "#EE22EE" con el
   * resto todavia sin escribir.
   */
  let draft = $state<string | null>(null);
  const shown = $derived(draft ?? value);

  /*
   * Escribiendo solo se admite el hexadecimal completo. Las comodidades --tres
   * digitos, sin almohadilla-- son para pegar un color, no para teclearlo, asi
   * que se aplican al terminar y no en cada tecla.
   */
  function edit(raw: string) {
    draft = raw;
    if (/^#[0-9a-f]{6}$/i.test(raw.trim())) onChange(raw.trim().toLowerCase());
  }

  /* Al salir del campo se acepta lo que sea un color, y lo que no lo sea se
     descarta volviendo al ultimo bueno: nunca se queda a medias. */
  function finish() {
    const hex = draft === null ? null : parseBrandColor(draft);
    if (hex) onChange(hex);
    draft = null;
  }
</script>

<Field {label} {hint}>
  <div class="row-palette-custom flex flex-wrap items-center">
    <!--
      El selector nativo es lo unico que sabe abrir la rueda de color del
      sistema, de donde sale el hexadecimal de una marca.
    -->
    <label class="input-palette-hex" data-tip="Escribir el color exacto">
      <span class="palette-swatch swatch-color" style="background: {value};"></span>
      <input
        type="color"
        {value}
        onchange={(e) => onChange(e.currentTarget.value.toLowerCase())}
        aria-label="{label}: elegir en la rueda de color"
        class="palette-color-native"
      />
      <input
        type="text"
        value={shown}
        oninput={(e) => edit(e.currentTarget.value)}
        onblur={finish}
        onkeydown={(e) => e.key === "Enter" && finish()}
        spellcheck="false"
        aria-label="{label}: código hexadecimal"
        class="palette-hex-field"
      />
    </label>
  </div>
</Field>

<style>
  .row-palette-custom {
    gap: var(--sp-6);

    & .input-palette-hex {
      display: flex;
      height: 2rem;
      cursor: pointer;
      align-items: center;
      gap: var(--sp-8);
      background: var(--bg-level2);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-sm);
      padding: 0 var(--sp-10) 0 var(--sp-6);
      transition: border-color 150ms;

      &:hover {
        border-color: var(--border-strong);
      }

      /* La rueda nativa escondida: se abre con el clic en la etiqueta. */
      & .palette-color-native {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        border-width: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      /* La medida y el radio los pone `.swatch-color`: es el mismo cuadro
         que los accesos rapidos de abajo. Aqui solo el cerco, que este no
         se pulsa y no lo recibe de `.opt-tile`. */
      & .palette-swatch {
        border: var(--border-width) solid var(--border);
      }

      & .palette-hex-field {
        width: 5.5rem;
        background: transparent;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        text-transform: uppercase;
        outline: none;
      }
    }
  }
</style>
