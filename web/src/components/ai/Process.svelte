<!--
  El proceso de un turno: una sola fila que cambia de estado.

  Mientras la IA trabaja, la fila enseña lo ultimo que lleva pensado y se
  desplaza sola para seguir el final del texto: se ve avanzar sin desplegar
  nada y sin ocupar sitio. Al cerrar el turno con respuesta, esa misma fila se
  queda quieta en el principio del razonamiento, con la cuenta de pasos, y lo
  que hay debajo se pliega.

  Es una sola fila y no dos componentes a propósito: lo que se veia vivo y lo
  que queda guardado son la misma cosa en dos momentos, y partirlo en dos hacia
  que el turno diera un salto al terminar.

  Un turno que termino sin respuesta --porque fallo o porque se detuvo-- no
  pliega nada: lo que se alcanzo a hacer es justo lo que hay que leer.
-->
<script lang="ts">
  import type { AiStep } from "@shared/types";

  import {
    elapsedLabel,
    hasProgress,
    latestLine,
    type Progress,
    type TimelineItem,
    timelineOf,
  } from "../../lib/aiProgress";
  import { cx } from "../../lib/cx";
  import { frameThrottle } from "../../lib/frameThrottle";
  import Icon from "../Icon.svelte";
  import Markdown from "../Markdown.svelte";
  import { Spinner } from "../ui";
  import DebugContext from "./DebugContext.svelte";

  let {
    progress,
    since,
    reasoning = "",
    steps,
    folded = true,
    open,
    onToggle,
  }: {
    /** Lo que la petición lleva producido, si todavía esta en marcha. */
    progress?: Progress;
    /** Desde cuando trabaja, para el reloj. */
    since?: number;
    /** Lo que penso, cuando el turno ya cerro. */
    reasoning?: string;
    /** Lo que hizo, cuando el turno ya cerro. */
    steps?: AiStep[];
    /**
     * Esta fila se pliega, que es lo normal: empieza cerrada y se abre a mano.
     *
     * Falso solo para un turno que termino sin respuesta --fallo, o se
     * detuvo--: ahi lo que se alcanzo a hacer es justo lo que hay que leer, asi
     * que se queda abierto y no se cierra.
     */
    folded?: boolean;
    /** Si esta desplegado. Lo guarda quien dibuja el turno, no esta fila. */
    open: boolean;
    onToggle: () => void;
  } = $props();

  /** Esta trabajando ahora mismo. */
  const working = $derived(!!progress);

  let line = $state<HTMLSpanElement | null>(null);
  let elapsed = $state(0);

  const timeline = $derived<TimelineItem[]>(
    progress
      ? timelineOf(progress)
      : (steps ?? []).map((step, i) => ({ id: i, kind: "step" as const, step })),
  );

  /** Cuantos pasos dio: es lo que dice la fila cuando el turno ya cerro. */
  const count = $derived(progress ? progress.steps.length : (steps?.length ?? 0));

  /* Lo que piensa manda; si su servidor no lo suelta, sirve lo que escribe. */
  const live = $derived(progress ? progress.reasoning || progress.text : "");

  /** Hay algo que desplegar. */
  const something = $derived(
    progress ? hasProgress(progress) : !!reasoning || (steps?.length ?? 0) > 0,
  );

  /**
   * Lo que se lee en la fila plegada.
   *
   * Trabajando, lo ultimo que lleva pensado, que es lo que se ve avanzar. Ya
   * cerrado, el principio del razonamiento: la misma línea, quieta.
   */
  const summary = $derived(
    working ? latestLine(live) || "Generando" : firstLine(reasoning) || rotulo(count),
  );

  /** La primera línea de un texto: por donde empieza el razonamiento. */
  function firstLine(text: string): string {
    const cut = text.indexOf("\n");
    return cut === -1 ? text : text.slice(0, cut);
  }

  /** Cuantos pasos dio, dicho como se lee en la fila plegada. */
  function rotulo(n: number): string {
    if (n === 0) return "Sin pasos";
    return n === 1 ? "Dio 1 paso" : `Dio ${n} pasos`;
  }

  // Un pulso por segundo basta: es un reloj de pared, no una barra de avance.
  $effect(() => {
    if (!working) return;
    const from = since ?? Date.now();
    elapsed = Date.now() - from;
    const id = setInterval(() => (elapsed = Date.now() - from), 1000);
    return () => clearInterval(id);
  });

  // La línea sigue el final del texto, al mismo ritmo que los redibujados.
  const follow = frameThrottle(() => {
    if (line) line.scrollLeft = line.scrollWidth - line.clientWidth;
  });

  $effect(() => {
    if (working && summary) follow();
  });

  // Un frame pedido dejaria corriendo trabajo sobre lo que ya no esta.
  $effect(() => () => follow.cancel());

  /** Desplegado de verdad: un turno que no pliega nada se queda abierto. */
  const shown = $derived(open || !folded);

  /**
   * Se puede plegar y desplegar.
   *
   * Un turno que no pliega nada no es un control a medias: no lleva cheuron y
   * no responde al clic, porque no hay nada que cerrar. Sin esto, pulsarlo
   * giraba la flecha y no pasaba nada.
   */
  const toggles = $derived(something && folded);
</script>

<div class={cx("process-ai inset plain", !folded && "process-open")}>
  <!--
    Trabajando, la fila se anuncia a quien usa un lector de pantalla: "esta
    trabajando" es informacion, no decoracion, y sin esto la única senal de que
    algo pasa era visual.
  -->
  <button
    type="button"
    disabled={!toggles}
    onclick={onToggle}
    aria-expanded={shown}
    class:is-open={shown}
    class:is-working={working}
    class="btn-toggle-process flex w-full items-center gap-2 text-left"
  >
    {#if working}
      <Spinner />
      <span class="process-elapsed shrink-0">{elapsedLabel(elapsed)}</span>
    {:else}
      <Icon name="ai-magic" size={13} class="process-mark" />
      <span class="process-elapsed shrink-0">{rotulo(count)}</span>
    {/if}

    <span bind:this={line} class="process-line flex-1">{summary}</span>

    {#if toggles}
      <Icon name="chevron-down" size={14} class={cx("chevron", shown && "chevron-open")} />
    {/if}
  </button>

  {#if working}
    <p class="sr-only" role="status" aria-live="polite">
      La inteligencia artificial está trabajando en esta página.
    </p>
  {/if}

  <!-- El pliegue lo hace la rejilla: de 0fr a 1fr la altura crece sola. -->
  {#if something}
    <div
      class="process-collapse grid"
      style="grid-template-rows: {shown
        ? '1fr'
        : '0fr'}; transition: grid-template-rows 300ms cubic-bezier(0.22, 1, 0.36, 1);"
    >
      <div class="process-collapse-inner">
        <div class="timeline-ai flex flex-col gap-2">
          {#each timeline as item (`${item.kind}${item.id}`)}
            {#if item.kind === "thought"}
              <div class="timeline-thought"><Markdown text={item.text} /></div>
            {:else}
              <p class="timeline-step">· {item.step.summary}</p>
            {/if}
          {/each}

          <!-- Lo que la ronda en marcha lleva pensado, todavía sin cerrar. -->
          {#if progress?.reasoning}
            <div class="timeline-thought"><Markdown text={progress.reasoning} /></div>
          {/if}
          {#if progress?.text}
            <p class="timeline-text">{progress.text}</p>
          {/if}
          {#if progress?.context}
            <DebugContext text={progress.context} />
          {/if}

          <!-- Ya cerrado, lo que penso va entero, encima de lo que hizo. -->
          {#if !progress && reasoning}
            <div class="timeline-thought"><Markdown text={reasoning} /></div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* La caja es `.inset.plain` del catálogo --el cerco sin fondo: lo que hay
     dentro es una línea que se desplaza sola y un fondo pleno la emborronaba--;
     aqui solo el acolchado, que lo ponen las dos filas.

     Sin recorte a propósito: recortando, esta caja seria el contenedor de
     desplazamiento de la cabecera y entonces no se pegaria a nada. No hace
     falta --nada de dentro pinta fondo-- y el pliegue se recorta por su cuenta.
     Se aisla para ordenar sus dos filas sin competir con la escala de capas de
     fuera: dentro del peldano, la cabecera va delante de la línea de tiempo. */
  .process-ai {
    isolation: isolate;
    padding: 0;
  }

  /* Desplegada, la línea de tiempo es mas alta que la columna: la cabecera se
     queda arriba mientras lo desplegado pasa por debajo, para que bajar a leer
     no se lleve por delante la única forma de cerrarla.

     Lleva el fondo de la columna --el mismo que se ve detras, asi que en reposo
     no cambia nada-- porque pegada tiene que tapar lo que pasa por detras.

     Plegada tiene alto fijo y se aisla del resto: lo que llega mientras la IA
     escribe --una línea de razonamiento mas larga que la anterior-- no puede
     mover lo que hay debajo. Ver `design.md` D8. */
  .btn-toggle-process {
    position: sticky;
    /* Pegada al borde de verdad de la columna. El navegador cuenta el acolchado
       del contenedor dentro del rectangulo donde se pega, asi que con `0` se
       quedaba una rendija arriba y se veia pasar el texto por encima. La medida
       la declara la columna --`components/AiPanel.svelte`--; sin ella, cero. */
    top: calc(var(--chat-pad-top, 0px) * -1);
    z-index: 1;
    contain: size layout;
    cursor: pointer;
    /* Redondeada por su cuenta, y no por la caja: la caja no recorta --si
       recortara, seria el contenedor de desplazamiento de esta fila y no se
       pegaria a nada-- asi que un fondo con esquinas rectas tapaba las suyas.
       Un pelo menos de radio, que es el grosor del cerco que la rodea. */
    border-radius: calc(var(--radius-md) - var(--border-width));
    background: var(--bg-level2);
    padding: var(--sp-10) var(--sp-12);
    height: 2.25rem;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-subtle);
    transition: color 150ms;

    &:disabled {
      cursor: default;
    }

    &:hover:not(:disabled) {
      color: var(--text-secondary);
    }

    /* Trabajando se lee mas: es lo que esta pasando ahora. */
    &.is-working {
      color: var(--text-secondary);
    }

    /* Abierta, abajo ya no hay esquina que redondear --sigue la línea de
       tiempo-- y la raya que las separa viaja con ella y no con lo que se
       desplaza: pegada arriba, sigue separando. */
    &.is-open {
      border-bottom: var(--border-width) solid var(--border);
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  .process-elapsed {
    color: var(--text-subtle);
    font-variant-numeric: tabular-nums;
  }

  /* La línea que se desplaza sola; su barra no se enseña. */
  .process-line {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    scrollbar-width: none;
  }

  .process-collapse {
    overflow: hidden;
  }

  .process-collapse-inner {
    min-height: 0;
    overflow: hidden;
  }

  /* El cheuron y la marca van dentro de `Icon`: hay que salir del ambito. */
  :global(.chevron) {
    flex-shrink: 0;
    transition: transform 150ms;

    &:global(.chevron-open) {
      transform: rotate(180deg);
    }
  }

  .btn-toggle-process :global(.process-mark) {
    flex-shrink: 0;
  }

  .timeline-ai {
    padding: var(--sp-8) var(--sp-12);
  }

  .timeline-thought {
    color: var(--text-primary);
  }

  .timeline-step {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-subtle);
  }

  .timeline-text {
    max-height: 10rem;
    overflow-y: auto;
    white-space: pre-wrap;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }
</style>
