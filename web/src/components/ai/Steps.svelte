<!-- Lo que la IA toco, en una lista sobria: se mira de reojo, no se lee. -->
<script lang="ts">
  import type { AiStep } from "@shared/types";

  import Icon from "../Icon.svelte";

  let { steps }: { steps: AiStep[] } = $props();
</script>

<ul class="steps-ai flex flex-col gap-1">
  <!--
    Dos pasos iguales son normales --dos escrituras seguidas sobre la misma
    pagina dan el mismo resumen--, asi que la posicion es lo unico que
    distingue de verdad a uno de otro. La lista de un turno no se reordena ni
    se recorta: solo crece por el final.
  -->
  {#each steps as step, i (`${i}-${step.tool}`)}
    <li class="step-ai flex items-start">
      <Icon name="check" size={12} class="step-check" />
      <span class="step-summary">{step.summary}</span>
    </li>
  {/each}
</ul>

<style>
  .steps-ai {
    margin-top: var(--sp-8);
  }

  .step-ai {
    gap: var(--sp-6);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  /* El icono lo dibuja `Icon`, con la clase que le pasamos. */
  .step-ai :global(.step-check) {
    margin-top: 0.125rem;
    flex-shrink: 0;
    color: var(--success);
  }

  .step-summary {
    min-width: 0;
  }
</style>
