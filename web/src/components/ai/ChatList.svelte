<!--
  Las conversaciones anteriores de la página abierta.

  Son de la página, no de la aplicación: aqui estan todas las que hay y todas
  se hicieron aqui, asi que ninguna necesita decir en cual.
-->
<script lang="ts" module>
  const when = (value: string) =>
    new Date(value).toLocaleString("es", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
</script>

<script lang="ts">
  import type { AiChatSummary } from "@shared/types";

  import Icon from "../Icon.svelte";
  import { Button } from "../ui";

  let {
    chats,
    onOpen,
    onBack,
  }: {
    chats: AiChatSummary[];
    onOpen: (id: string) => void;
    onBack: () => void;
  } = $props();
</script>

<div class="chat-list flex h-full flex-col gap-3">
  <Button size="sm" variant="ghost" onclick={onBack} class="btn-back-to-chat">
    <Icon name="arrow-left-01" size={13} /> Volver a la conversación
  </Button>

  <div class="chat-list-items flex-1 flex flex-col gap-1">
    {#if chats.length === 0}
      <div class="chat-list-empty flex flex-col items-center gap-2 text-center">
        <Icon name="messages-square" size={20} class="chat-list-empty-icon" />
        <p class="chat-list-empty-text">No hay conversaciones guardadas.</p>
      </div>
    {/if}

    {#each chats as chat (chat.id)}
      <button type="button" onclick={() => onOpen(chat.id)} class="btn-open-conversation opt">
        <span class="opt-body">
          <span class="chat-title opt-label">{chat.title}</span>
          <span class="chat-meta">
            <span class="chat-when">{when(chat.updated)}</span>
          </span>
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .chat-list {
    min-height: 0;

    /* Vive en el botón del `Button`, que es otro componente. */
    & :global(.btn-back-to-chat) {
      align-self: flex-start;
    }
  }

  .chat-list-items {
    min-height: 0;
    overflow-y: auto;
  }

  .chat-list-empty {
    padding: var(--sp-40) var(--sp-12);
  }

  /* El icono lo dibuja `Icon`, con la clase que le pasamos. */
  .chat-list-empty :global(.chat-list-empty-icon) {
    color: var(--text-muted);
  }

  .chat-list-empty-text {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  /* Cada conversación es `.opt` del catálogo, con `.opt-label` para el
     título. Aqui solo lo propio: la lista va sin cercos --serian una reja de
     cinco líneas-- y el cerco aparece bajo el cursor, que es cuando dice cual
     se va a abrir. */
  .btn-open-conversation {
    border-color: transparent;
    padding: var(--sp-10) var(--sp-12);

    &:hover {
      border-color: var(--border);
    }

    & .chat-meta {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
      margin-top: var(--sp-4);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    & .chat-when {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
