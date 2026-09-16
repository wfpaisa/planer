## Context

Ver `proposal.md` para el porqué. El estado del que se parte:

- `members` es una colección de cuentas **común a todas las aplicaciones** (`server/bootstrap.ts`). Tiene correo, nombre, foto y contraseña, y nada más.
- Lo que es de cada aplicación vive en `app_access`: el enlace aplicación-persona, lo que puede hacer con los datos y los roles con los que ve las pantallas.
- `PeoplePanel.tsx` son 557 líneas de formulario: un campo de correo, un desplegable de nivel y filas apiladas. No comparte nada con la cuadrícula de tablas.
- `/api/apps/:id/personas` devuelve una forma corta y fija --id, nombre, correo, nivel, roles-- que consume el panel y la aplicación publicada.
- Este cambio **depende por completo** de `relaciones-por-llave`: el mecanismo de columna única, columna que se muestra y emparejado por llave viene de ahí.

## Goals / Non-Goals

**Goals:**

- Que la lista de personas no sea un caso especial del producto.
- Que lo que una aplicación sabe de una persona no llegue a otra, por construcción y no por cuidado.
- Que la contraseña no pueda salir en una exportación aunque alguien se equivoque.

**Non-Goals:**

- El mecanismo de emparejar por llave.
- Que la persona edite sus propios datos.
- Permiso por columna, ni relaciones de una persona con otra.

## Decisions

### Los datos propios viven en una colección por aplicación

La cuenta común conserva lo que hace falta para entrar: correo, nombre y contraseña. Todo lo demás --documento, área, cargo-- vive en una colección propia de la aplicación, enlazada a la cuenta.

**Por qué.** Es lo único que hace cierta la separación entre aplicaciones sin depender de que nadie se acuerde de filtrar. Nómina y el taller pueden tener a la misma persona y no compartir una sola columna.

**Alternativas descartadas.**

- *Columnas en la cuenta común.* Se filtra todo entre aplicaciones y los nombres de columna chocan entre clientes distintos. Descartada de entrada.
- *Un JSON de datos sueltos dentro de `app_access`.* Barata y no se filtra, pero un JSON no lleva índice: sin índice no hay columna única, sin columna única no hay llave, y sin llave este cambio no sirve para lo que se pide. Además obligaría a reescribir la cuadrícula, el importar y el exportar en vez de reutilizarlos.

### Personas es una tabla de verdad, no una que se le parece

Con su colección, sus columnas y su registro en la lista de tablas. Así la cuadrícula, `ColumnModal`, `ImportModal`, `tableExport` y el panel lateral se apuntan a ella en vez de reescribirse, y una relación a personas es una relación como cualquier otra.

**Coste.** Hay que impedir en la tabla de personas lo que en las demás está permitido: borrar la tabla, borrar o cambiar de tipo las columnas del sistema, y renombrarlas. La cuadrícula pasa a tener que saber que una columna puede ser intocable, que no es un concepto que hoy exista.

### Las columnas del sistema son columnas de verdad, marcadas

La cuenta, el nivel y los roles se ven y se editan en la cuadrícula como cualquier columna, con una marca que impide borrarlas y cambiarlas de tipo. Editarlas escribe donde ya escribe hoy: el nivel y los roles en `app_access`, el correo en la cuenta.

**Por qué no dejarlas fuera de la tabla.** Si la cuadrícula no las enseña, hay que mantener a su lado la pantalla vieja para tocarlas, y volvemos a dos formas de hacer lo mismo.

**Y se juntan al pintar, no al guardar.** La cuadrícula lee hoy de una sola colección (`pb.collection(table.dataCollection)`). Las tres columnas del sistema no están ahí: el correo vive en la cuenta común y el nivel y los roles en `app_access`. La cuadrícula pide las dos cosas y las superpone sobre cada fila; al editar, una celda del sistema escribe por la ruta que ya existe y una columna propia escribe directo a la colección de la aplicación, como en cualquier tabla.

**Alternativas descartadas.**

- *Copiar el correo y el nivel a la colección de la aplicación.* La cuadrícula no se enteraría de nada, pero el mismo dato quedaría en dos sitios para siempre. Y no se sostiene: la escritura va directa del navegador a la base, así que cambiar el nivel en una celda no llegaría a `app_access` sin pasar igual por el servidor. Se paga la duplicación y no se ahorra el reparto.
- *Leer y escribir toda la tabla de personas por el servidor.* Mas limpio de modelo, pero obliga a que la cuadrícula, el panel lateral, el importar y el exportar acepten un origen de datos distinto del que tienen hoy. Es justo la reutilización que este cambio buscaba.

El reparto no es trabajo de más: la cuadrícula tiene que aprender igualmente que una columna puede ser intocable, y esa misma marca es la que decide por dónde escribe cada celda.

### La contraseña no pasa por la tabla en ningún momento

No es una columna ni se puede crear una que la contenga. Se pone y se cambia desde la fila, por el camino que ya existe, y se enseña una sola vez.

**Y la exportación no la conoce.** No es que se filtre al exportar: es que no está entre lo que la exportación puede leer. Un fallo en el filtro no debe poder convertirse en una fuga.

### Importar puede crear cuentas, pero nunca por defecto

Dar de alta a doscientos empleados desde el Excel de nómina es medio producto para una empresa. También convierte un dedazo en una persona fantasma con cuenta. Se dice cuántas se van a crear antes de guardar y hay que marcarlo a mano en cada importación.

### La API de personas pasa a llevar las columnas de la aplicación

`/api/apps/:id/personas` devuelve hoy una forma fija. Pasa a llevar también las columnas propias, que es lo que permite que una página publicada enseñe el área o el cargo de alguien.

**Sigue rigiendo el límite de siempre:** solo llega lo que la página tenga declarado. La tabla de personas no es una puerta trasera para leer columnas que nadie declaró.

## Risks / Trade-offs

- **Que un dato se vea desde otra aplicación** → Es el riesgo que manda. Los datos son de empleados reales. Hace falta una prueba explícita con la misma persona invitada a dos aplicaciones, no la confianza en que el modelo lo impide.
- **Que una contraseña salga en una exportación** → Se evita porque la exportación no puede leerla, no porque se filtre.
- **Quitar el acceso borra los datos de esa aplicación** → Es lo correcto y es irreversible. Tiene que decirse antes de confirmar, con qué se pierde.
- **La tabla de personas no se puede borrar** → Un concepto nuevo en el editor de tablas, que hoy asume que cualquier tabla se borra.
- **Depende de `relaciones-por-llave`** → Si aquel cambia de forma, este se resiente entero. No conviene empezarlo antes de que el primero esté cerrado.

## Migration Plan

1. Crear la colección de datos propios por aplicación, vacía, con el enlace a la cuenta. Nadie lo nota.
2. Registrar personas como tabla del sistema en las aplicaciones que ya existen, con solo las columnas del sistema.
3. Sustituir el panel por la cuadrícula. La pantalla de personas y roles conserva el bloque de roles arriba.
4. Importar y exportar.
5. Ampliar la API de personas con las columnas propias, conservando la forma corta mientras alguien la use.

Vuelta atrás: hasta el paso 2 no se ve nada. El paso 3 se revierte volviendo al panel, que hasta entonces conviene no borrar.

## Open Questions

- Qué pasa con el nombre: si `apellido` es una columna propia más o si el nombre de la cuenta se parte en dos. Lo primero no rompe nada; lo segundo obliga a migrar la cuenta común y a decidir cómo se arma la etiqueta que se enseña en todo el producto. Se puede responder al llegar al paso 2 sin cambiar specs ni tareas.
**Resuelta:** la tabla de personas aparece en los dos sitios. En la lista de tablas del editor como una más, y en la pantalla de personas y roles con el bloque de roles arriba y esa misma cuadrícula debajo. Se llega por donde ya se llegaba y además por donde están las demás tablas. Es lo que hace cierto que sea una tabla y no una que se le parece: se relaciona, se importa y se exporta desde el mismo sitio que el resto. Lo que se le quita en la lista es lo que no tiene: borrarla, duplicarla y cambiarle el nombre.
