<script lang="ts">
  import Spinner from "./Spinner.svelte";

  let { label = "Cargando" }: { label?: string } = $props();
</script>

<div class="placeholder-loading flex h-full flex-col items-center justify-center gap-2">
  <Spinner />
  <span class="loading-label">{label}</span>
</div>

<style>
  .placeholder-loading {
    min-height: 10rem;
    color: var(--text-muted);

    & .loading-label {
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
    }
  }
</style>
