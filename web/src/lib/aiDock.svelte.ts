/**
 * El estado de la columna de la IA, guardado por aplicacion en este navegador.
 *
 * Vive arriba --en el constructor-- porque el boton que la trae esta en la
 * barra superior y la columna se dibuja en la escena de la pagina. Escondido y
 * ancho son independientes: traerla de vuelta la devuelve con el ancho que
 * tenia.
 */

/** Lo que necesita el campo de texto para no ser inservible. */
const MIN = 300;
/** Tope duro: mas ancho que esto la conversacion no gana nada. */
const MAX = 720;
/** Y nunca mas de esta parte de la ventana, para no comerse el documento. */
const MAX_SHARE = 0.45;
/** El de partida: cabe una peticion y deja el documento respirando. */
const DEFAULT = 380;
/**
 * Por debajo de este ancho de ventana el dock dejaria al documento sin sitio,
 * asi que no se dibuja --ni el, ni su boton.
 */
const NARROW = 900;

const widthKey = (appId: string) => `plane_ai_dock_w_${appId}`;
const openKey = (appId: string) => `plane_ai_dock_${appId}`;

/**
 * El ancho, sujeto entre el minimo util y lo que la ventana permite. Va en
 * pixeles enteros: el puntero llega con fracciones y no hay nada que ganar
 * guardando media docena de decimales en el navegador.
 */
export function clampDock(width: number): number {
  const top = Math.min(MAX, Math.round(window.innerWidth * MAX_SHARE));
  return Math.round(Math.max(MIN, Math.min(width, Math.max(MIN, top))));
}

export interface AiDockState {
  /** Si la columna se esta dibujando ahora mismo. */
  readonly open: boolean;
  /** Traerla o esconderla. */
  toggle: () => void;
  /** Traerla, este como este. Para quien la necesita abierta, no alternada. */
  show: () => void;
  /**
   * Traerla con el cursor ya puesto en el campo de texto.
   *
   * Es lo que quiere quien pulsa "hablar con la IA" desde el documento: abrir
   * la columna y ademas tener que ir a buscar donde se escribe son dos gestos
   * para una sola intencion.
   */
  askFocus: () => void;
  /**
   * Cuantas veces se ha pedido el cursor. El numero no dice nada por si mismo,
   * solo que hubo una peticion nueva: el panel lo mira para llevarlo alli.
   */
  readonly focusAsks: number;
  readonly width: number;
  /** Confirmar un ancho nuevo. Se recuerda por aplicacion. */
  setWidth: (width: number) => void;
  /** La ventana no da para la columna: no hay dock, y tampoco boton. */
  readonly tooNarrow: boolean;
}

export function aiDock(appId: () => string): AiDockState {
  let wanted = $state(true);
  let width = $state(DEFAULT);
  let tooNarrow = $state(window.innerWidth < NARROW);
  let focusAsks = $state(0);

  // Lo guardado se lee por aplicacion: cambiar de aplicacion trae su columna,
  // no la de la anterior.
  $effect(() => {
    const id = appId();
    try {
      // Abierta la primera vez: la IA es la forma de construir aqui, y sin
      // verla no hay pista de que exista. Solo se esconde si se pidio esconder.
      wanted = localStorage.getItem(openKey(id)) !== "0";
      const saved = Number(localStorage.getItem(widthKey(id)));
      width = clampDock(Number.isFinite(saved) && saved > 0 ? saved : DEFAULT);
    } catch {
      wanted = true;
      width = DEFAULT;
    }
  });

  // La ventana manda sobre lo que se pidio: en una estrecha no hay columna, y
  // al ensanchar el maximo puede haber dejado el ancho guardado fuera de rango.
  $effect(() => {
    const onResize = () => {
      tooNarrow = window.innerWidth < NARROW;
      width = clampDock(width);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  const remember = (key: (id: string) => string, value: string) => {
    try {
      localStorage.setItem(key(appId()), value);
    } catch {
      /* sin memoria del navegador, la columna vuelve a empezar como al principio */
    }
  };

  return {
    get open() {
      return wanted && !tooNarrow;
    },
    get width() {
      return width;
    },
    get tooNarrow() {
      return tooNarrow;
    },
    toggle() {
      wanted = !wanted;
      remember(openKey, wanted ? "1" : "0");
    },
    show() {
      wanted = true;
      remember(openKey, "1");
    },
    get focusAsks() {
      return focusAsks;
    },
    askFocus() {
      wanted = true;
      remember(openKey, "1");
      // No se lleva el cursor desde aqui: la columna puede no estar dibujada
      // todavia. Se pide, y el panel lo cumple cuando ya tiene su campo.
      focusAsks += 1;
    },
    setWidth(next: number) {
      width = clampDock(next);
      remember(widthKey, String(width));
    },
  };
}
