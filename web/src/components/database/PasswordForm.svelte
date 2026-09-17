<!--
  La clave de una persona invitada, que no es una columna de la tabla.

  Es el unico dato del producto que no se puede leer: se pone, se ensena una
  sola vez y no queda en ningun sitio de donde volver a sacarla. Por eso no esta
  entre las columnas, no sale al exportar y vive aqui, en la fila de la persona,
  con su propio camino.

  Se puede escribir una clave o dejarlo vacio y que el servidor invente una: en
  los dos casos se ensena una sola vez, que es lo unico que hay que copiar antes
  de cerrar.
-->
<script lang="ts">
  import { MIN_PASSWORD } from "@shared/people";

  import { errorMessage, post } from "../../lib/pb";
  import Button from "../ui/Button.svelte";
  import ErrorNote from "../ui/ErrorNote.svelte";
  import Input from "../ui/Input.svelte";
  import PasswordNote from "./PasswordNote.svelte";

  let { accessId, email, onClose }: { accessId: string; email: string; onClose: () => void } =
    $props();

  let value = $state("");
  let busy = $state(false);
  let error = $state("");
  let done = $state("");

  const short = $derived(value.trim().length > 0 && value.trim().length < MIN_PASSWORD);

  async function submit() {
    if (short) return;
    busy = true;
    error = "";
    try {
      const res = await post<{ password: string }>(`/api/members/${accessId}/clave`, {
        password: value.trim() || undefined,
      });
      value = "";
      done = res.password;
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

{#if done}
  <PasswordNote
    title="Clave nueva para {email}"
    password={done}
    onDone={() => {
      done = "";
      onClose();
    }}
  />
{:else}
  <div class="form-password inset flex flex-col gap-2">
    <div class="row-password-form">
      <Input
        bind:value
        onkeydown={(e) => e.key === "Enter" && void submit()}
        placeholder="Dejalo vacio y se inventa una"
        aria-label="Clave nueva para {email}"
        class="input-password-form"
      />
      <Button
        variant="secondary"
        class="btn-password-form"
        loading={busy}
        disabled={short}
        onclick={() => void submit()}
      >
        Cambiar
      </Button>
      <Button class="btn-password-form" onclick={onClose} disabled={busy}>Cancelar</Button>
    </div>
    <p class="hint-password-form">
      {short
        ? `La clave necesita ${MIN_PASSWORD} caracteres o más.`
        : "Al cambiarla se cierran las sesiones que tuviera abiertas."}
    </p>
    <ErrorNote message={error} />
  </div>
{/if}

<style>
  /* La caja es `.inset` del catalogo: lo que se abre dentro de la fila de
     una persona se hunde, no se levanta. */
  .form-password {
    & .row-password-form {
      display: flex;
      gap: var(--sp-8);

      & :global(.input-password-form) {
        min-width: 0;
        flex: 1;
      }

      & :global(.btn-password-form) {
        flex-shrink: 0;
      }
    }

    & .hint-password-form {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }
  }
</style>
