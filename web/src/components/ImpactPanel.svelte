<!--
  El dialogo de impacto.

  Se abre cuando la IA necesita un cambio que puede romper algo: borrar una
  columna o una tabla, o cambiar el tipo de una columna. Dice siempre lo mismo
  --que cambio, para que se pide, que paginas usan lo que se va a tocar y que
  salidas hay-- y se abre al instante: los nombres de las paginas salen del
  manifiesto, y el detalle de para que las usa cada una se consulta solo si se
  pide.

  Es tambien el unico sitio donde se autoriza que la IA toque una pagina que
  no es la abierta.
-->
<script lang="ts">
  import type { DataImpact, ImpactChoice, ImpactResult } from "@shared/types";

  import { errorMessage, post } from "../lib/pb";
  import Icon from "./Icon.svelte";
  import ImpactPageRow from "./ImpactPageRow.svelte";
  import OmniPanel from "./OmniPanel.svelte";
  import { ErrorNote, Spinner } from "./ui";

  let {
    impact,
    appId,
    onClose,
    onResolved,
  }: {
    impact: DataImpact;
    appId: string;
    onClose: () => void;
    onResolved: (result: ImpactResult) => Promise<void> | void;
  } = $props();

  let busy = $state<ImpactChoice | "">("");
  let error = $state("");

  const many = $derived(impact.changes.length > 1);
  /** Lo que se va a tocar, para preguntarle a la IA para que lo usa cada pagina. */
  const what = $derived(
    impact.changes.map((c) => c.fieldLabel ?? c.field ?? c.tableLabel).join(", "),
  );

  async function decide(choice: ImpactChoice) {
    busy = choice;
    error = "";
    try {
      const result = await post<ImpactResult>(`/api/apps/${appId}/impacto`, {
        choice,
        changes: impact.changes,
      });
      await onResolved(result);
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = "";
    }
  }
</script>

{#snippet label(text: string)}
  <p class="impact-label eyebrow">{text}</p>
{/snippet}

<OmniPanel
  {onClose}
  title={many ? "Estos cambios pueden romper algo" : "Este cambio puede romper algo"}
  description="Decide una vez y se hace todo junto."
>
  <div class="impact-body flex flex-col gap-4">
    <ErrorNote message={error} />

    <section>
      {@render label("Qué se quiere hacer")}
      <ul class="impact-changes">
        {#each impact.changes as change (`${change.kind}-${change.tableId}-${change.field ?? ""}`)}
          <li class="impact-change">
            <Icon name="alert-02" size={14} class="impact-change-icon" />
            {change.what}
          </li>
        {/each}
      </ul>
    </section>

    <section>
      {@render label("Para qué")}
      <p class="impact-request alert info">{impact.request}</p>
    </section>

    <section>
      {@render label("Quién lo usa")}
      {#if impact.pages.length === 0}
        <p class="impact-no-pages">Ninguna página declara lo que se va a cambiar.</p>
      {:else}
        <div class="impact-pages inset plain">
          {#each impact.pages as page (page.id)}
            <ImpactPageRow {appId} pageId={page.id} name={page.name} {what} />
          {/each}
        </div>
      {/if}
    </section>

    <section>
      {@render label("Qué hacemos")}
      <div class="impact-options">
        {#each impact.options as option (option.id)}
          <button
            type="button"
            disabled={!!busy}
            onclick={() => void decide(option.id)}
            class="btn-impact-option impact-option opt"
          >
            <span class="impact-option-text opt-body">
              <span class="impact-option-label opt-label">{option.label}</span>
              <span class="impact-option-hint opt-hint">{option.hint}</span>
            </span>
            {#if busy === option.id}
              <Spinner />
            {/if}
          </button>
        {/each}
      </div>
    </section>
  </div>
</OmniPanel>

<style>
  /* El rotulo de cada tramo es `.eyebrow` del catalogo; aqui solo su hueco. */
  .impact-label {
    margin-bottom: var(--sp-6);
  }

  .impact-body {
    & .impact-changes {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);

      & .impact-change {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-8);
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        color: var(--text-primary);
      }
    }

    & :global(.impact-change-icon) {
      margin-top: 0.125rem;
      flex-shrink: 0;
      color: var(--warning);
    }

    & .impact-request {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);
      white-space: pre-wrap;
    }

    & .impact-no-pages {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);
    }

    /* La caja es `.inset.plain` --el cerco sin fondo, que lo ponen las filas
       de dentro--; aqui solo la linea que separa una pagina de la siguiente. */
    & .impact-pages {
      padding: 0;

      & :global(.impact-page-row + .impact-page-row) {
        border-top: var(--border-width) solid var(--border);
      }
    }

    /* Cada salida es `.opt` del catalogo, con su par `.opt-label` /
       `.opt-hint`: aqui solo el reparto de la lista. */
    & .impact-options {
      display: flex;
      flex-direction: column;
      gap: var(--sp-8);
    }
  }
</style>
