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
  setApp: (app: AppRecord) => void;
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
