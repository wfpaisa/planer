## Por qué

La lista de personas es la única lista del producto que no tiene columnas. Una tabla cualquiera se puede ampliar, importar, exportar, ordenar y filtrar; de una persona solo se guardan correo, nombre y foto, y para siempre. Si el área de nómina necesita la cédula, el área o el cargo, no hay dónde ponerlos.

Eso convierte en imposibles cosas que no tienen nada de raro: dar de alta a doscientos empleados desde el Excel que ya existe, sacar el directorio para otro sistema, o conectar la tabla de excesos de velocidad --que viene con cédulas-- con las personas de la aplicación. `relaciones-por-llave` deja resuelto el mecanismo de emparejar por una columna única, pero en la lista de personas la única columna única que hay es el correo. La cédula no existe todavía.

Y hay un límite que no se puede saltar: la lista de cuentas es común a todas las aplicaciones. Lo que el área de nómina sepa de una persona no puede aparecer en la aplicación del taller que tiene a esa misma persona invitada.

## Qué cambia

- **Personas es una tabla de la aplicación.** Con su cuadrícula, sus columnas, su buscador y su panel lateral, como cualquier otra. Deja de ser una pantalla aparte con su propia forma de hacer las cosas.
- **Columnas propias, por aplicación.** Documento, apellido, área, cargo: las que haga falta, con los tipos que ya existen. Viven en la aplicación que las creó y no se ven desde otra, aunque la persona sea la misma.
- **Columnas del sistema, que no se pueden borrar.** La cuenta (el correo con el que entra), lo que puede hacer con los datos y los roles con los que ve las pantallas siguen siendo del sistema. Se muestran en la cuadrícula pero no se quitan ni cambian de tipo.
- **Importar personas.** Un Excel de nómina da de alta a doscientos empleados de una vez, creando sus cuentas. Cuántas se van a crear se dice antes, no después.
- **Exportar personas.** Con una excepción que no se negocia: **la contraseña nunca sale**. Es el único dato del producto que no se puede leer, y un CSV con contraseñas es una fuga.
- **La contraseña se sigue tratando aparte.** Se pone o se cambia desde la fila, se enseña una sola vez y no se guarda en ningún sitio de donde se pueda volver a leer. No es una columna.
- **Cualquier columna puede marcarse como única.** Y con eso la cédula pasa a ser una llave: la tabla de excesos se importa con cédulas y se conecta sola, por el mecanismo que ya trajo `relaciones-por-llave`.
- **Los roles siguen donde están.** La pantalla de personas y roles conserva el bloque de roles arriba; lo que cambia debajo es la lista.

### Fuera del alcance

- **El mecanismo de emparejar por llave.** Es `relaciones-por-llave`, del que este cambio depende por completo.
- **Alcance por rol sobre la tabla de personas.** Quién ve qué filas de personas se decide con `permisos-por-rol`.
- **Jefe y equipo.** Una relación de una persona con otra persona es un cambio aparte.
- **Permiso por columna.** Que el salario lo vea nómina y no el resto llega después; aquí el permiso llega a la fila.
- **Que la persona edite sus propios datos.**

## Capacidades

### Capacidades nuevas

- `builder/people`: la lista de personas de una aplicación como tabla --columnas propias, columnas del sistema, importar, exportar, contraseñas-- y qué separa los datos de una aplicación de los de otra que comparte a la misma persona.

### Capacidades modificadas

- `table-relations`: una columna de persona pasa a poder emparejarse por cualquier columna única de la tabla de personas, no solo por el correo.

## Impacto

- **Modelo de datos**: los datos propios de la persona en una aplicación pasan a vivir en una colección por aplicación, enlazada a la cuenta común. La cuenta sigue conservando correo, nombre y contraseña; lo demás es de la aplicación.
- **`PeoplePanel.tsx`**: 557 líneas de formulario que pasan a ser una cuadrícula. Se conserva lo de las contraseñas, que no tiene equivalente en una tabla normal.
- **API de personas**: `/api/apps/:id/members` y `/api/apps/:id/personas` devuelven hoy una forma corta y fija. Pasan a llevar las columnas de la aplicación.
- **Editor de tablas**: la tabla de personas aparece junto a las demás, con las columnas del sistema que no se pueden tocar.
- **Columnas de tipo persona en otras tablas**: pasan a poder mostrar y emparejar por cualquier columna única.
- **Riesgo principal**: que un dato de una aplicación se vea desde otra que comparte a la misma persona. Los datos en juego son de empleados reales --cédula, área, cargo, salario-- y la separación tiene que estar probada, no supuesta.
- **Riesgo segundo**: exportar una contraseña. Tiene que ser imposible por construcción, no evitado por cuidado.
