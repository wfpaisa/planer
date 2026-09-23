<script lang="ts">
  import type { Snippet } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import type { TransitionConfig } from "svelte/transition";

  import { cx } from "../../lib/cx";
  import { portal } from "../../lib/portal";
  import Icon from "../Icon.svelte";

  let {
    id,
    open,
    onClose,
    title,
    icon,
    description,
    width = "modal-panel-width-default",
    height,
    fill = false,
    class: className,
    children,
    footer,
  }: {
    id?: string;
    open: boolean;
    onClose: () => void;
    title: string;
    /** Icono de la fuente, al lado del título, para lo que tiene marca propia. */
    icon?: string;
    description?: string;
    width?: string;
    /** Alto explicito; si no se da y `fill` esta activo se usa el alto por defecto. */
    height?: string;
    /** Ocupa la pantalla y pide que el cuerpo no crezca mas de lo que cabe. */
    fill?: boolean;
    /** Clase semantica que identifica al modal en la UI. */
    class?: string;
    children?: Snippet;
    footer?: Snippet;
  } = $props();

  let panel = $state<HTMLDivElement | null>(null);

  /*
   * Escape cierra, y el foco entra al panel. Los dos los traia gratis el
   * `<dialog>` nativo, y aun asi salia caro: `showModal()` vuelve inerte todo
   * el documento salvo el propio diálogo, y la inercia no la levanta ningún
   * CSS. La capa de avisos quedaba fuera --se veia, pero arrastrar sobre el
   * texto de un aviso pulsaba el velo y cerraba el modal--.
   */
  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Salvo que ya se lo haya llevado quien esta dentro: `IconPicker`, por
  // ejemplo, lo pone en su buscador.
  $effect(() => {
    if (!open || !panel) return;
    if (!panel.contains(document.activeElement)) panel.focus();
  });

  /*
   * La entrada y la salida son las del `.modal` del catalogo --ver
   * `styles/components.css`--, pero escritas aqui: aquel es un `popover` y las
   * suyas las lleva el CSS con `@starting-style`; este es un `<div>` que
   * `{#if open}` monta y desmonta, y sin transicion de Svelte el nodo se va
   * antes de que le de tiempo a irse. Los dos tienen que moverse igual: son el
   * mismo modal para quien lo mira, uno en el panel y otro en lo publicado.
   *
   * Svelte muestrea `css(t)` con `t` lineal, asi que el perfil lo pone esta
   * bezier y no una funcion de `svelte/easing`. Es lo que deja escribir por
   * separado el tiempo de cada propiedad --la opacidad acaba antes que el
   * movimiento-- igual que hacen las dos `transition` del catalogo.
   *
   * Las cuatro van con `|global` en el marcado. De fabrica una transicion es
   * local: solo corre si el bloque donde esta escrita es el que se crea o se
   * destruye. Y la mitad de los modales del panel --los ajustes de la
   * aplicacion, sin ir mas lejos-- no mueven este `open`, que les llega como
   * literal: es un `{#if}` de mas arriba el que monta el `<Modal>` entero, y
   * con la transicion local el bloque de aqui dentro nace ya puesto y no se
   * animaba nada.
   */
  const bezier = (x1: number, y1: number, x2: number, y2: number) => {
    const eje = (a: number, b: number, t: number) =>
      3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
    return (x: number) => {
      let lo = 0;
      let hi = 1;
      // Biseccion; doce pasos dejan el error muy por debajo de un pixel.
      for (let i = 0; i < 12; i++) {
        const medio = (lo + hi) / 2;
        if (eje(x1, x2, medio) < x) lo = medio;
        else hi = medio;
      }
      return eje(y1, y2, (lo + hi) / 2);
    };
  };

  /** `cubic-bezier(0.16, 1, 0.3, 1)`: frena casi del todo antes de llegar. */
  const posar = bezier(0.16, 1, 0.3, 1);
  /** El `ease-out` y el `ease-in` de CSS, que en JavaScript no tienen nombre. */
  const asomar = bezier(0, 0, 0.58, 1);
  const acelerar = bezier(0.42, 0, 1, 1);

  const ENTRA = 300;
  const SALE = 150;
  /** La opacidad de la tarjeta acaba antes que su movimiento. */
  const OPACA = 180;
  const VELO_ENTRA = 220;
  /** De que tamano crece la tarjeta, y cuantos rem sube. */
  const CHICA = 0.97;
  const ABAJO = 0.625;

  /*
   * El resto del panel apaga el movimiento con `@media (prefers-reduced-motion)`;
   * aqui no hay CSS que apagar --lo dibuja Svelte-- y la misma preferencia se
   * lee desde JavaScript.
   */
  const quieto = $derived(prefersReducedMotion.current);

  /*
   * El `_nodo` no se usa, pero el directivo llama a estas funciones con el
   * elemento delante: sin declararlo, TypeScript cuenta un argumento de mas.
   */
  const tarjeta = (p: number, opacidad: number) =>
    `opacity: ${opacidad}; scale: ${CHICA + (1 - CHICA) * p}; translate: 0 ${ABAJO * (1 - p)}rem;`;

  const entraTarjeta = (_nodo: Element): TransitionConfig => ({
    duration: quieto ? 0 : ENTRA,
    css: (t: number) => tarjeta(posar(t), asomar(Math.min(t / (OPACA / ENTRA), 1))),
  });

  const saleTarjeta = (_nodo: Element): TransitionConfig => ({
    duration: quieto ? 0 : SALE,
    // `t` baja de 1 a 0, asi que lo que se curva es `1 - t`: el tiempo corrido.
    css: (t: number) => {
      const p = 1 - acelerar(1 - t);
      return tarjeta(p, p);
    },
  });

  const entraVelo = (_nodo: Element): TransitionConfig => ({
    duration: quieto ? 0 : VELO_ENTRA,
    css: (t: number) => `opacity: ${asomar(t)}`,
  });

  const saleVelo = (_nodo: Element): TransitionConfig => ({
    duration: quieto ? 0 : SALE,
    css: (t: number) => `opacity: ${1 - acelerar(1 - t)}`,
  });
</script>

{#if open}
  <!--
    Al final del documento y no donde este escrito: un modal abierto desde
    dentro de la cuadricula --que se aisla, ver `routes/DatabaseEditor.svelte`--
    quedaria encerrado en su capa. El velo y el centrado los pone este
    contenedor (la casa, en el <style> de abajo); la tarjeta, `plane-card`;
    la cabeza, el cuerpo y el pie, `modal-*` de `components.css`. Lo único
    que cambia respecto de antes es el peldano, porque el suyo es 999. Ver la
    escala en `styles/global.css`.
  -->
  <div use:portal {id} role="dialog" aria-modal="true" aria-label={title} class="dialog-modal">
    <!-- Cerrar tocando el fondo; va antes para que la tarjeta pinte encima. -->
    <button
      type="button"
      aria-label="Cerrar"
      onclick={onClose}
      class="btn-close-modal-backdrop plane-backdrop cursor-default"
      in:entraVelo|global
      out:saleVelo|global
    ></button>
    <div
      bind:this={panel}
      tabindex="-1"
      in:entraTarjeta|global
      out:saleTarjeta|global
      class={cx(
        "modal-panel plane-card flex flex-col",
        width,
        height,
        !height && fill && "modal-panel-fill",
        className,
      )}
    >
      <div class="modal-head">
        <div class="modal-head-copy flex-1">
          <h2 class={icon ? "modal-head-title" : undefined}>
            {#if icon}<Icon name={icon} />{/if}
            {title}
          </h2>
          {#if description}
            <p>{description}</p>
          {/if}
        </div>
        <button
          type="button"
          class="btn-close-modal btn-icon sm btn-rounded"
          onclick={onClose}
          aria-label="Cerrar"
        >
          <Icon name="cancel-01" size={15} />
        </button>
      </div>
      {#if children}
        <!--
          `min-h-0` libera la altura del body dentro del flex column para que
          `overflow-y-auto` pueda activarse cuando el contenido supera la altura
          del modal.
        -->
        <div class="modal-body flex-1">
          {@render children()}
        </div>
      {/if}
      {#if footer}
        <div class="modal-foot">{@render footer()}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Solo cuando hay icono: el título pasa a renglon con el al lado. */
  .modal-head-title {
    display: flex;
    align-items: center;
    gap: var(--sp-8);
  }

  .dialog-modal {
    /* Modales: ve la escala de capas en `styles/global.css`. */
    z-index: 20;
    position: fixed;
    inset: 0;
    display: grid;
    /*
     * Una sola columna, atada al ancho de la pantalla y con minimo cero.
     * Sin la pista explicita la columna es `auto`, que no baja del minimo de
     * su contenido: una tabla ancha dentro del modal --veinte columnas en la
     * previsualizacion de una importacion-- estiraba la pista, y con ella la
     * tarjeta, muy por encima de la ventana. El `minmax(0, 1fr)` deja que lo
     * de dentro se encoja y que el desbordamiento caiga donde tiene que caer:
     * en el contenedor que se desplaza.
     */
    grid-template-columns: minmax(0, 1fr);
    place-items: center;
    padding: var(--sp-16);
  }

  .modal-panel {
    /*
     * Encima del velo a la fuerza: el velo es `position: fixed` y lo pintado
     * fijo va por delante de lo estatico, asi que sin capa propia se comeria
     * todos los clics de la tarjeta.
     */
    position: relative;
    z-index: 1;
    /*
     * `max-height: calc(100dvh - 2rem)` acota la altura al alto de la ventana
     * menos 1rem arriba y 1rem abajo: la tarjeta queda centrada por la rejilla
     * del modal y, cuando el contenido crece, se detiene antes de pegarse a
     * los bordes en vez de desbordar.
     */
    max-height: calc(100dvh - 2rem);
    overflow: visible;
    padding: 0;
  }

  .modal-panel-width-default {
    max-width: 32rem;
  }

  /* Para formularios con rejilla o campos en dos niveles: con el ancho corto
     el contenido no cabe y el cuerpo se desplaza en horizontal. */
  .modal-panel-width-lg {
    max-width: 44rem;
  }

  .modal-panel-fill {
    height: calc(100dvh - 5rem);
  }

  .modal-head-copy {
    min-width: 0;
  }
</style>
