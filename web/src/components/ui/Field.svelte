<script lang="ts">
  import type { Snippet } from "svelte";

  import Icon from "../Icon.svelte";

  let {
    id,
    label,
    icon,
    hint,
    children,
  }: {
    id?: string;
    label: string;
    /** Icono de la fuente, delante de la etiqueta, para lo que tiene marca propia. */
    icon?: string;
    hint?: string;
    children: Snippet;
  } = $props();
</script>

<!-- La etiqueta envuelve el control: la asociacion es implicita. -->
<label {id} class="field block">
  <span class="field-label">
    {#if icon}<Icon name={icon} />{/if}
    {label}
  </span>
  {@render children()}
  {#if hint}
    <span class="field-hint">{hint}</span>
  {/if}
</label>

<style>
  .field {
    & .field-label {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-bottom: var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      font-weight: 500;
      color: var(--text-secondary);
    }

    & .field-hint {
      display: block;
      margin-top: var(--sp-4);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }
  }
</style>
