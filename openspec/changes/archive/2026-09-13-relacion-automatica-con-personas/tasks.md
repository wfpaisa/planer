## 1. Un solo tipo de columna

- [x] 1.1 Quitar `person` de `FieldType` (`shared/types.ts`) y dejar `isRelationField` con una sola condición. `displayFieldOf` y `detailFieldOf` pierden su rama por tipo; el respaldo pasa a ser la primera columna única de la tabla destino, como en cualquier relación.
- [x] 1.2 En `toPbField` (`server/schema.ts`), borrar el caso `person` y `peopleTarget`. Toda relación apunta a la colección de datos de su tabla destino, la de personas incluida.
- [x] 1.3 En `ColumnModal.svelte`, quitar el tipo Persona del selector y su nota, y dejar la tabla de personas en `otherTables` como una tabla más.
- [x] 1.4 Quitar la rama por tipo de `relationTarget` y `matchValues` (`shared/relations.ts`). `relationTarget` queda sin ramas. `matchValues` empareja por lotes como con cualquier tabla, salvo el correo, que no está en la colección de personas y se busca en la lista de invitados (`isOverlayField`). Ver `design.md` D10.
- [x] 1.5 Quitar la rama por tipo de `declaredOf`, `expandOf` y `toLogicalRow` (`shared/htmlSources.ts`) y del cargue de invitados en `server/pageData.ts`. Una relación a la tabla de personas se resuelve con el expand de la base, con el correo superpuesto desde la lista de invitados; la lista se pide por la tabla destino y ya no por el tipo.
- [x] 1.6 Quitar `REAL_MEMBER_FIELDS` de `relationMatch` (`shared/htmlSources.ts`). La tabla destino es una tabla de la aplicación: sus columnas propias se filtran con un salto, y el correo con dos (`campo.member.cuenta`), que antes no se podía filtrar en el servidor. Los roles no se filtran, y no hace falta que se filtren: no pueden ser la columna que enseña.
- [x] 1.7 Quitar la rama de persona de `orphans.ts`, `cellValues.ts`, `personGuess.ts`, `importParse.ts`, `tableStructure.ts`, `KeyPicker.svelte`, `KeySelect.svelte`, `OrphanPanel.svelte` y `RelationView.svelte`. En `RelationView`, el estado enlazado deja de tener dos pinturas.
- [x] 1.8 Comprobar que `invitedFor` (`web/src/lib/orphans.ts`) sigue ofreciendo invitar a alguien desde un valor sin dueño, ahora reconociendo la columna por su tabla destino y no por su tipo.

## 2. Convertir las columnas que ya son de tipo persona

- [x] 2.1 Escribir la conversión que corre al arrancar el servidor: por cada columna de tipo persona, leer el ancla de cada fila, traducirla a la fila de personas de esa cuenta, recrear la columna apuntando a la tabla de personas y escribir el ancla nueva. Ver `design.md` D2.
- [x] 2.2 Una fila cuya cuenta ya no esté invitada no tiene fila destino: conservar su valor en la columna sin enlace, con el valor que la columna enseñaba.
- [x] 2.3 Hacerla idempotente y silenciosa cuando no hay nada que convertir: una aplicación sin columnas de ese tipo no debe pagar ninguna consulta.
- [x] 2.4 Correrla antes que cualquier otro arranque que lea columnas, para que nada se encuentre un tipo que ya no entiende.

## 3. La sesión lleva a la persona entera

- [x] 3.1 En `viewer` (`web/src/components/HtmlFrame.svelte`), añadir a `plane.usuario` las columnas propias de la persona, planas. El servidor ya las manda enteras para quien pregunta (`publicPeople` en `server/routes.ts`); hoy se descartan aquí.
- [x] 3.2 Hacer lo mismo en el camino de la vista previa, donde la persona se elige a mano (`PageStage.svelte`), para que probar con los ojos de alguien enseñe lo mismo que verá esa persona.
- [x] 3.3 En `guardSystemFields` (`server/peopleTable.ts`), rechazar las columnas de la tabla de personas llamadas `id`, `correo` o `roles`, diciendo cuál es el nombre y por qué. Solo en esa tabla. `nombre` no entra: es la columna que la tabla ya trae, y esa función ya impide borrarla.
- [x] 3.4 Impedirlo también en la tarjeta de columna, antes de mandar nada, para que el aviso llegue mientras se escribe.

## 4. El contexto de la IA

- [x] 4.1 En `viewerSection` (`shared/htmlContract.ts`), enumerar los campos de `plane.usuario` con las columnas reales de la tabla de personas de esa aplicación, y decir que una puede venir vacía.
- [x] 4.2 Reescribir la frase de "lo mío" en `rolesSection`: hoy dice que se filtra por el identificador al pintar. Pasa a decir que se filtra en el servidor, con la llave de esa tabla, y con el ejemplo de dos tablas que enlazan por llaves distintas.
- [x] 4.3 Extender a "lo mío" la advertencia que ya existe para los roles: decide lo que se enseña, no lo que se puede pedir. Nombrar lo que sí cierra el paso: marcar la aplicación como privada.
- [x] 4.4 Escribir la regla de cómo se nombra a una persona --nombre por delante, apellido si lo hay, segundo dato solo si aporta y en letra pequeña, el ancla nunca-- y decir que la cuadrícula hace lo contrario a propósito.
- [x] 4.5 En `tablesSection`, quitar la rama que describe una columna de persona aparte. Todas se describen igual.
- [x] 4.6 Comprobar que la documentación del constructor sale coherente: las dos salen del mismo texto (`buildHtmlDocs`).

## 5. Qué pasa al borrar lo apuntado

- [x] 5.1 Añadir a la definición de columna la conducta al borrar, con conservar el valor por defecto, y llevarla a `cascadeDelete` en `toPbField`. La cascada es lo único que PocketBase puede hacer solo.
- [x] 5.2 Ofrecerla en la tarjeta de la columna, no en el alta. Redactar las dos opciones como en `design.md` D7.
- [x] 5.3 Ampliar `parkPersonReferences` (`server/peopleTable.ts`) a una función general: dado un registro que va a borrarse, guardar en la columna sin enlace el valor que enseñaban las filas que lo señalan, para las columnas que conservan el valor. Deja de filtrar por tipo y busca por el identificador de la fila.
- [x] 5.4 Llamarla desde los tres caminos que borran: la orden `borrar` de `server/pageData.ts`, el quitar acceso de `server/routes.ts`, y el borrado de la cuadrícula.
- [x] 5.5 Pasar el borrado de la cuadrícula por el servidor: hoy `DataGrid.svelte` llama directo a la base y se salta cualquier regla. El borrado en bloque manda los identificadores juntos.
- [x] 5.6 Antes de borrar, contar y decir cuántas filas se conservan y cuántas se borran, por tabla. Reusar el recuento de impacto que ya existe para los cambios de estructura (`server/dataImpact.ts`) si encaja; si no, dejar escrito por qué no.

## 6. La tabla de un archivo soltado, en tres capas

- [x] 6.1 En `web/src/lib/dropFiles.ts`, convertir `matchingTable` en la capa 3, comparando el nombre del archivo --ya sin cola-- contra el nombre técnico **y** la etiqueta de cada tabla.
- [x] 6.2 Hacer que las tres capas devuelvan todas las candidatas y no la primera. Con más de una, la capa no decide y se pasa a la siguiente; hoy `tables.find` coge la primera en silencio, y la etiqueta de una tabla no tiene que ser única.
- [x] 6.3 Escribir la capa 2: las columnas del archivo, sin contar `id`, comparadas contra las columnas de cada tabla. Comparar por nombre técnico o por etiqueta, ignorando mayúsculas, tildes y separadores, que es la misma regla que ya usa `importIntoTable`.
- [x] 6.4 Escribir la capa 1: tomar una muestra corta de la columna `id` del archivo y preguntar a cada tabla si esos identificadores existen. Solo si el archivo trae esa columna.
- [x] 6.5 Encadenar las tres en el orden de `design.md` D3 y devolver la tabla, o nada. `matchingTable` pasa a ser la fachada de las tres, para que `Builder.svelte` no cambie.
- [x] 6.6 En `tableFromPlan` (`dropFiles.ts`), crear las columnas adivinadas como relación a la tabla de personas en vez de como tipo persona.
- [x] 6.7 Comprobar que un archivo reconocido como el de la tabla de personas se ofrece importar en ella, por el camino que crea las cuentas, y que no se ofrece crear una tabla nueva.

## 7. El archivo exportado se llama como la tabla que se ve

- [x] 7.1 En `DataGrid.svelte`, nombrar los tres archivos de descarga --`.csv`, `.xlsx`, `.json`-- con la etiqueta de la tabla en lugar de `table.name`, pasada por el mismo saneado que usa el resto.
- [x] 7.2 Hacerlo después de 6.1, o a la vez: al revés, durante un tiempo los archivos recién descargados no se reconocerían al volver a soltarlos.
- [x] 7.3 Mirar si `TableSidebar.svelte:190` --el `-columnas.json` de la estructura-- debería seguir la misma regla, y dejar escrito lo que se decida. **Sí la sigue**: sale con la etiqueta, por el mismo `exportName`. La cola `-columnas` se queda, y queda escrito por qué en el código: son dos archivos distintos de la misma tabla, y esa cola es además lo que impide que soltarlo de vuelta lo confunda con el archivo de datos.

## 8. Importar personas enlaza lo que estaba esperando

- [x] 8.1 En `Builder.svelte`, hacer que `runImport` vuelva a pedir la lista de invitados al terminar, como ya hace `DataGrid` cuando la importación va por el diálogo.
- [x] 8.2 Al terminar una importación que toque la tabla de personas, llamar a `waitingFor` una sola vez con la lista ya releída, y enlazar sin preguntar lo que devuelva. Ver `design.md` D8.
- [x] 8.3 Recoger las tres cifras del aviso: personas importadas y cuántas nuevas, filas enlazadas y de qué tabla, filas que siguen sin enlace y dónde se ven.
- [x] 8.4 Componer el aviso con una frase por cifra, omitiendo la que sea cero. Las dos primeras cuentan personas y filas respectivamente, así que cada frase nombra su sujeto.

## 9. Ofrecer convertir una columna de texto que nombra personas

- [x] 9.1 Extraer de `guessPersonColumns` (`web/src/lib/personGuess.ts`) la comparación que sirve para una columna ya guardada: hoy recibe las filas de un archivo, y aquí vienen de una tabla.
- [x] 9.2 Después de importar personas, pasar por las columnas de texto de las demás tablas y quedarse con las que tengan valores que identifiquen a una sola persona invitada.
- [x] 9.3 Ofrecerlo en un diálogo que diga la tabla, la columna y cuántos valores coinciden. No convertir sin que se acepte.
- [x] 9.4 Al aceptar, convertir la columna a relación a la tabla de personas con la llave que más coincidencias dio, y después enlazar los valores que quedaron esperando con `linkParkedValues` (`web/src/lib/relations.ts`).

## 10. Comprobación

- [x] 10.1 En `scripts/smoke-relaciones.ts`, comprobar que una columna que apunta a la tabla de personas guarda el identificador de la fila y no el de la cuenta.
- [x] 10.2 Comprobar que dos tablas apuntando a personas por llaves distintas --una por correo, otra por documento-- emparejan las dos.
- [x] 10.3 Comprobar que borrar una fila apuntada deja las filas que la señalaban con el valor visible y sin enlace, y ninguna con las dos columnas vacías. Repetirlo por los tres caminos de borrado.
- [x] 10.4 Comprobar la cascada: una columna declarada así borra las filas que apuntaban, y el aviso previo dice el número correcto.
- [x] 10.5 Comprobar la conversión de 2.1 sobre una tabla con columnas del tipo anterior: cada fila sigue apuntando a la misma persona, y una cuya cuenta se quitó antes conserva su valor.
- [x] 10.6 Comprobar que la tabla de personas rechaza una columna llamada `correo` y que otra tabla la acepta.
- [x] 10.7 Comprobar las tres capas de detección con casos separados: por identificadores tras renombrar el archivo, por columnas exactas sin columna `id`, por nombre técnico, y el empate de dos tablas con la misma etiqueta.
- [x] 10.8 Comprobar la ida y vuelta completa de la tabla de personas: exportar, soltar el archivo, y que se ofrezca importarlo en ella sin crear ninguna tabla.
- [x] 10.9 Comprobar que importar personas enlaza las filas que esperaban, y que un valor que nombra a dos personas y uno aceptado se quedan sin enlazar.
- [x] 10.10 Correr `bun run smoke:relaciones`, `bun run smoke:permisos` y `bun run typecheck`. `smoke:ia` sí hace falta esta vez: el contexto de la IA cambia. Correr solo el caso que cubra "lo mío", no la batería entera.

## 11. Repaso a mano

> Las tres se corrieron como guion contra un servidor vivo, llamando a las mismas funciones del panel que corre el navegador (`matchingTable`, `planDataFile`, `guessPersonColumns`, `tableFromPlan`, `guessPersonFields`, `linkParkedValues`, `waitingFor`) y a la IA de verdad. Lo que no cubren es el clic: los diálogos que ofrecen cada cosa se comprobaron leyéndolos, no pulsándolos.

- [x] 11.1 Correr las cuatro pruebas que originaron el cambio, con las tablas borradas y desde cero: personas y luego chequeos, chequeos y luego personas, personas después de las dos, y chequeos después de las dos.
- [x] 11.2 En cada una, confirmar que la columna nace como relación a la tabla de personas, que las filas sin coincidencia quedan señaladas y no vacías, y que invitar a quien faltaba las enlaza.
- [x] 11.3 Pedirle a la IA una pantalla de "mis chequeos" y otra de "mis excesos" en la misma aplicación, y comprobar que cada una filtra por su llave y que el filtro va en la petición al servidor.
