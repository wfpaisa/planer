<!--
  El plan con el que la IA cerro el modo Plan.

  Mismo patron que Question.svelte: se lee dentro de la conversacion, en el
  turno donde se cerro, con icono y estilo propios para distinguirlo de una
  respuesta normal (ver `design.md` D2 de `ia-modo-plan`).

  Pasar a modo Implementador es de un solo sentido: en cuanto `implementado`
  es verdadero, la tarjeta se queda sin el boton -- no se edita ni se reabre--
  y planear otra cosa exige activar el modo Plan de nuevo.
-->
<script lang="ts">
  import Icon from "../Icon.svelte";
  import Markdown from "../Markdown.svelte";
  import { Button } from "../ui";

  let {
    plan,
    live,
    onImplement,
  }: {
    plan: { texto: string; implementado: boolean };
    /** Se puede pasar a construir: es el ultimo turno y no hay nada en marcha. */
    live: boolean;
    onImplement: () => void;
  } = $props();
</script>

<div class="plan-ai card card-solid">
  <p class="plan-ai-header eyebrow">
    <Icon name="route-01" size={13} class="plan-ai-icon" />
    {plan.implementado ? "Plan implementado" : "Plan"}
  </p>
  <div class="plan-ai-text">
    <Markdown text={plan.texto} />
  </div>

  {#if !plan.implementado}
    <Button
      size="sm"
      variant="secondary"
      disabled={!live}
      buttonClass="btn-implement-plan"
      onclick={onImplement}
    >
      <Icon name="clipboard-check" size={18} /> ¡Todo listo, implementar!
    </Button>
  {/if}
</div>

<style>
  /* La caja es `.card.card-solid` del catalogo, igual que `Question.svelte`;
     aqui solo el hueco que la separa del turno de arriba y su acolchado. */
  .plan-ai {
    margin-top: var(--sp-8);
    padding: var(--sp-12);
  }

  .plan-ai-header {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    color: var(--accent);
  }

  :global(.plan-ai-icon) {
    color: var(--accent);
  }

  .plan-ai-text {
    margin-top: 0.125rem;
    color: var(--text-primary);
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
  }

  :global(.btn-implement-plan) {
    margin-top: var(--sp-10);
    width: fit-content;
    margin-left: auto;
  }
</style>
