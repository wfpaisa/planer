<!--
  Lo que se explica antes de traer un archivo `.planer`.

  Importar no toca nada de lo que ya hay: levanta una aplicación nueva, con su
  enlace propio y sin publicar. Eso hay que decirlo aqui y no despues, porque
  desde fuera "importar" se parece mucho a "restaurar", y quien cree que esta
  restaurando espera que lo de antes desaparezca.

  El nombre se pide vacio a proposito. Dentro del archivo viene el nombre de
  verdad --con sus acentos y sus mayusculas-- y el servidor lo usa si aqui no
  se escribe nada; el del archivo es el enlace, que ya viene sin acentos, asi
  que proponerlo seria cambiar "Odontología" por "Odontologia" sin avisar.
-->
<script lang="ts">
  import { slugify } from "@shared/types";

  import { Button, Field, Input, Modal } from "../ui";

  let {
    open,
    file,
    busy = false,
    onClose,
    onConfirm,
  }: {
    open: boolean;
    /** El archivo ya elegido. Sólo para decir cuál es. */
    file: File | null;
    busy?: boolean;
    onClose: () => void;
    onConfirm: (name: string) => void;
  } = $props();

  let name = $state("");

  // En blanco cada vez que se abre: el modal sigue montado con el cierre, y lo
  // que se escribio para un archivo no tiene nada que ver con el siguiente.
  $effect(() => {
    if (open) name = "";
  });

  const link = $derived(name.trim() ? slugify(name, "...") : "");
</script>

<Modal
  id="import-app-modal"
  class="modal-import-app"
  {open}
  onClose={busy ? () => {} : onClose}
  title="Importar aplicación"
  description="El archivo se importará como una aplicación nueva."
>
  <div class="body-import-app flex flex-col gap-4">
    <!-- En línea y no en la capa de avisos: es lo que hay que leer antes de
         aceptar, y tiene que seguir a la vista mientras se escribe el nombre. -->
    <p class="alert info note-import-app">
      <i class="hgi-stroke hgi-information-circle" aria-hidden="true"></i>
      <span>
        <strong>No se reemplaza ninguna aplicación.</strong>
        Se creará una aplicación sin publicar y con su propio enlace. Las aplicaciones actuales no cambiarán.
      </span>
    </p>

    {#if file}
      <p class="file-import-app">
        <i class="hgi-stroke hgi-file-zip" aria-hidden="true"></i>
        <span class="name-import-file">{file.name}</span>
      </p>
    {/if}

    <Field
      label="Nombre de la aplicación"
      hint={link
        ? `Su enlace público será /p/${link}`
        : "Déjalo en blanco para conservar el nombre guardado en el archivo."}
    >
      <Input
        autofocus
        bind:value={name}
        placeholder="Conservar el nombre del archivo"
        onkeydown={(e) => e.key === "Enter" && !busy && onConfirm(name)}
      />
    </Field>
  </div>

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cancelar</Button>
    <Button
      variant="secondary"
      buttonClass="btn-confirm-import-app"
      loading={busy}
      onclick={() => onConfirm(name)}
    >
      Importar aplicación
    </Button>
  {/snippet}
</Modal>

<style>
  .file-import-app {
    display: flex;
    align-items: center;
    gap: var(--sp-8);
    font-size: var(--text-sm);
    color: var(--text-secondary);

    & i {
      color: var(--text-muted);
    }

    /* El nombre del archivo puede ser largo y no parte por espacios. */
    & .name-import-file {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
