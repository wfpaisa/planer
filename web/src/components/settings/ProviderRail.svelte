<!--
  La columna de servidores.

  Cada uno lleva un punto que dice si esta listo --encendido, con clave y con
  algun modelo-- porque es lo unico que hay que saber de un vistazo: si va a
  atender o no.
-->
<script lang="ts">
  import {
    AI_PROVIDER_ABOUT,
    AI_PROVIDER_LABEL,
    aiProviderName,
    aiProviderReady,
  } from "@shared/aiCatalog";
  import type { AiProvider, AiProviderView } from "@shared/types";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";
  import { Dropdown } from "../ui";

  let {
    providers,
    openId,
    onOpen,
    onAdd,
  }: {
    providers: AiProviderView[];
    openId: string;
    onOpen: (id: string) => void;
    onAdd: (kind: AiProvider) => void;
  } = $props();

  const kinds = Object.keys(AI_PROVIDER_LABEL) as AiProvider[];
</script>

<div class="rail-ai-providers flex flex-col gap-1">
  <span class="rail-ai-providers-label eyebrow">Servidores</span>

  {#each providers as provider (provider.id)}
    {@const ready = aiProviderReady(provider)}
    <button
      type="button"
      onclick={() => onOpen(provider.id)}
      aria-pressed={provider.id === openId}
      class={cx(
        "btn btn-open-ai-provider",
        provider.id === openId ? "btn-primary" : "btn-open-ai-provider-idle",
        ready ? "badge-success" : provider.enabled ? "badge-warning" : "badge-error",
      )}
    >
      <span class="name-ai-provider">
        {aiProviderName(provider)}
      </span>
    </button>
  {/each}

  <Dropdown class="menu-add-ai-provider">
    {#snippet trigger({ toggle })}
      <button type="button" onclick={toggle} class="btn btn-ghost">
        <Icon name="plus-sign" size={16} />
        Conectar servidor
      </button>
    {/snippet}

    {#snippet children(close: () => void)}
      {#each kinds as kind (kind)}
        <button
          type="button"
          onclick={() => {
            onAdd(kind);
            close();
          }}
          class="btn-menu-item"
        >
          <span class="menu-item-title">{AI_PROVIDER_LABEL[kind]}</span>
          <span class="menu-item-about">{AI_PROVIDER_ABOUT[kind]}</span>
        </button>
      {/each}
    {/snippet}
  </Dropdown>
</div>

<style>
  .rail-ai-providers {
    /* El menu de conectar servidor vive dentro de Dropdown. */
    & :global(.menu-add-ai-provider) {
      width: 14rem;
    }

    /* El rotulo es `.eyebrow` del catalogo; aqui solo su hueco. */
    & .rail-ai-providers-label {
      display: block;
      margin-bottom: var(--sp-6);
    }

    /*
     * El item del menu ya viene vestido por `.menu button` del catalogo
     * --acolchado, radio y el fondo al apuntarlo--: aqui solo lo que este
     * menu tiene de distinto, que es llevar dos renglones en vez de uno.
     */
    & .btn-menu-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.125rem;

      & .menu-item-title {
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        color: var(--text-primary);
      }

      & .menu-item-about {
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-secondary);
      }
    }
  }
</style>
