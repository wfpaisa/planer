<!--
  El tamaño de letra de la aplicación: quien la construye lo elige y lo ven
  todos, también los visitantes. Es el segundo mando de la apariencia, junto
  a la paleta.

  Va en porcentaje, como el del panel (`settings/FontSizeSection.svelte`),
  pero escribe en el tema de la aplicación, no en este navegador.
-->
<script lang="ts">
  import {
    FONT_SCALE_DEFAULT,
    FONT_SCALE_MAX,
    FONT_SCALE_MIN,
    FONT_SCALE_STEP,
  } from "@shared/brand";
  import type { AppTheme } from "@shared/types";

  let { value, onChange }: { value: AppTheme; onChange: (next: AppTheme) => void } = $props();

  const percent = $derived(Math.round((value.fontScale ?? FONT_SCALE_DEFAULT) * 100));

  function set(next: number) {
    const fontScale = next / 100;
    onChange({
      ...value,
      // En el tamaño normal no se guarda: manda el de partida.
      fontScale: fontScale === FONT_SCALE_DEFAULT ? undefined : fontScale,
    });
  }
</script>

<label class="field app-font-size">
  <span class="field-label">
    Tamaño de letra
    <span class="range-val">{percent}&nbsp;%</span>
  </span>
  <input
    type="range"
    min={Math.round(FONT_SCALE_MIN * 100)}
    max={Math.round(FONT_SCALE_MAX * 100)}
    step={FONT_SCALE_STEP * 100}
    value={percent}
    oninput={(e) => set(Number(e.currentTarget.value))}
    aria-label="Tamaño de letra de la aplicación"
    class="slider-app-font-size"
  />
  <span class="field-hint">
    Escala del texto de la aplicación publicada respecto al tamaño normal.
  </span>
</label>

<style>
  .app-font-size {
    & .slider-app-font-size {
      width: 100%;
      cursor: pointer;
    }
  }
</style>
