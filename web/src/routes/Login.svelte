<script lang="ts">
  import planeIcon from "../assets/plane-icon.svg";
  import ThemePicker from "../components/ThemePicker.svelte";
  import Button from "../components/ui/Button.svelte";
  import ErrorNote from "../components/ui/ErrorNote.svelte";
  import Field from "../components/ui/Field.svelte";
  import Input from "../components/ui/Input.svelte";
  import { errorMessage } from "../lib/pb";
  import { navigate } from "../lib/router.svelte";
  import { session } from "../lib/session.svelte";

  let email = $state("");
  let password = $state("");
  let error = $state("");
  let busy = $state(false);

  $effect(() => {
    if (session.ready && session.me) navigate("/", { replace: true });
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = "";
    try {
      await session.signIn(email.trim(), password);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<div id="login-page" class="page-login flex items-center justify-center">
  <div class="login-theme-picker">
    <ThemePicker />
  </div>

  <div class="login-card-wrap w-full">
    <div class="login-head flex flex-col items-center gap-3">
      <img src={planeIcon} alt="Planer" class="brand-logo" />
      <div class="login-title-block text-center">
        <h1 class="login-title">Entrar a Planer</h1>
        <p class="login-subtitle">Crea aplicaciones, bases de datos, personas y roles.</p>
      </div>
    </div>

    <form id="login-form" onsubmit={submit} class="form-login card card-solid">
      <Field label="Correo">
        <Input
          type="email"
          autocomplete="username"
          bind:value={email}
          placeholder="admin@planer.local"
          required
        />
      </Field>
      <Field label="Contraseña">
        <Input type="password" autocomplete="current-password" bind:value={password} required />
      </Field>
      <ErrorNote message={error} />
      <div class="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          loading={busy}
          buttonClass="btn-sign-in"
          class="login-submit"
        >
          Entrar
        </Button>
      </div>
    </form>
  </div>
</div>

<style>
  .page-login {
    min-height: 100%;
    padding: 3rem 1rem;
  }

  .login-theme-picker {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }

  .login-card-wrap {
    max-width: 24rem;
  }

  .login-head {
    margin-bottom: var(--sp-28);
  }

  .brand-logo {
    width: 5rem;
    height: 5rem;
  }

  .login-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .login-subtitle {
    margin-top: var(--sp-4);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  /* La caja es `.card` del catalogo; `card-solid` porque en oscuro la del
     catalogo es translucida y esta se posa sola sobre el lienzo. Aqui solo
     el acolchado, que la card lo reparte entre cabecera, cuerpo y pie y
     este formulario no tiene ninguno de los tres. */
  .form-login {
    padding: var(--sp-20);
    box-shadow: var(--shadow-sm);

    /* Los campos y el boton son componentes: su raiz no es de aqui. */
    & > :global(* + *) {
      margin-top: var(--sp-16);
    }
  }
</style>
