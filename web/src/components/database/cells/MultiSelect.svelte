<!-- Varias opciones de una lista, marcadas o no. -->
<script lang="ts">
  import { Tag } from "../../ui";

  let {
    options,
    value,
    onChange,
  }: { options: string[]; value: string[]; onChange: (v: string[]) => void } = $props();

  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
</script>

<div class="container-multiselect inset flex flex-wrap">
  {#each options as option (option)}
    {@const on = value.includes(option)}
    <!--
      Cada opcion es una etiqueta del catalogo que se enciende, igual que los
      niveles de un modelo: marcada lleva su tinte, sin marcar se queda sin
      fondo para que solo se lean las puestas.
    -->
    <Tag
      tone={on ? "tint-1" : "off"}
      class="btn-toggle-multiselect-option"
      ariaLabel={`Opción ${option}`}
      pressed={on}
      onclick={() => toggle(option)}
    >
      {option}
    </Tag>
  {/each}
  {#if options.length === 0}
    <span class="multi-option-empty">Sin opciones</span>
  {/if}
</div>

<style>
  /* La caja es `.inset` del catalogo: dentro de una celda, las opciones van
     en un solo contorno hundido, igual que en el selector de acceso. */
  .container-multiselect {
    gap: var(--sp-6);

    & .multi-option-empty {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }
  }
</style>
