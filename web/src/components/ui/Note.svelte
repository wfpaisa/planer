<!--
  Un aviso con un mensaje suelto.

  Los avisos ya no se dibujan donde estan escritos: van todos a la capa de
  `Toast`, arriba a la derecha. En React el mensaje era el hijo y el aviso
  desaparecia solo con el; aqui el hijo siempre existe, asi que el mensaje es
  una prop y el aviso se dibuja solo cuando dice algo. Para un aviso con
  formato --varios parrafos, un enlace-- se pasa `children` y se controla desde
  fuera cuando se ensena.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import Toast, { type ToastKind } from "../Toast.svelte";

  let {
    kind = "error",
    message = "",
    duration,
    children,
  }: {
    kind?: ToastKind;
    message?: string;
    duration?: number;
    children?: Snippet;
  } = $props();
</script>

{#if children}
  <Toast {kind} {duration}>{@render children()}</Toast>
{:else if message}
  <Toast {kind} {duration} key={message}>{message}</Toast>
{/if}
