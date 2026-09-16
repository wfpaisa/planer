<!--
  Una pagina afectada por un cambio con riesgo.

  El nombre esta desde el primer momento --sale del manifiesto-- y el "para
  que" cuesta una consulta a la IA, asi que solo se pide cuando se abre.
-->
<script lang="ts">
  import { cx } from "../lib/cx";
  import { errorMessage, post } from "../lib/pb";
  import Icon from "./Icon.svelte";
  import { Spinner } from "./ui";

  let {
    appId,
    pageId,
    name,
    what,
  }: {
    appId: string;
    pageId: string;
    name: string;
    /** Lo que se va a tocar, dicho como lo entiende la IA. */
    what: string;
  } = $props();

  let open = $state(false);
  let detail = $state("");
  let busy = $state(false);

  async function toggle() {
    open = !open;
    if (!open || detail || busy) return;
    busy = true;
    try {
      const res = await post<{ text: string }>(`/api/apps/${appId}/impacto/detalle`, {
        pageId,
        what,
      });
      detail = res.text || "No se pudo averiguar.";
    } catch (err) {
      detail = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="impact-page-row">
  <button type="button" onclick={toggle} class="btn-toggle-impact-page impact-page-toggle">
    <span class="impact-page-name">{name}</span>
    <span class="impact-page-hint">
      {open ? "Ocultar" : "Para que la usa"}
    </span>
    <Icon
      name="chevron-down"
      size={14}
      class={cx("impact-page-chevron", open && "impact-page-chevron-open")}
    />
  </button>

  {#if open}
    <div class="impact-page-detail">
      {#if busy}
        <span class="impact-page-loading">
          <Spinner /> Mirando la página
        </span>
      {:else}
        <p class="impact-page-text">{detail}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .impact-page-row {
    padding: var(--sp-12) var(--sp-8);

    & .impact-page-toggle {
      display: flex;
      width: 100%;
      align-items: center;
      gap: var(--sp-8);
      text-align: left;
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      color: var(--text-primary);

      & .impact-page-name {
        min-width: 0;
        flex: 1 1 0%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      & .impact-page-hint {
        flex-shrink: 0;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }
    }

    /* El cheuron va dentro del Icon (un componente). */
    & :global(.impact-page-chevron) {
      flex-shrink: 0;
      color: var(--text-muted);
    }

    & :global(.impact-page-chevron-open) {
      transform: rotate(180deg);
    }

    & .impact-page-detail {
      margin-top: var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);

      & .impact-page-loading {
        display: flex;
        align-items: center;
        gap: var(--sp-8);
        color: var(--text-muted);
      }

      & .impact-page-text {
        white-space: pre-wrap;
      }
    }
  }
</style>
