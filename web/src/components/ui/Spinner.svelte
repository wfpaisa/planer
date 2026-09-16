<script lang="ts">
  import { cx } from "../../lib/cx";

  let { class: className }: { class?: string } = $props();
</script>

<span class={cx("spinner", className)}></span>
