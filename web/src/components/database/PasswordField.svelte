<!--
  La clave con la que entrara una persona que todavia no existe.

  No es una columna --la clave no se guarda, no se exporta y no se puede volver
  a leer, ver `PasswordForm.svelte`-- pero se escribe aqui, en el cajon que crea
  la fila, porque es el unico momento en que se puede elegir sin tener que
  volver despues a cambiarsela.

  Vacio vale: el servidor inventa una, pero esa no la ve nadie --se crea dentro
  y no se devuelve a la pantalla-- asi que esa persona entra cuando alguien le
  ponga una desde "Cambiar la clave", en su fila. Generarla aqui es lo mismo un
  paso antes, con la misma funcion que usa el servidor, pero delante: se lee y
  se copia antes de crear a nadie, y entonces la persona ya puede entrar.

  Se ve mientras se escribe, sin puntos: no es la clave de quien esta delante
  --es la de otra persona, y hay que poder copiarla y dictarla-- asi que
  taparla solo serviria para equivocarse al teclearla.
-->
<script lang="ts">
  import { MIN_PASSWORD, newPassword } from "@shared/people";

  import Icon from "../Icon.svelte";
  import Button from "../ui/Button.svelte";
  import Input from "../ui/Input.svelte";

  let { value = $bindable("") }: { value?: string } = $props();

  let copied = $state(false);

  const short = $derived(value.trim().length > 0 && value.trim().length < MIN_PASSWORD);

  async function copy() {
    await navigator.clipboard.writeText(value.trim());
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<div class="field-password flex flex-col">
  <!--
    Con la misma pinta que la etiqueta de una columna a proposito: en el cajon
    se llena de arriba abajo y este es un renglon mas de los que hay que
    rellenar, aunque por dentro no vaya a la tabla.
  -->
  <span class="label-password-field">
    <Icon name="key-round" size={13} class="icon-password-field" />
    Clave
  </span>

  <div class="row-password-field">
    <Input
      bind:value
      placeholder="Déjalo vacío y se inventa una"
      aria-label="Clave con la que entrará esta persona"
      class="input-password-field"
    />
    <Button
      class="btn-password-field"
      tip="Inventa una clave y la deja escrita aquí"
      onclick={() => {
        value = newPassword();
        copied = false;
      }}
    >
      <Icon name="dices" size={14} /> Generar
    </Button>
    <!--
      Solo con algo escrito: copiar el hueco vacio no copia nada y deja creyendo
      que si.
    -->
    {#if value.trim()}
      <Button
        class="btn-password-field"
        tip={copied ? "Copiada" : "Copiar la clave"}
        onclick={() => void copy()}
      >
        <Icon name={copied ? "check" : "copy-01"} size={14} />
        <span class="sr-only">{copied ? "Copiada" : "Copiar la clave"}</span>
      </Button>
    {/if}
  </div>

  <!--
    Vacia tiene consecuencia y se dice aqui: la que inventa el servidor no
    vuelve a la pantalla, asi que esa persona no entra hasta que alguien le
    ponga una. Es el unico sitio donde se puede avisar a tiempo.
  -->
  <p class="hint-password-field" class:hint-password-field-short={short}>
    {short
      ? `La clave necesita ${MIN_PASSWORD} caracteres o más.`
      : value.trim()
        ? "Cópiala antes de guardar: después no se vuelve a poder leer."
        : "Si la dejas vacía, no podrá entrar hasta que le des una desde su fila."}
  </p>
</div>

<style>
  .field-password {
    /* Las medidas son las de `DrawerField`, que es lo que tiene encima. */
    & .label-password-field {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
      margin-bottom: var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      font-weight: 500;
      color: var(--text-secondary);

      & :global(.icon-password-field) {
        color: var(--text-muted);
      }
    }

    & .row-password-field {
      display: flex;
      gap: var(--sp-8);

      & :global(.input-password-field) {
        min-width: 0;
        flex: 1;
        /* Una clave inventada se lee letra a letra para dictarla. */
        font-family: var(--font-mono);
      }

      & :global(.btn-password-field) {
        flex-shrink: 0;
      }
    }

    & .hint-password-field {
      margin-top: var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);

      /* Corta pero escrita: no es un fallo del guardado todavia, es lo que
         falta para poder guardar. */
      &.hint-password-field-short {
        color: var(--warning);
      }
    }
  }
</style>
