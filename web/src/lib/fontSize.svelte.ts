const KEY = "plane-font-size";

/** El deslizador va de 80% a 160%, de diez en diez. */
export const FONT_SIZE_MIN = 80;
export const FONT_SIZE_MAX = 160;
export const FONT_SIZE_STEP = 10;
/** El tamano por defecto es el normal del navegador. */
export const DEFAULT_FONT_SIZE = 100;

function saved(): number {
  const value = Number(localStorage.getItem(KEY));
  if (!Number.isInteger(value)) return DEFAULT_FONT_SIZE;
  if (value < FONT_SIZE_MIN || value > FONT_SIZE_MAX || value % FONT_SIZE_STEP !== 0) {
    return DEFAULT_FONT_SIZE;
  }
  return value;
}

let percent = $state(saved());

/**
 * Aplica el tamano de letra a la raiz (`html`) como un porcentaje directo de
 * `font-size`: toda la hoja esta en rem, asi que mover la raiz reescala el
 * panel entero, letra y alturas de linea juntas. En el valor normal se quita
 * el estilo inline para que mande el tamano del navegador. La eleccion queda
 * guardada solo en este navegador.
 */
$effect.root(() => {
  $effect(() => {
    const style = document.documentElement.style;
    if (percent === DEFAULT_FONT_SIZE) {
      style.removeProperty("font-size");
    } else {
      style.fontSize = `${percent}%`;
    }
    localStorage.setItem(KEY, String(percent));
  });
});

export const fontSize = {
  /** El porcentaje sobre el tamano normal que usa el panel ahora mismo. */
  get percent(): number {
    return percent;
  },
  set(value: number) {
    percent = value;
  },
};
