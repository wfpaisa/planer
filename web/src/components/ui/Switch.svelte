<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    onchange,
  }: {
    checked?: boolean;
    label?: string;
    onchange?: (value: boolean) => void;
  } = $props();
</script>

<!-- El interruptor del sistema: `choice` ordena etiqueta y control, y
     `switch` pinta la pista con su perilla (components.css). -->
<label class="switch-control choice switch">
  <input
    type="checkbox"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    bind:checked
    onchange={(e) => onchange?.(e.currentTarget.checked)}
  />
  {#if label}
    <span class="switch-label">{label}</span>
  {/if}
</label>

<style>
  .switch-control {
    cursor: pointer;
  }
</style>
