## Por qué

Hoy una columna que apunta a otra tabla enseña lo primero que encuentra. Literalmente: `relationLabel` en `web/src/components/cells.tsx` recorre el registro relacionado y muestra la primera columna de texto que aparece. Añade una columna antes y cambia lo que se ve en toda la grilla. Y en la página publicada ni eso: el documento HTML recibe el id crudo, así que quien escribe `{{conductor}}` pinta `rec_ana8x2k` en pantalla.

Encima, esas columnas no se pueden importar. `convertValue` deja pasar el texto tal cual y PocketBase espera un id de registro, de modo que un CSV de Tránsito con cédulas —el caso más común que existe— no entra de ninguna forma. La única manera de rellenar una columna de persona hoy es elegir a mano, fila por fila, en un selector.

El empleado que arma su pantalla no sabe que existe un id. Lo que él tiene es un archivo con cédulas y placas, y espera seguir viendo cédulas y placas.

## Qué cambia

- **La relación declara qué columna enseña.** Al crear la columna se elige la tabla destino y, dentro de ella, la columna que se muestra: Conductor se ve por documento, Vehículo se ve por placa. Deja de decidirlo el orden de las columnas.
- **Se guarda el id, se ve y se escribe la llave.** El enlace real sigue siendo el id del registro, que es lo que sostiene los permisos y lo que hace que corregir un dato en la tabla destino se propague solo. Lo que se ve, se exporta y se escribe es la columna elegida. Que debajo viva un id no aparece en ninguna pantalla.
- **Columnas únicas.** Una columna puede marcarse como única. Solo las únicas sirven de llave: si dos personas se llaman igual, el nombre no identifica a nadie.
- **Emparejar al importar.** Un archivo con cédulas se conecta solo. La llave se propone —la de mostrar, o la que encaje con los valores que llegan— y se puede cambiar para ese archivo sin tocar lo que enseña la grilla.
- **Un valor sin dueño es un estado válido, no un error.** El exceso de velocidad ocurrió aunque esa cédula no esté en la lista: la fila entra completa y el valor se conserva a la vista. Se marca en neutro, no como avería.
- **Conectar o dejar así.** Los valores sin dueño se agrupan por valor, no por fila: tres cédulas, no veinte filas. Cada una se resuelve invitando a esa persona —y sus filas se conectan de una vez— o aceptándola, y deja de contar.
- **La página recibe las dos cosas.** Una celda de relación llega al documento con la llave siempre presente y los datos del registro destino, vacíos cuando no hay enlace. La página pinta el exceso y la gráfica igual; solo el nombre sale en blanco.
- **Las gráficas se agrupan por la llave.** Como la llave está siempre, las filas sin dueño siguen sumando en los totales. Agrupar por id las dejaría caer en silencio y el total no cuadraría con la tabla.

### Fuera del alcance

- **Columnas propias de la persona** (documento, área, cargo). Sin ellas la única llave disponible para una columna de persona es el correo, que ya existe. Es el cambio `personas-como-tabla`, que se apoya en este.
- **Alcance por rol.** `permisos-por-rol` va por su cuenta; aquí solo se respeta que el enlace siga siendo un id para que aquella regla tenga suelo.
- **Relaciones múltiples por llave.** Una columna que apunta a varios registros se sigue rellenando a mano.
- **Deshacer una importación.**

## Capacidades

### Capacidades nuevas

- `table-relations`: cómo una columna de relación declara qué columna del destino enseña, cómo se empareja un valor con un registro, qué pasa cuando no hay coincidencia y cómo se resuelve después.

### Capacidades modificadas

- `builder/tables`: importar y exportar dejan de tratar las columnas de persona y relación como texto sin convertir; se emparejan por llave, se cuentan las coincidencias antes de guardar y se avisa de los enlaces rotos al exportar.
- `html-pages`: se fija la forma en que una celda de relación llega al documento HTML, en lugar del id crudo de hoy.
- `page-context`: la IA y la documentación pasan a decir que una relación puede venir sin resolver, qué campo usar para agrupar y cómo se pinta una fila sin enlace.

## Impacto

- **Definición de columna**: `FieldDef` gana la columna que se muestra y la marca de única. El tipo `person` pasa a ser una relación a la tabla de personas con una llave por defecto, y deja de tener camino propio.
- **Base de datos**: una columna de relación pasa a ocupar dos columnas reales, la relación y el valor sin dueño. Los catorce sitios de `server/schema.ts`, `server/dataImpact.ts`, `server/versions.ts` y `server/htmlBridge.ts` que asumen que una columna definida es una columna real hay que revisarlos uno a uno.
- **Grilla y celdas**: `relationLabel` deja de adivinar; el selector pasa a buscar por la llave.
- **Importar**: recuento de coincidencias en la previsualización y pantalla de valores sin dueño.
- **Exportar**: aviso de enlaces que ya no resuelven, que hoy salen como celda en blanco sin decir nada.
- **Puente de datos de la página publicada**: cambia la forma de una celda de relación. Es la parte que puede romper páginas ya escritas.
- **Riesgo principal**: una página existente que hoy pinta el id crudo pasa a recibir otra cosa. Hay que decidir si se conserva la forma vieja y por cuánto tiempo.
