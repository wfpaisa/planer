<!--
  Con que se va a pedir: que modelo y cuanto se le pide pensar.

  Las dos cosas viven en el mismo menu porque se deciden juntas --un modelo que
  no sabe pensar no tiene nivel que elegir-- y porque las dos son lo mismo:
  cuanto se va a gastar en esta petición.
-->
<script lang="ts">
  import {
    aiModelLabel,
    aiProviderName,
    aiProviderReady,
    aiThinkingLabel,
    aiThinkingLevels,
  } from "@shared/aiCatalog";
  import { type AiChoice, type AiConfigView } from "@shared/types";

  import Icon from "../Icon.svelte";
  import { Dropdown, MenuItem, MenuLabel, MenuSeparator } from "../ui";

  let {
    config,
    choice,
    onPick,
    disabled,
  }: {
    config: AiConfigView;
    choice: AiChoice;
    onPick: (patch: Partial<AiChoice>) => void;
    disabled: boolean;
  } = $props();

  const provider = $derived(config.providers.find((p) => p.id === choice.provider));
  const model = $derived(provider?.models.find((m) => m.id === choice.model));
  const usable = $derived(config.providers.filter(aiProviderReady));
  /* Un modelo que no piensa no tiene nivel que elegir, y se dice. */
  const levels = $derived(model ? aiThinkingLevels(model) : []);
</script>

<!--
  El hueco del que no esta marcado mide lo mismo que el visto bueno: sin el,
  los rotulos del menu bailarian de línea en línea.
-->
{#snippet mark(on: boolean)}
  {#if on}
    <Icon name="check" size={13} class="mark-checked" />
  {:else}
    <span class="mark-hole shrink-0"></span>
  {/if}
{/snippet}

<Dropdown up class="menu-ai-models">
  {#snippet trigger({ toggle })}
    <button
      type="button"
      {disabled}
      onclick={toggle}
      aria-label="Elegir modelo y cuánto piensa"
      class="btn-pick-ai-model btn sm"
    >
      <Icon name="ai-brain-03" size={16} class="model-thinking-icon" />
      <span class="model-name">{model ? aiModelLabel(model) : "Sin modelo"}</span>
      <Icon name="chevron-down" size={12} class="model-chevron" />
    </button>
  {/snippet}

  {#snippet children(close: () => void)}
    {#each usable as p (p.id)}
      <MenuLabel>{aiProviderName(p)}</MenuLabel>
      {#each p.models as m (m.id)}
        {#snippet icon()}
          {@render mark(p.id === choice.provider && m.id === choice.model)}
        {/snippet}
        <MenuItem
          {icon}
          onclick={() => {
            onPick({ provider: p.id, model: m.id });
            close();
          }}
        >
          {aiModelLabel(m)}
        </MenuItem>
      {/each}
    {/each}

    <MenuSeparator />
    <MenuLabel>Cuánto piensa</MenuLabel>
    {#if levels.length > 1}
      {#each levels as level (level)}
        {#snippet icon()}
          {@render mark(choice.thinking === level)}
        {/snippet}
        <MenuItem
          {icon}
          onclick={() => {
            onPick({ thinking: level });
            close();
          }}
        >
          {aiThinkingLabel(level)}
        </MenuItem>
      {/each}
    {:else}
      <div class="menu-ai-note">
        {#if model?.thinking}
          Este modelo siempre usa razonamiento{levels[0]
            ? ` en nivel "${aiThinkingLabel(levels[0])}"`
            : ""}.
        {:else}
          Este modelo responde sin razonamiento previo.
        {/if}
      </div>
    {/if}
  {/snippet}
</Dropdown>

<style>
  /* La clase lleva el menu de Dropdown (un componente): sale del ambito. */
  :global(.menu-ai-models) {
    --menu-max-height: 20rem;
  }

  .btn-pick-ai-model {
    border-radius: var(--radius-lg);
    color: var(--text-secondary);

    &:hover:not(:disabled) {
      color: var(--text-primary);
    }

    &:disabled {
      cursor: default;
      opacity: 0.5;
    }

    & .model-name {
      max-width: 7rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  /* El icono de pensamiento va dentro del Icon: fuera del ambito del botón. */
  :global(.model-thinking-icon) {
    flex-shrink: 0;
  }

  /* El cheuron va dentro del Icon: fuera del ambito del botón. */
  :global(.model-chevron) {
    flex-shrink: 0;
    opacity: 0.6;
  }

  /* El visto bueno va dentro de Icon (un componente): sale del ambito. */
  :global(.mark-checked) {
    flex-shrink: 0;
    color: var(--accent);
  }

  /* Mide lo mismo que el visto bueno para que el menu no baile de línea. */
  .mark-hole {
    width: 13px;
  }

  .menu-ai-note {
    padding: var(--sp-6) var(--sp-10);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }
</style>
