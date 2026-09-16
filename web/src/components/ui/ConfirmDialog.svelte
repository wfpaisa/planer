<script lang="ts">
  import type { Snippet } from "svelte";

  import Button from "./Button.svelte";
  import Field from "./Field.svelte";
  import Input from "./Input.svelte";
  import Modal from "./Modal.svelte";

  let {
    open,
    onClose,
    title,
    message,
    confirmLabel = "Borrar",
    busy = false,
    onConfirm,
    confirmText,
    confirmHint,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    message: string | Snippet;
    confirmLabel?: string;
    busy?: boolean;
    onConfirm: () => void;
    /** Si se da, hay que escribirlo tal cual para poder confirmar. */
    confirmText?: string;
    /** La frase que acompana el campo de confirmacion. */
    confirmHint?: string;
  } = $props();

  let typed = $state("");
  const needsText = $derived(!!confirmText);
  const matches = $derived(!confirmText || typed === confirmText);

  $effect(() => {
    if (open) typed = "";
  });
</script>

<Modal {open} {onClose} {title}>
  <p class="confirm-dialog-message">
    {#if typeof message === "string"}{message}{:else}{@render message()}{/if}
  </p>
  {#if needsText}
    <div class="confirm-dialog-field">
      <Field label={confirmHint ?? "Escribe el nombre para confirmar"}>
        <Input autofocus bind:value={typed} placeholder={confirmText} />
      </Field>
    </div>
  {/if}
  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cancelar</Button>
    <Button variant="danger" loading={busy} disabled={!matches} onclick={onConfirm}>
      {confirmLabel}
    </Button>
  {/snippet}
</Modal>

<style>
  .confirm-dialog-message {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .confirm-dialog-field {
    margin-top: var(--sp-16);
  }
</style>
