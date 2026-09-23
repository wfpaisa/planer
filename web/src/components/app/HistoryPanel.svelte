<!--
  Los cambios guardados del diseño de una aplicación.

  Publicar deja una versión aqui; desde esta lista se puede mirar como quedaba,
  volver a ella o limpiarla.
-->
<script lang="ts">
  import type { AppVersionSummary, VersionsView } from "@shared/types";

  import { useBuilder } from "../../lib/builderContext";
  import { api, del, errorMessage, patch, post } from "../../lib/pb";
  import { preview, setPanelAside } from "../../lib/previewPanel.svelte";
  import { location, navigate } from "../../lib/router.svelte";
  import { useAsync } from "../../lib/useAsync.svelte";
  import Icon from "../Icon.svelte";
  import OmniPanel from "../OmniPanel.svelte";
  import { Button, ConfirmDialog, ErrorNote, SuccessNote } from "../ui";
  import VersionRow from "./VersionRow.svelte";
  import WatchingBadge from "./WatchingBadge.svelte";

  let { onClose }: { onClose: () => void } = $props();

  const builder = useBuilder();

  let error = $state("");
  let busy = $state("");
  let done = $state("");
  /** Lo que hay que leer antes de volver a una versión, si hay algo. */
  let warning = $state<{ version: AppVersionSummary; text: string } | null>(null);

  /*
   * Que se esta mirando en la capa de encima. No sale de la ruta: esta lista se
   * dibuja debajo de la capa y ahi la ruta que ve es la del fondo.
   */
  const watching = $derived(preview.source);

  const view = useAsync(() => api<VersionsView>(`/api/apps/${builder.app.id}/versiones`));

  /*
   * La vista previa se abre como una capa encima de lo que se este viendo, asi
   * que se guarda como fondo para volver exactamente a donde se estaba (con los
   * cambios abiertos tal cual) al cerrarla.
   *
   * Y esta tarjeta se aparta mientras dure: se dibuja delante de la capa, asi
   * que quedarse tapaba justo lo que se acaba de pedir ver. No se cierra --la
   * lista sigue cargada-- y vuelve desde la cinta de la vista previa, que es lo
   * que deja ir mirando una versión detras de otra.
   */
  function openPreview(source: string) {
    setPanelAside(true);
    navigate(`/a/${builder.app.id}/vista/${source}`, {
      state: { background: { pathname: location.pathname, search: location.search } },
    });
  }

  async function guard(key: string, fn: () => Promise<void>) {
    busy = key;
    error = "";
    done = "";
    try {
      await fn();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = "";
    }
  }

  const savePoint = () =>
    guard("save", async () => {
      await post(`/api/apps/${builder.app.id}/versiones`, { label: "Punto de guardado" });
      await view.reload();
    });

  /**
   * Volver a una versión puede encontrarse con una estructura de tablas que ya
   * no es la de entonces. Restaurar no devuelve columnas, asi que el servidor
   * avisa antes y no hace nada hasta que se confirma.
   */
  const restore = (version: AppVersionSummary, confirmado = false) =>
    guard(version.id, async () => {
      const res = await post<{ needsConfirm?: boolean; aviso?: string }>(
        `/api/apps/${builder.app.id}/versiones/${version.id}/restaurar`,
        { confirmado },
      );

      if (res.needsConfirm) {
        warning = { version, text: res.aviso ?? "" };
        return;
      }

      await Promise.all([builder.reloadPages(), builder.reloadTables()]);
      await view.reload();
      done = `Volviste a la versión ${version.number}. Publica cuando quieras que se vea.`;
    });

  const remove = (version: AppVersionSummary) =>
    guard(version.id, async () => {
      await del(`/api/apps/${builder.app.id}/versiones/${version.id}`);
      await view.reload();
    });

  const rename = (version: AppVersionSummary, label: string) =>
    guard(version.id, async () => {
      await patch(`/api/apps/${builder.app.id}/versiones/${version.id}`, { label });
      await view.reload();
    });

  const togglePin = (version: AppVersionSummary) =>
    guard(version.id, async () => {
      await patch(`/api/apps/${builder.app.id}/versiones/${version.id}`, {
        pinned: !version.pinned,
      });
      await view.reload();
    });

  const versions = $derived(view.data?.versions ?? []);
  /** La que ve la gente ahora mismo. Sin ella, esta app no se publicó nunca. */
  const live = $derived(versions.find((v) => v.live));
  const hasChanges = $derived(view.data?.hasChanges);
</script>

<OmniPanel
  title="Histórico de cambios"
  description="Cada publicación queda guardada. Puedes mirarla, volver a ella o borrarla."
  {onClose}
>
  <div class="history-panel-body flex flex-col gap-4">
    <!--
      El borrador no tiene fila propia, asi que su tarjeta hace de fila: lo que
      se esta editando, si ya lo vio alguien, y el mismo ojo que las demas.
    -->
    <div class="history-draft-card alert info">
      <div class="history-draft-text">
        <p class="history-draft-title">
          {hasChanges ? "Hay cambios sin publicar" : "Todo está publicado"}
          {#if watching === "borrador"}<WatchingBadge />{/if}
        </p>
        <p class="history-draft-sub">
          {hasChanges
            ? live
              ? `Lo que estás editando todavía no lo ve nadie: la gente sigue viendo la versión ${live.number}.`
              : "Lo que estás editando todavía no lo ve nadie."
            : live
              ? `El enlace público muestra la versión ${live.number}, que es esto mismo.`
              : "El enlace público muestra lo mismo que estás editando."}
        </p>
      </div>
      <Button
        size="sm"
        variant={watching === "borrador" ? "secondary" : "default"}
        tip={watching === "borrador" ? "Ya lo estas mirando" : undefined}
        onclick={() => openPreview("borrador")}
      >
        <Icon name="eye" size={13} /> Ver borrador
      </Button>
      <Button size="sm" loading={busy === "save"} onclick={savePoint}>
        <Icon name="save" size={13} /> Guardar punto
      </Button>
    </div>

    <ErrorNote message={error || view.error} />

    <SuccessNote message={done} />

    <div class="history-versions inset plain">
      {#if !view.loading && versions.length === 0}
        <p class="history-empty">No hay publicaciones.</p>
      {/if}
      {#each versions as version (version.id)}
        <VersionRow
          {version}
          busy={busy === version.id}
          watching={watching === version.id}
          onPreview={() => openPreview(version.id)}
          onRestore={() => restore(version)}
          onRemove={() => remove(version)}
          onRename={(label) => rename(version, label)}
          onPin={() => togglePin(version)}
        />
      {/each}
    </div>
  </div>

  {#snippet footer()}
    <Button onclick={onClose}>Listo</Button>
  {/snippet}
</OmniPanel>

<ConfirmDialog
  open={!!warning}
  onClose={() => (warning = null)}
  title={`Volver a la versión ${warning?.version.number ?? ""}`}
  message={warning?.text ?? ""}
  confirmLabel="Volver igual"
  busy={busy === warning?.version.id}
  onConfirm={() => {
    const pending = warning;
    warning = null;
    if (pending) void restore(pending.version, true);
  }}
/>

<style>
  .history-panel-body {
    & .history-draft-card {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-8);

      & .history-draft-text {
        min-width: 0;
        flex: 1 1 0%;
      }

      & .history-draft-title {
        display: flex;
        align-items: center;
        gap: var(--sp-8);
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        font-weight: 500;
        color: var(--text-primary);
      }

      & .history-draft-sub {
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-secondary);
      }
    }

    /* La caja es `.inset.plain` --el cerco sin fondo, que ya lo ponen las
       filas de dentro--; aqui solo la línea que separa una versión de la
       siguiente. */
    & .history-versions {
      padding: 0;

      /* Una fila y la siguiente se separan por una línea tenue del divide-y. */
      & :global(.row-version + .row-version) {
        border-top: var(--border-width) solid var(--border);
      }

      & .history-empty {
        padding: var(--sp-24) var(--sp-12);
        text-align: center;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }
    }
  }
</style>
