<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLSelectAttributes } from "svelte/elements";

  import { cx } from "../../lib/cx";

  let {
    value = $bindable(""),
    class: className,
    children,
    ...rest
  }: Omit<HTMLSelectAttributes, "class"> & { class?: string; children?: Snippet } = $props();
</script>

<select {...rest} bind:value class={cx("select-form-control field-control w-full", className)}>
  {@render children?.()}
</select>
