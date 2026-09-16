<!--
  Vista previa del borrador o de una version guardada.

  Dibuja exactamente lo mismo que ve un visitante, pero con la sesion del
  constructor y con los avisos de lo que el documento hace mal.

  Se abre como una capa encima del editor, no como una pagina aparte: asi
  "volver al editor" no navega a ningun sitio, solo cierra la capa, y todo lo
  que estaba abierto detras (por ejemplo los cambios) sigue como estaba.
-->
<script lang="ts">
  import type { AppBundle, VersionsView } from "@shared/types";

  import AppView from "../components/AppView.svelte";
  import Icon from "../components/Icon.svelte";
  import { Button, ErrorNote, Loading, Tag } from "../components/ui";
  import { previewPageLoader } from "../lib/htmlDocs";
  import { api, pb } from "../lib/pb";
  import { appPeople, setPeople } from "../lib/people.svelte";
  import { preview, setPanelAside } from "../lib/previewPanel.svelte";
  import { useAsync } from "../lib/useAsync.svelte";

  let { appId, source, onClose }: { appId: string; source: string; onClose: () => void } = $props();

  let pageSlug = $state<string | undefined>();

  setPeople(appPeople(() => appId));

  /* Depende solo de la aplicacion: uno nuevo por dibujado reiniciaria el marco
     sin parar. */
  const makePageLoader = $derived((pageId: string) => previewPageLoader(appId, pageId));

  const bundle = useAsync(() => api<AppBundle>(`/api/apps/${appId}/vista/${source}`));

  /*
   * El historial, solo para poder decir que se esta mirando: el paquete trae la
   * fotografia, no el numero de la version ni cual esta publicada. Se pide
   * aparte para que la cinta lo diga con todas las letras tambien cuando se
   * llega por la direccion, sin pasar por la lista.
   */
  const history = useAsync(() => api<VersionsView>(`/api/apps/${appId}/versiones`));
  const versions = $derived(history.data?.versions ?? []);
  const shown = $derived(versions.find((v) => v.id === source));
  const live = $derived(versions.find((v) => v.live));

  /*
   * La lista de cambios se aparto para dejar ver esto. Se ofrece traerla de
   * vuelta sin cerrar la capa: asi se va de una version a otra --mirar, volver
   * a la lista, mirar la siguiente-- sin salir y entrar cada vez.
   */
  const panelAside = $derived(preview.aside);
  const bringPanelBack = () => setPanelAside(false);
</script>

<div id="preview-overlay" class="overlay-preview flex flex-col">
  {#if bundle.loading}
    <Loading label="Preparando la vista previa" />
  {:else if bundle.error || !bundle.data}
    <div class="preview-error">
      <ErrorNote message={bundle.error || "No se pudo abrir la vista previa"} />
      <div class="preview-error-actions flex items-center gap-2">
        {#if panelAside}
          <Button variant="secondary" onclick={bringPanelBack}>
            <Icon name="history" /> Ver los cambios
          </Button>
        {/if}
        <Button variant="secondary" onclick={onClose}>Volver al editor</Button>
      </div>
    </div>
  {:else}
    <AppView
      bundle={bundle.data}
      client={pb}
      {makePageLoader}
      showIssues
      {pageSlug}
      onOpenPage={(page) => (pageSlug = page.slug)}
    >
      {#snippet banner()}
        <div id="preview-banner" class="banner-preview alert info items-center gap-2 shrink-0">
          <Icon name="eye" size={14} class="banner-preview-eye" />
          <!--
            Que se esta mirando, con su nombre, y si eso es o no lo que ve la
            gente: entrar y salir de varias versiones seguidas sin saber en cual
            estas es lo que hacia inutil esta pantalla.
          -->
          <Tag tone="tag-warning" class="banner-preview-label shrink-0">
            {source === "borrador"
              ? "Borrador"
              : shown
                ? `Versión ${shown.number}`
                : "Versión guardada"}
          </Tag>
          {#if shown?.live}
            <Tag tone="tag-success" class="banner-preview-label shrink-0">En vivo</Tag>
          {/if}
          <span class="banner-preview-copy flex-1">
            {source === "borrador"
              ? history.data && !history.data.hasChanges
                ? "Lo que estás editando, que es lo mismo que está publicado."
                : "Lo que estás editando. Nadie más lo ve todavía."
              : shown?.live
                ? "Esto es lo que ve la gente en el enlace público."
                : live
                  ? `Cómo quedaba entonces. Publicada sigue la versión ${live.number}.`
                  : "Cómo quedaba entonces."}
          </span>
          <!--
            La lista de cambios se aparto para dejar ver esto; desde aqui vuelve,
            encima, para seguir mirando versiones.
          -->
          {#if panelAside}
            <Button
              class="btn-open-changes"
              size="sm"
              onclick={bringPanelBack}
              variant="warning"
              aria-label="Volver a la lista de cambios"
            >
              <Icon name="history" size={13} /> Cambios
            </Button>
          {/if}
          <Button size="sm" onclick={onClose} variant="warning">
            <Icon name="arrow-left-01" size={13} /> Volver al editor
          </Button>
        </div>
      {/snippet}
    </AppView>
  {/if}
</div>

<style>
  .overlay-preview {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: var(--bg-level2);
  }

  .preview-error {
    margin: 0 auto;
    max-width: 28rem;
    padding: var(--sp-40);
  }

  .preview-error-actions {
    margin-top: var(--sp-16);
  }

  /* La franja es `.alert.info` del catalogo --el mismo azul y la misma tinta
     que el resto de avisos--; aqui solo lo que la hace franja y no caja: sin
     esquinas, pegada de lado a lado y con la linea solo abajo, que es donde
     empieza lo que se esta mirando. */
  .banner-preview {
    border-radius: 0;
    border-width: 0 0 var(--border-width);
    padding: var(--sp-8) var(--sp-12);
  }

  /* El ojo lo dibuja `Icon`, con la clase que le pasamos. */
  .banner-preview :global(.banner-preview-eye) {
    flex-shrink: 0;
    color: var(--warning);
  }

  /* Las pastillas las dibuja `Tag`: su clase sale del ambito de aqui. */
  :global(.banner-preview-label) {
    font-weight: 500;
  }

  .banner-preview-copy {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--warning);
  }
</style>
