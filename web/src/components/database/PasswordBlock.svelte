<!--
  El bloque de la clave dentro del panel lateral de una persona.

  Empieza cerrado: se abre el panel de una persona para cambiarle el area o el
  cargo mucho mas a menudo que para darle una clave nueva.
-->
<script lang="ts">
  import Icon from "../Icon.svelte";
  import Button from "../ui/Button.svelte";
  import PasswordForm from "./PasswordForm.svelte";

  let { accessId, email }: { accessId: string; email: string } = $props();

  let open = $state(false);
</script>

<div class="block-password">
  {#if open}
    <PasswordForm {accessId} {email} onClose={() => (open = false)} />
  {:else}
    <Button onclick={() => (open = true)}>
      <Icon name="key-round" size={14} /> Cambiar la clave
    </Button>
  {/if}
</div>

<style>
  .block-password {
    padding-top: var(--sp-8);
  }
</style>
