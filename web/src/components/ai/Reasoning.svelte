<!--
  Lo que penso el modelo, plegado por defecto. La misma linea que se veia viva
  mientras trabajaba se queda aqui, ya quieta, en el principio del
  razonamiento. El que quiera lo despliega entero.
-->
<script lang="ts" module>
  /** La primera linea de un texto: por donde empieza el razonamiento. */
  export const firstLine = (text: string): string => {
    const cut = text.indexOf("\n");
    return cut === -1 ? text : text.slice(0, cut);
  };
</script>

<script lang="ts">
  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";
  import Markdown from "../Markdown.svelte";

  let { text }: { text: string } = $props();

  let open = $state(false);
</script>

<div class="reasoning-ai inset">
  <button
    type="button"
    onclick={() => (open = !open)}
    class="btn-toggle-reasoning flex w-full items-center gap-1"
  >
    <Icon name="chevron-down" size={12} class={cx("chevron", open && "chevron-open")} />
    <span class="reasoning-toggle-label shrink-0">
      {open ? "Ocultar razonamiento" : "Razonamiento"}
    </span>
    {#if !open}
      <span class="reasoning-first flex-1 text-left">{firstLine(text)}</span>
    {/if}
  </button>

  <!-- El pliegue lo hace la rejilla: de 0fr a 1fr la altura crece sola. -->
  <div
    class="reasoning-collapse grid"
    style="grid-template-rows: {open
      ? '1fr'
      : '0fr'}; transition: grid-template-rows 300ms cubic-bezier(0.22, 1, 0.36, 1);"
  >
    <div class="reasoning-collapse-inner">
      <div class="reasoning-ai-content">
        <Markdown {text} />
      </div>
    </div>
  </div>
</div>

<style>
  /* La caja es `.inset` del catalogo --lo que se pliega dentro de un turno
     se hunde, no se levanta--; aqui solo el hueco que la separa del turno. */
  .reasoning-ai {
    margin-top: var(--sp-8);
  }

  .btn-toggle-reasoning {
    cursor: pointer;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    font-weight: 500;
    color: var(--text-muted);
    transition: color 150ms;

    &:hover {
      color: var(--text-secondary);
    }
  }

  .reasoning-first {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 400;
    opacity: 0.7;
  }

  /* El cheuron va dentro del Icon (un componente): hay que salir del ambito. */
  :global(.chevron) {
    flex-shrink: 0;
    transition: transform 150ms;

    &:global(.chevron-open) {
      transform: rotate(180deg);
    }
  }

  .reasoning-collapse {
    overflow: hidden;
  }

  .reasoning-collapse-inner {
    min-height: 0;
    overflow: hidden;
  }

  .reasoning-ai-content {
    margin-top: var(--sp-6);
    margin-left: var(--sp-4);
    border-color: color-mix(in oklab, var(--accent) 30%, transparent);
    border-left: 2px solid;
    padding-left: var(--sp-10);
    color: var(--text-secondary);
  }
</style>
