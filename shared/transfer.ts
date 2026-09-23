/**
 * El archivo `.planer`: una aplicación entera fuera de la plataforma.
 *
 * Por dentro es un comprimido zip con la extensión cambiada, y trae todo lo
 * que hace falta para volver a levantarla en otro servidor: la aplicación con
 * su apariencia y sus roles, sus tablas con sus columnas, sus páginas con el
 * HTML de cada una, las filas y los archivos adjuntos.
 *
 * Lo que **no** viaja son las personas invitadas. Una cuenta es de una
 * aplicación y de ninguna otra --la identidad lleva delante el id de la app,
 * ver `loginFor` en `shared/people.ts`-- así que copiarla no daria acceso a
 * nadie, y llevarse claves de un servidor a otro dentro de un archivo que se
 * manda por correo no es algo que esta plataforma vaya a hacer. Lo que si se
 * conserva es lo que las filas decian de cada persona: una columna que
 * apuntaba a alguien sale con el valor a la vista, sin enlace, que es
 * exactamente el hueco que el panel ya sabe rellenar.
 *
 * Nada aquí dentro nombra un id de PocketBase: las tablas se nombran por su
 * nombre tecnico y las columnas por el suyo. Es lo que permite que el archivo
 * se abra en un servidor donde esos ids no existen.
 */
import type { AppTheme, FieldDef, TableMeta } from "./types.ts";

/**
 * Version del formato. Sube cuando un archivo nuevo deja de poder leerse con
 * el codigo viejo; leer uno mas antiguo tiene que seguir funcionando siempre.
 */
export const PLANER_FORMAT = 1;

/** La extension con la que se descarga. Por dentro es un zip. */
export const PLANER_EXT = ".planer";

/** El archivo con la estructura, dentro del comprimido. */
export const MANIFEST_NAME = "planer.json";

/** Carpetas del comprimido. */
export const DOCS_DIR = "paginas";
export const ROWS_DIR = "datos";
export const FILES_DIR = "archivos";

/**
 * Una columna, sin nada que dependa de esta instalacion.
 *
 * Se le quita el `id` --lo asigna PocketBase al crear la colección-- y la
 * tabla destino de una relación deja de ser un id para pasar a ser el nombre
 * tecnico de la tabla, que si viaja.
 */
export interface TransferField extends Omit<FieldDef, "id" | "relationTableId"> {
  /** Nombre tecnico de la tabla a la que apunta la relación. */
  relationTable?: string;
}

/** Una tabla que declara una página, nombrada por nombres y no por ids. */
export interface TransferSource {
  /** Nombre con el que el HTML pide esta fuente. */
  name: string;
  /** Nombre tecnico de la tabla. */
  tabla: string;
  /** Nombre logico de cada columna -> nombre tecnico de la columna. */
  fields: Record<string, string>;
}

export interface TransferTable {
  name: string;
  label: string;
  order: number;
  fields: TransferField[];
  meta: TableMeta;
  acceptedOrphans?: Record<string, string[]>;
  /** La tabla de personas. Al importar no se crea: ya existe, y se le ponen sus columnas. */
  system?: boolean;
  /** Cuantas filas suyas trae el comprimido. */
  filas: number;
}

export interface TransferPage {
  name: string;
  slug: string;
  icon: string;
  order: number;
  isHome: boolean;
  separator?: boolean;
  roles?: string[];
  memory?: string;
  /** Ruta del documento dentro del comprimido. Vacía: la página no tiene nada escrito. */
  doc?: string;
  sources?: TransferSource[];
}

/** La estructura entera, tal como se guarda en `planer.json`. */
export interface PlanerManifest {
  formato: number;
  /** Cuando se exporto, en ISO. Solo informativo. */
  creado: string;
  aplicacion: {
    name: string;
    icon: string;
    visibility: "private" | "public";
    theme: AppTheme | null;
    roles: string[];
  };
  tablas: TransferTable[];
  paginas: TransferPage[];
  /** El comprimido trae las filas de las tablas. */
  datos: boolean;
  /** Cuantos archivos adjuntos trae. */
  archivos: number;
}

/** Lo que se cuenta al terminar de importar o de duplicar. */
export interface TransferResult {
  appId: string;
  name: string;
  slug: string;
  tablas: number;
  paginas: number;
  filas: number;
  archivos: number;
  /**
   * Lo que no se pudo traer tal cual, dicho en frases. Vacío: entro todo.
   *
   * No son errores: son decisiones que el archivo no podia tomar --una
   * relación cuya tabla no venia, un adjunto que ya no estaba-- y que quien
   * importa tiene que saber sin tener que ir a buscarlas.
   */
  avisos: string[];
}

/**
 * El nombre con el que se descarga una aplicación.
 *
 * Sale del enlace y no del nombre: el enlace ya es minusculas, sin tildes y
 * sin espacios, que es lo que un nombre de archivo necesita.
 */
export function transferFileName(slug: string): string {
  return `${slug || "aplicacion"}${PLANER_EXT}`;
}
