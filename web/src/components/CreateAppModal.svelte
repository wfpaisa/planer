<script lang="ts">
  import { DEFAULT_ICON } from "@shared/icons";
  import type { AppRecord, AppTheme } from "@shared/types";

  import { errorMessage, post } from "../lib/pb";
  import IconPicker from "./IconPicker.svelte";
  import PalettePicker from "./PalettePicker.svelte";
  import Button from "./ui/Button.svelte";
  import ErrorNote from "./ui/ErrorNote.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Modal from "./ui/Modal.svelte";

  let {
    open,
    onClose,
    onCreated,
  }: { open: boolean; onClose: () => void; onCreated: (app: AppRecord) => void } = $props();

  let name = $state("");
  let icon = $state(DEFAULT_ICON);
  // Sin tocar nada se crea con la paleta de partida: elegir un color a mano
  // o del catalogo es cosa de quien construye, no una obligacion de este
  // formulario.
  let theme = $state<AppTheme>({ palette: null });
  let busy = $state(false);
  let error = $state("");

  async function submit() {
    busy = true;
    error = "";
    try {
      const app = await post<AppRecord>("/api/apps", {
        name,
        icon,
        // El catalogo entero desde el principio: se puede afinar despues
        // en los ajustes de la aplicacion, pero no hay razon para obligar
        // a un color a mano si ya se sabe con que paleta se quiere ver, ni
        // para forzar una si no se toca nada.
        theme,
      });
      onCreated(app);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  id="home-create-app-modal"
  class="modal-new-app"
  {open}
  {onClose}
  title="Nueva aplicación"
  description="Le pondremos una tabla y una pantalla de inicio vacías."
>
  <div class="create-app-fields flex flex-col gap-4">
    <div class="create-app-name-row">
      <IconPicker value={icon} onChange={(next) => (icon = next)} />
      <div class="create-app-name">
        <Field label="Nombre">
          <Input
            autofocus
            bind:value={name}
            placeholder="Directorio de empleados"
            onkeydown={(e) => e.key === "Enter" && name.trim() && submit()}
          />
        </Field>
      </div>
    </div>

    <Field
      label="Color de marca"
      hint="Con él se ve la aplicación publicada, y de ahí sale el color de su icono."
    >
      <PalettePicker value={theme} onChange={(next) => (theme = next)} />
    </Field>

    <ErrorNote message={error} />
  </div>

  {#snippet footer()}
    <Button onclick={onClose}>Cancelar</Button>
    <Button variant="secondary" loading={busy} onclick={submit} disabled={!name.trim()}>
      Crear
    </Button>
  {/snippet}
</Modal>

<style>
  .create-app-fields {
    & .create-app-name-row {
      display: flex;
      align-items: flex-end;
      gap: var(--sp-8);

      & .create-app-name {
        min-width: 0;
        flex: 1 1 0%;
      }
    }
  }
</style>
