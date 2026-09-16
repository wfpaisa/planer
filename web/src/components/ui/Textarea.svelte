<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";

  import { cx } from "../../lib/cx";

  let {
    value = $bindable(""),
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLTextareaAttributes, "class"> & {
    class?: string;
    ref?: HTMLTextAreaElement | null;
  } = $props();
</script>

<textarea
  {...rest}
  bind:this={ref}
  bind:value
  class={cx("textarea-form-control field-control w-full", className)}></textarea>

<style>
  .textarea-form-control {
    min-height: 5rem;
    padding-top: var(--sp-8);
    padding-bottom: var(--sp-8);
  }
</style>
