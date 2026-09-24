/**
 * El estado de la columna de la IA, guardado por aplicación en este navegador.
 *
 * Vive arriba --en el constructor-- porque el botón que la trae esta en la
 * barra superior y la columna se dibuja en la escena de la página. Escondido y
 * ancho son independientes: traerla de vuelta la devuelve con el ancho que
 * tenia.
 */

/*
 * Los anchos van en `rem` y no en pixeles.
 *
 * El panel entero se mide así, y su tamaño de letra se cambia desde los ajustes
 * --`fontSize.svelte.ts` mueve la raíz, y con ella el `rem`--: con pixeles
 * fijos la columna se estrechaba respecto a su propio texto justo cuando el
 * texto se agrandaba, que es cuando menos sitio sobra. Se pasan a pixeles al
 * usarlos porque todo lo demás de aquí --lo que mide la ventana, lo que llega
 * del puntero, lo que se guarda-- va en pixeles.
 */

/** Lo que necesita el campo de texto para no ser inservible, y el de partida. */
const MIN_REM = 28;
/** Tope duro: mas ancha que esto la conversación no gana nada. */
const MAX_REM = 48;
/** Y nunca mas de esta parte de la ventana, para no comerse el documento. */
const MAX_SHARE = 0.45;
/**
 * Por debajo de este ancho de ventana una columna dejaria al documento sin
 * sitio. Ahi la conversación no es columna sino hoja: tapa la escena entera,
 * se abre solo cuando se pide y se cierra con la misma equis. Antes, por
 * debajo de este ancho la IA desaparecia sin decir nada --en una tableta o un
 * telefono, justo lo que distingue a la plataforma no estaba--.
 */
const NARROW = 900;

/** Lo que mide un `rem` ahora mismo, con el tamaño de letra que este puesto. */
function rem(): number {
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

/**
 * El ancho minimo, que es también con el que nace.
 *
 * Son el mismo número a propósito: la columna empieza en lo mas angosto que se
 * la deja estar, y de ahi solo se ensancha. Quien no toque nada la ve siempre
 * igual, y quien la ensanche no puede volver a un sitio peor que el de partida.
 */
const base = () => Math.round(MIN_REM * rem());

const widthKey = (appId: string) => `plane_ai_dock_w_${appId}`;
const openKey = (appId: string) => `plane_ai_dock_${appId}`;

/**
 * El ancho, sujeto entre el minimo útil y lo que la ventana permite. Va en
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
   * Cuantas veces se ha pedido el cursor. El número no dice nada por si mismo,
   * solo que hubo una petición nueva: el panel lo mira para llevarlo alli.
   */
  readonly focusAsks: number;
  readonly width: number;
  /** Confirmar un ancho nuevo. Se recuerda por aplicación. */
  setWidth: (width: number) => void;
  /** La ventana no da para la columna: la conversación se abre como hoja. */
  readonly tooNarrow: boolean;
  /**
   * Si la columna esta abierta porque alguien acaba de pedirla.
   *
   * Es lo unico que distingue "abrir la conversación" de "volver a las páginas
   * y encontrarla donde estaba": las dos cosas dibujan la columna de cero --al
   * cambiar de mitad, el constructor desmonta la escena entera-- y solo la
   * primera es un gesto que merezca verse. Lo lee la columna al entrar y lo
   * gasta con `ackOpen`.
   */
  readonly openedByHand: boolean;
  /** El gesto ya se vio: la proxima vez que se dibuje, sale puesta. */
  ackOpen: () => void;
}

export function aiDock(appId: () => string): AiDockState {
  let wanted = $state(true);
  let width = $state(base());
  let tooNarrow = $state(window.innerWidth < NARROW);
  let focusAsks = $state(0);
  /** Ver `openedByHand`. */
  let byHand = $state(false);
  /*
   * La hoja de la ventana estrecha. No se recuerda ni nace abierta: tapa la
   * página entera, y abrirla sola al entrar dejaria a quien entra sin ver lo
   * que vino a mirar.
   */
  let sheet = $state(false);

  // Lo guardado se lee por aplicación: cambiar de aplicación trae su columna,
  // no la de la anterior.
  $effect(() => {
    const id = appId();
    try {
      // Abierta la primera vez: la IA es la forma de construir aquí, y sin
      // verla no hay pista de que exista. Solo se esconde si se pidio esconder.
      wanted = localStorage.getItem(openKey(id)) !== "0";
      const saved = Number(localStorage.getItem(widthKey(id)));
      // Un ancho guardado mas angosto que el minimo de ahora sube solo: es lo
      // que hace que subir el minimo alcance también a quien ya la había movido.
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
      return tooNarrow ? sheet : wanted;
    },
    get width() {
      return width;
    },
    get tooNarrow() {
      return tooNarrow;
    },
    toggle() {
      if (tooNarrow) {
        sheet = !sheet;
        byHand = sheet;
        return;
      }
      wanted = !wanted;
      byHand = wanted;
      remember(openKey, wanted ? "1" : "0");
    },
    show() {
      byHand = true;
      if (tooNarrow) {
        sheet = true;
        return;
      }
      wanted = true;
      remember(openKey, "1");
    },
    get focusAsks() {
      return focusAsks;
    },
    askFocus() {
      byHand = true;
      if (tooNarrow) sheet = true;
      else {
        wanted = true;
        remember(openKey, "1");
      }
      // No se lleva el cursor desde aquí: la columna puede no estar dibujada
      // todavía. Se pide, y el panel lo cumple cuando ya tiene su campo.
      focusAsks += 1;
    },
    get openedByHand() {
      return byHand;
    },
    ackOpen() {
      byHand = false;
    },
    setWidth(next: number) {
      width = clampDock(next);
      remember(widthKey, String(width));
    },
  };
}
