<!--
  Anadir un modelo.

  Con catalogo se busca por nombre y llega con sus medidas puestas; sin el, se
  ofrecen los conocidos y queda escribirlo a mano. En los dos casos se puede
  escribir uno que no salga en ninguna lista: el catalogo va por detras de lo
  que los servidores publican, y un modelo recien salido no espera.
-->
<script lang="ts">
  import {
    AI_NEW_MODEL,
    AI_PROVIDER_BASE,
    AI_SUGGESTED,
    aiHasCatalog,
    aiModelLabel,
    aiWindowLabel,
  } from "@shared/aiCatalog";
  import type { AiModel, AiProviderView } from "@shared/types";

  import { errorMessage, post } from "../../lib/pb";
  import Icon from "../Icon.svelte";
  import type { ToastKind } from "../Toast.svelte";
  import { Button, Input, Note, Spinner, Tag } from "../ui";

  let {
    provider,
    wire,
    onAdd,
  }: {
    provider: AiProviderView;
    wire: () => AiProviderView & { apiKey: string };
    onAdd: (model: AiModel) => void;
  } = $props();

  let searching = $state(false);
  let catalog = $state<AiModel[] | null>(null);
  let query = $state("");
  let busy = $state(false);
  /**
   * Lo que hay que decir al anadir un modelo, con su tono: que ya estaba en la
   * lista no es un fallo, y en rojo lo parecia.
   */
  let notice = $state<{ kind: ToastKind; text: string } | null>(null);
  const say = (kind: ToastKind, text: string) => (notice = { kind, text });
  const fail = (err: unknown) => say("error", errorMessage(err));
  const hush = () => (notice = null);

  const hasCatalog = $derived(aiHasCatalog(provider.provider));
  const known = $derived(
    AI_SUGGESTED[provider.provider].filter(
      (model) => !provider.models.some((m) => m.id === model.id),
    ),
  );

  /* Se muestra un puñado: la lista entera son cientos y no se lee. */
  const found = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    return (catalog ?? [])
      .filter(
        (m) =>
          !needle || m.id.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  });

  async function openSearch(): Promise<void> {
    searching = true;
    hush();
    if (catalog) return;
    busy = true;
    try {
      catalog = await post<AiModel[]>("/api/ai/catalogo", { provider: wire() });
    } catch (err) {
      fail(err);
      catalog = [];
    } finally {
      busy = false;
    }
  }

  function add(model: AiModel): void {
    if (provider.models.some((m) => m.id === model.id)) {
      say("warning", `"${model.id}" ya está en la lista.`);
      return;
    }
    onAdd(model);
    query = "";
    searching = false;
    hush();
  }

  /*
   * Escribir el nombre y anadirlo no es "a mano" cuando el servidor tiene
   * catalogo: se le pregunta por ese nombre igual que si se hubiera elegido de
   * la lista. Solo se cae en los valores genericos si el servidor no sabe
   * contar los suyos o si pregunto y no lo conoce.
   */
  async function addTyped(id: string): Promise<void> {
    if (!hasCatalog) {
      add({ ...AI_NEW_MODEL, id });
      return;
    }
    busy = true;
    hush();
    try {
      add(await post<AiModel>("/api/ai/catalogo", { provider: wire(), id }));
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="add-model flex flex-col gap-2">
  {#if searching && hasCatalog}
    <div class="search-model-box inset plain">
      <Input
        bind:value={query}
        autofocus
        placeholder="Busca por nombre: glm, claude, llama…"
        aria-label="Buscar un modelo en el catálogo"
        autocomplete="off"
        spellcheck={false}
      />
      <!--
        Si la direccion del servidor quedo mal puesta --por ejemplo tras cambiar
        la clase sin tocarla-- la busqueda falla sin ninguna pista de por que.
        Verla aqui delata el error al instante.
      -->
      <p class="search-model-url">
        Buscando en {provider.baseUrl || AI_PROVIDER_BASE[provider.provider] || "(oficial)"}
      </p>

      {#if busy}
        <p class="search-model-loading">
          <Spinner /> Trayendo el catálogo
        </p>
      {/if}

      {#if !busy && catalog?.length}
        <ul class="search-model-list">
          {#each found as model (model.id)}
            <li>
              <button type="button" onclick={() => add(model)} class="btn-add-catalog-model opt">
                <span class="model-id-wrap">
                  <span class="model-id">{model.id}</span>
                  {#if model.label}
                    <span class="model-label">{model.label}</span>
                  {/if}
                </span>
                {#if model.vision}
                  <Tag tone="tint-1">Visión</Tag>
                {/if}
                {#if model.thinking}
                  <Tag tone="tint-1">Piensa</Tag>
                {/if}
                {#if model.contextWindow > 0}
                  <Tag tone="tint-1" class="badge-model-window">
                    {aiWindowLabel(model.contextWindow)}
                  </Tag>
                {/if}
              </button>
            </li>
          {/each}
          {#if !found.length}
            <li class="search-model-none">Ninguno se llama así. Puedes escribirlo a mano.</li>
          {/if}
        </ul>
      {/if}

      <Note kind={notice?.kind ?? "error"} message={notice?.text ?? ""} />

      <div class="search-model-actions">
        <Button size="sm" variant="ghost" onclick={() => (searching = false)}>Cancelar</Button>
        <Button
          size="sm"
          variant="soft"
          loading={busy}
          onclick={() => void addTyped(query.trim())}
          disabled={!query.trim()}
        >
          Añadir "{query.trim() || "…"}"{hasCatalog ? "" : " a mano"}
        </Button>
      </div>
    </div>
  {:else}
    <div class="known-models">
      {#each known as model (model.id)}
        <Tag tone="tint-1" class="btn-add-known-model" onclick={() => add({ ...model })}>
          <Icon name="plus-sign" />
          {aiModelLabel(model)}
        </Tag>
      {/each}

      <Button
        variant="soft"
        size="sm"
        buttonClass="btn-add-ai-model"
        onclick={() => {
          if (hasCatalog) void openSearch();
          else onAdd({ ...AI_NEW_MODEL, id: "" });
        }}
      >
        <Icon name="plus-sign" size={13} />
        {hasCatalog ? "Buscar un modelo" : "Otro modelo"}
      </Button>

      <Note kind={notice?.kind ?? "error"} message={notice?.text ?? ""} />
    </div>
  {/if}
</div>

<style>
  .add-model {
    margin-top: var(--sp-8);

    /* La caja es `.inset.plain` del catalogo --el cerco sin fondo, que ya lo
       pone la ficha del servidor--; aqui solo el reparto de dentro. */
    & .search-model-box {
      display: flex;
      flex-direction: column;
      gap: var(--sp-8);

      & .search-model-url {
        margin-top: var(--sp-6);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }

      & .search-model-loading {
        display: flex;
        align-items: center;
        gap: var(--sp-8);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }

      & .search-model-list {
        max-height: 16rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;

        /* La ventana de contexto del catalogo, en cifras alineadas. */
        /* La pastilla la dibuja `Tag`: su clase sale del ambito de aqui. */
        & :global(.badge-model-window) {
          font-variant-numeric: tabular-nums;
        }

        /* Cada modelo del catalogo es una fila que se elige: `.opt` del
           catalogo, sin borde --van una debajo de otra y un cerco por fila
           haria de la lista una reja-- y apretada, que pueden ser veinte. */
        & .btn-add-catalog-model {
          gap: var(--sp-8);
          padding: var(--sp-6) var(--sp-8);
          border-color: transparent;

          & .model-id-wrap {
            min-width: 0;
            flex: 1;

            & .model-id {
              display: block;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-family: var(--font-mono);
              font-size: var(--text-xs);
              line-height: var(--text-xs--line-height);
              color: var(--text-primary);
            }

            & .model-label {
              display: block;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-size: var(--text-xs);
              line-height: var(--text-xs--line-height);
              color: var(--text-muted);
            }
          }
        }

        & .search-model-none {
          padding: var(--sp-6) var(--sp-8);
          font-size: var(--text-xs);
          line-height: var(--text-xs--line-height);
          color: var(--text-muted);
        }
      }

      & .search-model-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-6);
      }
    }

    & .known-models {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-6);

      /* La etiqueta-boton la dibuja `Tag`: su clase sale del ambito de aqui. */
      & :global(.btn-add-known-model) {
        cursor: pointer;
        gap: var(--sp-4);
        transition: background-color 0.15s;

        &:hover {
          background: var(--bg-field);
        }
      }
    }
  }
</style>
