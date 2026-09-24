<!-- Una clave recien hecha: se ve una vez, se copia y se cierra. -->
<script lang="ts">
  import Icon from "../Icon.svelte";
  import Button from "../ui/Button.svelte";

  let { title, password, onDone }: { title: string; password: string; onDone: () => void } =
    $props();

  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<div role="status" class="notice-password alert info flex-col">
  <div class="row-password-notice">
    <p class="title-password-notice">{title}</p>
    <Button
      size="sm"
      tip="Ya la copié"
      aria-label="Cerrar: ya copié la clave"
      buttonClass="btn-close-password-notice"
      class="btn-icon btn-ghost"
      onclick={onDone}
    >
      <Icon name="cancel-01" size={13} />
    </Button>
  </div>
  <div class="row-password-notice">
    <code class="code-password-notice">
      {password}
    </code>
    <Button size="sm" class="btn-password-notice" onclick={() => void copy()}>
      <Icon name={copied ? "check" : "copy-01"} size={13} />
      {copied ? "Copiada" : "Copiar"}
    </Button>
  </div>
  <p class="hint-password-notice">No volverá a mostrarse. Compártela por un canal seguro.</p>
</div>

<style>
  /* La caja es `.alert.info` del catálogo --el mismo azul y el mismo borde
     que el resto de avisos--; aqui solo el apilado, porque este lleva tres
     renglones en vez de un icono y un texto. */
  .notice-password {
    gap: var(--sp-6);

    & .row-password-notice {
      display: flex;
      align-items: center;
      gap: var(--sp-8);

      & .title-password-notice {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: inherit;
      }

      & .code-password-notice {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: var(--sp-6) var(--sp-8);
        border-radius: var(--radius-sm);
        background: var(--bg-level2);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-primary);
      }

      & :global(.btn-password-notice) {
        flex-shrink: 0;
      }
    }

    & .hint-password-notice {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);
    }
  }
</style>
