/**
 * Que celdas de la grilla estan elegidas ahora mismo.
 *
 * Solo coordenadas: fila y columna por su sitio en lo que se esta viendo, nunca
 * el id de la fila ni el nombre de la columna. La grilla se repagina, se ordena
 * y se filtra, y una seleccion que guardara ids tendria que sobrevivir a todo
 * eso; lo que se hace en su lugar es soltarla cuando las filas cambian, que es
 * lo que hace cualquier hoja de calculo al reordenar.
 *
 * La pareja que define el rango es `anchor` (donde empezo) y `active` (donde
 * esta el cursor). El rectangulo sale de las dos, y por eso extender con
 * mayusculas no necesita recordar nada mas: mueve `active` y el rango se
 * recalcula.
 */

/** Una celda por su sitio: fila y columna de lo que se ve. */
export interface CellRef {
  row: number;
  col: number;
}

/** El rectangulo elegido, con los dos extremos ya ordenados. */
export interface CellRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** Por que lados de una celda pasa el contorno del rango. */
export interface CellEdges {
  top: boolean;
  left: boolean;
  right: boolean;
  bottom: boolean;
}

/** Cuantas filas y columnas hay ahora en la grilla. */
export interface GridLimits {
  rows: number;
  cols: number;
}

export interface GridSelection {
  /** Donde esta el cursor. Nada: no hay seleccion. */
  readonly active: CellRef | null;
  readonly range: CellRange | null;
  /** Se esta arrastrando el raton con el boton apretado. */
  readonly dragging: boolean;
  /** Cuantas celdas cubre el rango. */
  readonly size: number;
  has(row: number, col: number): boolean;
  edges(row: number, col: number): CellEdges;
  /** Pone el cursor en una celda. Con `extend`, mueve el extremo y conserva el inicio. */
  focus(cell: CellRef, extend?: boolean): void;
  beginDrag(cell: CellRef): void;
  /** Lleva el extremo del rango hasta esta celda, si se esta arrastrando. */
  dragTo(cell: CellRef): void;
  endDrag(): void;
  /** Mueve el cursor. `extend` estira el rango en vez de empezar otro. */
  move(dRow: number, dCol: number, extend: boolean): void;
  /** Lleva el cursor al borde: fila o columna, principio o final. */
  edge(where: "row-start" | "row-end" | "col-start" | "col-end", extend: boolean): void;
  all(): void;
  clear(): void;
}

export function createSelection(limits: () => GridLimits): GridSelection {
  let active = $state<CellRef | null>(null);
  let anchor = $state<CellRef | null>(null);
  let dragging = $state(false);

  const range = $derived.by<CellRange | null>(() => {
    if (!active || !anchor) return null;
    return {
      top: Math.min(anchor.row, active.row),
      left: Math.min(anchor.col, active.col),
      bottom: Math.max(anchor.row, active.row),
      right: Math.max(anchor.col, active.col),
    };
  });

  /** Deja la celda dentro de la grilla: fuera de ella no hay a donde ir. */
  function clamp(cell: CellRef): CellRef {
    const { rows, cols } = limits();
    return {
      row: Math.max(0, Math.min(rows - 1, cell.row)),
      col: Math.max(0, Math.min(cols - 1, cell.col)),
    };
  }

  function inside(row: number, col: number): boolean {
    const r = range;
    return !!r && row >= r.top && row <= r.bottom && col >= r.left && col <= r.right;
  }

  /** Pone el cursor donde se dice; extender conserva el inicio del rango. */
  function focus(cell: CellRef, extend = false): void {
    const next = clamp(cell);
    active = next;
    if (!extend || !anchor) anchor = next;
  }

  function move(dRow: number, dCol: number, extend: boolean): void {
    const from = active;
    if (!from) {
      focus({ row: 0, col: 0 });
      return;
    }
    focus({ row: from.row + dRow, col: from.col + dCol }, extend);
  }

  function edge(where: "row-start" | "row-end" | "col-start" | "col-end", extend: boolean): void {
    const from = active;
    if (!from) return;
    const { rows, cols } = limits();
    const target: CellRef =
      where === "row-start"
        ? { row: from.row, col: 0 }
        : where === "row-end"
          ? { row: from.row, col: cols - 1 }
          : where === "col-start"
            ? { row: 0, col: from.col }
            : { row: rows - 1, col: from.col };
    focus(target, extend);
  }

  return {
    get active() {
      return active;
    },
    get range() {
      return range;
    },
    get dragging() {
      return dragging;
    },
    get size() {
      const r = range;
      return r ? (r.bottom - r.top + 1) * (r.right - r.left + 1) : 0;
    },
    has: inside,
    edges(row, col) {
      if (!inside(row, col)) return { top: false, left: false, right: false, bottom: false };
      const r = range as CellRange;
      return {
        top: row === r.top,
        left: col === r.left,
        right: col === r.right,
        bottom: row === r.bottom,
      };
    },
    focus,
    beginDrag(cell) {
      const next = clamp(cell);
      active = next;
      anchor = next;
      dragging = true;
    },
    dragTo(cell) {
      if (!dragging) return;
      active = clamp(cell);
    },
    endDrag() {
      dragging = false;
    },
    move,
    edge,
    all() {
      const { rows, cols } = limits();
      if (rows === 0 || cols === 0) return;
      anchor = { row: 0, col: 0 };
      active = { row: rows - 1, col: cols - 1 };
    },
    clear() {
      active = null;
      anchor = null;
      dragging = false;
    },
  };
}
