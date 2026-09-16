<!--
  El contexto que de verdad se le mando al modelo: sistema, herramientas y
  mensajes, tal cual salieron.

  Dos procedencias, el mismo sitio para leerlas. `text` es el de esta visita,
  que llega con la peticion si se pidio en modo debug. Sin el, `load` trae el
  que quedo guardado en el servidor --uno por pagina, el de la ultima
  peticion--: es lo que hace que recargar despues de un fallo no pierda
  justamente lo que hace falta para entenderlo.

  Lo guardado se pide al desplegar, no antes: es lo mas pesado que hay por aqui
  y casi nunca se mira.
-->
<script lang="ts">
  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  let {
    text = "",
    load,
  }: {
    /** El contexto de esta visita. Vacio: se pide el guardado. */
    text?: string;
    /** Trae el guardado. `null`: no hay ninguno para esta pagina. */
    load?: () => Promise<{ text: string; truncated: boolean } | null>;
  } = $props();

  let open = $state(false);
  let loaded = $state<{ text: string; truncated: boolean } | null>(null);
  let loading = $state(false);
  let failed = $state("");

  const shown = $derived(text || loaded?.text || "");

  async function toggle(): Promise<void> {
    open = !open;
    if (!open || text || loaded || loading || !load) return;
    loading = true;
    failed = "";
    try {
      loaded = await load();
      if (!loaded) failed = "No hay nada guardado de esta página todavía.";
    } catch {
      failed = "No se pudo leer el contexto guardado.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="context-debug-ai">
  <button
    type="button"
    onclick={() => void toggle()}
    class="btn-toggle-context-debug flex items-center gap-1"
  >
    <Icon name="chevron-down" class={cx("chevron", open && "chevron-open")} />
    Contexto enviado
  </button>
  {#if open}
    {#if loading}
      <p class="context-debug-note">Leyendo el contexto guardado…</p>
    {:else if shown}
      {#if loaded?.truncated}
        <p class="context-debug-note">No cabía entero: esto es la parte que se pudo guardar.</p>
      {/if}
      <pre class="context-debug-content">{shown}</pre>
    {:else}
      <p class="context-debug-note">{failed || "No hay contexto que mostrar."}</p>
    {/if}
  {/if}
</div>

<style>
  .context-debug-ai {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  .btn-toggle-context-debug {
    color: var(--text-muted);
    transition: color 150ms;

    &:hover {
      color: var(--text-secondary);
    }
  }

  /* El chevron lo dibuja `Icon`, con las clases que le pasamos. */
  .btn-toggle-context-debug :global(.chevron) {
    flex-shrink: 0;
    transition: transform 150ms;
  }

  .btn-toggle-context-debug :global(.chevron.chevron-open) {
    transform: rotate(180deg);
  }

  .context-debug-note {
    margin-top: var(--sp-4);
    color: var(--text-muted);
  }

  .context-debug-content {
    margin-top: var(--sp-4);
    max-height: 15rem;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    border-radius: var(--radius-sm);
    background: black;
    padding: var(--sp-8);
    font-size: 0.625rem;
    line-height: 1.5;
    color: oklch(0.87 0 0);
  }
</style>
