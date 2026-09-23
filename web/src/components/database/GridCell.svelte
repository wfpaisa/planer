<!--
  Una celda de la cuadricula: lo que se lee, lo que esta elegido y, cuando toca,
  lo que se escribe.

  El contorno del rango no se dibuja celda a celda con cuatro bordes sueltos:
  cada celda sabe por que lados suyos pasa el borde del rectangulo (`edges`) y
  pinta solo esos. Asi el rango se ve como una figura y no como una rejilla de
  cuadros, y no hace falta ningún elemento flotante por encima que haya que
  volver a medir con cada desplazamiento.
-->
<script lang="ts" module>
  /** Columnas donde la tecla que abrio la celda ya es lo primero escrito. */
  const SEEDABLE = ["text", "longtext", "number", "email", "url"];

  /** Campos que el navegador abre con su propio calendario o reloj. */
  const PICKER_TYPES = ["date", "datetime-local", "time", "month", "week"];

  /**
   * Abre el desplegable del control, si tiene uno propio.
   *
   * Una celda se pulsa para elegir, no para mirar un control cerrado: sin esto,
   * abrir una columna de opciones pedia un clic mas sobre el select, y una de
   * fecha otro sobre el icono del calendario.
   */
  function openPicker(control: HTMLElement) {
    const picker = control as { showPicker?: () => void };
    if (typeof picker.showPicker !== "function") return;
    const isPicker =
      control instanceof HTMLSelectElement ||
      (control instanceof HTMLInputElement && PICKER_TYPES.includes(control.type));
    if (!isPicker) return;
    // El navegador puede negarse si no lo ve como gesto de quien mira; que no
    // se abra solo es una comodidad de menos, no un fallo que contar.
    try {
      picker.showPicker();
    } catch {
      /* se queda cerrado */
    }
  }
</script>

<script lang="ts">
  import { type FieldDef, isRelationField, type TableRecord } from "@shared/types";
  import { untrack } from "svelte";

  import { type Row } from "../../lib/cellValues";
  import { cx } from "../../lib/cx";
  import type { CellEdges } from "../../lib/gridSelection.svelte";
  import { pb } from "../../lib/pb";
  import { CellInput, CellView } from "./cells";

  let {
    field,
    row,
    tables,
    selected,
    active,
    edges,
    marked,
    editing,
    seed,
    width,
    editable,
    reason,
    saving,
    onDown,
    onOver,
    onEdit,
    onCommit,
    onCancel,
  }: {
    field: FieldDef;
    row: Row;
    tables: TableRecord[];
    /** La celda esta dentro del rango elegido. */
    selected: boolean;
    /** Es la celda donde esta el cursor. */
    active: boolean;
    edges: CellEdges;
    /** La fila entera esta marcada con su casilla. */
    marked: boolean;
    editing: boolean;
    /** La tecla con la que se abrio la edicion, si se abrio tecleando. */
    seed?: string;
    /** Ancho elegido para la columna, o nada para el que salga solo. */
    width?: number;
    editable: boolean;
    /** Por que no se escribe, cuando no se escribe. Sale en el globo. */
    reason?: string;
    /** Se esta guardando lo que se escribio en esta celda. */
    saving: boolean;
    onDown: (e: MouseEvent) => void;
    onOver: () => void;
    onEdit: () => void;
    onCommit: (value: unknown) => void;
    onCancel: () => void;
  } = $props();

  /**
   * Lo que se lleva escrito, sin guardar todavía.
   *
   * Una relación empieza sin valor a propósito: lo que se escribe en ella es la
   * llave, y la llave de una fila ya guardada vive en el registro enlazado, no
   * en la celda. `KeyPicker` la saca de la fila cuando no le llega nada.
   */
  let draft = $state<unknown>(null);

  /**
   * La celda, para poder traerla a la vista.
   *
   * Moverse con las flechas hasta el final de la página dejaba el cursor fuera
   * de lo que se ve: la cuadricula se desplaza sola, pero solo por lo que el
   * ratón hace, y el teclado no mueve ningún foco que el navegador siga.
   */
  let box = $state<HTMLTableCellElement | null>(null);

  $effect(() => {
    if (!active || !box) return;
    // `nearest`: si ya se ve, no se mueve nada; solo se desplaza lo justo.
    box.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  /**
   * El control que se acaba de abrir, para llevarle el foco.
   *
   * Se busca en el nodo en vez de pedirselo a cada tipo de control: `autofocus`
   * es un atributo que el navegador solo atiende al cargar el documento, y una
   * celda se abre mucho después. Sin esto, la celda se veia abierta pero las
   * teclas seguian llegando a la cuadricula.
   */
  let editBox = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!editing || !editBox) return;
    const control = editBox.querySelector<HTMLElement>("input, select, textarea");
    /*
     * Sin control que enfocar --una lista de opciones multiples son botones--
     * el foco se lo queda la caja: si no, se queda en la cuadricula y Escape
     * llega a su teclado, que lo lee como "suelta el rango" en vez de cerrar.
     */
    (control ?? editBox).focus();
    if (control) openPicker(control);
    // Lo que ya había se reemplaza al escribir, como en cualquier hoja de
    // calculo; lo que se abrio tecleando se continua, no se selecciona.
    if (!seed && control instanceof HTMLInputElement && control.type !== "checkbox") {
      control.select();
    }
  });

  /*
   * Pulsar fuera del control guarda lo escrito, en vez de perderlo.
   *
   * Los campos de texto ya lo hacian por su cuenta --pierden el foco y eso los
   * cierra-- pero los que no son un campo no pierden ningún foco: en una
   * columna de opciones multiples se marcaban tres roles, se pulsaba fuera y no
   * quedaba ninguno.
   *
   * Escucha en la fase de captura porque la celda de destino también atiende el
   * mismo `mousedown`, y cierra la edicion antes de que este llegue a correr.
   */
  $effect(() => {
    if (!editing) return;
    const outside = (e: MouseEvent) => {
      if (editBox && !editBox.contains(e.target as Node)) onCommit(draft);
    };
    window.addEventListener("mousedown", outside, true);
    return () => window.removeEventListener("mousedown", outside, true);
  });

  /*
   * Al abrirse la edicion, el borrador arranca en lo que la fila tiene --o en
   * la tecla que la abrio, que es lo que se acaba de escribir sobre ella--. Se
   * lee sin depender de la fila (`untrack`) porque la fila se vuelve a leer al
   * guardar, y eso reiniciaria lo que se este escribiendo.
   *
   * La tecla no siembra cualquier columna: en una fecha, una casilla o una
   * lista de opciones no es un valor, y el control lo rechazaria dejando la
   * celda en blanco. Ahi abre la edicion y se descarta.
   */
  $effect(() => {
    if (!editing) return;
    untrack(() => {
      if (isRelationField(field)) {
        draft = seed ?? undefined;
        return;
      }
      if (seed && SEEDABLE.includes(field.type)) {
        const asNumber = Number(seed);
        draft = field.type === "number" ? (Number.isNaN(asNumber) ? null : asNumber) : seed;
        return;
      }
      draft = row[field.name];
    });
  });
</script>

<td
  bind:this={box}
  class={cx(
    "cell-grid-db",
    "grid-db-data-cell",
    marked ? "grid-db-data-cell-marked" : "grid-db-data-cell-idle",
    selected && "cell-grid-db-selected",
    active && "cell-grid-db-active",
    editing && "cell-grid-db-editing",
    saving && "cell-grid-db-saving",
    edges.top && "cell-grid-db-edge-top",
    edges.left && "cell-grid-db-edge-left",
    edges.right && "cell-grid-db-edge-right",
    edges.bottom && "cell-grid-db-edge-bottom",
  )}
  data-editable={editable ? "" : undefined}
  data-tip={editable ? undefined : reason || undefined}
  onmousedown={onDown}
  onmouseenter={onOver}
  ondblclick={() => editable && onEdit()}
>
  {#if editing}
    <!--
      Las teclas del control no son de la cuadricula: Enter y Escape ya cierran
      la celda, y dejandolas subir llegaban también al teclado de la grilla, que
      leia el Escape como "suelta el rango" y dejaba sin cursor la celda que se
      acababa de cerrar.
    -->
    <div
      bind:this={editBox}
      class="cell-grid-db-edit"
      tabindex="-1"
      onmousedown={(e) => {
        /*
         * El ratón dentro del control no es un clic en la celda. Sin cortarlo
         * aqui subia al `<td>`, que devuelve el foco a la cuadricula, y poner
         * el cursor entre dos palabras cerraba la edicion en marcha.
         */
        e.stopPropagation();
      }}
      ondblclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        e.stopPropagation();
        // Las teclas de cierre, para los controles que no las traen: los campos
        // de texto las manejan ellos, una lista de opciones no.
        if (e.key === "Escape") onCancel();
        else if (e.key === "Enter" && e.target === editBox) onCommit(draft);
      }}
      role="presentation"
    >
      <CellInput
        {field}
        value={draft}
        {row}
        {tables}
        client={pb}
        autofocus
        onChange={(v) => (draft = v)}
        onDone={() => onCommit(draft)}
        {onCancel}
      />
    </div>
  {:else}
    <div
      class="cell-grid-db-read"
      style={width ? `width:${width}px;max-width:${width}px` : undefined}
    >
      <CellView {field} {row} />
    </div>
  {/if}
</td>

<style>
  .cell-grid-db {
    position: relative;
    height: 2.25rem;
    padding: 0;
    cursor: cell;
    user-select: none;
    vertical-align: middle;

    /* La que no se escribe no promete que se escriba: se elige y se copia, pero
       el cursor es el de siempre y el globo dice donde se cambia. */
    &:not([data-editable]) {
      cursor: default;
    }

    /*
      El lavado de la fila marcada y el de pasar por encima se repiten aqui: los
      declara `DataGrid` para sus dos columnas fijas y su CSS no alcanza al
      marcado de este componente.
    */
    &.grid-db-data-cell-marked {
      background: color-mix(in oklab, var(--text-primary) 4%, transparent);
    }

    :global(tr:hover) > &.grid-db-data-cell-idle {
      background: var(--bg-hover);
    }

    & .cell-grid-db-read {
      display: flex;
      height: 2.25rem;
      align-items: center;
      padding: 0 var(--sp-12);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /*
      El control de edicion se sale de la celda a propósito: una celda angosta
      no puede encoger lo que se escribe. Va por encima de las de al lado y de
      la fila fijada de la izquierda.
    */
    & .cell-grid-db-edit {
      position: absolute;
      inset: -1px auto auto -1px;
      z-index: 40;
      min-width: calc(100% + 2px);
      max-width: 22rem;
      background: var(--bg-level2);
      border: var(--border-width) solid var(--accent);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
    }

    /*
      El contorno se dibuja con sombras y no con bordes: un borde empujaria la
      celda un pixel y toda la fila bailaria al moverse el rango.

      Y con una sola declaracion de cuatro sombras, no una regla por
      combinacion de lados: `box-shadow` no se suma entre reglas --la ultima
      reemplaza a las de antes-- asi que una celda con borde a izquierda y
      derecha y sin borde arriba ni abajo, que es cada celda intermedia de una
      columna elegida entera, se quedaba solo con el lado que ganara por orden.
      Cada lado enciende su variable y la sombra apagada mide cero, que no
      pinta nada.
    */
    &.cell-grid-db-selected {
      background: var(--accent-soft);

      /*
        Las divisiones de dentro del rango se siguen viendo --sin ellas el
        bloque elegido es una mancha y no se sabe cuantas celdas lleva-- pero en
        el color del propio rango: la línea gris de la rejilla de fuera lo
        cortaba en trozos que no son suyos.
      */
      border-left-color: color-mix(in oklab, var(--accent) 30%, transparent);
      border-bottom-color: color-mix(in oklab, var(--accent) 30%, transparent);
      box-shadow:
        inset 0 var(--cell-edge-top, 0) 0 0 var(--accent),
        inset var(--cell-edge-left, 0) 0 0 0 var(--accent),
        inset calc(-1 * var(--cell-edge-right, 0)) 0 0 0 var(--accent),
        inset 0 calc(-1 * var(--cell-edge-bottom, 0)) 0 0 var(--accent);
    }

    &.cell-grid-db-edge-top {
      --cell-edge-top: 1px;
    }

    &.cell-grid-db-edge-left {
      --cell-edge-left: 1px;
    }

    &.cell-grid-db-edge-right {
      --cell-edge-right: 1px;
    }

    &.cell-grid-db-edge-bottom {
      --cell-edge-bottom: 1px;
    }

    /*
      Pasar por una fila del rango no la saca de el: el lavado de siempre
      borraba el color de lo elegido y la fila parecia deseleccionarse al
      acercar el ratón. Es el mismo color, un poco mas encendido. El cursor se
      queda fuera: ya tiene el suyo, que es el mas marcado de los tres.
    */
    :global(tr:hover) > &.cell-grid-db-selected:not(.cell-grid-db-active) {
      background: color-mix(in oklab, var(--accent) 15%, var(--accent-soft));
    }

    /* El cursor va mas marcado que el resto del rango. */
    &.cell-grid-db-active {
      background: var(--bg-level2);
      box-shadow: inset 0 0 0 2px var(--accent);
    }

    &.cell-grid-db-saving .cell-grid-db-read {
      opacity: 0.5;
    }
  }
</style>
