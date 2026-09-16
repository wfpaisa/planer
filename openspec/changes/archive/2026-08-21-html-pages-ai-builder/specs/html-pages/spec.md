## Purpose

Define la pagina como un documento HTML completo y aislado, con la lista de tablas que puede pedir, los archivos que Planer le inyecta y quien puede abrirla. Es el reemplazo del armado por bloques y el limite de lo que una pagina puede tocar.

## ADDED Requirements

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

Cada pagina SHALL tener uno de estos tres niveles de acceso: cualquiera, cualquiera que haya entrado, o solo ciertos roles. El nivel SHALL aplicarse en el servidor.

#### Scenario: Pagina abierta a cualquiera

- **WHEN** alguien sin sesion abre una pagina de nivel "cualquiera"
- **THEN** la ve

#### Scenario: Pagina que exige sesion

- **WHEN** alguien sin sesion abre una pagina de nivel "cualquiera que haya entrado"
- **THEN** se le pide entrar
- **AND** al entrar se le muestra la pagina que pedia

#### Scenario: Pagina limitada por rol

- **WHEN** alguien con sesion pero sin el rol exigido abre una pagina limitada a ciertos roles
- **THEN** no recibe el contenido de la pagina

#### Scenario: El servidor manda

- **WHEN** se pide directamente el contenido de una pagina para la que no se tiene permiso
- **THEN** el servidor no lo entrega, aunque el sidebar no la mostrara
