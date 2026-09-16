## Por qué

Hoy una tabla tiene un solo dueño: la columna de tipo persona decide quién alcanza cada fila, y esa decisión vale igual para todo el mundo. Eso sirve para "cada quien ve lo suyo" y para nada más.

En cuanto una misma tabla tiene que comportarse distinto según quién mire --el gestor ve todas las multas y cada conductor sólo las suyas; el callcenter trabaja toda la agenda y cada odontólogo sólo sus atenciones-- no hay forma de decirlo. Y filtrar desde el HTML no vale: la página decide qué se pinta, pero la base decide qué se entrega, y lo que se entrega ya viajó al navegador de quien mira.

Al revisar veinte aplicaciones típicas de una empresa, esta carencia aparece en dieciséis. No es una mejora: es lo que separa "publicar información" de "que un área trabaje con sus datos". El registro de producto acaba de fijar que el usuario de Planer es el empleado que construye su propia pantalla sin pasar por tecnología; sin esto, ese empleado no puede armar casi nada de lo que su área necesita.

## Qué cambia

- **Alcance por rol.** Cada tabla puede decir, para cada rol de la aplicación, qué filas alcanza: `todas`, `las mías` (nombrando la columna que conecta la fila conmigo) o `ninguna`.
- **Leer y escribir se dicen por separado.** Un rol puede ver todas las reservas de salas y mover sólo la suya. Hasta ahora se asumía un único alcance para las dos cosas.
- **Escalera de acciones.** Lo que un rol puede hacer se elige de una escalera de cinco peldaños con nombre: `nada`, `consultar`, `registrar` (añadir sin cambiar lo añadido), `trabajar` y `administrar` (incluye borrar). Resuelve dos casos que hoy no se pueden expresar: leer sin poder borrar, y añadir sin poder editar después.
- **BREAKING: el permiso lo aplica el servidor.** Hoy el navegador habla directo con la base y el permiso vive en una regla escrita dentro de ella. Con cuatro roles que alcanzan cosas distintas esa regla crece y se vuelve frágil. Las órdenes de datos de una página pasan a resolverse en el servidor, que sabe quién pregunta y con qué roles. El principio de producto "los permisos se aplican en el servidor, no escondiendo cosas en el navegador" pasa a ser cierto al pie de la letra.
- **Sin configurar hasta que haga falta.** Una tabla nueva no pregunta nada y se comporta como hoy. El ajuste por rol es un añadido que se abre sólo cuando el usuario lo necesita.
- **La verificación es una frase.** Debajo del ajuste, el sistema escribe en español qué quedó puesto ("El callcenter trabaja todas las agendas. Cada odontólogo trabaja las suyas."). El empleado confirma leyendo, no interpretando una cuadrícula.
- **Ver la página como otro rol.** Desde el constructor se puede mirar una pantalla con los ojos de un rol, sin cerrar sesión.
- La IA recibe en su contexto qué alcanza cada rol en cada tabla, y puede proponer esos ajustes al escribir una página.

### Fuera del alcance

Quedan fuera a propósito, y cada uno merece su propio cambio:

- **Quién es mi jefe** y el alcance "las filas de mi gente".
- **Solicitar y aprobar**: que los permisos de una fila dependan del paso en que esté.
- **Columnas que no todos ven**: el permiso llega a la fila, no a la columna.
- **Empate por valor** (conectar por cédula o correo en vez de por relación directa). El modelo de alcance se define de forma que quepa después sin rehacerlo.
- **Respuestas anónimas.**

## Capacidades

### Capacidades nuevas

- `access-control`: qué filas de una tabla alcanza cada rol y qué puede hacer con ellas; cómo se aplica en el servidor; el resumen en español y la vista previa por rol.

### Capacidades modificadas

- `page-context`: el contexto que reciben la IA y la documentación pasa a incluir qué alcanza cada rol en cada tabla, para que una página no se escriba pidiendo datos que nunca le van a llegar.

## Impacto

- **Definición de tabla**: se añade el ajuste por rol junto a la columna de dueño actual, que se conserva como el caso simple.
- **Reglas de la base**: dejan de expresar la lógica de roles y pasan a cerrar el acceso directo. La base deja de ser el sitio donde se decide.
- **Camino de datos de las páginas publicadas**: hoy el navegador consulta la base con la sesión de quien mira; pasa a consultar al servidor. Afecta a las órdenes `listar`, `obtener`, `crear`, `actualizar` y `borrar`.
- **Editor de tablas**: pantalla nueva de "quién ve qué", con el resumen en español.
- **Constructor de páginas**: vista previa por rol.
- **Contexto de la IA**: texto nuevo que describe el modelo de alcance.
- **Riesgo principal**: un alcance mal traducido deja ver filas ajenas, y los datos en juego son reales (llamados de atención, nómina, pacientes). Hace falta una batería de pruebas que compruebe, rol por rol, que nadie alcanza la fila de otro.
