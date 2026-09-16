<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../../lib/cx";

  let {
    icon,
    danger = false,
    onclick,
    class: className,
    children,
  }: {
    icon?: Snippet;
    danger?: boolean;
    onclick?: () => void;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<button type="button" {onclick} class={cx(danger && "danger", className)}>
  {@render icon?.()}
  <span class="menu-item-content">{@render children()}</span>
</button>

<style>
  .menu-item-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
