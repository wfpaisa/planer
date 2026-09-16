<!--
  Lo que la IA pregunto cuando no podia seguir sin saberlo.

  No es un dialogo encima de nada: se lee dentro de la conversacion, en el
  turno donde se pregunto, porque es parte de lo que la IA respondio.

  Elegir una opcion no contesta hacia atras --la peticion ya termino--: manda
  una peticion nueva que lleva dentro la pregunta y lo elegido. Por eso los
  botones solo estan vivos en el ultimo turno: contestar a una pregunta vieja
  reabriria algo que ya se resolvio.
-->
<script lang="ts">
  import type { AiQuestion, AiQuestionOption } from "@shared/types";

  let {
    question,
    live,
    onChoose,
  }: {
    question: AiQuestion;
    /** Se puede contestar: es el ultimo turno y no hay nada en marcha. */
    live: boolean;
    onChoose: (option: AiQuestionOption) => void;
  } = $props();
</script>

<div class="question-ai card card-solid">
  <p class="question-ai-header eyebrow">{question.header}</p>
  <p class="question-ai-text">{question.question}</p>

  <!--
    Dos opciones distintas pueden llegar con el mismo rotulo si el modelo se
    repite, asi que la posicion entra en la clave.
  -->
  <div class="question-ai-options flex flex-col">
    {#each question.options as option, i (`${i}-${option.label}`)}
      <button
        type="button"
        disabled={!live}
        onclick={() => onChoose(option)}
        class="btn-question-option opt"
      >
        <span class="opt-body">
          <span class="question-option-label opt-label">{option.label}</span>
          {#if option.description}
            <span class="question-option-hint opt-hint">{option.description}</span>
          {/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  /* La caja es `.card.card-solid` del catalogo --en oscuro la del catalogo es
     translucida y esta se posa sobre el fondo del chat--; aqui solo el hueco
     que la separa del turno de arriba y su acolchado, que es mas corto que el
     de una card de pantalla. */
  .question-ai {
    margin-top: var(--sp-8);
    padding: var(--sp-12);
  }

  .question-ai-text {
    margin-top: 0.125rem;
    color: var(--text-primary);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
  }

  .question-ai-options {
    gap: var(--sp-4);
    margin-top: var(--sp-8);
  }

  /*
   * Cada salida es `.opt` del catalogo, con su par `.opt-label` / `.opt-hint`,
   * y ocupa su linea entera: se eligen leyendolas, no comparando anchos, y el
   * detalle de abajo necesita el ancho para caber en una linea.
   */
  .btn-question-option {
    padding: var(--sp-8) var(--sp-12);

    & .question-option-label {
      white-space: normal;
    }

    & .question-option-hint {
      white-space: normal;
    }
  }
</style>
