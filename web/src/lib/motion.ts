/**
 * El movimiento de lo que monta y desmonta Svelte.
 *
 * Casi todo el panel se mueve con CSS y nada más: `styles/animations.css`
 * lleva las familias --menús, superficies, cajones, velos-- y el navegador se
 * encarga, incluso de la salida, porque un `popover` sigue dibujado mientras
 * se va (`transition-behavior: allow-discrete`).
 *
 * Lo que NO puede ir por ahí es lo que dibuja un `{#if}`: el nodo se va del
 * documento en el acto y no le da tiempo a despedirse. Eso es el modal del
 * panel (`ui/Modal`), el velo que lo acompaña y los avisos (`Toast`). Para
 * esos hace falta una transición de Svelte, y aquí están las tres que hay.
 *
 * Lo importante es que no son OTRO movimiento: las duraciones se leen de los
 * mismos tokens `--mo-*` de la hoja, así que cambiar el ritmo del panel sigue
 * siendo tocar un número en un sitio. Las curvas se repiten aquí como bézier
 * --una `cubic-bezier` de CSS no se puede leer y evaluar desde JavaScript--
 * y cada una dice de qué token es copia.
 */
import { prefersReducedMotion } from "svelte/motion";
import type { TransitionConfig } from "svelte/transition";

/* ------------------------------------------------------------------ */
/* Los tokens, leídos de la hoja                                        */
/* ------------------------------------------------------------------ */

const cache = new Map<string, number>();

/**
 * Lo que dura un token del sistema, en milisegundos.
 *
 * Se lee una vez por token y se guarda: son constantes de diseño, no cambian
 * en caliente, y `getComputedStyle` en cada entrada de un modal costaría un
 * recálculo de estilo justo cuando hay que empezar a dibujar.
 */
function ms(token: string, fallback: number): number {
  const hit = cache.get(token);
  if (hit !== undefined) return hit;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const value = raw.endsWith("ms")
    ? Number.parseFloat(raw)
    : raw.endsWith("s")
      ? Number.parseFloat(raw) * 1000
      : Number.NaN;
  const out = Number.isFinite(value) && value > 0 ? value : fallback;
  cache.set(token, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Las curvas                                                          */
/* ------------------------------------------------------------------ */

/**
 * Una bézier de CSS, evaluable.
 *
 * Svelte muestrea `css(t)` con `t` lineal, así que el perfil lo tiene que
 * poner la función: sin esto, todo saldría a velocidad constante.
 */
function bezier(x1: number, y1: number, x2: number, y2: number) {
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
}

/** Copia de `--mo-enter`: frena casi del todo antes de llegar. */
const entrar = bezier(0.16, 1, 0.3, 1);
/** Copia de `--mo-leave`: acelera al irse. */
const salir = bezier(0.4, 0, 1, 1);
/** Copia de `--mo-move`: la de ida y vuelta, y la de los fundidos. */
const mover = bezier(0.4, 0, 0.2, 1);

/**
 * Copia de `--mo-spring`: el muelle amortiguado de la hoja (ζ=0.75, ω=9). Se
 * pasa un 2,8% de su destino y vuelve; es lo que le da peso a lo que se abre.
 */
function muelle(t: number): number {
  const z = 0.75;
  const w = 9;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/* ------------------------------------------------------------------ */
/* Las medidas                                                         */
/* ------------------------------------------------------------------ */

/** De qué tamaño crece lo que entra (`--mo-shrink`). */
const CHICA = 0.97;
/** Cuántos rem sube (`--mo-lift`). */
const SUBE = 0.625;
/** Cuántos rem entra de lado lo que viene del borde (`--mo-travel`). */
const VIENE = 1;

/**
 * El resto del panel apaga el movimiento con `@media (prefers-reduced-motion)`;
 * aquí no hay CSS que apagar --lo dibuja Svelte-- y la misma preferencia se
 * lee desde JavaScript.
 */
const quieto = () => prefersReducedMotion.current;

/*
 * El nodo no se usa en ninguna de las seis, pero el directivo las llama con el
 * elemento delante: sin declararlo, TypeScript cuenta un argumento de más.
 */
type Transicion = (nodo: Element) => TransitionConfig;

/* ------------------------------------------------------------------ */
/* Superficies: el modal y la hoja                                     */
/* ------------------------------------------------------------------ */

const superficie = (p: number, opacidad: number) =>
  `opacity: ${opacidad}; scale: ${CHICA + (1 - CHICA) * p}; translate: 0 ${SUBE * (1 - p)}rem;`;

/**
 * Como entra el `.modal` del catálogo: subiendo `--mo-lift` y creciendo desde
 * `--mo-shrink`, con el muelle. La opacidad acaba antes que el movimiento,
 * para que el último tramo --el lento, el que se mira-- se vea ya nítido.
 */
export const surfaceIn: Transicion = () => {
  const duracion = ms("--mo-t-surface", 336);
  const opaca = duracion * 0.65;
  return {
    duration: quieto() ? 0 : duracion,
    css: (t) => superficie(muelle(t), mover(Math.min(t / (opaca / duracion), 1))),
  };
};

/** Y como se va: corto y acelerando, que quitarse de en medio no se mira. */
export const surfaceOut: Transicion = () => ({
  duration: quieto() ? 0 : ms("--mo-t-leave", 180),
  // `t` baja de 1 a 0, así que lo que se curva es `1 - t`: el tiempo corrido.
  css: (t) => {
    const p = 1 - salir(1 - t);
    return superficie(p, p);
  },
});

/* ------------------------------------------------------------------ */
/* Velos                                                               */
/* ------------------------------------------------------------------ */

/** El velo entra antes que la tarjeta: lo de detrás se apaga primero. */
export const veilIn: Transicion = () => ({
  duration: quieto() ? 0 : ms("--mo-t-surface", 336) * 0.8,
  css: (t) => `opacity: ${mover(t)}`,
});

/** Y se va con ella. */
export const veilOut: Transicion = () => ({
  duration: quieto() ? 0 : ms("--mo-t-leave", 180),
  css: (t) => `opacity: ${1 - salir(1 - t)}`,
});

/* ------------------------------------------------------------------ */
/* Columnas                                                            */
/* ------------------------------------------------------------------ */

/**
 * La columna que se abre haciendo sitio: la de la conversación con la IA.
 *
 * Lo que se anima es el ANCHO, y no un desplazamiento, porque el gesto no es
 * que la columna aparezca encima sino que el documento se aparte para dejarle
 * sitio. Con un `translate` la columna entraria tapando lo que hay, y al
 * terminar el documento pegaria un salto para colocarse.
 *
 * `min-width: 0` va en cada cuadro a propósito: la columna es un elemento
 * flexible, su minimo de fabrica es el de su contenido, y sin esto el ancho
 * animado se quedaria encallado en lo que mida la conversación por dentro.
 *
 * Quien la use tiene que fijarle el ancho al contenido mientras dura --ver
 * `is-moving` en `components/AiDock.svelte`--: si no, lo de dentro se
 * redibuja en cada cuadro y el texto baila mientras la columna crece.
 */
export const columnIn: Transicion = (nodo) => {
  const ancho = nodo.getBoundingClientRect().width;
  const duracion = ms("--mo-t-screen", 384);
  return {
    duration: quieto() ? 0 : duracion,
    /*
     * El ancho va con `--mo-move` y no con la curva de entrada: esta no nace
     * ni muere, cambia de sitio --el documento se corre a un lado-- y la
     * curva de entrada, que gasta casi todo el recorrido en el primer tercio,
     * abria la columna de un tiron y luego se arrastraba.
     *
     * La opacidad acaba en la primera mitad: lo que se mira al final es el
     * sitio que se esta abriendo, y para entonces ya se lee lo que hay dentro.
     */
    css: (t) =>
      `width: ${ancho * mover(t)}px; min-width: 0; opacity: ${mover(Math.min(t * 2, 1))};`,
  };
};

/** Y al cerrarse, el documento recupera el ancho: corto y acelerando. */
export const columnOut: Transicion = (nodo) => {
  const ancho = nodo.getBoundingClientRect().width;
  return {
    duration: quieto() ? 0 : ms("--mo-t-leave", 180),
    css: (t) => {
      const p = 1 - salir(1 - t);
      return `width: ${ancho * p}px; min-width: 0; opacity: ${p};`;
    },
  };
};

/* ------------------------------------------------------------------ */
/* Hojas                                                               */
/* ------------------------------------------------------------------ */

/**
 * La hoja de la ventana estrecha: lo mismo que la columna, pero donde no cabe
 * una columna. Ahi no hay sitio que abrir --tapa la escena entera-- asi que
 * el gesto es el de las superficies: sube desde abajo, que es lo que dice
 * "esto se abre encima".
 */
export const sheetIn: Transicion = () => {
  const duracion = ms("--mo-t-surface", 336);
  return {
    duration: quieto() ? 0 : duracion,
    css: (t) =>
      `opacity: ${mover(Math.min(t * 2, 1))}; translate: 0 ${VIENE * (1 - entrar(t))}rem;`,
  };
};

export const sheetOut: Transicion = () => ({
  duration: quieto() ? 0 : ms("--mo-t-leave", 180),
  css: (t) => {
    const p = 1 - salir(1 - t);
    return `opacity: ${p}; translate: 0 ${VIENE * (1 - p)}rem;`;
  },
});

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

/**
 * El aviso de la esquina. Viene del borde por el que se queda --lateral, no
 * de abajo-- porque es lo único del panel que vive pegado a una esquina: el
 * recorrido dice de dónde sale sin tener que mirar.
 */
export const noticeIn: Transicion = () => {
  const duracion = ms("--mo-t-surface", 336);
  return {
    duration: quieto() ? 0 : duracion,
    css: (t) => {
      const p = entrar(t);
      return `opacity: ${mover(Math.min(t * 2, 1))}; translate: ${VIENE * (1 - p)}rem 0; scale: ${
        CHICA + (1 - CHICA) * p
      };`;
    },
  };
};

/**
 * Al irse se encoge en vertical además de desvanecerse: los que quedan
 * debajo suben a ocupar su sitio sin dar un salto.
 */
export const noticeOut: Transicion = () => ({
  duration: quieto() ? 0 : ms("--mo-t-leave", 180),
  css: (t) => {
    const p = 1 - salir(1 - t);
    return `opacity: ${p}; translate: ${VIENE * (1 - p)}rem 0; scale: ${0.96 + 0.04 * p};`;
  },
});
