# html-pages Specification

## Purpose
Define la pagina como un documento HTML completo y aislado, con la lista de tablas que puede pedir, los archivos que Planer le inyecta y quien puede abrirla. Es el reemplazo del armado por bloques y el limite de lo que una pagina puede tocar.

## Requirements

### Requirement: La pagina es un documento HTML

Una pagina SHALL guardar un documento HTML completo. El sistema SHALL dibujarlo en un marco aislado, sin acceso a la sesion, a las cookies ni al resto del panel.

#### Scenario: Guardar y ver una pagina

- **WHEN** el constructor guarda el HTML de una pagina y la abre
- **THEN** la pagina se dibuja tal como se escribio
- **AND** el documento no puede leer la sesion de quien mira

#### Scenario: Un documento roto no rompe el panel

- **WHEN** el HTML de una pagina tiene un error que impide dibujarla
- **THEN** la navegacion y la barra del constructor siguen funcionando
- **AND** el constructor puede abrir su codigo para corregirlo

### Requirement: Pagina de inicio permanente

Cada aplicacion SHALL tener siempre una pagina de inicio. El sistema SHALL impedir borrarla.

#### Scenario: Aplicacion recien creada

- **WHEN** se crea una aplicacion
- **THEN** ya existe una pagina de inicio en blanco

#### Scenario: Intentar borrar la pagina de inicio

- **WHEN** el constructor intenta borrar la pagina de inicio
- **THEN** el sistema no la borra y explica que siempre debe existir una

#### Scenario: Borrar el resto de las paginas

- **WHEN** el constructor borra todas las paginas menos la de inicio
- **THEN** la aplicacion sigue abriendose por la pagina de inicio

### Requirement: Tablas declaradas por pagina

Cada pagina SHALL declarar la lista de tablas que puede pedir, con el nombre logico de cada columna asociado a su identidad interna. El puente de datos SHALL rechazar cualquier tabla o columna que no este en esa lista.

#### Scenario: Pedir una tabla declarada

- **WHEN** el HTML de una pagina pide una tabla que esta en su lista
- **THEN** recibe las filas segun los permisos de quien esta mirando

#### Scenario: Pedir una tabla no declarada

- **WHEN** el HTML de una pagina pide una tabla que no esta en su lista
- **THEN** la peticion se rechaza con un mensaje que dice que esa fuente no esta declarada
- **AND** no se consulta la base de datos

#### Scenario: Saber que paginas usan una tabla

- **WHEN** se pregunta que paginas usan una tabla concreta
- **THEN** el sistema devuelve solo las paginas que la declararon

### Requirement: Renombrar una columna no rompe la pagina

Como las columnas se guardan por su identidad interna y no por su nombre, renombrar una columna SHALL NO requerir ningun cambio en el HTML de las paginas que la usan ni generar ningun aviso.

#### Scenario: Renombrar una columna que usa una pagina

- **WHEN** la columna `precio` pasa a llamarse `valor` y hay una pagina que la declara
- **THEN** la pagina sigue recibiendo esa columna con el nombre logico que ya usaba
- **AND** no se genera ningun aviso

### Requirement: Archivos inyectados por referencia

El sistema SHALL inyectar en cada pagina un archivo de estilos y un archivo de navegacion y datos, referenciados por enlace y nunca pegados como contenido dentro del documento. Cada referencia SHALL llevar un comentario corto que diga para que sirve.

#### Scenario: Ver el codigo de una pagina

- **WHEN** el constructor abre el codigo HTML de una pagina
- **THEN** ve dos lineas de referencia con su comentario, no cientos de lineas de estilos y guiones

#### Scenario: Mejorar los archivos inyectados

- **WHEN** Planer actualiza el archivo de estilos o el de navegacion y datos
- **THEN** todas las paginas de todas las aplicaciones reciben la version nueva sin editarlas

### Requirement: Reposicion de lo inyectado

Al guardar una pagina, si falta alguna de las referencias inyectadas, el sistema SHALL reponerla y SHALL dejar constancia visible de que lo hizo.

#### Scenario: Guardar una pagina sin la referencia de estilos

- **WHEN** el constructor guarda un HTML del que se borro la referencia de estilos
- **THEN** el sistema la repone
- **AND** avisa de que la volvio a anadir

#### Scenario: Guardar una pagina completa

- **WHEN** el constructor guarda un HTML que conserva las dos referencias
- **THEN** el sistema no cambia nada y no muestra ningun aviso

### Requirement: Quien puede ver una pagina

Quién puede abrir una página SHALL decidirse en dos sitios que no se repiten.

La aplicación SHALL declarar una sola cosa: si es pública o si requiere iniciar sesión. Cuando requiere iniciar sesión, ninguna de sus páginas SHALL abrirse sin cuenta.

Cada página SHALL declarar qué roles pueden abrirla, como una lista de marcas. La lista SHALL incluir una marca `Todos` y una marca por cada rol que la aplicación define. `Todos` SHALL venir marcada por defecto y SHALL ser excluyente con las demás: marcar un rol la desmarca, y desmarcar el último rol la vuelve a marcar. Entre roles SHALL poder marcarse varios a la vez.

Con `Todos` marcada, la página SHALL abrirse a cualquiera que alcance la aplicación. Con uno o más roles marcados, la página SHALL exigir sesión iniciada y uno de esos roles, aunque la aplicación sea pública.

Lo declarado SHALL aplicarse en el servidor. Una página que quien pregunta no puede abrir SHALL NO entregar su contenido ni sus datos.

#### Scenario: Pagina abierta a cualquiera

- **WHEN** alguien sin cuenta abre una pagina con `Todos` marcada de una aplicacion publica
- **THEN** la ve

#### Scenario: Pagina que exige sesion

- **WHEN** alguien sin cuenta abre cualquier pagina de una aplicacion que requiere iniciar sesion
- **THEN** se le pide entrar
- **AND** al entrar se le muestra la pagina que pedia

#### Scenario: Pagina limitada por rol

- **WHEN** alguien sin el rol exigido abre una pagina que tiene ese rol marcado
- **THEN** no recibe el contenido de la pagina
- **AND** si llego sin cuenta, se le pide entrar

#### Scenario: Pagina limitada a varios roles

- **WHEN** una pagina tiene marcados los roles `admin` y `jefe`
- **THEN** la abre quien tenga cualquiera de los dos
- **AND** quien tenga solo el rol `vendedor` no recibe su contenido

#### Scenario: Marcar un rol desmarca Todos

- **WHEN** el constructor marca el rol `jefe` en una pagina que tenia `Todos`
- **THEN** `Todos` queda desmarcada y la pagina pasa a exigir ese rol

#### Scenario: Desmarcar el ultimo rol vuelve a Todos

- **WHEN** el constructor desmarca el unico rol marcado de una pagina
- **THEN** `Todos` vuelve a quedar marcada

#### Scenario: El servidor manda

- **WHEN** se pide directamente el contenido de una pagina para la que no se tiene permiso
- **THEN** el servidor no lo entrega, aunque el sidebar no la mostrara

### Requirement: La pagina se dibuja a pantalla completa

El documento HTML de una pagina SHALL ocupar el alto y el ancho completos de la ventana, tanto en la pantalla de quien construye como en la del publico. Ningun elemento de Planer SHALL restarle espacio: el sidebar y la barra Todo En Uno se dibujan encima del documento, nunca a su lado ni por encima de su borde superior.

#### Scenario: El constructor abre una pagina

- **WHEN** quien construye abre una pagina con contenido
- **THEN** el documento ocupa toda la ventana de lado a lado y de arriba abajo
- **AND** el sidebar y la barra se ven superpuestos sobre el

#### Scenario: Un visitante abre una pagina publicada

- **WHEN** un visitante abre una pagina de la aplicacion publicada
- **THEN** el documento ocupa toda la ventana
- **AND** el sidebar se ve superpuesto sobre el

#### Scenario: La misma pagina en las dos pantallas

- **WHEN** se compara una pagina en el panel y en su enlace publico
- **THEN** el documento tiene el mismo tamano en las dos

### Requirement: Una celda de relacion llega resuelta al documento

Cuando el puente de datos entrega una fila al documento HTML, una celda de tipo persona o relacion SHALL llegar con el valor de la columna que esa relacion enseña siempre presente, y con los datos del registro enlazado cuando lo haya. Cuando no hay enlace, el valor SHALL seguir presente y los datos del registro SHALL llegar vacios. El puente SHALL NO entregar el id del registro como unico contenido de la celda.

#### Scenario: Fila con enlace

- **WHEN** el documento pide una tabla con una columna de relacion y la fila esta enlazada
- **THEN** la celda llega con el valor de la columna que enseña y con los datos del registro enlazado

#### Scenario: Fila sin enlace

- **WHEN** el documento pide una tabla con una columna de relacion y la fila no esta enlazada
- **THEN** la celda llega con el valor tal como se guardo y los datos del registro vacios

#### Scenario: Pintar una fila sin enlace

- **WHEN** una pagina escribe el nombre del registro enlazado y la fila no tiene enlace
- **THEN** ese hueco sale vacio y el resto de la fila se pinta igual, sin que la pagina falle

#### Scenario: Contar filas sin enlace

- **WHEN** una pagina agrupa o suma filas por una columna de relacion usando el valor que enseña
- **THEN** las filas sin enlace entran en el recuento con su valor, y el total coincide con el de la tabla

### Requirement: Solo llegan las columnas declaradas del registro enlazado

De un registro enlazado SHALL llegar unicamente lo que la pagina tenga declarado, igual que ocurre con las columnas de la tabla que se pide. El puente SHALL rechazar la peticion de una columna del registro enlazado que no este declarada.

#### Scenario: Columna del enlace no declarada

- **WHEN** una pagina pide de un registro enlazado una columna que no declaro
- **THEN** esa columna no llega y la peticion se rechaza con el mismo mensaje que una fuente no declarada
### Requirement: Una página nueva se abre a todos

Una página recién creada SHALL nacer con `Todos` marcada. Limitar quién la abre SHALL ser un añadido, no un paso previo para poder usarla.

#### Scenario: Crear una página y publicarla

- **WHEN** el constructor crea una página y publica la aplicación sin abrir sus opciones
- **THEN** la página se abre a cualquiera que alcance la aplicación
