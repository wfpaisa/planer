<!--
  El encabezado de una columna de la grilla.

  Todo lo que se le puede hacer a una columna se pide desde su propio titulo
  --ordenar, esconderla, cambiarla-- y no solo desde los menus de la barra: es
  donde se esta mirando cuando se quiere. La flecha del orden vive en el titulo
  de la columna ordenada, asi que se ve por que estan las filas asi.
-->
<script lang="ts" module>
  export interface Sort {
    field: string;
    dir: "asc" | "desc";
  }

  /** Lo mas angosta que puede quedar una columna al arrastrarla. */
  const MIN_WIDTH = 72;
</script>

<script lang="ts">
  import { ROLE_ICON } from "@shared/people";
  import type { FieldDef } from "@shared/types";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";
  import { Dropdown, MenuItem, MenuSeparator } from "../ui";
  import FieldIcon from "./FieldIcon.svelte";

  let {
    field,
    sort,
    onSort,
    onEdit,
    onHide,
    onRoles,
    width,
    onResize,
  }: {
    field: FieldDef;
    sort: Sort | null;
    onSort: (next: Sort | null) => void;
    /** Ancho elegido para esta columna, o nada para el que salga solo. */
    width?: number;
    /**
     * Se esta arrastrando el borde. `done` distingue lo que se ve mientras se
     * arrastra de lo que hay que guardar al soltar: guardar en cada pixel serian
     * cien peticiones por un tiron de raton.
     */
    onResize?: (width: number, done: boolean) => void;
    /** Las columnas fijas no se cambian: solo se ordenan, se muestran o se esconden. */
    onEdit?: () => void;
    onHide: () => void;
    /**
     * Abre la gestion de roles. Solo lo trae la columna de roles: sus opciones
     * no se editan como las de un desplegable normal, se nombran ahi.
     */
    onRoles?: () => void;
  } = $props();

  const sorted = $derived(sort?.field === field.name ? sort.dir : null);

  let head = $state<HTMLTableCellElement | null>(null);

  /**
   * Arrastrar el borde derecho del titulo.
   *
   * Los escuchas van en la ventana y no en el tirador: al arrastrar deprisa el
   * raton se sale del tirador --son seis pixeles-- y con ellos colgados de el
   * la columna se quedaba a medio camino.
   */
  function startResize(e: MouseEvent) {
    if (e.button !== 0 || !head || !onResize) return;
    // No es un clic en el titulo: ni ordena, ni abre el menu.
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = head.getBoundingClientRect().width;
    const at = (ev: MouseEvent) =>
      Math.max(MIN_WIDTH, Math.round(startWidth + ev.clientX - startX));

    const move = (ev: MouseEvent) => onResize(at(ev), false);
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.classList.remove("is-resizing-column");
      onResize(at(ev), true);
    };

    // Mientras se arrastra, el cursor es el mismo pase por donde pase y no se
    // selecciona texto de la tabla por el camino.
    document.body.classList.add("is-resizing-column");
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  /** El teclado tambien mueve el borde, de diez en diez pixeles. */
  function resizeKeys(e: KeyboardEvent) {
    if (!head || !onResize) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const now = head.getBoundingClientRect().width;
    onResize(Math.max(MIN_WIDTH, Math.round(now + (e.key === "ArrowRight" ? 10 : -10))), true);
  }
</script>

<th
  bind:this={head}
  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
  style={width ? `width:${width}px;min-width:${width}px;max-width:${width}px` : undefined}
  class="column-head text-left"
>
  <!--
    Sin relleno: quien manda dentro es el boton, que ocupa la celda entera
    --igual que en las filas-- para que pinchar en cualquier punto del titulo
    abra su menu.
  -->
  <Dropdown class="menu-column-head" wrapClass="wrap-column-head" align="right">
    {#snippet trigger({ open, toggle })}
      <button
        type="button"
        onclick={toggle}
        class={cx(
          "btn-column-menu",
          "column-head-btn",
          sorted || open ? "column-head-active" : "column-head-quiet",
        )}
      >
        <FieldIcon
          type={field.type}
          system={field.system}
          class={cx(
            "column-head-icon",
            onEdit ? "column-head-icon-editable" : "column-head-icon-fixed",
          )}
        />
        <span class="column-head-label">{field.label}</span>
        <!--
          Que la columna no pueda estar vacia se dice pegado al titulo, que es
          donde iba el asterisco que este icono sustituye: se lee con el nombre
          de la columna, como una parte suya.
        -->
        {#if field.required === true}
          <span
            class="column-head-mark column-head-mark-required"
            data-tip="Obligatoria: una fila sin este dato no entra"
          >
            <Icon name="square-asterisk" size={13} />
            <span class="sr-only">Obligatoria</span>
          </span>
        {/if}
        {#if sorted === "asc"}
          <Icon name="arrow-up-az" class="column-head-sort-asc" size={42} />
        {:else if sorted === "desc"}
          <Icon name="arrow-down-az" class="column-head-sort-desc" size={16} />
        {/if}

        <!--
          Que no se repita se dice al otro lado, junto al menu: no es una
          propiedad del nombre sino de la tabla entera --es lo que hace que la
          columna sirva de llave-- y ahi se repasa de un vistazo por toda la
          cabecera, en la misma vertical fila tras fila de titulos de distinto
          largo. El icono es el mismo que el del encabezado de la
          previsualizacion al importar, para que sean la misma cosa en los dos
          sitios.
        -->
        {#if field.unique === true}
          <span
            class="column-head-mark column-head-mark-unique"
            data-tip="No se repite: dos filas no pueden tener el mismo valor"
          >
            <Icon name="fingerprint-pattern" size={13} />
            <span class="sr-only">No se repite</span>
          </span>
        {/if}

        <Icon name="ellipsis-vertical" class={cx("column-menu")} size={16} />
      </button>
    {/snippet}

    {#snippet children(close)}
      <MenuItem
        onclick={() => {
          onSort({ field: field.name, dir: "asc" });
          close();
        }}
      >
        {#snippet icon()}<Icon name="arrow-up-az" size={14} />{/snippet}
        Ordenar de menor a mayor
      </MenuItem>
      <MenuItem
        onclick={() => {
          onSort({ field: field.name, dir: "desc" });
          close();
        }}
      >
        {#snippet icon()}<Icon name="arrow-down-az" size={14} />{/snippet}
        Ordenar de mayor a menor
      </MenuItem>
      {#if sorted}
        <MenuItem
          onclick={() => {
            onSort(null);
            close();
          }}
        >
          {#snippet icon()}<Icon name="cancel-01" size={14} />{/snippet}
          Quitar orden
        </MenuItem>
      {/if}
      <MenuSeparator />
      {#if onRoles}
        <MenuItem
          onclick={() => {
            close();
            onRoles();
          }}
        >
          {#snippet icon()}<Icon name={ROLE_ICON} size={14} />{/snippet}
          Gestionar roles
        </MenuItem>
      {/if}
      {#if onEdit}
        <MenuItem
          onclick={() => {
            close();
            onEdit();
          }}
        >
          {#snippet icon()}<Icon name="edit-03" size={14} />{/snippet}
          Editar columna
        </MenuItem>
      {/if}
      <MenuItem
        onclick={() => {
          close();
          onHide();
        }}
      >
        {#snippet icon()}<Icon name="eye-off" size={14} />{/snippet}
        Esconder la columna
      </MenuItem>
    {/snippet}
  </Dropdown>

  {#if onResize}
    <!--
      El tirador del ancho. Es un boton de verdad y no un adorno: se le puede
      llegar con el tabulador y moverlo con las flechas, que es la unica forma
      de cambiar un ancho sin raton.
    -->
    <button
      type="button"
      class="handle-column-resize"
      aria-label={`Ancho de la columna ${field.label}`}
      onmousedown={startResize}
      onkeydown={resizeKeys}
      ondblclick={() => onResize?.(0, true)}
    ></button>
  {/if}
</th>

<style>
  .column-head {
    position: relative;
    min-width: 11rem;
    padding: 0;
    font-weight: 500;
    border-right: var(--border-width) solid var(--border);
    background-color: color-mix(in srgb, var(--bg-level1) 97%, var(--text-primary));

    /*
      Pegado al borde derecho y un poco por fuera: el borde es de un pixel y
      acertarle pediria puntería. Se ve al pasar por el encabezado.
    */
    & .handle-column-resize {
      position: absolute;
      top: 0;
      right: -3px;
      z-index: 1;
      height: 100%;
      width: 6px;
      cursor: col-resize;
      background: transparent;

      &:hover,
      &:focus-visible {
        background: var(--accent);
      }
    }

    & .column-head-btn {
      display: flex;
      height: 2.25rem;
      width: 100%;
      align-items: center;
      gap: var(--sp-6);
      padding: 0 var(--sp-12);
      cursor: pointer;
      transition:
        background-color 150ms,
        color 150ms;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary) !important;
      }

      &.column-head-active {
        color: var(--text-primary);
      }

      &.column-head-quiet {
        color: var(--text-secondary);
      }

      /* El icono del tipo de la columna va dentro de FieldIcon (un componente). */
      & :global(.column-head-icon) {
        flex-shrink: 0;
      }

      & :global(.column-head-icon-editable) {
        color: var(--text-muted);
      }

      & :global(.column-head-icon-fixed) {
        color: var(--text-muted);
      }

      & .column-head-mark {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        color: var(--text-muted);

        /* El mismo rojo con el que se pintaba el asterisco al que sustituye. */
        &.column-head-mark-required {
          color: var(--danger);
        }

        /*
          La de unica toma el hueco que sobra y el menu se le pega detras: asi
          se queda en el borde derecho de toda la cabecera en vez de bailar
          detras de titulos de distinto largo.
        */
        &.column-head-mark-unique {
          margin-left: auto;
          color: var(--warning);
        }
      }

      & .column-head-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Las flechas de orden van dentro de Icon (un componente). */
      & :global(.column-head-sort-asc),
      & :global(.column-head-sort-desc) {
        flex-shrink: 0;
        color: var(--accent-soft-text);
      }

      & :global(.column-menu) {
        margin-left: auto;
        flex-shrink: 0;
        color: var(--text-muted);
        transition: opacity 150ms;
      }

      /* Con la marca de unica el hueco ya lo tomo ella: dos margenes
         automaticos se repartirian lo que sobra y la dejarian a media
         cabecera. */
      &:has(.column-head-mark-unique) :global(.column-menu) {
        margin-left: 0;
      }
    }
  }

  /* El contenedor y el menu del desplegable viven dentro de Dropdown. */
  .column-head :global(.wrap-column-head) {
    width: 100%;
  }

  .column-head :global(.menu-column-head) {
    width: 15rem;
  }
</style>
