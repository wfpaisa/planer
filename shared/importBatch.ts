/**
 * Lo que hace falta para escribir muchas filas de golpe.
 *
 * Tiene dos lados, y por eso vive aquí: el navegador parte la importacion en
 * tramos de este tamaño (`save` en `web/src/components/database/ImportModal.svelte`) y
 * el servidor deja la instalacion de PocketBase en condiciones de aceptarlos
 * (`ensureBatchSettings` en `server/bootstrap.ts`). Cuando los dos numeros no
 * cuadran, la importacion se cae a mitad con un 429 --o no arranca con un
 * "Batch API is not enabled"-- y el aviso habla de un lote que quien importa no
 * sabe que existe.
 */

/** Cuantas filas se pueden importar de una vez. */
export const MAX_IMPORT_ROWS = 5000;

/** Cuantos pedidos lleva cada tramo del lote. */
export const IMPORT_BATCH_CHUNK = 200;

/**
 * Segundos que se le conceden a un tramo para terminar.
 *
 * El lote es una transaccion: o entran las 200 filas o no entra ninguna, y los
 * 3 segundos de fabrica se quedan cortos en cuanto las filas traen relaciones
 * que resolver o el disco va lento.
 */
export const IMPORT_BATCH_TIMEOUT = 30;

/**
 * El suelo de las reglas de limite que estorban a una importacion.
 *
 * Cada fila del tramo cuenta como un pedido suyo, así que las reglas que miran
 * pedidos --y no la ruta del lote-- se llenan con el primer tramo: la regla de
 * fabrica `*:create` son 20 creaciones cada 5 segundos, y por eso una
 * importacion se caia siempre en la fila 21.
 *
 * El suelo es la importacion mas grande que la plataforma admite entera. Y es
 * así de alto a propósito: los tramos van tan rápido como deje el disco, así
 * que un archivo grande mete varios miles de filas dentro de la misma ventana
 * de segundos. Con un suelo mas bajo --tres tramos, digamos-- lo que salia era
 * lo peor de los dos mundos: una importacion a medias, con la mitad de las
 * filas dentro y la otra en un archivo que hay que volver a traer.
 *
 * Sigue siendo un techo, no un "sin limite", y las reglas que de verdad
 * protegen --las de las claves-- no se tocan.
 */
export const IMPORT_RATE_FLOOR: Record<string, number> = {
  "*:create": MAX_IMPORT_ROWS,
  "/api/": MAX_IMPORT_ROWS,
  // El tramo entero es un solo pedido a esta ruta, y van de uno en uno.
  "/api/batch": 30,
};
