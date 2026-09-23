<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="menu-label eyebrow">
  {@render children()}
</div>

<style>
  /* El rotulo es `.eyebrow` del catálogo; aqui solo su hueco dentro del menu. */
  .menu-label {
    padding: var(--sp-8) var(--sp-10) var(--sp-4);
  }
</style>
