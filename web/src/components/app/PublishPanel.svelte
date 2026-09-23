<script lang="ts">
  import type { AppRecord, AppVersionSummary, VersionsView } from "@shared/types";
  import { untrack } from "svelte";

  import { useBuilder } from "../../lib/builderContext";
  import { cx } from "../../lib/cx";
  import { api, errorMessage, patch, post } from "../../lib/pb";
  import { useAsync } from "../../lib/useAsync.svelte";
  import Icon from "../Icon.svelte";
  import OmniPanel from "../OmniPanel.svelte";
  import Button from "../ui/Button.svelte";
  import ErrorNote from "../ui/ErrorNote.svelte";
  import Field from "../ui/Field.svelte";
  import Input from "../ui/Input.svelte";
  import Switch from "../ui/Switch.svelte";

  let { onClose }: { onClose: () => void } = $props();

  const builder = useBuilder();
  const app = $derived(builder.app);

  let busy = $state(false);
  let error = $state("");
  let copied = $state(false);

  // El formulario necesita una copia inicial; las actualizaciones se envían al guardar.
  const initialApp = untrack(() => builder.app);
  let draft = $state({ published: initialApp.published, visibility: initialApp.visibility });
  const dirty = $derived(draft.published !== app.published || draft.visibility !== app.visibility);

  const versions = useAsync(() => {
    void builder.touched;
    return api<VersionsView>(`/api/apps/${builder.app.id}/versiones`);
  });

  const pending = $derived(versions.data?.hasChanges ?? false);
  const link = $derived(`${window.location.origin}/p/${app.slug}`);

  async function publish() {
    busy = true;
    error = "";
    try {
      if (dirty) {
        builder.setApp(
          await patch<AppRecord>(`/api/apps/${app.id}`, {
            published: draft.published,
            visibility: draft.visibility,
          }),
        );
      }
      // Con el interruptor apagado solo queda el ajuste guardado: el enlace
      // sigue sin funcionar y no hay nada que sacar al público.
      if (draft.published) {
        const done = await post<{ app: AppRecord; version: AppVersionSummary }>(
          `/api/apps/${app.id}/publicar`,
          {},
        );
        // Guardar la aplicación sube `touched`: asi el aviso del botón de arriba
        // también vuelve a preguntar y deja de decir que hay cambios pendientes.
        builder.setApp(done.app);
      }
      // Aplicar el borrador era lo único que quedaba por hacer aqui: la tarjeta
      // se cierra sola y el encabezado ya cuenta como quedo.
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  /*
   * La aplicación decide una sola cosa. Quien abre cada página se decide en la
   * página, con sus roles, y las dos no se pisan: esto es la frontera de
   * fuera, aquello el reparto de dentro. Ver `design.md` D3.
   */
  const VISIBILITIES = [
    {
      value: "private",
      icon: "key-round",
      title: "Requiere iniciar sesión",
      description: "Hay que ingresar con una cuenta creada en la Base de datos de Personas.",
    },
    {
      value: "public",
      icon: "globe-02",
      title: "Libre",
      description: "No requiere iniciar sesión para poder ver.",
    },
  ] as const;
</script>

<OmniPanel
  title="Publicar"
  description="Configura cómo se comparte tu aplicación y  quién puede acceder."
  {onClose}
>
  <div class="body-publish-panel flex flex-col gap-5">
    <ErrorNote message={error} />

    {#if pending}
      <div class="alert warn status-publish-panel">
        <i class="hgi-stroke hgi-alert-02" aria-hidden="true"></i>
        {#if app.published}
          <span>
            <strong>Cambios sin publicar</strong>
            Hay cambios guardados que aún no están disponibles para el público.
          </span>
        {:else}
          <span>
            <strong>Aplicación sin publicar</strong>
            La aplicación todavía no está publicada, por lo que el enlace aún no está disponible.
          </span>
        {/if}
      </div>
    {/if}

    <div class="row-publish-visibility opt-row">
      <div class="opt-body">
        <p class="label-publish-visibility opt-label">Publicar</p>
        <p class="hint-publish-visibility opt-hint">
          Mientras este apagado, el enlace no funcionara.
        </p>
      </div>
      <Switch checked={draft.published} onchange={(v) => (draft.published = v)} />
    </div>

    <!-- Con el interruptor apagado no hay enlace ni público al que dejar entrar:
         quien puede ver y por donde solo tienen sentido si esto sale fuera. -->
    {#if draft.published}
      <div class="grid-publish-visibility grid gap-2">
        {#each VISIBILITIES as option (option.value)}
          <button
            type="button"
            onclick={() => (draft.visibility = option.value)}
            aria-label={option.title}
            aria-pressed={draft.visibility === option.value}
            class={cx("btn-visibility-option opt", draft.visibility === option.value && "active")}
          >
            <Icon name={option.icon} size={20} class="icon-visibility-option" />
            <span class="body-visibility-option opt-body">
              <span class="title-visibility-option opt-label">{option.title}</span>
              <span class="description-visibility-option opt-hint">{option.description}</span>
            </span>
          </button>
        {/each}
      </div>

      <Field label="Enlace">
        <div class="row-publish-link join">
          <Input readonly value={link} onfocus={(e) => e.currentTarget.select()} />
          <Button onclick={copy} buttonClass="btn-open-copy" variant="soft">
            <Icon name={copied ? "check" : "copy-01"} size={14} />
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            buttonClass="btn-open-published"
            variant="soft"
            onclick={() => window.open(link, "_blank")}
          >
            <Icon name="external-link" size={14} />
          </Button>
        </div>
      </Field>
    {/if}
  </div>

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy} variant="soft">Cerrar</Button>
    <Button
      variant={draft.published && app.published ? "warning" : "secondary"}
      loading={busy}
      onclick={publish}
    >
      {draft.published && app.published ? "Publicar cambios" : "Guardar"}
    </Button>
  {/snippet}
</OmniPanel>

<style>
  .body-publish-panel {
    /* La fila del interruptor es `.opt-row` del catálogo, con su par
       `.opt-label` / `.opt-hint`: aqui no queda nada propio que decir. */

    /*
     * Las dos salidas son `.opt` del catálogo: la elegida se tine con el
     * acento suave, igual que el tipo de columna o la salida de un impacto.
     * Antes eran dos `.btn` pegados con `.join` y la elegida iba con el
     * acento pleno: el mismo gesto --elegir una de dos-- se veia de dos
     * maneras distintas segun la pantalla.
     */
    & .grid-publish-visibility {
      grid-template-columns: repeat(2, minmax(0, 1fr));

      & .btn-visibility-option {
        align-items: flex-start;

        & :global(.icon-visibility-option) {
          margin-top: 0.125rem;
          flex: none;
        }

        /* La explicacion son dos renglones, asi que no se recorta. */
        & .description-visibility-option {
          white-space: normal;
          overflow-wrap: break-word;
        }
      }
    }

    & .row-publish-link {
      display: flex;
    }
  }
</style>
