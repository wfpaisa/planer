## Context

Ver `proposal.md` para la motivacion.

Lo que ya existe y condiciona el diseno:

- **Bloques como configuracion.** `PageRecord.blocks` es JSON puro. `render.tsx` lo dibuja igual en el editor, en la vista previa y en la app publicada, con `showIssues` como unica diferencia.
- **Historial de versiones.** Cada publicacion o punto de guardado copia `blocks` entero dentro de `DesignSnapshot`, con un tope de 30 versiones por app. Todo lo que engorde un bloque se multiplica por 30.
- **Una version guarda presentacion, nunca datos.** Restaurar no puede crear, borrar ni cambiar columnas.
- **Revision de bloques.** `reviewDesign()` recorre los bloques buscando tablas y columnas que ya no existen. Los bloques actuales guardan **nombres** de columna, por eso hace falta el arreglo automatico al renombrar.
- **Reglas de acceso en la base.** Cada tabla `d_*` lleva sus propias reglas: publica o privada, rol del miembro, dueno por fila. Ningun cliente puede leer mas de lo que le toca, venga de donde venga la peticion.
- **Dos sesiones.** El editor usa el cliente del constructor; la app publicada usa el del miembro. `RuntimeProvider` ya entrega el correcto.
- **IA opcional.** La clave vive solo en el servidor y puede no estar configurada.
- **Sin framework de pruebas.** La verificacion es `bun run typecheck` mas `bun run smoke`.

El archivo de referencia que motivo esto (`inventario.html`, 2.450 lineas, 117 KB) tiene sus ~20 colores en un unico bloque `:root` y toca el guardado del navegador en 5 puntos. Es el caso favorable, y aun asi es demasiado grande para que una IA lo reescriba de una sola vez.

## Goals / Non-Goals

**Goals:**

- Ejecutar HTML de terceros sin que pueda tocar la sesion de quien mira la pantalla.
- Que el HTML sobreviva a que renombren tablas y columnas.
- Que un archivo grande no engorde el historial ni el paquete que descarga cada visitante.
- Que la varita magica funcione sobre un archivo de 100 KB con el presupuesto de tokens actual.
- Que importar y guardar funcione sin IA configurada.

**Non-Goals:**

- Un editor de codigo completo dentro de Planer. Basta un area de texto con el codigo.
- Paginas o aplicaciones enteras en HTML. Esto es un bloque dentro de una pagina normal.
- Guardar bloques HTML como libreria reutilizable entre apps.
- Que la IA interna genere bloques HTML desde cero. Aqui solo adapta lo que llega importado.
- Reescribir los bloques existentes para que referencien columnas por id.

## Decisions

### 1. El HTML corre en una caja aislada sin origen propio

Se dibuja en un marco con `sandbox="allow-scripts"` y **sin** `allow-same-origin`. El documento queda con origen opaco: no alcanza el almacenamiento local, ni las cookies, ni el token de la sesion, ni el resto de la pagina.

Alternativas descartadas:

| Opcion | Por que no |
|---|---|
| Dibujarlo dentro de la pagina | Cualquier HTML pegado podria leer la sesion del visitante. Inaceptable con invitados. |
| Dibujarlo dentro de la pagina, limpiando el codigo | Mata la mitad de los casos de uso: nada interactivo. |
| Estilos aislados sin aislar el codigo | Protege el diseno, no la sesion. Resuelve el problema equivocado. |

El coste es que hay que inyectar los estilos y medir la altura a mano. Se asume.

### 2. El documento se sirve por su huella, no viaja dentro del bloque

El contenido se guarda en una coleccion interna nueva, `html_docs`, con la huella `sha256` del contenido como clave unica. El bloque guarda la huella, no el contenido.

Esto resuelve tres cosas a la vez:

- **Historial.** Treinta versiones del mismo documento guardan treinta huellas, no treinta copias de 117 KB.
- **Paquete publico.** `AppBundle` lleva la huella. El documento lo pide el marco aparte, y solo el de la pagina que se esta viendo.
- **Cache.** El navegador se queda con el documento y solo pregunta si cambio.

Lo guardado es inmutable, pero lo que se sirve no es solo lo guardado: lleva ademas el puente, y ese si cambia. Por eso la marca de cache junta las dos huellas y el documento se revalida en vez de guardarse para siempre. Con cache permanente, arreglar un fallo del puente no habria llegado nunca a un bloque que el navegador ya tuviera; con revalidacion, el cuerpo solo viaja cuando de verdad cambio.

Se reutiliza `hashSnapshot`/`stable` como referencia de estilo, pero la huella del documento es de su texto crudo.

**Recorte.** Un documento se borra cuando ni el borrador ni ninguna version superviviente lo nombran. Corre justo despues de `pruneVersions()`, en el mismo camino. Asi se respeta "restaurar nunca pierde presentacion": mientras una version lo nombre, el documento sigue ahi.

Alternativa descartada: guardar el HTML dentro del bloque. Mas simple de escribir, pero multiplica el peso por el numero de versiones y obliga a descargar todos los documentos de la app en cada visita.

### 2b. Lo inyectado nunca vuelve a guardarse

El documento se guarda siempre tal como lo escribio el constructor; el puente y la hoja base se anaden al servir y **nunca** entran en el almacenamiento. Por eso el editor de codigo trabaja sobre el contenido **crudo**, no sobre lo que se sirve: cargar y guardar lo envuelto embebe la inyeccion en el documento, y envolverlo de nuevo en la siguiente visita la duplica y engorda el bloque con cada ciclo.

Si lo que se va a guardar ya trae los nodos inyectados (por un error anterior), se reemplazan en lugar de acumularse: envolver ha de ser idempotente, reconociendo la huella de sus propios nodos (`data-plane`) y sustituyendolos por la version actual.

### 3. El manifiesto traduce nombres logicos a ids

El bloque declara sus fuentes:

```
fuente "equipos"  →  tabla abc123
                      columna "nombre" → id fld_9f2
                      columna "estado" → id fld_a41
```

El HTML solo conoce los nombres logicos. El puente traduce en ambos sentidos: al pedir datos traduce el nombre logico a la columna real de hoy, y al devolver las filas las entrega con los nombres logicos.

Consecuencia importante: **el bloque HTML es inmune a los renombrados por construccion.** Los ids no cambian cuando se renombra una columna, asi que no necesita el arreglo automatico que si necesitan los otros bloques. En la revision solo participa reportando lo que desaparecio de verdad.

Alternativa descartada: que el HTML use los nombres tecnicos reales. Obliga a reescribir el codigo del bloque cada vez que alguien renombra algo, y a hacerlo por reemplazo de texto, que es exactamente donde estas cosas se rompen en silencio.

### 4. Los datos viajan por mensajes, nunca por acceso directo

Dentro del marco vive un objeto `plane` con cinco ordenes: `listar`, `obtener`, `crear`, `actualizar`, `borrar`. Cada llamada es un mensaje al panel; el panel la resuelve con el cliente que corresponda (constructor o miembro) y responde.

Tres cosas se comprueban en el panel antes de resolver:

1. La fuente esta declarada en el manifiesto de ese bloque. Un HTML no puede pedir una tabla que no declaro.
2. Los filtros y el orden se arman traduciendo nombres logicos. El HTML no compone texto de filtro libre.
3. Las reglas de acceso de la tabla siguen aplicando. El puente no eleva permisos: usa la misma sesion que el resto de la pantalla.

El mensaje se identifica por la referencia a la ventana del marco, no por el origen, porque un marco sin origen propio se anuncia como `null`.

Alternativa descartada: que el HTML llame directo a la base. El texto de instrucciones para la IA se vuelve largo y lleno de detalles internos, el HTML viejo se rompe cuando cambie la plataforma, y haria falta el token dentro del marco.

### 5. Los estilos llegan por mensaje, no incrustados en el documento

Al servirse, el documento se envuelve unicamente con el guion del puente, que es corto y siempre igual. Los colores no se incrustan: el panel los manda por mensaje al cargar y cada vez que cambian.

El guion escribe las variables en la raiz del documento y marca el modo claro u oscuro. Asi el documento guardado depende solo de su huella y la cache inmutable sigue siendo valida aunque la app cambie de paleta.

Se manda tambien una hoja base corta (tipografia, botones, tarjetas, tablas) para que un HTML sin estilos propios ya se vea nativo.

Alternativa descartada: incrustar los colores al servir. Obliga a invalidar la cache por cada combinacion de app y tema.

### 5b. La hoja base pone el fondo de la aplicacion

El canvas de un marco aislado es **opaco**: aunque `html` y `body` digan `transparent`, el iframe no deja ver la pagina que hay detras y pinta el fondo por defecto del navegador, que es blanco. "Dejar transparente" no alcanza para que el bloque se parezca a la aplicacion; hace falta pintar la pagina por dentro.

La hoja base pone `html { background: var(--surface-page) }` (la raiz toma el color de la pagina) y deja el `body` transparente. Los estilos del documento llegan despues en el mismo documento y con la misma especificidad, asi que un contenido que quiera su propio fondo puede sobreescribirlos; el que no, se ve del color de la pagina, sin blancos a la vista.

`--surface-page` se define en la raiz cuando llega el mensaje de tema (ver 5). Antes de eso la variable no existe y el valor cae a `transparent`, que es justo lo que hace falta para que ni siquiera haya un parpadeo blanco al cargar.

### 6. La altura la reporta el propio marco

El guion del puente observa el tamano del documento y avisa al panel, que ajusta la altura del marco. Con tope maximo configurable en el bloque, para que un documento con desbordamiento no crezca sin fin.

Se mide **el cuerpo, nunca el elemento raiz**: la raiz siempre ocupa al menos lo que mide el marco, asi que midiendola un contenido corto no podria encoger y quedaria un hueco vacio debajo.

El panel registra su oyente una sola vez, no en cada dibujado. El puente no repite una altura que ya mando, asi que un mensaje que llegue mientras el oyente se esta reemplazando se pierde para siempre.

La altura vive mientras vive el documento que la reporto. Si el marco deja de tener ese documento delante (ver 6c), el panel vuelve al alto de partida y espera la medida del documento restaurado: quedarse con el ultimo valor recibido deja el bloque clavado en el alto de una pagina que ya no es la suya.

### 6b. Un contenido que guarda por su cuenta no se rompe

Dentro del marco no hay almacenamiento propio, y leerlo lanza un error que se lleva por delante el resto del guion del documento: el bloque quedaria en blanco y lo unico visible seria un error tecnico en la consola.

El puente instala uno de mentira, en memoria, antes de que corra nada del documento. Asi un archivo importado funciona desde el primer momento, que es justo lo que hace util pegar algo y verlo. No guarda nada de verdad, y en cuanto el documento escribe algo se avisa al constructor para no dejarle creer que si.

Alternativa descartada: dejar que falle y confiar en que la varita lo arregle. Obliga a tener IA configurada solo para poder ver lo que acabas de importar.

### 6c. Un documento que se va a otra pagina no se lleva el bloque

El almacenamiento de mentira arranca vacio, y un archivo pensado para vivir solo suele leerlo para saber quien entro. Al no encontrar nada concluye que nadie inicio sesion y hace lo que haria en su sitio: irse a su pantalla de acceso.

Un marco puede navegarse a si mismo aunque este aislado; no hay permiso que quitar para impedirlo. El destino suele venir escrito en el propio archivo, apuntando al sitio donde vivia antes; y si viene como direccion relativa, se resuelve contra la pagina que contiene el bloque. En los dos casos el bloque acaba en un sitio que no se deja incrustar, y el visitante mira la pagina de error del navegador dentro del bloque.

Con el documento fuera, el puente ya no existe. Si alcanzo a medir, el alto se queda en el de esa pagina ajena; si el guardia de sesion corre antes de que mida nada, que es lo normal porque suele ir en la cabecera del archivo, el bloque se queda en el alto de partida. Un bloque de 160 pixeles vacios y uno de 274 con una hoja rota son el mismo fallo visto en dos momentos distintos.

El panel avisa antes de que ocurra: el puente escucha la salida del documento y lo dice. Al recibirlo, el panel vuelve a poner el documento en el marco y reinicia el alto. En el editor y en la vista previa se le cuenta al constructor que el contenido intento irse y que ahi dentro no hay a donde ir; en la app publicada no se muestra nada, igual que con el aviso del almacenamiento.

Restaurar tiene un limite de intentos seguidos. Un documento que se va nada mas cargar entraria en un ciclo, y ese ciclo se lo come el navegador de quien esta mirando: pasado el limite se retira el marco. Retirarlo, y no solo dejar de insistir: si se queda puesto, lo que se ve dentro del bloque es la pagina a la que se fue, o sea la pagina de error del navegador, que es exactamente lo que no puede verse.

Y ahi esta el limite de esta decision: **volver a poner el documento arregla al que se va por accidente, no al que se va siempre.** Un guardia de sesion falla en cada vuelta, porque el almacenamiento de mentira sigue vacio; el archivo de vacaciones agotaria los reintentos sin llegar a mostrarse ni una vez. Para ese caso la vuelta atras solo compra tiempo: lo que hace falta es quitarle el guardia al documento.

Por eso el paso que conecta los datos se lleva tambien el guardia: donde el documento decide si hay sesion y se va si no la hay, pasa a usar a quien esta mirando, que es lo que 8b le da. Es el mismo trozo de codigo que ya se le manda a la IA — el que toca el guardado — y sale del mismo sitio.

Mientras eso no se haya hecho, el bloque se queda quieto pasado el limite y, si es el constructor quien mira, con la explicacion delante: este contenido tiene su propio inicio de sesion y la varita puede quitarselo. Un visitante no ve un bloque que se recarga solo; ve un bloque quieto.

El puente ademas desactiva las salidas que si puede: los enlaces que sacan del bloque y el envio de formularios que no pasa por las ordenes de datos. Lo que no puede interceptar es una asignacion directa de la direccion, y por eso hace falta la vuelta atras.

Alternativa descartada: exigir que la varita quite el guardia de sesion antes de poder ver nada. Vuelve a atar el primer dibujado a que haya IA configurada, que es justo lo que 6b evita.

Alternativa descartada: servir el documento desde su propia direccion en vez de incrustado. Le da un origen donde resolver sus rutas, pero tambien un origen de verdad, y con el vuelven el almacenamiento y las cookies que 1 quita a proposito.

### 7. El diagnostico no usa IA, y solo desactiva lo que de verdad no existe

Al importar se analiza el archivo con lectura de texto: donde estan las variables de color, cuantos colores quedan sueltos fuera de ellas, cuantos puntos tocan el guardado del navegador, si hay datos de ejemplo reconocibles, que recursos externos pide, cuantos puntos cambian la direccion de la pagina, el tamano.

Los puntos que navegan no desactivan ninguna casilla: se cuentan y se avisan, porque explican de antemano por que un archivo con su propio acceso se comporta raro dentro del bloque (ver 6c).

Es rapido, gratis, funciona sin clave de IA, y es lo que decide que casillas de la varita tienen sentido.

**Una casilla se desactiva solo cuando en el archivo no existe nada de lo que esa casilla necesita**, nunca porque el archivo este desordenado. Medido sobre ocho archivos reales, la primera version desactivaba la casilla de estilos en los ocho: todos tienen su bloque de variables, pero tambien entre 9 y 43 colores sueltos, y la regla los daba por perdidos. Estar desordenado es justamente el motivo por el que alguien pide ayuda; un asistente que se retira ante el desorden no sirve.

Lo mismo con las tablas: tres de esos ocho archivos no traen datos de ejemplo pero guardan en catorce puntos. Ahi las columnas se deducen del codigo que guarda, no de unos datos que no estan.

| Casilla | Se ofrece cuando |
|---|---|
| Crear la base de datos | hay datos de ejemplo **o** el archivo guarda algo |
| Cargar datos de ejemplo | hay datos de ejemplo |
| Adaptar los estilos | hay variables de color **o** colores sueltos |

### 8. La varita trabaja por trozos, un paso por peticion

El archivo de referencia son unas 40.000 fichas de texto. El limite actual de respuesta de la IA es 16.000. Reescribirlo entero de una vez no cabe, ni hoy ni con margen razonable.

Cada paso manda solo el trozo que necesita y recibe solo ese trozo reescrito:

| Paso | Que se manda | Usa IA |
|---|---|---|
| Diagnostico | nada, se analiza aqui | no |
| Crear tablas | los datos de ejemplo, o el codigo que guarda si no los hay | si |
| Cargar datos de ejemplo | nada, se transforman los datos ya leidos | no |
| Adaptar estilos | el bloque de variables y la lista de colores sueltos | si |
| Conectar datos | solo las funciones que tocan el guardado | si |

Los colores sueltos son declaraciones de una linea: en los archivos reales medidos suman entre 500 y 1.500 letras en total, asi que caben todos en una sola peticion junto al bloque de variables.

El resultado de cada paso se aplica sustituyendo el trozo exacto que se extrajo. Como se conoce el texto original literal, la sustitucion no puede caer en el sitio equivocado.

Cada paso es una peticion propia. El panel las encadena y va mostrando el progreso. El servidor no guarda estado entre pasos: si uno falla, se reintenta ese y no se pierde lo anterior.

Alternativa descartada: una sola peticion con el archivo completo. No cabe en el presupuesto, y un fallo obliga a repetirlo todo.

### 8b. La varita no reconstruye lo que la plataforma ya es

Un archivo hecho para vivir suelto trae su propio acceso: una lista de usuarios, sus claves, sus roles y una marca de quien entro. Leido como datos, eso parece una tabla mas, y la varita la creaba. El archivo de vacaciones acabo con una tabla `sesion` que no manda sobre nada.

Duplicar el acceso no es solo ruido. Deja dos padrones de personas que se separan al primer cambio, y el que decide los permisos es siempre el de la plataforma: las reglas de cada tabla miran la sesion de verdad, no una fila que diga que alguien es administrador. Una tabla de claves ademas invita a guardarlas donde no se deben guardar.

Asi que ni el paso de crear tablas ni el texto de instrucciones proponen tablas de acceso: ni sesion, ni usuarios o personas que sirvan para entrar, ni contrasenas, ni roles. Lo que se reconoce como acceso se descarta con su motivo escrito, para que el constructor vea que se ignoro a proposito y no por un fallo.

En su lugar el HTML tiene `plane.usuario`, que ya dice quien esta mirando. Se le anaden **los roles de esa persona en la aplicacion**: sin ellos, un contenido al que se le prohibe tener su propio padron se queda sin manera de distinguir a un administrador de un visitante, y la unica salida que le queda es volver a inventarse uno.

La frontera es lo que sirve para entrar y para mandar, no la palabra. Una tabla de empleados con sus vacaciones es contenido de la aplicacion y se crea; una tabla de empleados con su contrasena y su rol es el acceso y no.

Alternativa descartada: crear las tablas y avisar despues de que no sirven para entrar. El aviso llega cuando ya hay una tabla de claves creada, y quitarla es trabajo manual del constructor.

### 9. Aceptar o descartar: el documento nuevo no toca el bloque hasta que se acepta

La varita guarda su resultado como un documento mas en `html_docs`, pero el bloque sigue apuntando al original hasta que el constructor acepta.

- **Comparar** es dibujar dos marcos, uno con cada huella, uno al lado del otro. No hace falta tocar la vista previa ni el historial.
- **Aceptar** cambia la huella y el manifiesto del bloque, y el panel se queda con las tablas que la varita creo antes de volver a dibujarlo. El bloque comprueba su manifiesto contra la lista de tablas que tiene el panel delante, asi que una tabla recien creada que el panel todavia no conoce se ve exactamente igual que una borrada: el bloque se declara roto por una tabla que existe.
- **Descartar** no cambia nada del bloque. El documento candidato queda huerfano y lo limpia el recorte.

**Las tablas que creo la varita si son reales y se quedan.** No se pueden crear a medias, y borrarlas al descartar seria borrar datos. Al descartar se dice claramente que tablas quedaron y donde eliminarlas.

Antes de empezar, la varita crea un punto de guardado automatico llamado "Antes de optimizar". Es el seguro de la parte del diseno, y usa el mecanismo que ya existe.

Alternativa descartada: usar restaurar version para descartar. Devolveria tambien cualquier otro cambio hecho mientras tanto. Demasiado ancho para un boton que dice "descartar".

### 10. Un solo texto de instrucciones

El texto que copia el boton lo genera un modulo compartido: colores disponibles, las cinco ordenes, la forma del manifiesto y las tablas elegidas con sus columnas. Ese mismo modulo alimenta a la varita magica y, mas adelante, a la IA interna. Una sola version que mantener.

## Risks / Trade-offs

- **Se ejecuta codigo de terceros.** → Caja sin origen propio, sin token y sin acceso al resto de la pagina. Los permisos del marco se declaran al minimo: solo ejecutar guiones.
- **Un HTML pide una tabla que no declaro.** → El puente rechaza cualquier fuente que no este en el manifiesto del bloque.
- **El documento depende de tipografias e iconos de internet.** → Funciona, pero si esos servidores caen el bloque se ve mal. El diagnostico lo avisa al importar. Si algun dia se anaden reglas de contenido al servidor, hay que contemplar el marco o estos documentos dejaran de cargar.
- **El contenido se navega a otra pagina y deja el bloque en la pagina de error del navegador.** → El puente avisa de la salida, el panel devuelve el documento a su sitio y reinicia el alto, con tope de intentos seguidos para no entrar en un ciclo.
- **La varita reconstruye el acceso que la plataforma ya tiene.** → Ni el paso de crear tablas ni las instrucciones proponen tablas de sesion, usuarios, claves o roles; el HTML usa `plane.usuario` con sus roles.
- **La varita se equivoca al reescribir.** → El bloque no cambia hasta que se acepta, y hay comparacion lado a lado. Ademas queda el punto de guardado automatico.
- **Un archivo desordenado da mal resultado.** → El diagnostico lo detecta y desmarca las casillas que no aplican, con el motivo escrito.
- **Sin clave de IA configurada.** → Importar, diagnosticar, guardar y copiar instrucciones funcionan igual. Solo la varita queda apagada, con su explicacion.
- **Documentos muy pesados.** → Tope de tamano al importar. El coste del historial ya esta resuelto por la huella; el tope protege el resto.
- **Los bloques HTML no participan del arreglo automatico por renombrado.** → Es intencional: referencian ids, no necesitan arreglo. Hay que evitar que alguien "arregle" esta asimetria haciendo que guarden nombres.

## Migration Plan

No hay migracion de datos. El tipo de bloque es nuevo y nace vacio; ninguna app existente lo tiene.

`bootstrap.ts` crea `html_docs` de forma idempotente, igual que el resto de colecciones internas.

Vuelta atras: quitar el bloque del catalogo deja de ofrecerlo. Los bloques ya creados dejarian de dibujarse; la coleccion y los documentos se pueden conservar sin efecto.
