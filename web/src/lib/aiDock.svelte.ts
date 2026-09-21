/**
 * El estado de la columna de la IA, guardado por aplicacion en este navegador.
 *
 * Vive arriba --en el constructor-- porque el boton que la trae esta en la
 * barra superior y la columna se dibuja en la escena de la pagina. Escondido y
 * ancho son independientes: traerla de vuelta la devuelve con el ancho que
 * tenia.
 */

/*
 * Los anchos van en `rem` y no en pixeles.
 *
 * El panel entero se mide asi, y su tamano de letra se cambia desde los ajustes
 * --`fontSize.svelte.ts` mueve la raiz, y con ella el `rem`--: con pixeles
 * fijos la columna se estrechaba respecto a su propio texto justo cuando el
 * texto se agrandaba, que es cuando menos sitio sobra. Se pasan a pixeles al
 * usarlos porque todo lo demas de aqui --lo que mide la ventana, lo que llega
 * del puntero, lo que se guarda-- va en pixeles.
 */

/** Lo que necesita el campo de texto para no ser inservible, y el de partida. */
const MIN_REM = 28;
/** Tope duro: mas ancha que esto la conversacion no gana nada. */
const MAX_REM = 48;
/** Y nunca mas de esta parte de la ventana, para no comerse el documento. */
const MAX_SHARE = 0.45;
/**
 * Por debajo de este ancho de ventana el dock dejaria al documento sin sitio,
 * asi que no se dibuja --ni el, ni su boton.
 */
const NARROW = 900;

/** Lo que mide un `rem` ahora mismo, con el tamano de letra que este puesto. */
function rem(): number {
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

/**
 * El ancho minimo, que es tambien con el que nace.
 *
 * Son el mismo numero a proposito: la columna empieza en lo mas angosto que se
 * la deja estar, y de ahi solo se ensancha. Quien no toque nada la ve siempre
 * igual, y quien la ensanche no puede volver a un sitio peor que el de partida.
 */
const base = () => Math.round(MIN_REM * rem());

const widthKey = (appId: string) => `plane_ai_dock_w_${appId}`;
const openKey = (appId: string) => `plane_ai_dock_${appId}`;

/**
 * El ancho, sujeto entre el minimo util y lo que la ventana permite. Va en
 * pixeles enteros: el puntero llega con fracciones y no hay nada que ganar
 * guardando media docena de decimales en el navegador.
 *
 * Cuando la ventana no da ni para el minimo, manda la ventana. Es el caso de
 * una pantalla justa con la letra grande --27rem con la letra al 160% son casi
 * 700 pixeles-- y ahi un minimo que no cediera se quedaria con tres cuartas
 * partes del sitio: la columna acabaria tapando aquello sobre lo que se esta
 * preguntando. Con sitio de sobra, que es lo normal, el minimo son los 27rem
 * enteros.
 */
export function clampDock(width: number): number {
  const top = Math.min(Math.round(MAX_REM * rem()), Math.round(window.innerWidth * MAX_SHARE));
  const min = Math.min(base(), top);
  return Math.round(Math.max(min, Math.min(width, top)));
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
  let width = $state(base());
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
      // Un ancho guardado mas angosto que el minimo de ahora sube solo: es lo
      // que hace que subir el minimo alcance tambien a quien ya la habia movido.
      width = clampDock(Number.isFinite(saved) && saved > 0 ? saved : base());
    } catch {
      wanted = true;
      width = base();
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
