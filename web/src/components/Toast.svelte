<!--
  Los avisos del panel.

  Antes cada aviso se dibujaba donde estaba escrito: dentro de un panel, de un
  modal o de una columna estrecha. Empujaba el contenido al aparecer y, si el
  sitio tenia desplazamiento, se quedaba fuera de la vista justo cuando habia
  algo que leer. Ahora todos van a una sola capa, arriba a la derecha de la
  ventana, montada al final del documento: nadie los recorta y siempre se ven.

  El aviso esta mientras haya algo que decir; si el mensaje cambia, vuelve a
  asomar. Se va solo pasados unos segundos, o cuando quien lo pide lo quita.
-->
<script lang="ts" module>
  export type ToastKind = "error" | "warning" | "success" | "info";

  /**
   * Lo que se ve por cada tipo: el tono de la alerta del sistema y su icono.
   *
   * Los cuatro son los del catalogo, los mismos que ensena `/demo`: un icono
   * distinto por tono y siempre el mismo para el mismo tono, aqui y en los
   * avisos en linea de cualquier pantalla.
   */
  const KINDS: Record<ToastKind, { className: string; icon: string }> = {
    error: { className: "danger", icon: "cancel-circle" },
    warning: { className: "warn", icon: "alert-02" },
    success: { className: "ok", icon: "checkmark-circle-02" },
    info: { className: "info", icon: "information-circle" },
  };

  /** Lo que tarda en irse solo. */
  const LIFE = 14000;

  const CONTAINER_ID = "toast-layer";

  /**
   * La capa es una sola y se crea al vuelo la primera vez que hace falta, asi
   * ningun sitio tiene que acordarse de montarla.
   *
   * Cuelga de `body` y se queda ahi. Que salga por encima de un modal es cosa
   * del CSS y de nadie mas: los avisos son el peldano 40 y los modales el 20.
   * Ver la escala en `styles/global.css`.
   */
  export function toastLayer(): HTMLElement {
    const found = document.getElementById(CONTAINER_ID);
    if (found) return found;
    const el = document.createElement("div");
    el.id = CONTAINER_ID;
    el.className = "toast-layer";
    document.body.appendChild(el);
    return el;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { portal } from "../lib/portal";
  import Icon from "./Icon.svelte";

  let {
    kind = "error",
    duration = LIFE,
    key = "",
    children,
  }: {
    kind?: ToastKind;
    /** Cero o menos: se queda hasta que quien lo pide lo quite. */
    duration?: number;
    /** Cuando cambia, el aviso vuelve a asomar y el reloj arranca de cero. */
    key?: string;
    children: Snippet;
  } = $props();

  // Se cierra a mano o por tiempo; vuelve a abrirse cuando cambia el mensaje.
  let closed = $state(false);
  // Con el puntero encima el aviso se queda: se esta leyendo o copiando.
  let hover = $state(false);
  // Y tambien mientras haya texto suyo seleccionado: soltar el raton fuera del
  // aviso es lo normal al arrastrar para seleccionar, y ahi el reloj no puede
  // volver a correr con la seleccion todavia hecha.
  let picking = $state(false);
  let card = $state<HTMLDivElement | null>(null);

  // Arranca vacio a proposito: leer `key` aqui capturaria solo su primer valor.
  let previous = "";
  $effect(() => {
    if (previous !== key) {
      previous = key;
      closed = false;
    }
  });

  $effect(() => {
    const onSelect = () => {
      const sel = document.getSelection();
      if (!card || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        picking = false;
        return;
      }
      picking = card.contains(sel.getRangeAt(0).commonAncestorContainer);
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  });

  // La cuenta atras se detiene mientras el puntero descansa sobre el aviso y
  // vuelve a arrancar de cero al salir: nadie termina de copiar un texto que se
  // esconde a mitad.
  $effect(() => {
    if (closed || hover || picking || duration <= 0) return;
    // Leido para que el reloj se reinicie con cada mensaje nuevo.
    void key;
    const timer = window.setTimeout(() => {
      closed = true;
    }, duration);
    return () => window.clearTimeout(timer);
  });

  const look = $derived(KINDS[kind]);
</script>

{#if !closed}
  <!-- El puntero encima no activa nada, solo detiene la cuenta atras; la equis es lo unico interactivo. -->
  <div
    use:portal={toastLayer()}
    bind:this={card}
    role={kind === "success" ? "status" : "alert"}
    onmouseenter={() => (hover = true)}
    onmouseleave={() => (hover = false)}
    class="notice-toast toast-item alert w-full {look.className}"
  >
    <!-- Sin medida: `.alert i` la pone, y asi el icono acompana al texto. -->
    <Icon name={look.icon} class="icon-notice-toast" />
    <!--
      `select-text` y `cursor-text`: el texto del aviso se copia arrastrando,
      como cualquier otro texto. Es lo unico que hay que hacer con el --el
      nombre de una columna, el numero de una fila-- y transcribirlo a mano es
      justo lo que no puede pasar.
    -->
    <div class="notice-toast-body">
      {@render children()}
    </div>
    <button
      type="button"
      aria-label="Cerrar aviso"
      class="btn btn-ghost sm btn-close-toast"
      onclick={() => (closed = true)}
    >
      <Icon name="cancel-01" size={12} />
    </button>
  </div>
{/if}

<style>
  /*
   * La capa de los avisos. Se crea al vuelo en `toastLayer()` y cuelga de
   * `body`, asi que se estiliza con `:global`. Arriba a la derecha, por encima
   * de los modales (peldano 40 de la escala de capas).
   */
  :global(.toast-layer) {
    position: fixed;
    inset: 0.75rem 0.75rem auto auto;
    left: 0.75rem;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--sp-8);
    pointer-events: none;

    @media (min-width: 40rem) {
      left: auto;
      right: 1rem;
      top: 1rem;
    }
  }

  .notice-toast {
    max-width: 24rem;
    padding: var(--sp-8) var(--sp-12);
    /* Mas grande que el `.alert` del catalogo (--text-xs) a proposito: este se
       lee de reojo y desde lejos, en la esquina y sobre lo que se este
       haciendo. */
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
    box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 0.18);
    pointer-events: auto;

    /* El alto del primer renglon del mensaje. Es la medida contra la que se
       centran el icono y la equis, y sale de la letra del aviso: si manana
       cambia el tamano, la alineacion se recalcula sola. */
    --renglon: calc(var(--text-base) * var(--text-base--line-height));

    & .notice-toast-body {
      min-width: 0;
      flex: 1;
      cursor: text;
      user-select: text;
    }

    /* El icono se centra en el PRIMER RENGLON, no en la caja entera: con dos
       lineas se queda arriba, junto a la primera, que es donde lo busca la
       vista. `.alert` lo deja arriba del todo y le da un empujon de un pixel,
       medido para su letra --text-xs--; aqui el texto es --text-base y con el
       renglon de 1.5 el icono quedaba tres pixeles alto. Dandole de alto el
       renglon entero se centra solo, sin numero que ajustar a mano. */
    & :global(.icon-notice-toast) {
      height: var(--renglon);
      align-items: center;
      margin-top: 0;
    }

    /* La equis, por lo mismo: cuadrada y del alto del renglon, asi su centro
       cae en el de la primera linea. Antes eran 1.25rem subidos dos pixeles,
       y se quedaba cuatro por encima del texto. */
    & .btn-close-toast {
      margin-right: -0.25rem;
      height: var(--renglon);
      min-height: 0;
      width: var(--renglon);
      flex-shrink: 0;
      padding: 0;
    }
  }
</style>
