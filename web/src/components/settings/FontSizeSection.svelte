<!--
  El tamaño elegido se aplica al guardar.
-->
<script lang="ts" module>
  import { FONT_SIZE_MAX, FONT_SIZE_MIN, FONT_SIZE_STEP } from "../../lib/fontSize.svelte";

  const TICKS = Array.from(
    { length: (FONT_SIZE_MAX - FONT_SIZE_MIN) / FONT_SIZE_STEP + 1 },
    (_, i) => FONT_SIZE_MIN + i * FONT_SIZE_STEP,
  );
</script>

<script lang="ts">
  import { fontSize } from "../../lib/fontSize.svelte";
  import Icon from "../Icon.svelte";
  import SettingsSection from "../SettingsSection.svelte";
  import { Button } from "../ui";

  // El panel no cambia de escala hasta guardar; mientras tanto solo cambia el valor.
  let pending = $state(fontSize.percent);
</script>

{#snippet icon()}
  <Icon name="type" />
{/snippet}

{#snippet footer()}
  <Button
    variant="secondary"
    disabled={pending === fontSize.percent}
    onclick={() => fontSize.set(pending)}
  >
    Guardar tamaño
  </Button>
{/snippet}

<SettingsSection
  id="ajustes-tamano-letra"
  {icon}
  {footer}
  title="Tamaño de letra"
  description="Aumenta o reduce el tamaño del texto y los controles del panel."
  class="section-font-size"
>
  <div class="body-font-size w-full">
    <input
      type="range"
      min={FONT_SIZE_MIN}
      max={FONT_SIZE_MAX}
      step={FONT_SIZE_STEP}
      bind:value={pending}
      aria-label="Tamaño de letra"
      class="slider-font-size field-control"
    />
    <div class="ticks-font-size">
      {#each TICKS as tick (tick)}
        <span>|</span>
      {/each}
    </div>
    <div class="values-font-size">
      {#each TICKS as tick (tick)}
        <span>{tick}%</span>
      {/each}
    </div>
  </div>
</SettingsSection>

<style>
  .body-font-size {
    & .slider-font-size {
      width: 100%;
      cursor: pointer;
    }

    & .ticks-font-size,
    & .values-font-size {
      display: flex;
      justify-content: space-between;
      padding-inline: var(--sp-10);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }

    & .ticks-font-size {
      margin-top: var(--sp-8);
    }

    & .values-font-size {
      margin-top: var(--sp-8);
      font-variant-numeric: tabular-nums;
    }
  }
</style>
