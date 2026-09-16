## Why

Apuntar a otra tabla tiene hoy dos tipos de columna que hacen casi lo mismo: **Relación**, que apunta a una tabla, y **Persona**, que apunta a quien inicia sesión. Quien construye no tiene forma de saber cuál le toca, porque la diferencia no está en lo que ve --las dos enseñan una cédula y guardan un enlace-- sino en dónde se ancla cada una: Relación se ancla a la fila de la tabla destino, y Persona a la cuenta.

Esa diferencia invisible decide cosas que sí se ven, y siempre a peor por el camino equivocado: la propuesta al importar, el aviso al invitar a alguien, y --lo grave-- que al quitar a una persona la base anula el enlace y nadie guarda el valor, así que la cédula desaparece de la fila sin dejar rastro. El desplegable ofrece "Personas y roles" como una tabla más, así que caer ahí es lo normal.

El tipo Persona existía por una sola razón: que una página publicada pudiera enseñarle a cada quien sus propias filas, comparando contra el identificador de la cuenta. Ese motivo se cae en cuanto se mira un caso real. Cada tabla enlaza a la persona por una llave distinta --chequeos por el correo, excesos por la cédula, mañana otra por un código de empleado-- y un identificador único no sirve para ninguna de las tres. Lo que hace falta no es el identificador de quien mira: son sus datos. Filtrar por valor funciona con cualquier llave, y además encuentra las filas que nunca llegaron a enlazarse, que el identificador nunca ve.

Aparte, arrastrar un archivo de personas al constructor no lo lleva a la tabla de personas: crea una tabla nueva y aparte, sin cuentas detrás. Ocurre porque al exportar el archivo se nombra con el nombre técnico de la tabla y al arrastrarlo se busca por la etiqueta visible, que son dos cosas distintas. Afecta a toda tabla cuya etiqueta lleve mayúsculas, tildes o espacios.

## What Changes

- **BREAKING** El tipo **Persona** desaparece. Queda un solo tipo, **Relación**, que apunta a cualquier tabla incluida "Personas y roles", empareja por la llave que se elija y se ancla a la fila de la tabla destino. Las columnas que hoy son de tipo Persona se convierten, reescribiendo su ancla de la cuenta a la fila.
- **BREAKING** `plane.usuario` pasa a llevar todas las columnas propias de la persona --su cédula, su cargo, lo que la aplicación le haya puesto--, además de las cuatro de siempre. El contexto de la IA las enumera por su nombre. La instrucción que hoy dice que "lo mío" se filtra por el identificador al pintar se sustituye por filtrar en el servidor con la llave de cada tabla.
- La tabla de personas SHALL NO admitir columnas llamadas `id`, `correo` ni `roles`, porque son los nombres con los que llega la sesión. `nombre` no se reserva: la columna que la tabla ya trae es justo el dato que la sesión manda con ese nombre.
- Una columna de relación declara qué pasa con sus filas cuando se borra aquello a lo que apuntan: conservar el valor a la vista (por defecto) o borrar las filas también. Se elige en la tarjeta de la columna, no al crearla, y el aviso al borrar dice cuántas filas se llevan por delante.
- El contexto de la IA fija cómo se nombra a una persona en una página: el nombre por delante, un segundo dato solo si aporta y en letra pequeña, y el ancla nunca.
- A qué tabla va un archivo soltado se decide en tres capas: los identificadores de su columna `id`, luego sus columnas exactas, luego el nombre del archivo comparado contra el nombre técnico **y** la etiqueta. Si una capa encuentra más de una tabla no adivina: pasa a la siguiente, y si ninguna decide se pregunta como si el archivo fuera nuevo.
- Al exportar, el archivo se nombra con la etiqueta de la tabla, no con su nombre técnico: `personas-y-roles.csv`.
- Terminar de importar personas enlaza solas las filas de otras tablas que esperaban a esas personas, y lo dice con frases que nombran de qué hablan y cuántos son.
- Cuando una columna de texto de otra tabla coincide con las personas invitadas, el sistema lo avisa y ofrece convertirla en columna de relación a la tabla de personas. No la convierte solo.
- Arrastrar un archivo a una tabla vuelve a pedir la lista de invitados al terminar, para que el siguiente archivo no empareje contra una lista vieja.

## Capabilities

### New Capabilities
- `builder/file-drop`: a qué tabla pertenece un archivo de datos soltado en el constructor, y qué se hace cuando no pertenece a ninguna.

### Modified Capabilities
- `table-relations`: un solo tipo de columna para apuntar a otra tabla, y qué pasa con las filas que apuntan a algo que se borra.
- `page-context`: lo que el contexto dice de quien mira, cómo se filtra "lo mío" y cómo se nombra a una persona.
- `builder/tables`: el nombre del archivo exportado, y el ofrecimiento de convertir una columna de texto que resulta nombrar personas.
- `builder/people`: los nombres reservados de la tabla de personas, e importar personas enlaza lo que estaba esperando y lo dice.

## Impact

- `shared/types.ts`: `FieldType` pierde `person`. `isRelationField`, `displayFieldOf` y `detailFieldOf` dejan de tener dos ramas.
- `server/schema.ts`: `toPbField` pierde el caso `person`; toda relación apunta a la colección de datos de su tabla destino. `cascadeDelete` deja de ser siempre `false` y sale de lo que declare la columna.
- `server/peopleTable.ts`: `parkPersonReferences` deja de filtrar por tipo y busca por el identificador de la fila de personas.
- `server/pageData.ts` y `shared/htmlSources.ts`: una relación a la tabla de personas se resuelve con el expand de la base como cualquier otra, y encima se le superpone el correo, que no es una columna de esa colección. La lista de invitados sigue haciendo falta para eso, pero se pide por la tabla destino y ya no por el tipo de la columna. Ver `design.md` D10.
- `shared/htmlContract.ts`: las columnas de la persona en la sesión, el filtrado en el servidor y cómo nombrar a una persona.
- `web/src/components/HtmlFrame.svelte`: `viewer` añade las columnas propias, que el servidor ya manda enteras para quien pregunta (`publicPeople` en `server/routes.ts`).
- `web/src/components/DataGrid.svelte`: el nombre del archivo al exportar, enlazar lo que esperaba al terminar una importación, y borrar filas pasa por el servidor en vez de ir directa a la base.
- `web/src/components/ColumnModal.svelte`: la tabla de personas vuelve al desplegable como una más, y aparece la opción de qué pasa al borrar.
- `web/src/lib/dropFiles.ts`, `personGuess.ts`, `orphans.ts`, `relations.ts`, `cellValues.ts`, `tableStructure.ts`: pierden la rama del tipo persona.
- No cambia quién puede ver qué. "Solo lo mío" sigue siendo una comodidad de presentación y no una barrera; ver `design.md` D6.
