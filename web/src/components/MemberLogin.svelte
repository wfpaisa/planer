<!--
  Entrar a una aplicacion privada.

  Lo que se compara no es el correo a secas: es el correo dentro de esta
  aplicacion. La misma direccion puede tener cuenta en otra, con otra clave, y
  esa no abre esta. Ver `loginFor` en `shared/people.ts`.
-->
<script lang="ts">
  import { loginFor } from "@shared/people";
  import type { AppBundle } from "@shared/types";

  import { paletteAttrs } from "../lib/appTheme";
  import { pbApp } from "../lib/pb";
  import AppIcon from "./AppIcon.svelte";
  import { Button, ErrorNote, Field, Input } from "./ui";

  let { bundle, onSignedIn }: { bundle: AppBundle; onSignedIn: () => void } = $props();

  let email = $state("");
  let password = $state("");
  let busy = $state(false);
  let error = $state("");

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = "";
    try {
      await pbApp.collection("members").authWithPassword(loginFor(bundle.app.id, email), password);
      onSignedIn();
    } catch {
      error = "Correo o contraseña incorrectos.";
      busy = false;
    }
  }
</script>

<div class="login-member flex items-center justify-center" {...paletteAttrs(bundle.app.theme)}>
  <div class="login-member-card">
    <div class="login-member-head">
      <AppIcon app={bundle.app} size={38} class="login-member-appicon" />
      <div>
        <h1 class="login-member-title">{bundle.app.name}</h1>
        <p class="login-member-hint">Identificate para continuar.</p>
      </div>
    </div>

    <form
      id="published-form-login"
      onsubmit={submit}
      class="published-form-login login-member-form card card-solid"
    >
      <Field label="Correo">
        <Input type="email" autocomplete="username" bind:value={email} required />
      </Field>
      <Field label="Contraseña">
        <Input type="password" autocomplete="current-password" bind:value={password} required />
      </Field>
      <ErrorNote message={error} />
      <Button type="submit" variant="secondary" loading={busy} class="login-member-submit"
        >Entrar</Button
      >
    </form>
  </div>
</div>

<style>
  .login-member {
    min-height: 100%;
    padding: 3rem 1rem;
    background: var(--bg-level1);

    & .login-member-card {
      width: 100%;
      max-width: 24rem;
    }

    & .login-member-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-12);
      margin-bottom: var(--sp-28);
      text-align: center;

      & :global(.login-member-appicon) {
        width: 2.75rem;
        height: 2.75rem;
        border-radius: var(--radius-md);
      }

      & .login-member-title {
        font-size: var(--text-lg);
        line-height: var(--text-lg--line-height);
        font-weight: 600;
        color: var(--text-primary);
      }

      & .login-member-hint {
        margin-top: var(--sp-4);
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        color: var(--text-secondary);
      }
    }

    /* La caja es `.card` del catalogo; `card-solid` porque en oscuro la del
       catalogo es translucida y esta se posa sola sobre el lienzo. Aqui solo
       el reparto de dentro: la card no trae acolchado propio, lo ponen su
       cabecera y su cuerpo, y este formulario no tiene ninguno de los dos. */
    & .login-member-form {
      display: grid;
      gap: var(--sp-16);
      padding: var(--sp-20);
      box-shadow: var(--shadow-sm);

      & :global(.login-member-submit) {
        width: 100%;
      }
    }
  }
</style>
