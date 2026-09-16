<!--
  Limpieza: se eligen las aplicaciones que sobran y se borran con todo lo que
  guardan --tablas, paginas, accesos, versiones y conversaciones--.

  Se pide escribir la autorizacion a mano porque no hay vuelta atras y porque
  aqui no se borra una aplicacion, sino varias de una vez: marcar sin querer
  una casilla de mas es demasiado facil.

  Lo que no se toca son los ajustes de esta pantalla: el servidor de IA con
  sus claves y el tamano de letra siguen igual despues de limpiar.
-->
<script lang="ts" module>
  /** Lo que hay que escribir para poder confirmar. */
  export const CLEAN_PHRASE = "AUTORIZO";
</script>

<script lang="ts">
  import type { AppRecord } from "@shared/types";

  import { errorMessage, pb, post } from "../../lib/pb";
  import { useAsync } from "../../lib/useAsync.svelte";
  import AppIcon from "../AppIcon.svelte";
  import Icon from "../Icon.svelte";
  import { Button, ErrorNote, Field, Input, Loading, Modal } from "../ui";

  let {
    open,
    onClose,
    onCleaned,
  }: {
    open: boolean;
    onClose: () => void;
    /** Cuantas aplicaciones y cuantas tablas se fueron. */
    onCleaned?: (result: { apps: number; tables: number }) => void;
  } = $props();

  const apps = useAsync(() => pb.collection("apps").getFullList<AppRecord>({ sort: "-updated" }));

  let chosen = $state<string[]>([]);
  let typed = $state("");
  let busy = $state(false);
  let error = $state("");

  // Cada visita empieza en blanco: ni la seleccion ni la autorizacion de la
  // vez anterior sobreviven a cerrar el modal.
  $effect(() => {
    if (!open) return;
    chosen = [];
    typed = "";
    error = "";
    void apps.reload();
  });

  const list = $derived(apps.data ?? []);
  const all = $derived(list.length > 0 && chosen.length === list.length);
  const ready = $derived(chosen.length > 0 && typed.trim() === CLEAN_PHRASE);

  function toggle(id: string) {
    chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
  }

  function toggleAll() {
    chosen = all ? [] : list.map((app) => app.id);
  }

  async function clean() {
    busy = true;
    error = "";
    try {
      const result = await post<{ apps: number; tables: number }>("/api/apps/limpiar", {
        apps: chosen,
      });
      onCleaned?.(result);
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  id="clean-apps-modal"
  class="modal-clean-apps"
  {open}
  onClose={busy ? () => {} : onClose}
  title="Limpiar aplicaciones"
  description="Elige cuáles se van. Se borran con sus tablas, sus páginas y todos sus datos."
  width="modal-clean-apps-width"
>
  <div class="body-clean-apps flex flex-col gap-4">
    <!-- En linea y no en la capa de avisos: es la advertencia de lo que se va
         a hacer, y tiene que seguir a la vista mientras se marca la lista. -->
    <p class="alert danger warn-clean-apps">
      <i class="hgi-stroke hgi-alert-02" aria-hidden="true"></i>
      <span>
        <strong>Esto no se puede deshacer.</strong>
        Las aplicaciones marcadas se borran con sus tablas, sus páginas, sus accesos y todos sus datos.
        Los ajustes se conservan: el servidor de IA, sus claves y el tamaño de letra siguen igual.
      </span>
    </p>

    <ErrorNote message={apps.error} />
    <ErrorNote message={error} />

    {#if apps.loading && !apps.data}
      <Loading label="Cargando aplicaciones" />
    {:else if list.length === 0}
      <p class="empty-clean-apps">No hay ninguna aplicación que limpiar.</p>
    {:else}
      <div class="head-clean-apps flex items-center justify-between gap-3">
        <label class="choice check-clean-all">
          <input type="checkbox" checked={all} onchange={toggleAll} />
          <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
          <span>Seleccionar todas</span>
        </label>
        <span class="count-clean-apps">
          {chosen.length} de {list.length}
        </span>
      </div>

      <ul class="list-clean-apps flex flex-col gap-1">
        {#each list as app (app.id)}
          <li>
            <label class="choice row-clean-app">
              <input
                type="checkbox"
                checked={chosen.includes(app.id)}
                onchange={() => toggle(app.id)}
              />
              <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
              <AppIcon {app} size={16} class="icon-clean-app" />
              <span class="name-clean-app">{app.name}</span>
              <span class="slug-clean-app">/{app.slug}</span>
            </label>
          </li>
        {/each}
      </ul>

      <div class="auth-clean-apps">
        <Field
          label="Autorización"
          hint={`Escribe ${CLEAN_PHRASE} para confirmar que estás de acuerdo con que se eliminen las aplicaciones marcadas y se borren sus datos. No se puede deshacer.`}
        >
          <Input bind:value={typed} placeholder={CLEAN_PHRASE} />
        </Field>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cancelar</Button>
    <Button
      variant="danger"
      buttonClass="btn-confirm-clean-apps"
      loading={busy}
      disabled={!ready}
      onclick={() => void clean()}
    >
      <Icon name="trash" size={14} />
      Eliminar {chosen.length || ""}
    </Button>
  {/snippet}
</Modal>

<style>
  :global(.modal-clean-apps-width) {
    max-width: 34rem;
  }

  .empty-clean-apps {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .count-clean-apps {
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* La lista puede ser larga; el modal no crece con ella. */
  .list-clean-apps {
    max-height: 18rem;
    overflow-y: auto;
    list-style: none;
  }

  .row-clean-app {
    width: 100%;
    padding: var(--sp-6) var(--sp-8);
    border-radius: var(--radius-sm);

    &:hover {
      background: var(--bg-field);
    }
  }

  .name-clean-app {
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* El enlace se lee de segundas y cede el sitio cuando el nombre es largo. */
  .slug-clean-app {
    margin-left: auto;
    flex: none;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
</style>
