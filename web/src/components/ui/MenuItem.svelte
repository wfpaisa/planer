<script lang="ts">
  import type { Snippet } from "svelte";

  import { cx } from "../../lib/cx";

  let {
    icon,
    danger = false,
    disabled = false,
    onclick,
    class: className,
    children,
  }: {
    icon?: Snippet;
    danger?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<button
  type="button"
  {disabled}
  onclick={disabled ? undefined : onclick}
  class={cx(danger && "danger", className)}
>
  {@render icon?.()}
  <span class="menu-item-content">{@render children()}</span>
</button>

<style>
  .menu-item-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
