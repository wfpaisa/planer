<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    icon,
    title,
    description,
    action,
  }: {
    id?: string;
    icon?: Snippet;
    title: string;
    description?: string;
    action?: Snippet;
  } = $props();
</script>

<div {id} class="placeholder-empty flex flex-col items-center justify-center gap-3 text-center">
  {#if icon}
    <div class="empty-icon">{@render icon()}</div>
  {/if}
  <div class="empty-copy">
    <h3 class="empty-title">{title}</h3>
    {#if description}
      <p class="empty-description">{description}</p>
    {/if}
  </div>
  {@render action?.()}
</div>

<style>
  .placeholder-empty {
    padding: 4rem 1.5rem;

    & .empty-icon {
      display: flex;
      height: 2.75rem;
      width: 2.75rem;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      border: var(--border-width) solid var(--border);
      background: var(--bg-field);
      color: var(--text-muted);
    }

    & .empty-copy {
      & .empty-title {
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        font-weight: 500;
        color: var(--text-primary);
      }

      & .empty-description {
        margin-top: var(--sp-4);
        max-width: 24rem;
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        color: var(--text-secondary);
      }
    }
  }
</style>
