<!--
  Dar a alguien acceso que no tenia: se autoriza aqui, leyendo lo que va a
  poder hacer.

  No es el dialogo de impacto. Aquel decide sobre una tabla y ofrece cuatro
  salidas --conservar, aplicar, aplicar y arreglar, no tocar-- que sobre un
  permiso no significan nada. Aqui hay una frase y dos respuestas.

  Y no se abre encima de la conversacion: se lee dentro de ella, donde se pidio,
  porque lo que hay que leer es la frase. Un boton generico de "autorizar" en
  una ventana aparte seria justo lo contrario de lo que esto es.

  Quitar acceso no llega hasta aqui: eso ya se aplico al pedirlo.
-->
<script lang="ts">
  import type { AccessChange, ImpactResult } from "@shared/types";

  import { errorMessage, post } from "../../lib/pb";
  import Icon from "../Icon.svelte";
  import { Button, ErrorNote } from "../ui";

  let {
    change,
    appId,
    onResolved,
  }: {
    change: AccessChange;
    appId: string;
    /** Se aplico: hay que releer lo que dependa del acceso. */
    onResolved: (result: ImpactResult) => Promise<void> | void;
  } = $props();

  let busy = $state(false);
  let error = $state("");
  /** Ya se decidio, en un sentido o en otro. La tarjeta se queda diciendo cual. */
  let settled = $state<"dado" | "no" | "">("");

  async function grant(): Promise<void> {
    busy = true;
    error = "";
    try {
      const result = await post<ImpactResult>(`/api/apps/${appId}/acceso`, { change });
      settled = "dado";
      await onResolved(result);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="access-grant alert warn">
  <Icon name="user-lock-01" size={16} class="access-grant-icon" />

  <div class="access-grant-body">
    <div class="access-grant-head">
      <span class="access-grant-title">Dar acceso a {change.personName}</span>
    </div>

    <!-- Lo unico que hay que leer para decidir. -->
    <p class="access-grant-consequence">{change.consequence}</p>

    <ErrorNote message={error} />

    {#if settled === "dado"}
      <p class="access-grant-settled">Hecho. Queda un punto al que volver en «Cambios».</p>
    {:else if settled === "no"}
      <p class="access-grant-settled">El acceso se quedó como estaba.</p>
    {:else}
      <div class="access-grant-actions flex items-center">
        <Button
          buttonClass="btn-grant-access"
          onclick={grant}
          loading={busy}
          variant="secondary"
          size="sm"
        >
          Dar el acceso
        </Button>
        <Button
          buttonClass="btn-keep-access"
          onclick={() => (settled = "no")}
          disabled={busy}
          variant="ghost"
          size="sm"
        >
          Dejarlo como está
        </Button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* La caja es `.alert.warn` del catalogo: el mismo amarillo, el mismo borde
     y el mismo reparto --icono a la izquierda, texto al lado-- que cualquier
     otro aviso del panel. Aqui solo el hueco que la separa del turno de
     arriba y el peso de sus dos renglones. */
  .access-grant {
    margin-top: var(--sp-8);
  }

  .access-grant-body {
    min-width: 0;
    flex: 1;
  }

  .access-grant-head {
    font-weight: 600;
  }

  .access-grant-consequence {
    margin-top: var(--sp-4);
    color: var(--text-primary);
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
  }

  .access-grant-actions {
    gap: var(--sp-8);
    margin-top: var(--sp-8);
  }

  .access-grant-settled {
    margin-top: var(--sp-8);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }
</style>
