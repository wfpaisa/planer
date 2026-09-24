<!--
  Con que se va a pedir: que modelo y cuanto se le pide pensar.

  Son dos submenús del menú "+" del campo de escribir: se deciden juntos --un
  modelo que no sabe pensar no tiene nivel que elegir-- pero se leen aparte,
  cada uno con lo elegido a la vista en su fila. `onDone` cierra el menú de
  fuera al elegir, que es cuando ya no queda nada que mirar ahí.
-->
<script lang="ts">
  import {
    aiModelLabel,
    aiProviderName,
    aiProviderReady,
    aiThinkingChatLabel as aiThinkingLabel,
    aiThinkingLevels,
  } from "@shared/aiCatalog";
  import { type AiChoice, type AiConfigView } from "@shared/types";

  import Icon from "../Icon.svelte";
  import { MenuItem, MenuLabel, MenuSub } from "../ui";

  let {
    config,
    choice,
    onPick,
    onDone,
    disabled,
  }: {
    config: AiConfigView;
    choice: AiChoice;
    onPick: (patch: Partial<AiChoice>) => void;
    onDone: () => void;
    disabled: boolean;
  } = $props();

  const provider = $derived(config.providers.find((p) => p.id === choice.provider));
  const model = $derived(provider?.models.find((m) => m.id === choice.model));
  const usable = $derived(config.providers.filter(aiProviderReady));
  /* Un modelo que no piensa no tiene nivel que elegir, y se dice. */
  const levels = $derived(model ? aiThinkingLevels(model) : []);
  const thinkingValue = $derived(
    levels.length > 1
      ? aiThinkingLabel(choice.thinking)
      : model?.thinking
        ? levels[0]
          ? aiThinkingLabel(levels[0])
          : "Siempre"
        : "No",
  );

  /** Elegir cierra el submenú y el menú de fuera. */
  function choose(patch: Partial<AiChoice>, close: () => void): void {
    onPick(patch);
    close();
    onDone();
  }
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

{#snippet modelIcon()}
  <Icon name="ai-brain-03" size={14} />
{/snippet}

{#snippet thinkingIcon()}
  <Icon name="idea-01" size={14} />
{/snippet}

<MenuSub
  class="btn-pick-ai-model"
  menuClass="menu-ai-models"
  icon={modelIcon}
  value={model ? aiModelLabel(model) : "Sin modelo"}
  {disabled}
>
  Modelo
  {#snippet content(close)}
    {#each usable as p (p.id)}
      <MenuLabel>{aiProviderName(p)}</MenuLabel>
      {#each p.models as m (m.id)}
        {#snippet icon()}
          {@render mark(p.id === choice.provider && m.id === choice.model)}
        {/snippet}
        <MenuItem {icon} onclick={() => choose({ provider: p.id, model: m.id }, close)}>
          {aiModelLabel(m)}
        </MenuItem>
      {/each}
    {/each}
  {/snippet}
</MenuSub>

<MenuSub
  class="btn-pick-ai-thinking"
  menuClass="menu-ai-thinking"
  icon={thinkingIcon}
  value={thinkingValue}
  {disabled}
>
  Razonamiento
  {#snippet content(close)}
    {#if levels.length > 1}
      <MenuLabel>Cuánto piensa</MenuLabel>
      {#each levels as level (level)}
        {#snippet icon()}
          {@render mark(choice.thinking === level)}
        {/snippet}
        <MenuItem {icon} onclick={() => choose({ thinking: level }, close)}>
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
</MenuSub>

<style>
  /* Las clases llevan la lista de MenuSub (un componente): salen del ambito. */
  :global(.menu-ai-models, .menu-ai-thinking) {
    --menu-max-height: 20rem;
    min-width: 13rem;
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
    max-width: 16rem;
    padding: var(--sp-6) var(--sp-10);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }
</style>
