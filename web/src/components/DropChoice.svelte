<!--
  Una de las cosas que se pueden hacer con el archivo que se acaba de soltar.

  Todas se ven igual --nombre arriba, lo que va a pasar debajo-- porque todas
  son lo mismo: una salida de la misma pregunta. Lo que va debajo no describe la
  opcion, cuenta la consecuencia, que es lo unico que hace falta para elegir.
-->
<script lang="ts">
  import { cx } from "../lib/cx";

  let {
    label,
    hint,
    onclick,
    buttonClass,
  }: {
    label: string;
    hint: string;
    onclick: () => void;
    buttonClass: string;
  } = $props();
</script>

<button type="button" {onclick} class={cx(buttonClass, "drop-choice opt")}>
  <span class="opt-body">
    <span class="drop-choice-label opt-label">{label}</span>
    <span class="drop-choice-hint opt-hint">{hint}</span>
  </span>
</button>

<style>
  /* La caja es `.opt` del catalogo, con su par `.opt-label` / `.opt-hint`.
     Aqui solo el respiro: la salida de una pregunta se lee entera, asi que
     va mas holgada que una celda de rejilla. La consecuencia, ademas, puede
     ocupar dos renglones. */
  .drop-choice {
    padding: var(--sp-12) var(--sp-16);

    & .drop-choice-hint {
      white-space: normal;
    }
  }
</style>
