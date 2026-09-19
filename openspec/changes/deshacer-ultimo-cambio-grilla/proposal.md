## Why

La cuadrícula ya escribe en bloque: pegar un rango, vaciarlo con Delete y editar una celda van directo a la base de datos. Un pegado en la columna equivocada sobrescribe decenas de celdas sin ninguna vuelta atrás, y el dato anterior solo existía en la pantalla que se acaba de recargar.

## What Changes

- La cuadrícula recuerda la última escritura hecha desde ella —un pegado, un vaciado o una celda— y ofrece deshacerla.
- Aparece un botón **Deshacer** dentro del aviso que ya se muestra tras pegar o vaciar, y `Ctrl+Z` (`Cmd+Z`) deshace con el foco en la cuadrícula y ninguna celda abierta.
- Deshacer un pegado que creó filas borra esas filas; deshacer sobre filas que ya existían devuelve a cada celda el valor que tenía antes.
- Un solo nivel: no hay pila ni rehacer. Lo recordado se descarta al cambiar de tabla, de página, de filtro, de búsqueda o de orden, al cambiar las columnas de la tabla, y después de deshacer una vez.
- Quedan fuera: el borrado de filas seleccionadas (va por el servidor con cascada declarada por columna, no tiene inverso), la importación, los cambios de estructura y las columnas de la tabla de personas que se escriben por la API de miembros (correo, nivel, roles).
- **Nota**: la edición en celda y el pegado de rangos nunca se especificaron. Este cambio no los documenta en retroactivo; añade solo los requisitos de deshacer.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `builder/tables`: se añaden los requisitos de deshacer la última escritura hecha desde la cuadrícula, qué la invalida y qué queda fuera.

## Impact

- **Frontend**:
  - `web/src/lib/dataGridEdit.ts` — `writeCell`, `clearRange` y `pasteRange` devuelven además el inverso de lo que escribieron, armado con los valores crudos de las filas tal como estaban en memoria antes del PATCH.
  - `web/src/lib/dataGridUndo.ts` (nuevo) — el tipo de lo recordado y la función que lo aplica.
  - `web/src/lib/importSave.ts` — `writeBatches` recoge los ids de las filas creadas. Hoy solo lee el estado de cada respuesta y descarta el cuerpo; sin los ids no se puede deshacer un pegado que creó filas. El cambio es aditivo (una opción nueva que se llena en el sitio, como ya hace `leftover`) y no afecta a la importación.
  - `web/src/components/database/DataGrid.svelte` — guarda lo recordado, lo descarta donde corresponde, añade el atajo de teclado y el botón en el aviso.
- **Backend**: ninguno. El borrado de las filas creadas reusa `POST /api/tables/:id/filas/borrar`, que ya existe.
- **Tipos compartidos**: ninguno. Lo recordado vive en el navegador y muere con la pantalla.
