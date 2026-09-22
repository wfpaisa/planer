/**
 * Lo que el constructor le presta a sus pantallas.
 *
 * Vive aparte de `routes/Builder` porque la ruta dibuja a sus propias hijas
 * --AppEditor, DatabaseEditor, Preview, Settings-- y esas hijas necesitan el
 * contexto: teniendolo dentro del archivo de la ruta, seis componentes
 * importaban la ruta entera solo por el hook.
 */
import type { AppRecord, PageRecord, TableRecord } from "@shared/types";
import { getContext, setContext } from "svelte";

import type { AiDockState } from "./aiDock.svelte";

export interface BuilderValue {
  readonly app: AppRecord;
  readonly tables: TableRecord[];
  readonly pages: PageRecord[];
  reloadTables: () => Promise<void>;
  reloadPages: () => Promise<void>;
  /**
   * Vuelve a leer los invitados a la aplicacion.
   *
   * Lo llama quien crea o quita gente desde la tabla de personas: la lista la
   * leen las celdas de tipo persona de todas las tablas, y una lista vieja
   * pinta como roto un enlace que esta bien.
   */
  reloadPeople: () => Promise<void>;
  /** Vuelve a leer la aplicacion: nombre, icono, tema y colocacion del sidebar. */
  reloadApp: () => Promise<void>;
  /**
   * Entregarle un archivo al constructor, igual que si se hubiera soltado
   * encima.
   *
   * Soltar vale en cualquier parte del editor, pero no todo el mundo arrastra:
   * el boton de importar de la lista de tablas lo elige del disco. El camino es
   * el mismo --se mira que es, se pregunta que hacer con el y se crea-- y por
   * eso se presta en vez de repetirse: lo que vive alli son los oyentes de la
   * ventana y las preguntas, no una pantalla.
   */
  openFile: (files: FileList | File[] | null) => void;
  setApp: (app: AppRecord) => void;
  /**
   * Sube cada vez que alguien cambia las filas de una tabla sin pasar por la
   * cuadricula.
   *
   * La cuadricula lee sus filas por su cuenta --y solo cuando cambia algo suyo:
   * la busqueda, el orden, la pagina-- asi que no se entera de lo que pasa por
   * fuera y se queda ensenando filas que ya no existen. Esta es la senal de
   * que hay que volver a leer, y la levanta quien hizo el cambio.
   *
   * Es distinta de `touched`, que cuenta cambios del diseno para el boton de
   * publicar: eso sube tambien al tocar una pagina o el tema, y releer todas
   * las filas por un cambio de color soltaria de paso la seleccion y lo que se
   * podia deshacer.
   */
  readonly dataTouched: number;
  /** Decir que las filas de una tabla cambiaron desde fuera de la cuadricula. */
  touchData: () => void;
  /**
   * Sube uno cada vez que algo del diseno se guarda. Sirve para que el boton de
   * publicar se entere de que hay cambios sin tener que preguntar cada rato.
   */
  readonly touched: number;
  /** Hay un servidor de IA conectado: sin el no hay nada que pedir. */
  readonly aiReady: boolean;
  /**
   * El dock de la IA. Vive aqui porque el boton que lo trae esta en el
   * encabezado y la columna se dibuja en la escena de la pagina.
   */
  readonly dock: AiDockState;
}

const KEY = Symbol("plane:constructor");

export function setBuilder(value: BuilderValue): void {
  setContext(KEY, value);
}

export function useBuilder(): BuilderValue {
  const value = getContext<BuilderValue | undefined>(KEY);
  if (!value) throw new Error("Falta el contexto del constructor");
  return value;
}
