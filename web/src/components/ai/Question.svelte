<!--
  Lo que la IA pregunto cuando no podia seguir sin saberlo.

  No es un diálogo encima de nada: se lee dentro de la conversación, en el
  turno donde se pregunto, porque es parte de lo que la IA respondio.

  Elegir una opción no contesta hacia atras --la petición ya termino--: manda
  una petición nueva que lleva dentro la pregunta y lo elegido. Por eso los
  botones solo estan vivos en el ultimo turno: contestar a una pregunta vieja
  reabriria algo que ya se resolvio.

  Debajo de las opciones va siempre "Otro": lo que la IA ofrece son las salidas
  que se le ocurrieron, no todas las que hay, y sin una salida abierta la única
  forma de decir la tercera cosa era ignorar la pregunta y escribir abajo,
  perdiendo el hilo de a que se estaba contestando. Se escribe aqui, en la
  pregunta, y se manda como una respuesta mas.
-->
<script lang="ts">
  import type { AiQuestion, AiQuestionOption } from "@shared/types";

  import Icon from "../Icon.svelte";
  import { Button, Textarea } from "../ui";

  let {
    question,
    live,
    onChoose,
    onOther,
  }: {
    question: AiQuestion;
    /** Se puede contestar: es el ultimo turno y no hay nada en marcha. */
    live: boolean;
    onChoose: (option: AiQuestionOption) => void;
    /** Contestar con algo que no estaba entre las opciones. */
    onOther: (text: string) => void;
  } = $props();

  /** El campo abierto: mientras lo este, ocupa el sitio del botón "Otro". */
  let writing = $state(false);
  let text = $state("");
  let field = $state<HTMLTextAreaElement | null>(null);

  // Abrir el campo es para escribir en el: el cursor llega puesto, sin un clic
  // mas. `writing` se lee dentro para que el efecto vuelva a correr al abrir.
  $effect(() => {
    if (writing) field?.focus();
  });

  function send(): void {
    const value = text.trim();
    if (!value || !live) return;
    onOther(value);
    text = "";
    writing = false;
  }

  function cancel(): void {
    writing = false;
    text = "";
  }
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

    <!--
      La salida abierta. Cerrada es una opción mas --se lee en la misma columna
      que las otras, al final, porque es la que se elige cuando ninguna vale--;
      abierta se convierte en el campo, en su sitio, sin mover lo de arriba.

      El campo abierto no se cierra porque la IA se ponga a trabajar --lo que se
      estaba escribiendo se perderia--: se queda, y lo que se apaga es Enviar.
    -->
    {#if writing}
      <div class="question-ai-other">
        <Textarea
          bind:value={text}
          bind:ref={field}
          rows={3}
          placeholder="Escribe la respuesta que falta"
          class="area-question-other"
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
              e.preventDefault();
              send();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
        <div class="question-other-foot flex items-center gap-2">
          <span class="question-other-tip">Enter envía · Shift+Enter salto de línea</span>
          <Button
            size="sm"
            variant="ghost"
            buttonClass="btn-question-other-cancel"
            onclick={cancel}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            buttonClass="btn-question-other-send"
            disabled={!live || !text.trim()}
            onclick={send}
          >
            Enviar
          </Button>
        </div>
      </div>
    {:else}
      <button
        type="button"
        disabled={!live}
        onclick={() => (writing = true)}
        class="btn-question-other opt"
      >
        <Icon name="pencil-edit-02" />
        <span class="opt-body">
          <span class="question-option-label opt-label">Otro</span>
          <span class="question-option-hint opt-hint">
            Contestar con algo que no está entre las opciones.
          </span>
        </span>
      </button>
    {/if}
  </div>
</div>

<style>
  /* La caja es `.card.card-solid` del catálogo --en oscuro la del catálogo es
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
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
  }

  .question-ai-options {
    gap: var(--sp-4);
    margin-top: var(--sp-8);
  }

  /*
   * Cada salida es `.opt` del catálogo, con su par `.opt-label` / `.opt-hint`,
   * y ocupa su línea entera: se eligen leyendolas, no comparando anchos, y el
   * detalle de abajo necesita el ancho para caber en una línea.
   */
  .btn-question-option,
  .btn-question-other {
    padding: var(--sp-8) var(--sp-12);

    & .question-option-label {
      white-space: normal;
    }

    & .question-option-hint {
      white-space: normal;
    }
  }

  /* El campo ocupa el hueco de la opción que lo abrio: mismo ancho, pegado a
     la ultima opción, con sus dos botones debajo a la derecha. */
  .question-ai-other {
    display: flex;
    flex-direction: column;
    gap: var(--sp-8);
  }

  .question-other-foot {
    justify-content: flex-end;
  }

  /* El recordatorio del teclado vive a la izquierda y cede el ancho antes que
     los botones. */
  .question-other-tip {
    margin-right: auto;
    min-width: 0;
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  @media (width < 30rem) {
    .question-other-tip {
      display: none;
    }
  }
</style>
