<script lang="ts">
  import type { Snippet } from "svelte";

  import Note from "./Note.svelte";

  let {
    message = "",
    duration,
    children,
  }: { message?: string; duration?: number; children?: Snippet } = $props();
</script>

<Note kind="warning" {message} {duration} {children} />
