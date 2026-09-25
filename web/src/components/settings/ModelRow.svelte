<!--
  Un modelo de la lista.

  Cerrado se lee de un vistazo: como se llama y de que es capaz. Abierto se
  corrige todo. Lo normal es no tener que abrirlo nunca --los servidores con
  catálogo traen sus medidas hechas-- y por eso empieza cerrado.
-->
<script lang="ts">
  import {
    AI_THINKING_KNOWN,
    aiThinkingLabel,
    aiThinkingLevels,
    aiThinkingRank,
    aiWindowLabel,
  } from "@shared/aiCatalog";
  import type { AiModel, AiProviderView } from "@shared/types";
  import { untrack } from "svelte";

  import { errorMessage, post } from "../../lib/pb";
  import Icon from "../Icon.svelte";
  import { Button, ErrorNote, Field, Input, Tag } from "../ui";

  let {
    model,
    catalog,
    wire,
    onChange,
    onRemove,
  }: {
    model: AiModel;
    /** Si su servidor sabe contar los datos de este modelo. */
    catalog: boolean;
    wire: () => AiProviderView & { apiKey: string };
    onChange: (patch: Partial<AiModel>) => void;
    onRemove: () => void;
  } = $props();

  // Un modelo recien escrito a mano se abre solo: sin nombre no hay nada que
  // leer, y lo que toca es escribirlo. Solo cuenta como estaba al llegar; lo
  // que se escriba después no lo tiene que volver a cerrar.
  let open = $state(untrack(() => !model.id));
  let busy = $state(false);
  let error = $state("");

  const levels = $derived(aiThinkingLevels(model));
  const efforts = $derived([...new Set([...AI_THINKING_KNOWN, ...model.efforts])]);

  /** Traer del catálogo lo que este modelo puede hacer. */
  async function load(): Promise<void> {
    busy = true;
    error = "";
    try {
      const found = await post<AiModel>("/api/ai/catalogo", {
        provider: wire(),
        id: model.id.trim(),
      });
      onChange(found);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="row-ai-model inset plain">
  <div class="head-ai-model">
    <span class="name-ai-model">
      {#if model.id}
        {model.id}
      {:else}
        <span class="name-ai-model-empty">Modelo sin nombre</span>
      {/if}
    </span>

    {#if model.vision}
      <Tag tone="tint-1" class="capability-ai-model">Visión</Tag>
    {/if}
    {#if model.thinking}
      <Tag
        tone="tint-1"
        class="capability-ai-model"
        tip={`Niveles: ${levels.map(aiThinkingLabel).join(", ")}`}
      >
        Piensa
      </Tag>
    {/if}
    {#if model.contextWindow > 0}
      <Tag tone="tint-1" class="capability-ai-model capability-ai-model-numeric">
        {aiWindowLabel(model.contextWindow)}
      </Tag>
    {/if}

    {#if catalog}
      <Button
        variant="ghost"
        size="sm"
        loading={busy}
        disabled={!model.id.trim()}
        tip="Actualizar los datos desde el catálogo"
        buttonClass="btn-fetch-ai-model"
        class="btn-icon"
        onclick={() => void load()}
      >
        <Icon name="refresh" size={16} />
      </Button>
    {/if}
    <Button
      variant="ghost"
      size="sm"
      tip={open ? "Cerrar detalles" : "Editar los datos del modelo"}
      buttonClass="btn-edit-ai-model"
      class="btn-icon"
      onclick={() => (open = !open)}
    >
      <Icon name="pencil-edit-02" size={16} />
    </Button>
    <Button
      variant="ghost"
      size="sm"
      tip="Eliminar este modelo"
      buttonClass="btn-remove-ai-model"
      class="btn-icon btn-remove-ai-model-square"
      onclick={onRemove}
    >
      <Icon name="delete-02" size={16} />
    </Button>
  </div>

  {#if open}
    <div class="body-ai-model">
      <div class="grid-ai-model">
        <Field
          label="Identificador del modelo"
          hint="Escribe el nombre exacto que usa el servidor."
        >
          <Input
            value={model.id}
            oninput={(e) => onChange({ id: e.currentTarget.value })}
            placeholder="z-ai/glm-5.3-flash"
            autocomplete="off"
            spellcheck={false}
            class="input-ai-model-id"
          />
        </Field>
        <Field label="Nombre visible" hint="Si lo dejas vacío, se mostrará el identificador.">
          <Input
            value={model.label}
            oninput={(e) => onChange({ label: e.currentTarget.value })}
            placeholder={model.id}
            autocomplete="off"
          />
        </Field>
      </div>

      <div class="row-ai-model-measures">
        <label class="measure-ai-model">
          <span class="measure-ai-model-label">Tokens máximos por respuesta</span>
          <input
            type="number"
            min={256}
            step={1000}
            value={model.maxTokens}
            oninput={(e) => onChange({ maxTokens: Number(e.currentTarget.value) })}
            class="input-form-control field-control sm measure-ai-model-input"
          />
        </label>
        <label class="measure-ai-model">
          <span class="measure-ai-model-label">Ventana de contexto</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={model.contextWindow}
            oninput={(e) => onChange({ contextWindow: Number(e.currentTarget.value) })}
            class="input-form-control field-control sm measure-ai-model-input"
          />
        </label>
        <label class="check-ai-model choice">
          <input
            type="checkbox"
            checked={model.vision}
            onchange={(e) => onChange({ vision: e.currentTarget.checked })}
            class="check-ai-model-control"
          />
          <i class="choice-box ico-nudge icon icon-tick-02" aria-hidden="true"></i>
          Ve imágenes
        </label>
        <label class="check-ai-model choice">
          <input
            type="checkbox"
            checked={model.thinking}
            onchange={(e) => onChange({ thinking: e.currentTarget.checked })}
            class="check-ai-model-control"
          />
          <i class="choice-box ico-nudge icon icon-tick-02" aria-hidden="true"></i>
          Piensa antes de responder
        </label>
      </div>

      <!--
        Que niveles ofrece. Los de un servidor con catálogo llegan solos y con
        su nombre --hay modelos con `max`, que no es ninguno de los de
        siempre--; a mano se marcan de entre los nombres conocidos. Ninguno
        marcado quiere decir los de siempre.
      -->
      {#if model.thinking}
        <div>
          <span class="efforts-ai-model-label">
            Niveles de razonamiento disponibles. Sin selección, se usarán los habituales.
          </span>
          <div class="efforts-ai-model-list">
            {#each efforts as level (level)}
              {@const on = model.efforts.includes(level)}
              <Tag
                tone={on ? "tint-1" : "off"}
                pressed={on}
                class="btn-toggle-ai-effort"
                onclick={() =>
                  onChange({
                    efforts: on
                      ? model.efforts.filter((l) => l !== level)
                      : [...model.efforts, level].sort(
                          (a, b) => aiThinkingRank(a) - aiThinkingRank(b),
                        ),
                  })}
              >
                {aiThinkingLabel(level)}
              </Tag>
            {/each}
          </div>
        </div>
      {/if}

      <ErrorNote message={error} />
    </div>
  {/if}
</div>

<style>
  /* La caja es `.inset.plain` del catálogo --el cerco sin fondo, que ya lo
     pone la ficha del servidor que la contiene--; aqui solo lo de dentro. */
  .row-ai-model {
    padding: 0;

    & .head-ai-model {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      padding: var(--sp-8) var(--sp-10);

      & .name-ai-model {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        color: var(--text-primary);

        & .name-ai-model-empty {
          font-family: var(--font-family);
          font-style: italic;
          color: var(--text-muted);
        }
      }

      /* Las pastillas las dibuja `Tag`: sus clases salen del ambito de aqui. */
      & :global(.capability-ai-model) {
        flex-shrink: 0;
      }

      & :global(.capability-ai-model-numeric) {
        font-variant-numeric: tabular-nums;
      }

      & :global(.input-ai-model-id) {
        font-family: var(--font-mono);
      }

      /* Los botones cuadrados viven en `Button`; no deben encogerse. */
      & :global(.btn-fetch-ai-model),
      & :global(.btn-edit-ai-model),
      & :global(.btn-remove-ai-model) {
        flex-shrink: 0;
      }
    }

    & .body-ai-model {
      display: flex;
      flex-direction: column;
      gap: var(--sp-12);
      padding: var(--sp-10);
      border-top: var(--border-width) solid var(--border);

      & .grid-ai-model {
        display: grid;
        gap: var(--sp-12);

        @media (min-width: 40rem) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      & .row-ai-model-measures {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--sp-12);

        & .measure-ai-model {
          display: block;

          & .measure-ai-model-label {
            display: block;
            margin-bottom: var(--sp-4);
            font-size: var(--text-xs);
            line-height: var(--text-xs--line-height);
            color: var(--text-muted);
          }

          & .measure-ai-model-input {
            width: 8rem;
            font-variant-numeric: tabular-nums;
          }
        }

        & .check-ai-model {
          display: flex;
          cursor: pointer;
          align-items: center;
          gap: var(--sp-8);
          margin-bottom: var(--sp-6);
          font-size: var(--text-xs);
          line-height: var(--text-xs--line-height);
          color: var(--text-secondary);
        }
      }

      & .efforts-ai-model-label {
        display: block;
        margin-bottom: var(--sp-6);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }

      & .efforts-ai-model-list {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-6);
      }
    }
  }
</style>
