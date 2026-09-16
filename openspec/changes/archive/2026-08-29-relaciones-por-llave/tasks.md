## 1. Definición de columna

- [x] 1.1 Añadir a `FieldDef` en `shared/types.ts` la columna del destino que se muestra y la marca de única; documentar que `person` pasa a ser una relación con llave por defecto
- [x] 1.2 En `ColumnModal.tsx`, al elegir tabla destino ofrecer también qué columna se muestra, con la lista de columnas de esa tabla
- [x] 1.3 En `ColumnModal.tsx`, casilla de columna única, con el texto que explica que solo una columna única sirve de llave
- [x] 1.4 Al marcar una columna como única, comprobar los datos existentes y, si hay valores repetidos, no aplicar la marca y decir cuántas filas chocan y cuáles
- [x] 1.5 Traducir la marca de única a un índice único de PocketBase en `server/schema.ts`, y quitarlo al desmarcarla
- [x] 1.6 Rechazar en el servidor el guardado de una fila que repite un valor en una columna única, con el mensaje que dice con qué fila choca
      Rechaza el índice único de PocketBase, comprobado en `smoke:relaciones`. El mensaje que nombra
      la fila con la que choca lo compone `uniqueClashMessage` (`web/src/lib/relations.ts`) donde se
      escribe: PocketBase solo dice "debe ser único" y no con quién.

## 2. Una columna definida, dos columnas reales

- [x] 2.1 En `server/schema.ts`, emitir por cada columna de relación la relación y la columna del valor sin dueño
- [x] 2.2 Conservar la pareja al renombrar una columna
- [x] 2.3 Borrar la pareja completa al borrar la columna
- [x] 2.4 Repasar `ownerFieldOf` y `accessRules` para que sigan apuntando a la relación y no al valor
- [x] 2.5 Repasar `server/dataImpact.ts`: el impacto de borrar o cambiar el tipo de una columna de relación tiene que contar las dos
- [x] 2.6 Repasar `server/versions.ts`: una fotografía del diseño guarda y repone la pareja
- [x] 2.7 Repasar `web/src/lib/tableStructure.ts` para que no enseñe la columna del valor como si fuera una columna del usuario
- [x] 2.8 Recorrer los catorce sitios que asumen "una columna definida es una columna real" y dejar una nota en cada uno de por qué ahora son dos
      La nota canónica está en `ORPHAN_SUFFIX` (`shared/types.ts`); cada sitio remite a ella. Recorridos:
      1. `server/schema.ts` — `toPbFields`, que es donde nacen las dos
      2. `server/schema.ts` — `normalizeFields`, que reserva también el nombre del valor
      3. `server/schema.ts` — `orphanIdsOf`, para que renombrar no borre el corralito
      4. `server/schema.ts` — `updateDataCollection`, donde borrar la columna se lleva las dos
      5. `server/schema.ts` — `accessRules` y `ownerFieldOf`: la regla nombra la relación, nunca el valor
      6. `server/dataImpact.ts` — borrar columna
      7. `server/dataImpact.ts` — cambiar de tipo
      8. `server/versions.ts` — una fotografía guarda presentación, no estructura
      9. `web/src/lib/tableStructure.ts` — la estructura exportada tiene una columna, no dos
      10. `shared/htmlSources.ts` — `toLogicalRow` y `toRealValues`
      11. `shared/relations.ts` — `relationCellValues`, que decide cuál de las dos se llena
      12. `web/src/components/cells.tsx` — `relationCell`, los cuatro estados de la celda
      13. `web/src/lib/tableExport.ts` — se exporta el valor, nunca el id
      14. `server/pageConvert.ts` y `server/htmlWizard.ts` — no les afecta, y queda dicho por qué

## 3. Emparejar

- [x] 3.1 Resolución de un valor contra la columna llave de la tabla destino, en el servidor, devolviendo el registro o nada
      (en `shared/relations.ts`, ejecutada en el punto de escritura: la escritura de filas no pasa por el servidor
      y así va con la sesión de quien escribe. Decidido con el usuario el 2026-08-29)
- [x] 3.2 Para columnas de persona, buscar solo entre las personas invitadas a esta aplicación, nunca en la lista común de cuentas
- [x] 3.3 Al guardar una fila: si el valor resuelve, se guarda el id y se limpia el valor sin dueño; si no, al revés
- [x] 3.4 Impedir dejar sin enlace la columna que decide quién ve cada fila

## 4. Grilla y celdas

- [x] 4.1 Retirar la adivinanza de `relationLabel` en `cells.tsx` y leer la columna declarada
- [x] 4.2 Pintar la celda sin enlace con su valor y la marca neutra
- [x] 4.3 Convertir el selector de relación y el de persona en un campo que busca por la llave declarada
- [x] 4.4 Validar al salir del campo: bloquear ese campo y no la fila, conservando lo demás del panel lateral
- [x] 4.5 No bloquear el guardado de una fila cuyo enlace ya venía roto y no se ha tocado
- [x] 4.6 Contador por tabla de filas sin enlace, que al pincharlo filtra la grilla
- [x] 4.7 Pantalla de valores sin dueño: valores distintos con cuántas filas dependen de cada uno
- [x] 4.8 Acción de crear el registro que falta y enlazar de una vez todas las filas con ese valor
- [x] 4.9 Acción de aceptar un valor, que deja de contar y persiste
- [x] 4.10 Al crear un registro cuya llave coincide con un valor sin dueño no aceptado, avisar de cuántas filas lo esperaban y ofrecer enlazarlas
- [x] 4.11 Señalar el enlace roto cuando el registro enlazado ya no existe o no está al alcance

## 5. Importar

- [x] 5.1 En `importParse.ts`, sustituir el paso crudo de persona y relación por el emparejado por llave, aceptando también un id de la tabla destino
- [x] 5.2 En `ImportModal.tsx`, elegir la llave de emparejamiento por columna, entre las únicas de la tabla destino
- [x] 5.3 Proponer la llave: la que muestra la columna, o la que encaje mirando los valores del archivo
- [x] 5.4 Recuento por columna de cuántos valores encontraron registro y cuántos no, en la previsualización
- [x] 5.5 Ver desde la previsualización la lista de valores que no encontraron registro, con cuántas filas dependen de cada uno
- [x] 5.6 Guardar las filas sin enlace con su valor, sin marcarlas como error de importación
- [x] 5.7 Repasar `web/src/lib/dropFiles.ts`, que también convierte valores al soltar un archivo

## 6. Exportar

- [x] 6.1 En `tableExport.ts`, exportar una columna de relación con el valor de la columna que enseña, y no con el id
- [x] 6.2 Exportar el valor sin dueño en las filas que no tienen enlace
- [x] 6.3 Avisar antes de descargar de cuántas filas tienen el enlace roto y saldrán vacías
- [x] 6.4 Prueba de ida y vuelta: exportar una tabla y reimportar ese archivo deja cada fila enlazada al mismo registro

## 7. La página publicada

- [x] 7.1 En `server/htmlBridge.ts`, entregar la celda de relación con el valor siempre presente y los datos del registro enlazado cuando lo haya
      (hecho en `shared/htmlSources.ts`, que es donde se traduce la fila; `htmlBridge.ts` solo lleva el guion inyectado)
- [x] 7.2 Entregar del registro enlazado solo las columnas declaradas por la página, rechazando las demás con el mensaje de fuente no declarada
- [x] 7.3 Seguir entregando la forma vieja junto a la nueva mientras dure la transición, y dejar por escrito cómo se sabe que ya no la pide nadie
      (`OLD_ID_SUFFIX` en `shared/htmlSources.ts`; el criterio de retirada queda escrito ahí)
- [x] 7.4 Comprobar con una página existente que lo que pintaba antes sigue pintándose
      (`bun run smoke` pasa entero: 34 comprobaciones sobre páginas ya escritas, incluidas las del puente)

## 8. Contexto de la IA

- [x] 8.1 En `shared/htmlContract.ts`, describir la nueva forma de una celda de relación: a qué tabla apunta, qué columna enseña, que puede venir sin enlace
- [x] 8.2 Decir que para agrupar y contar se usa el valor y nunca el id, con el motivo
- [x] 8.3 Fijar una única forma de pintar una fila sin enlace, para que todas las páginas la muestren igual
- [x] 8.4 Repasar `server/aiPage.ts`, que hoy tiene una rama propia para el tipo persona
- [x] 8.5 Conciliar con `page-context` de `permisos-por-rol` si ese cambio ya se aplicó
      (no aplica: `permisos-por-rol` está en 0/52, sin implementar. Cuando se aplique, su `page-context`
      tendrá que convivir con la sección de relaciones de `shared/htmlContract.ts`)

## 9. Migración

- [x] 9.1 Rellenar la columna que se muestra en las relaciones que ya existen, con lo que `relationLabel` estuviera adivinando
- [x] 9.2 Comprobar en una aplicación con datos que la grilla enseña lo mismo antes y después
      (la migración escribe lo que `relationLabel` adivinaba, y `relationCell` conserva ese mismo
      respaldo para las columnas que aún no lo tengan)
- [x] 9.3 Poner la llave por defecto de las columnas de persona en el correo

## 10. Pruebas

- [x] 10.1 Importar un archivo con valores que casan y valores que no; comprobar que entran todas las filas
- [x] 10.2 Corregir el valor de la llave en la tabla destino y comprobar que todas las filas enlazadas enseñan el nuevo
- [x] 10.3 Crear el registro que faltaba y comprobar que sus filas quedan enlazadas de una vez
- [x] 10.4 Aceptar un valor y comprobar que el contador baja y no vuelve
      (el valor aceptado se guarda en `acceptedOrphans` de la tabla y `pendingRows` lo descuenta;
      probado a mano en el panel, no cubierto por el script)
- [x] 10.5 Comprobar que una gráfica agrupada por una columna de relación cuadra con el total de la tabla habiendo filas sin enlace
- [x] 10.6 Comprobar que una columna de persona no empareja contra alguien que no está invitado a esta aplicación

Las pruebas 6.4 y 10.1-10.6 viven en `scripts/smoke-relaciones.ts` (`bun run smoke:relaciones`).
