<!--
  Llevarse la respuesta. Vive escondido hasta que el puntero pasa por encima
  del turno --o hasta que el teclado llega a el--: esta cuando hace falta y no
  ensucia la lectura el resto del tiempo.
-->
<script lang="ts">
  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  let { text }: { text: string } = $props();

  let done = $state(false);

  // El visto bueno dura lo justo para verse y se va solo.
  $effect(() => {
    if (!done) return;
    const timer = setTimeout(() => (done = false), 1600);
    return () => clearTimeout(timer);
  });

  function copy() {
    navigator.clipboard
      ?.writeText(text)
      .then(() => (done = true))
      .catch(() => {
        /* sin permiso del navegador no hay copia, y tampoco hay que avisar */
      });
  }
</script>

<button
  type="button"
  aria-label={done ? "Copiado" : "Copiar la respuesta"}
  onclick={copy}
  class={cx("btn-copy-ai-answer shrink-0", done && "copied")}
>
  <Icon name={done ? "check" : "copy-01"} size={13} />
</button>

<style>
  .btn-copy-ai-answer {
    margin-left: auto;
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: var(--sp-4);
    color: var(--text-muted);
    opacity: 0;
    transition:
      background-color 150ms,
      color 150ms,
      opacity 150ms;

    &:hover {
      background: var(--bg-field);
      color: var(--text-primary);
    }

    &:focus-visible {
      opacity: 1;
    }

    /* Lo trae a la vista el turno que lo contiene: `.group` en el padre. */
    :global(.group:hover) & {
      opacity: 1;
    }

    &.copied {
      opacity: 1;
      color: var(--success);
    }
  }
</style>
