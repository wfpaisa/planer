/**
 * Las celdas de la rejilla.
 *
 * En React eran un solo archivo de 508 lineas con cinco componentes dentro;
 * aqui cada uno es su propio `.svelte` y este indice los junta.
 *
 * El valor de una celda --sin marcado-- vive aparte, en `lib/cellValues.ts`:
 * lo usan la exportacion a Excel y la rejilla de personas, que no pintan nada.
 */
export { default as CellInput } from "./CellInput.svelte";
export { default as CellView } from "./CellView.svelte";
export { default as KeyPicker } from "./KeyPicker.svelte";
export { default as MultiSelect } from "./MultiSelect.svelte";
export { default as RelationView } from "./RelationView.svelte";
