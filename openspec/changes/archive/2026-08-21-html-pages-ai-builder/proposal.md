## Why

Hoy una pantalla se arma con bloques de configuracion (tabla, tarjetas, formulario, ficha, indicadores, texto). Cada bloque impone su propio diseno, asi que el constructor solo puede pedir lo que el bloque sabe dibujar. La IA hereda ese techo: genera configuracion valida, pero nunca una pantalla distinta de las seis que existen.

El objetivo es quitar ese techo. Una pagina pasa a ser un documento HTML completo que escribe la IA sin restricciones de diseno, con la base de datos, las personas y los permisos de Planer detras. El bloque de HTML ya demostro que el modelo funciona: se dibuja aislado, pide datos por un puente y solo puede tocar las tablas que declara. Esta propuesta lo sube de bloque a pagina y retira el constructor por bloques.

## What Changes

**El modelo de pagina**

- **BREAKING** Una pagina deja de ser una lista de bloques y pasa a ser un documento HTML.
- Cada pagina declara que tablas usa. Lo no declarado no se puede pedir: la lista es permiso y es bandera de dependencia a la vez.
- Cada pagina se sirve con dos archivos inyectados por referencia, no pegados: uno de estilos y otro de navegacion y datos. Cada linea inyectada lleva un comentario corto que dice para que sirve, y si al guardar falta alguna, el sistema la repone y lo avisa.
- Siempre existe una pagina de inicio y no se puede borrar.
- Permisos por pagina en tres niveles: cualquiera, cualquiera con sesion, o solo ciertos roles.

**El contexto unico**

- Un solo texto describe colores, espaciados, tablas, ordenes de datos, quien esta mirando y lo prohibido. De el salen dos cosas: la documentacion para el constructor y el contexto que recibe la IA.
- Se arma en el momento de cada peticion, nunca se guarda dentro del documento: un contexto congelado se queda viejo en cuanto cambia una tabla.

**La superficie del constructor**

- Barra Todo En Uno flotante, visible solo para quien construye: campo de texto, boton de IA, compartir, ajustes de la app y ajustes de la pagina. Centrada si la pagina esta vacia, abajo si tiene contenido. Los dialogos crecen desde la barra y se encogen hacia ella al cerrarse.
- Sidebar de navegacion visible para todos, con crear, borrar y permisos ocultos al visitante.
- Compartir ofrece dos enlaces, el de la app y el de la pagina, cada uno con quien puede abrirlo.

**La IA**

- Una sola puerta: escribir en el campo de la barra abre el dialogo con ese texto dentro; el boton abre una conversacion nueva.
- Las conversaciones pertenecen a la app y recuerdan en que pagina se hicieron.
- La IA toca solo la pagina abierta. La unica excepcion la autoriza el constructor en el dialogo de impacto.

**La base de datos**

- Los cambios sin riesgo (crear tabla, anadir columna, renombrar columna) se aplican sin preguntar.
- Los que pueden romper algo (borrar o cambiar el tipo de una columna o una tabla) abren un dialogo con el impacto: que quiere, para que, que paginas la usan y que salidas hay. El aviso es instantaneo y solo nombra las paginas; el detalle de para que se usa se consulta a la IA si el constructor lo pide.
- Todos los cambios de una peticion se muestran en una sola pregunta, y lo aceptado queda como un solo paso del historial.

**Retiradas**

- **BREAKING** Se retiran los bloques de tabla, tarjetas, formulario, ficha, indicadores y texto, su inspector, su revision de referencias y las ordenes de IA que los generaban.
- Se conservan el marco aislado, el guardado por contenido, el puente con la base de datos, la traduccion de nombres de columna, la importacion de HTML, y las tablas, personas y roles.

## Capabilities

### New Capabilities

- `html-pages`: La pagina como documento HTML aislado, con su pagina de inicio, sus archivos inyectados, su lista de tablas declaradas y sus tres niveles de permiso.
- `page-context`: El texto unico que describe colores, espaciados, tablas, ordenes y limites, del que salen la documentacion del constructor y el contexto de la IA.
- `app-navigation`: El sidebar de paginas, con lo que ve el visitante y lo que ve solo quien construye.
- `builder-omnibar`: La barra Todo En Uno, sus dos iconos de ajustes, el dialogo de compartir y la forma en que los dialogos nacen y vuelven a la barra.
- `ai-authoring`: La entrada unica a la IA, las conversaciones por aplicacion y el alcance de una pagina por peticion.
- `data-impact`: La clasificacion de los cambios de base de datos por riesgo y el dialogo de impacto que decide el constructor.

### Modified Capabilities

- `app-versions`: Una version pasa a guardar el HTML de cada pagina y la forma de las tablas, en vez de la lista de bloques de cada pagina.
- `block-checks`: Se retiran todos sus requisitos. La deteccion de referencias rotas pasa a `html-pages` (tablas declaradas) y a `data-impact` (aviso antes de romper).

## Impact

- **Datos**: las paginas guardan la huella de un documento HTML y su lista de tablas, no una lista de bloques. Las versiones existentes quedan sin equivalente directo.
- **Servidor**: el puente de datos y el guardado por contenido suben de bloque a pagina; la revision de bloques se retira; el contexto se genera en cada peticion de IA.
- **Panel**: se retiran el constructor por bloques, el inspector y el panel de revision; se anaden la barra Todo En Uno, el sidebar y los dialogos.
- **IA**: cambian las ordenes disponibles; deja de emitir configuracion de bloques y pasa a escribir HTML y a pedir permiso antes de tocar la base de datos.
- **Documentacion**: el README recibe la seccion de como conectarse a la base de datos desde el HTML, generada del mismo texto unico que alimenta a la IA.
- **Sin cambios**: tablas, filas, personas, roles y reglas de acceso de la base de datos.
