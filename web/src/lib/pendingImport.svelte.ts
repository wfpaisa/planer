/**
 * Un archivo que espera a que se abra la tabla donde tiene que entrar.
 *
 * Lo escribe el constructor al soltar un archivo que reconoce como el de la
 * tabla de personas, y lo recoge la cuadricula de esa tabla al pintarse. Hace
 * falta porque las personas no entran por el camino corriente: crearles la
 * cuenta lo hace el diálogo de importar, que vive dentro de la cuadricula.
 *
 * Es un modulo con estado y no un contexto porque quien lo escribe y quien lo
 * lee no estan montados a la vez: entre los dos hay un cambio de ruta.
 */
let pending = $state<{ tableId: string; file: File } | null>(null);

/** Deja el archivo esperando a esa tabla. */
export function askImport(tableId: string, file: File): void {
  pending = { tableId, file };
}

/**
 * El archivo que esperaba a esta tabla, si es que hay uno. Se recoge una vez:
 * volver a abrir la tabla no vuelve a abrir el diálogo.
 */
export function takeImport(tableId: string): File | null {
  if (pending?.tableId !== tableId) return null;
  const { file } = pending;
  pending = null;
  return file;
}
