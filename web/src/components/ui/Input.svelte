<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  import { cx } from "../../lib/cx";

  let {
    value = $bindable(""),
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLInputAttributes, "class"> & {
    class?: string;
    /** El nodo, para quien necesite pedirle el foco. */
    ref?: HTMLInputElement | null;
  } = $props();
</script>

<input
  {...rest}
  bind:this={ref}
  bind:value
  class={cx("input-form-control field-control w-full", className)}
/>
