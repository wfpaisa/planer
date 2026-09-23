<!--
  Cortar el plan a mitad de conversación (D4): un botón, no un texto que el
  usuario escriba para que el modelo lo interprete como orden de cierre.

  Vive al pie del ultimo turno, donde esta el plan que se va a cortar, y no en
  la barra de abajo: aparece solo cuando hay algo que cerrar, y se lee con lo
  ultimo que dijo la IA, que es con lo que se decide si ya basta de conversar.
-->
<script lang="ts">
  import Icon from "../Icon.svelte";
  import { Button } from "../ui";

  let { onCut }: { onCut: () => void } = $props();
</script>

<div class="cut-plan-ai flex justify-end">
  <Button
    size="sm"
    variant="ghost"
    tip="Cierra el plan con lo que hay hasta ahora y pasa a construir"
    buttonClass="btn-cut-plan"
    onclick={onCut}
  >
    <Icon name="clipboard-check" size={15} /> Implementar ahora
  </Button>
</div>

<style>
  .cut-plan-ai {
    margin-top: var(--sp-8);
  }
</style>
