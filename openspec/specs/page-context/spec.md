# page-context Specification

## Purpose
Reune en un solo texto todo lo que hay que saber para escribir el HTML de una pagina: colores, espaciados, tablas, ordenes de datos, quien esta mirando y lo prohibido. De ese texto salen la documentacion que lee el constructor y el contexto que recibe la IA, para que nunca se contradigan.

## Requirements

### Requirement: Un solo texto para la documentacion y para la IA

El sistema SHALL construir el contexto de una pagina desde una unica fuente. La documentacion del constructor y el contexto que se manda a la IA SHALL derivar de esa misma fuente.

#### Scenario: Cambiar como se piden los datos

- **WHEN** cambia la forma de pedir datos y se actualiza la fuente unica
- **THEN** la documentacion del constructor y el contexto de la IA reflejan el cambio a la vez

#### Scenario: La documentacion del constructor

- **WHEN** el constructor consulta como conectarse a la base de datos desde el HTML
- **THEN** encuentra las mismas ordenes y los mismos nombres que recibe la IA

### Requirement: El contexto se arma en el momento

El contexto SHALL construirse en cada peticion con el estado actual de la aplicacion. El sistema SHALL NO guardar el contexto dentro del documento HTML de la pagina.

#### Scenario: Cambiar una tabla y volver a pedir

- **WHEN** se anade una columna a una tabla y despues se hace una peticion a la IA
- **THEN** el contexto ya nombra esa columna

#### Scenario: Borrar una tabla y volver a pedir

- **WHEN** se borra una tabla y despues se hace una peticion a la IA
- **THEN** el contexto ya no la nombra

### Requirement: Contenido del contexto

El contexto SHALL incluir, como minimo: los colores de la paleta de la aplicacion en modo claro y oscuro, los espaciados y tamanos de texto, las tablas de la aplicacion con sus columnas y tipos, las ordenes para listar, obtener, crear, actualizar y borrar con lo que devuelve cada una, como saber quien esta mirando y que roles tiene, los roles que la aplicacion define y que roles tiene marcados la pagina que se esta escribiendo. Para cada columna que apunte a otra tabla SHALL decir ademas a que tabla apunta, que columna enseña --que es tambien la llave por la que empareja--, que una fila puede venir sin enlace y que la columna que enseña esta siempre presente.

El contexto SHALL explicar ademas los nombres de bloque: que un elemento puede llevar un nombre estable, que ese nombre es lo que permite editarlo sin rehacer la pagina, y que conviene ponerselo con significado a lo que se edita.

#### Scenario: Aplicacion con tablas

- **WHEN** se arma el contexto de una aplicacion con tablas
- **THEN** el contexto nombra cada tabla, sus columnas y el tipo de cada columna

#### Scenario: Aplicacion sin tablas

- **WHEN** se arma el contexto de una aplicacion que todavia no tiene tablas
- **THEN** el contexto dice que no hay tablas y que no se llamen las ordenes de datos

#### Scenario: Tabla con una columna de relacion

- **WHEN** se arma el contexto de una tabla con una columna que apunta a otra tabla
- **THEN** el contexto dice a que tabla apunta, que columna enseña y que puede llegar sin enlace

#### Scenario: Tabla que apunta a las personas

- **WHEN** se arma el contexto de una tabla con una columna que apunta a la tabla de personas
- **THEN** el contexto la describe igual que cualquier otra relacion, nombrando la tabla de personas como destino

#### Scenario: Tabla con alcances declarados por rol

- **WHEN** se arma el contexto de una aplicacion cuyas tablas traian alcances declarados por rol de antes de este cambio
- **THEN** el contexto no los menciona, porque ya no se aplican

#### Scenario: Tabla sin alcances declarados

- **WHEN** se arma el contexto de cualquier tabla
- **THEN** el contexto dice que quien puede abrir la pagina alcanza todas sus filas

#### Scenario: Aplicacion con roles definidos

- **WHEN** se arma el contexto de una aplicacion que define varios roles
- **THEN** el contexto los nombra tal como estan escritos, para compararlos contra los roles de quien mira

#### Scenario: Pagina limitada a ciertos roles

- **WHEN** se arma el contexto de una pagina que tiene marcados uno o mas roles
- **THEN** el contexto dice cuales son y que quien la abre tiene alguno de ellos

#### Scenario: Pagina abierta a todos

- **WHEN** se arma el contexto de una pagina con `Todos` marcada en una aplicacion publica
- **THEN** el contexto dice que quien mira puede llegar sin cuenta, y que la pagina tiene que dibujarse bien en ese caso

#### Scenario: Explicar los nombres de bloque

- **WHEN** se arma el contexto de cualquier pagina
- **THEN** explica que es un nombre de bloque y para que sirve
- **AND** dice que se le pone a lo que se edita, no a todo el documento

### Requirement: El contexto dice cuando usar el bisturi

El contexto SHALL decir que un cambio localizado se hace editando el bloque que le corresponde, y que rehacer el documento entero se reserva para cuando cambia la estructura de la pantalla.

#### Scenario: Contexto de una pagina ya construida

- **WHEN** se arma el contexto de una pagina que ya tiene contenido
- **THEN** explica que para un cambio localizado se edita el bloque
- **AND** que rehacer la pagina entera es para cuando cambia la estructura

### Requirement: El contexto declara los limites

El contexto SHALL declarar de forma explicita lo que el HTML de una pagina no puede hacer: crear su propio inicio de sesion o padron de usuarios, guardar datos en el navegador, y llevar la pantalla a otra direccion.

#### Scenario: Peticion que pide una pantalla de acceso

- **WHEN** se le pide a la IA una pantalla con inicio de sesion propio
- **THEN** la IA no lo escribe y explica que la sesion la pone la plataforma

### Requirement: Los colores se ofrecen, no se imponen

El contexto SHALL entregar los colores y espaciados de la aplicacion como variables disponibles. La IA SHALL decidir si usarlas segun lo que pida el constructor.

#### Scenario: Peticion sin indicaciones de estilo

- **WHEN** el constructor pide una pantalla sin decir nada del aspecto
- **THEN** la pagina usa los colores de la paleta de la aplicacion

#### Scenario: Cambiar la paleta despues

- **WHEN** una pagina usa las variables de la paleta y se cambia la paleta de la aplicacion
- **THEN** la pagina se repinta con los colores nuevos sin editarla

#### Scenario: Peticion con un aspecto propio

- **WHEN** el constructor pide de forma explicita una pantalla con otros colores
- **THEN** la IA puede apartarse de la paleta

### Requirement: El contexto dice como se pinta y se cuenta una fila sin enlace

El contexto SHALL indicar que para agrupar, contar o comparar filas se use el valor de la columna que enseña la relacion y no el id del registro enlazado, para que las filas sin enlace no desaparezcan de los totales. SHALL indicar tambien una unica forma de pintar una fila sin enlace, de modo que todas las paginas de la aplicacion la muestren igual.

#### Scenario: Escribir una grafica sobre una columna de relacion

- **WHEN** la IA escribe una grafica que agrupa por una columna de persona o relacion
- **THEN** agrupa por el valor que enseña esa columna, y las filas sin enlace aparecen con su valor

#### Scenario: Escribir una lista con filas sin enlace

- **WHEN** la IA escribe una pantalla que lista filas de una tabla con una columna de relacion
- **THEN** las filas sin enlace se pintan de la forma que indica el contexto, sin inventar una distinta en cada pagina

### Requirement: El contexto dice que los roles son para ajustar la pantalla

El contexto SHALL decir que los roles de quien mira sirven para decidir que se le muestra, y que ajustar la pantalla por rol se hace dentro de la pagina comparando contra los roles de quien mira.

El contexto SHALL decir tambien que lo que se esconde por rol no queda protegido: los datos de las tablas que la pagina declara llegan enteros al navegador de cualquiera que pueda abrirla. Esconder un boton SHALL presentarse como una decision de presentacion, nunca como una barrera.

#### Scenario: Peticion de esconder algo por rol

- **WHEN** se le pide a la IA que un boton solo lo vea un rol
- **THEN** la pagina que escribe comprueba el rol de quien mira antes de dibujarlo

#### Scenario: Peticion que confia en el rol como barrera

- **WHEN** se le pide a la IA que unos datos "solo los pueda ver" un rol dentro de una pagina abierta a todos
- **THEN** la IA lo implementa y advierte de que esconderlos no impide que lleguen al navegador
- **AND** explica que para impedirlo hay que limitar la pagina a ese rol

### Requirement: El contexto advierte de que guardar exige cuenta

El contexto SHALL decir que crear, actualizar y borrar exigen una sesion iniciada, y que la plataforma avisa por su cuenta cuando alguien sin sesion lo intenta. La pagina SHALL NO tener que escribir ese aviso.

La IA SHALL advertirlo al construir una pagina que guarda datos y que puede abrirse sin cuenta, nombrando lo que va a pasar cuando alguien sin sesion intente guardar.

#### Scenario: Pagina abierta a todos con un formulario

- **WHEN** se le pide a la IA un formulario en una pagina abierta a `Todos`
- **THEN** la IA lo construye
- **AND** advierte de que quien llegue sin cuenta vera un aviso pidiendo iniciar sesion al guardar

#### Scenario: La pagina no escribe el aviso

- **WHEN** la IA construye una pagina que guarda datos
- **THEN** no escribe su propio mensaje de "inicia sesion", porque lo pone la plataforma

### Requirement: El contexto enumera lo que se sabe de quien mira

El contexto SHALL enumerar, por su nombre, cada dato de la persona que la pagina recibe: su identificador, su nombre, su correo, sus roles y **todas** las columnas propias que la aplicacion tenga en su tabla de personas. Los nombres SHALL ser los reales de esa aplicacion, no una lista fija.

Esos datos SHALL llegar a la pagina en un solo nivel, sin agruparse aparte.

El contexto SHALL decir que una columna puede venir vacia --una persona a la que nadie le rellenó el documento-- y que la pagina tiene que dibujarse bien en ese caso.

#### Scenario: Aplicacion con columnas propias de personas

- **WHEN** se arma el contexto de una aplicacion cuya tabla de personas tiene una columna de documento y otra de cargo
- **THEN** el contexto nombra el documento y el cargo entre lo que se sabe de quien mira

#### Scenario: Aplicacion sin columnas propias

- **WHEN** se arma el contexto de una aplicacion cuya tabla de personas no tiene ninguna columna propia
- **THEN** el contexto nombra solo el identificador, el nombre, el correo y los roles, y no inventa ninguna otra

#### Scenario: Una persona sin ese dato

- **WHEN** se le pide a la IA una pantalla que use el documento de quien mira
- **THEN** la pagina que escribe contempla que ese documento pueda venir vacio

### Requirement: El contexto dice como enseñar solo las filas de quien mira

El contexto SHALL decir que enseñar "lo mio" se hace filtrando en el servidor, pasando el filtro en la propia orden de listar, y SHALL decir expresamente que no se hace trayendo todas las filas y descartandolas al pintar.

El contexto SHALL decir que el valor por el que se filtra es el dato de la persona que corresponda a la llave de esa tabla, y que la llave puede ser distinta en cada tabla.

El contexto SHALL NO decir que "lo mio" se resuelve comparando el identificador de quien mira.

El contexto SHALL advertir que ese filtro decide lo que se enseña y no lo que se puede alcanzar, igual que ya advierte de lo mismo para los roles.

#### Scenario: Dos tablas que enlazan por llaves distintas

- **WHEN** se le pide a la IA una pantalla con las filas de quien mira, en una aplicacion donde una tabla apunta a personas por el correo y otra por el documento
- **THEN** la pagina filtra cada tabla por su propia llave

#### Scenario: Filtrar no es descartar al pintar

- **WHEN** se le pide a la IA una pantalla con las filas de quien mira
- **THEN** la pagina pide al servidor solo esas filas, y no la tabla entera

#### Scenario: Quien llega sin sesion

- **WHEN** una pagina que enseña "lo mio" se abre sin cuenta
- **THEN** no hay nada que sea "lo mio", y la pagina dibuja el caso general

#### Scenario: Confiar en el filtro como barrera

- **WHEN** se le pide a la IA que unos datos "solo los pueda ver" cada quien de si mismo
- **THEN** la IA lo implementa y advierte de que el filtro decide lo que se enseña, no lo que se puede pedir
- **AND** explica que lo que si cierra el paso es marcar la aplicacion como privada

### Requirement: El contexto dice como se nombra a una persona en una pagina

El contexto SHALL fijar como se presenta a una persona cuando quien construye no ha dicho otra cosa:

- SHALL usarse su nombre, y su apellido si la aplicacion tiene una columna para el.
- Un segundo dato --su documento, su correo-- SHALL añadirse solo cuando distinga a dos personas que se leen igual o cuando la pantalla trate justo de ese dato, y SHALL ir en letra mas pequeña y apagada.
- El identificador SHALL NO enseñarse nunca.

Lo que el constructor haya pedido enseñar SHALL prevalecer sobre lo anterior.

El contexto SHALL decir ademas que la cuadricula del constructor hace lo contrario a proposito --el valor por delante y la persona detras, porque ahi el valor es lo que se corrige-- para que no se tome por una incoherencia.

#### Scenario: Una lista de personas sin instrucciones

- **WHEN** se le pide a la IA una pantalla que liste personas, sin decir que enseñar de ellas
- **THEN** la pagina enseña el nombre, y el identificador no aparece

#### Scenario: Una pantalla que trata de documentos

- **WHEN** se le pide a la IA una pantalla de control de documentos
- **THEN** la pagina enseña el nombre y, debajo y en letra pequeña, el documento

#### Scenario: El constructor dice que enseñar

- **WHEN** se le pide a la IA que en esa pantalla se vea el correo de cada persona
- **THEN** la pagina enseña el correo, sin que la regla por defecto lo impida

### Requirement: El contexto dice quién escribe la petición

El contexto SHALL decir que quien escribe la petición es el dueño de la aplicación, y que dentro de la aplicación su rol es `admin`.

El contexto SHALL decir además que `admin` existe en toda aplicación desde que nace y no se puede quitar, para que la equivalencia valga en cualquier aplicación y no solo en las que hayan nombrado ese rol a mano.

El contexto SHALL presentarlo como un hecho de la plataforma, no como una instrucción: ser dueño de la aplicación es lo que da el poder de construirla, y `admin` es solo el nombre del rol que le corresponde dentro de ella.

Por ser un hecho, SHALL llegar igual a la documentación del constructor y al contexto de la IA.

#### Scenario: Aplicación que no nombró roles a mano

- **WHEN** se arma el contexto de una aplicación cuyos roles son solo los que trae de nacimiento
- **THEN** el contexto nombra `admin` como el rol de quien escribe

#### Scenario: La documentación del constructor

- **WHEN** el constructor consulta la documentación de cómo se escribe una página
- **THEN** encuentra dicho que su rol dentro de la aplicación es `admin`

### Requirement: La instrucción de cómo leer la petición es solo para el modelo

El contexto SHALL llevar, solo cuando se arma para la IA, la instrucción de cómo deducir para quién es una pantalla a partir de las palabras de la petición.

Esa instrucción SHALL NO aparecer en la documentación del constructor: es una regla de lectura para el modelo, no algo que quien construye tenga que saber.

#### Scenario: Contexto armado para la IA

- **WHEN** se arma el contexto de una petición a la IA
- **THEN** incluye la regla de cómo leer para quién es la pantalla

#### Scenario: Documentación del constructor

- **WHEN** se genera la documentación de cómo se escribe una página
- **THEN** no incluye esa regla de lectura
