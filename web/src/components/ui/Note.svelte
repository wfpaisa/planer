<!--
  Un aviso con un mensaje suelto.

  Los avisos ya no se dibujan donde estan escritos: van todos a la capa de
  `Toast`, arriba a la derecha. En React el mensaje era el hijo y el aviso
  desaparecia solo con el; aqui el hijo siempre existe, asi que el mensaje es
  una prop y el aviso se dibuja solo cuando dice algo. Para un aviso con
  formato --varios parrafos, un enlace-- se pasa `children` y se controla desde
  fuera cuando se enseña.
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
  <!--
    El mensaje puede traer dos renglones: `errorMessage` pone arriba lo que hay
    que arreglar y debajo lo que dijo la API para llegar ahi --su código, su
    estado, su cuerpo cuando no se reconoce--. El de abajo se dibuja mas
    apagado: se lee si hace falta y se copia siempre, pero no compite con el de
    arriba. Partirlo aqui y no en `errorMessage` es lo que deja el mensaje
    siendo una cadena para todo el panel.
  -->
  {@const cut = message.indexOf("\n")}
  <Toast {kind} {duration} key={message}>
    <span class="note-message">{cut < 0 ? message : message.slice(0, cut)}</span>
    {#if cut >= 0}
      <span class="note-detail">{message.slice(cut + 1)}</span>
    {/if}
  </Toast>
{/if}

<style>
  .note-message {
    display: block;
  }

  .note-detail {
    display: block;
    margin-top: var(--sp-4);
    white-space: pre-line;
    opacity: 0.75;
    /* Un detalle sin espacios --un JSON, el nombre de una colección-- no puede
       desbordar el aviso, que tiene ancho tope. */
    overflow-wrap: anywhere;
  }
</style>
