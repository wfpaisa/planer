<script lang="ts">
  import type { Snippet } from "svelte";

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
    ></button>
    <div
      bind:this={panel}
      tabindex="-1"
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
