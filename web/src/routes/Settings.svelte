<script lang="ts">
  import type { AppRecord, AppTheme } from "@shared/types";

  import AppFontSize from "../components/AppFontSize.svelte";
  import BrandPreview from "../components/BrandPreview.svelte";
  import Icon from "../components/Icon.svelte";
  import IconPicker from "../components/IconPicker.svelte";
  import PalettePicker from "../components/PalettePicker.svelte";
  import Button from "../components/ui/Button.svelte";
  import ConfirmDialog from "../components/ui/ConfirmDialog.svelte";
  import ErrorNote from "../components/ui/ErrorNote.svelte";
  import Field from "../components/ui/Field.svelte";
  import Input from "../components/ui/Input.svelte";
  import Modal from "../components/ui/Modal.svelte";
  import { appBrand } from "../lib/appTheme";
  import { useBuilder } from "../lib/builderContext";
  import { cx } from "../lib/cx";
  import { del, errorMessage, patch } from "../lib/pb";
  import { navigate } from "../lib/router.svelte";

  let { onClose }: { onClose: () => void } = $props();

  const builder = useBuilder();
  const app = $derived(builder.app);

  let name = $state(builder.app.name);
  let slug = $state(builder.app.slug);
  let icon = $state(builder.app.icon);
  let theme = $state<AppTheme>(appBrand(builder.app.theme));

  let busy = $state(false);
  let error = $state("");
  let confirmDelete = $state(false);
  let deleting = $state(false);

  const dirty = $derived(
    name !== app.name ||
      slug !== app.slug ||
      icon !== app.icon ||
      JSON.stringify(theme) !== JSON.stringify(appBrand(app.theme)),
  );

  async function remove() {
    deleting = true;
    try {
      await del(`/api/apps/${app.id}`);
      navigate("/");
    } catch (err) {
      deleting = false;
      confirmDelete = false;
      error = errorMessage(err);
    }
  }

  async function save() {
    busy = true;
    error = "";
    try {
      const updated = await patch<AppRecord>(`/api/apps/${app.id}`, {
        name,
        slug,
        icon,
        theme,
      });
      builder.setApp(updated);
      slug = updated.slug;
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet section(
  id: string,
  title: string,
  description: string,
  className: string,
  body: import("svelte").Snippet,
)}
  <section {id} class={cx("settings-section card card-solid", className)}>
    <header class="card-head">
      <div class="section-copy">
        <h2 class="section-title card-title">{title}</h2>
        <p class="section-description card-sub">{description}</p>
      </div>
    </header>
    <div class="section-body card-body">{@render body()}</div>
  </section>
{/snippet}

<Modal
  id="app-settings-modal"
  class="panel-app-settings"
  open
  {onClose}
  title="Ajustes de la aplicación"
  description="Nombre, enlace y apariencia con los que se publica."
  width="modal-settings-width"
  fill
>
  <div>
    <ErrorNote message={error} />

    {#snippet identity()}
      <div class="settings-identity-grid grid gap-4">
        <div class="settings-icon-name flex items-end gap-2">
          <IconPicker value={icon} onChange={(next) => (icon = next)} />
          <div class="settings-name-field flex-1">
            <Field label="Nombre">
              <Input bind:value={name} />
            </Field>
          </div>
        </div>
        <Field label="Enlace" hint="Se abrira en /p/{slug || '...'}">
          <Input bind:value={slug} placeholder="directorio-de-empleados" />
        </Field>
      </div>
    {/snippet}
    {@render section(
      "app-settings-identity-section",
      "Identidad",
      "El nombre y el enlace con los que se publica.",
      "section-app-identity",
      identity,
    )}

    {#snippet appearance()}
      <div class="settings-appearance flex flex-col gap-5">
        <PalettePicker value={theme} onChange={(next) => (theme = next)} />
        <AppFontSize value={theme} onChange={(next) => (theme = next)} />
        <BrandPreview {theme} />
      </div>
    {/snippet}
    {@render section(
      "app-settings-theme-section",
      "Apariencia",
      "La paleta y el tamaño de letra con los que se publica la aplicación. Claro u oscuro no se elige aquí: lo pone quien visita la página, y los colores se ajustan solos para verse bien en los dos.",
      "section-app-theme",
      appearance,
    )}

    {#snippet danger()}
      <div class="settings-danger-row flex items-center justify-between gap-4">
        <p class="danger-label">
          Borrar <strong>{app.name}</strong> y todo lo que tiene.
        </p>
        <Button variant="danger" onclick={() => (confirmDelete = true)}>
          <Icon name="trash" size={14} /> Borrar aplicación
        </Button>
      </div>
    {/snippet}
    {@render section(
      "app-settings-danger-section",
      "Borrar aplicación",
      "Se borran la aplicación, sus tablas y todos sus datos. Esta acción no se puede deshacer.",
      "section-app-delete",
      danger,
    )}
  </div>

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cancelar</Button>
    <Button variant="secondary" loading={busy} disabled={!dirty} onclick={() => void save()}>
      Guardar
    </Button>
  {/snippet}
</Modal>

<ConfirmDialog
  open={confirmDelete}
  onClose={() => (confirmDelete = false)}
  title={`Borrar "${app.name}"`}
  confirmText={app.name}
  confirmHint={`Escribe "${app.name}" para confirmar`}
  busy={deleting}
  onConfirm={() => void remove()}
>
  {#snippet message()}
    Se borrará la aplicación <strong>{app.name}</strong> y todos sus datos. Esta acción no se puede deshacer.
  {/snippet}
</ConfirmDialog>

<style>
  /* El panel del modal vive en `Modal.svelte`; su ancho se manda desde aqui. */
  :global(.modal-settings-width) {
    max-width: 48rem;
  }

  /* La caja es `.card` del catalogo --`card-solid` porque en oscuro la
     del catalogo es translucida y aqui va sobre el cuerpo de un modal--
     con su cabecera, su titulo y su subtitulo. Aqui solo lo propio: la
     separacion entre secciones y el titulo un escalon mas chico, que
     dentro de un modal ya hay un titulo por encima. */
  .settings-section {
    margin-top: var(--sp-16);
    box-shadow: var(--shadow-sm);

    & .section-copy {
      min-width: 0;
    }

    & .section-title {
      font-size: var(--text-sm);
      font-weight: 600;
    }

    & .section-description {
      font-size: var(--text-xs);
    }

    & .section-body {
      & > * + * {
        margin-top: var(--sp-16);
      }
    }
  }

  /* Arriba y no estiradas: la ayuda debajo del enlace hace su columna mas
     alta, y estiradas la otra se descolgaria. Asi las dos etiquetas y los dos
     campos empiezan a la misma altura. */
  .settings-identity-grid {
    align-items: start;

    @media (min-width: 40rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .settings-name-field {
    min-width: 0;
  }

  .danger-label {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
</style>
