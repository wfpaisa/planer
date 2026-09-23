<!-- Una salida a otra pantalla desde dentro de un panel. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    hint,
    onclick,
    children,
  }: { label: string; hint: string; onclick: () => void; children: Snippet } = $props();
</script>

<button type="button" {onclick} aria-label={label} class="btn-open-panel-entry entry-panel opt">
  <span class="icon-panel-entry">
    {@render children()}
  </span>
  <span class="text-panel-entry opt-body">
    <span class="label-panel-entry opt-label">{label}</span>
    <span class="hint-panel-entry opt-hint">{hint}</span>
  </span>
</button>

<style>
  /* La caja es `.opt` del catálogo, con su par `.opt-label` / `.opt-hint`;
     aqui solo la pastilla del icono, que es de esta pieza y no del catálogo. */
  .entry-panel {
    padding: var(--sp-8) var(--sp-12);

    & .icon-panel-entry {
      display: flex;
      height: 1.75rem;
      width: 1.75rem;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background: var(--bg-level1);
    }

    & .hint-panel-entry {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
