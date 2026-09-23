<!-- No se pudo abrir la aplicación: por que, y que se puede hacer. -->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { Button, EmptyState } from "./ui";

  let { message, onLogout }: { message: string; onLogout?: () => void } = $props();

  const notPublished = $derived(message.includes("no está publicada"));
  const missing = $derived(message.includes("no existe"));
  const noAccess = $derived(message.includes("no tiene acceso"));

  const iconName = $derived(notPublished ? "clock-01" : missing ? "search-x" : "lock");
  const title = $derived(
    notPublished
      ? "Esta aplicación todavía no está publicada"
      : missing
        ? "Esta aplicación no existe"
        : noAccess
          ? "No tienes acceso a esta aplicación"
          : "No se pudo abrir la aplicación",
  );
  const description = $derived(
    notPublished
      ? "Quien la creó aún no la ha publicado. Vuelve a intentarlo más tarde."
      : missing
        ? "El enlace puede estar mal escrito o la aplicación ya no está disponible."
        : noAccess
          ? "Tu cuenta no tiene permiso para verla. Pide acceso a quien la creó."
          : "No se pudo abrir. Recarga la página para intentarlo de nuevo.",
  );
</script>

<div class="error-published flex items-center justify-center">
  <!--
    Es el estado vacío del kit (`ui/EmptyState`): el mismo icono en su caja, el
    mismo título y la misma explicacion que cuando una lista no tiene nada. No
    hace falta otra tarjeta: lo que cambia es el texto, no la pieza.
  -->
  <EmptyState id="published-error" {title} {description}>
    {#snippet icon()}<Icon name={iconName} size={20} />{/snippet}
    {#snippet action()}
      <div class="actions-error-published">
        {#if noAccess && onLogout}
          <Button variant="ghost" onclick={onLogout} class="btn-logout-error">
            <Icon name="log-out" size={14} /> Cerrar sesión
          </Button>
        {/if}
        <Button variant="ghost" onclick={() => window.location.reload()}>
          <Icon name="refresh-cw" size={14} /> Recargar
        </Button>
      </div>
    {/snippet}
  </EmptyState>
</div>

<style>
  .error-published {
    min-height: 100%;
    padding: var(--sp-40) var(--sp-16);
  }

  /* Las dos salidas van en la misma línea; el estado vacío las apila. */
  .actions-error-published {
    display: flex;
    align-items: center;
    gap: var(--sp-8);

    & :global(.btn-logout-error) {
      color: var(--text-secondary);
    }
  }
</style>
