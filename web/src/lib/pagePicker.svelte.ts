/**
 * El cursor que senala un elemento del documento.
 *
 * El boton que lo enciende vive en el dock, y el marco donde hay que
 * encenderlo vive en la escena de la pagina: dos ramas distintas del arbol,
 * sin nadie en comun mas que la escena entera. Pasarlo de padres a hijos
 * obligaria a atravesar media docena de componentes que no tienen nada que ver
 * con esto, asi que el estado vive fuera, como la conversacion.
 *
 * Lo senalado no se guarda aqui: viaja al panel y se queda en la conversacion
 * de la pagina, junto a lo que se esta escribiendo. Aqui solo esta el
 * interruptor, que es lo que de verdad comparten los dos lados.
 *
 * En React esto era un `useSyncExternalStore` con su lista de suscriptores
 * escrita a mano. Con runas el modulo guarda su propio `$state` y quien lo lea
 * al dibujarse se entera solo; lo unico que sigue habiendo a mano es el aviso
 * de lo senalado, que no es estado sino un suceso.
 */
import type { PickedBlock } from "@shared/types";

let active = $state(false);

/** Si el cursor esta encendido, para quien lo dibuje. */
export const picker = {
  get active(): boolean {
    return active;
  },
};

/** Encender o apagar el cursor. */
export function setPickerActive(next: boolean): void {
  active = next;
}

const takers = new Set<(block: PickedBlock) => void>();

/** El puente senalo un elemento. */
export function emitPicked(block: PickedBlock): void {
  for (const fn of takers) fn(block);
}

/** Quedarse con lo que se vaya senalando. */
export function onPicked(fn: (block: PickedBlock) => void): () => void {
  takers.add(fn);
  return () => {
    takers.delete(fn);
  };
}

let counter = 0;
export const nextPickId = () => `p${++counter}`;
