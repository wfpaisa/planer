<!--
  La IA esta trabajando.

  En una sola linea se ve lo ultimo que lleva pensado, y esa linea se desplaza
  sola para seguir el final del texto: se ve avanzar sin desplegar nada y sin
  ocupar sitio.

  El despliegue empieza cerrado a proposito: lo que va escribiendo es codigo
  HTML, y para la mayoria de peticiones eso es ruido. Quien quiera mirar, abre;
  y una vez abierto se queda abierto mientras dure la peticion.
-->
<script lang="ts">
  import {
    elapsedLabel,
    hasProgress,
    latestLine,
    type Progress,
    timelineOf,
  } from "../../lib/aiProgress";
  import { cx } from "../../lib/cx";
  import { frameThrottle } from "../../lib/frameThrottle";
  import Icon from "../Icon.svelte";
  import Markdown from "../Markdown.svelte";
  import { Spinner } from "../ui";
  import DebugContext from "./DebugContext.svelte";

  let { progress, since }: { progress: Progress; since: number } = $props();

  let open = $state(false);
  let line = $state<HTMLSpanElement | null>(null);
  let elapsed = $state(0);

  const something = $derived(hasProgress(progress));
  const timeline = $derived(timelineOf(progress));
  /* Lo que piensa manda; si su servidor no lo suelta, sirve lo que escribe. */
  const summary = $derived(latestLine(progress.reasoning || progress.text));

  // Un pulso por segundo basta: es un reloj de pared, no una barra de avance.
  $effect(() => {
    const from = since;
    elapsed = Date.now() - from;
    const id = setInterval(() => (elapsed = Date.now() - from), 1000);
    return () => clearInterval(id);
  });

  // La linea sigue el final del texto, al mismo ritmo que los redibujados.
  const follow = frameThrottle(() => {
    if (line) line.scrollLeft = line.scrollWidth - line.clientWidth;
  });

  $effect(() => {
    if (summary) follow();
  });

  // Un frame pedido dejaria corriendo trabajo sobre lo que ya no esta.
  $effect(() => () => follow.cancel());
</script>

<div class="working-ai inset plain">
  <button
    type="button"
    disabled={!something}
    onclick={() => (open = !open)}
    class="btn-toggle-working-timeline flex w-full items-center gap-2 text-left"
  >
    <Spinner />
    <span class="working-elapsed shrink-0">{elapsedLabel(elapsed)}</span>
    <span bind:this={line} class="working-line flex-1">
      {summary || "Generando"}
    </span>
    {#if something}
      <span class="working-toggle shrink-0">{open ? "Ocultar" : "Ver que hace"}</span>
      <Icon name="chevron-down" size={14} class={cx("chevron", open && "chevron-open")} />
    {/if}
  </button>

  <!-- El pliegue lo hace la rejilla: de 0fr a 1fr la altura crece sola. -->
  {#if something}
    <div
      class="working-collapse grid"
      style="grid-template-rows: {open
        ? '1fr'
        : '0fr'}; transition: grid-template-rows 300ms cubic-bezier(0.22, 1, 0.36, 1);"
    >
      <div class="working-collapse-inner">
        <div class="timeline-ai flex flex-col gap-2">
          {#each timeline as item (`${item.kind}${item.id}`)}
            {#if item.kind === "thought"}
              <div class="timeline-thought"><Markdown text={item.text} /></div>
            {:else}
              <p class="timeline-step">· {item.step.summary}</p>
            {/if}
          {/each}

          <!-- Lo que la ronda en marcha lleva pensado, todavia sin cerrar. -->
          {#if progress.reasoning}
            <Markdown text={progress.reasoning} />
          {/if}
          {#if progress.text}
            <p class="timeline-text">
              {progress.text}
            </p>
          {/if}
          {#if progress.context}
            <DebugContext text={progress.context} />
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* La caja es `.inset.plain` del catalogo --el cerco sin fondo: lo que hay
     dentro es una linea que se desplaza sola y un fondo pleno la emborronaba--;
     aqui solo el recorte y el acolchado, que lo ponen las dos filas. */
  .working-ai {
    overflow: hidden;
    padding: 0;
  }

  .btn-toggle-working-timeline {
    cursor: pointer;
    padding: var(--sp-10) var(--sp-12);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-secondary);

    &:disabled {
      cursor: default;
    }
  }

  .working-elapsed {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* La linea que se desplaza sola; su barra no se ensena. */
  .working-line {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    scrollbar-width: none;
  }

  .working-toggle {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  .working-collapse {
    overflow: hidden;
  }

  .working-collapse-inner {
    min-height: 0;
    overflow: hidden;
  }

  /* El cheuron va dentro del Icon (un componente): hay que salir del ambito. */
  :global(.chevron) {
    flex-shrink: 0;
    transition: transform 150ms;

    &:global(.chevron-open) {
      transform: rotate(180deg);
    }
  }

  .timeline-ai {
    border-top: var(--border-width) solid var(--border);
    padding: var(--sp-8) var(--sp-12);
  }

  .timeline-thought {
    color: var(--text-secondary);
  }

  .timeline-step {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  .timeline-text {
    max-height: 10rem;
    overflow-y: auto;
    white-space: pre-wrap;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-secondary);
  }
</style>
