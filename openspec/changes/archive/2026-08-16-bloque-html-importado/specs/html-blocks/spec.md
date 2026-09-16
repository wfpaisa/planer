## Purpose

Permite que un constructor use su propio HTML como un bloque mas de una pagina, con los colores de la aplicacion y con acceso a las tablas, sin que ese codigo pueda alcanzar la sesion de quien mira la pantalla.

## ADDED Requirements

### Requirement: Bloque de HTML propio

Una pagina SHALL poder incluir bloques cuyo contenido es HTML del constructor. El bloque SHALL comportarse como cualquier otro en cuanto a titulo, subtitulo, orden dentro de la pagina y roles que lo ven.

#### Scenario: Agregar el bloque desde el catalogo

- **WHEN** el constructor abre el catalogo de bloques de una pagina
- **THEN** encuentra el bloque de HTML junto a los demas
- **AND** al agregarlo aparece vacio, esperando contenido

#### Scenario: El bloque respeta los roles

- **WHEN** un bloque de HTML esta limitado a un rol y lo abre alguien que no lo tiene
- **THEN** el bloque no llega al navegador de esa persona

#### Scenario: Bloque sin contenido

- **WHEN** el constructor abre una pagina con un bloque de HTML todavia vacio
- **THEN** el editor le dice que falta importar o pegar contenido
- **AND** en la app publicada ese bloque no se muestra

### Requirement: El HTML corre aislado de la aplicacion

El HTML del bloque SHALL ejecutarse aislado: SHALL NOT poder leer ni escribir el almacenamiento del navegador de la aplicacion, SHALL NOT poder leer las credenciales de la sesion, y SHALL NOT poder leer ni modificar el resto de la pagina.

#### Scenario: El HTML intenta leer la sesion

- **WHEN** el HTML de un bloque intenta leer el almacenamiento local o las cookies de la aplicacion
- **THEN** no obtiene nada de la aplicacion

#### Scenario: El HTML intenta salir de su bloque

- **WHEN** el HTML de un bloque intenta modificar contenido que esta fuera de el
- **THEN** no lo consigue
- **AND** el resto de la pagina se muestra normal

#### Scenario: El HTML falla

- **WHEN** el HTML de un bloque tiene un error y deja de funcionar
- **THEN** los demas bloques de la pagina siguen funcionando

### Requirement: Un contenido que guarda por su cuenta sigue funcionando

Un contenido que use el almacenamiento del navegador SHALL poder ejecutarse igualmente, con un almacenamiento propio del bloque que dura lo que dura la pantalla abierta. Cuando lo use, el editor y la vista previa SHALL avisar de que esos datos no se guardan de verdad; la app publicada SHALL NOT mostrar ese aviso.

#### Scenario: Contenido sin convertir

- **WHEN** se importa un contenido que lee y escribe en el almacenamiento del navegador
- **THEN** el contenido se dibuja y funciona
- **AND** no aparece ningun error

#### Scenario: Aviso al constructor

- **WHEN** ese contenido guarda algo y lo esta viendo el constructor
- **THEN** se le avisa de que esos datos se pierden al salir y de que puede conectarlo a una tabla

#### Scenario: El visitante no ve el aviso

- **WHEN** ese mismo contenido lo abre un visitante en el enlace publico
- **THEN** no ve ningun aviso

#### Scenario: Contenido con su propio inicio de sesion

- **WHEN** se importa un contenido que busca en el almacenamiento quien inicio sesion y no encuentra nada
- **THEN** el bloque sigue mostrando el contenido importado

### Requirement: El contenido no saca a nadie de su bloque

Un bloque de HTML SHALL seguir mostrando su contenido aunque este intente llevar la pantalla a otra direccion. El sistema SHALL devolver el contenido a su sitio y SHALL volver a ajustar el alto al del contenido devuelto. Cuando el intento se repita sin parar, el sistema SHALL dejar de reintentar en vez de encadenar recargas.

En el editor y en la vista previa el constructor SHALL enterarse de que el contenido intento salir; la app publicada SHALL NOT mostrar ese aviso.

#### Scenario: El contenido se manda a otra pagina

- **WHEN** el contenido de un bloque intenta cambiar la direccion de la pagina
- **THEN** el bloque sigue mostrando el contenido importado
- **AND** no aparece ninguna pagina de error del navegador dentro del bloque

#### Scenario: Aviso al constructor

- **WHEN** el contenido intenta salir y lo esta viendo el constructor
- **THEN** se le avisa de que el contenido intento ir a otra pagina y de que dentro del bloque no hay a donde ir

#### Scenario: El contenido insiste

- **WHEN** el contenido intenta salir una y otra vez nada mas cargarse
- **THEN** el sistema deja de devolverlo pasado un numero de intentos
- **AND** retira el contenido en vez de dejar a la vista la pagina a la que se fue
- **AND** el resto de la pagina sigue funcionando

#### Scenario: El visitante no ve el aviso de salida

- **WHEN** ese mismo contenido lo abre un visitante en el enlace publico
- **THEN** no ve ningun aviso

### Requirement: El bloque toma los colores de la aplicacion

El sistema SHALL poner a disposicion del HTML los colores y el modo claro u oscuro de la aplicacion, y SHALL actualizarlos cuando cambien sin necesidad de volver a importar nada.

#### Scenario: Cambiar la paleta de la app

- **WHEN** el constructor cambia el color principal de la aplicacion
- **THEN** el bloque de HTML que usa los colores de la aplicacion se actualiza

#### Scenario: Cambiar a modo oscuro

- **WHEN** el visitante cambia al modo oscuro
- **THEN** el bloque recibe el aviso del modo activo

### Requirement: El bloque ocupa el alto que necesita

El sistema SHALL ajustar el alto del bloque al del contenido, hasta un tope que el constructor SHALL poder fijar. El alto SHALL corresponder siempre al contenido que se esta mostrando: cuando el bloque vuelve a cargar su contenido, el alto SHALL medirse de nuevo y SHALL NOT conservarse el ultimo alto medido antes de esa recarga.

#### Scenario: Contenido que crece

- **WHEN** el contenido del bloque crece al abrirse una seccion
- **THEN** el bloque crece con el, sin barras de desplazamiento propias

#### Scenario: El bloque vuelve a cargar su contenido

- **WHEN** el bloque vuelve a cargar su contenido despues de haber mostrado otra cosa
- **THEN** el alto pasa a ser el del contenido cargado
- **AND** no se queda en el alto de lo que se mostraba antes

#### Scenario: Contenido mas alto que el tope

- **WHEN** el contenido supera el tope de alto fijado
- **THEN** el bloque se queda en el tope
- **AND** el contenido se desplaza dentro del bloque

### Requirement: Manifiesto de tablas y columnas

Un bloque de HTML que usa datos SHALL declarar sus fuentes: por cada una, un nombre logico, la tabla a la que apunta y los nombres logicos de las columnas que usa. Las columnas SHALL guardarse por su identidad interna, no por su nombre.

#### Scenario: Renombrar una columna que usa el bloque

- **WHEN** una columna declarada en el manifiesto de un bloque de HTML cambia de nombre
- **THEN** el bloque sigue funcionando sin cambios en su contenido
- **AND** los datos siguen llegando con el nombre logico que declaro

#### Scenario: Renombrar una tabla que usa el bloque

- **WHEN** cambia la etiqueta de una tabla declarada en el manifiesto
- **THEN** el bloque sigue funcionando

### Requirement: Ordenes de datos

El HTML SHALL poder pedir y guardar datos mediante un conjunto cerrado de ordenes: listar, obtener uno, crear, actualizar y borrar. Las ordenes SHALL nombrar las fuentes y las columnas por sus nombres logicos, y las filas devueltas SHALL usar esos mismos nombres.

#### Scenario: Listar registros

- **WHEN** el HTML pide la lista de una fuente declarada
- **THEN** recibe las filas con las columnas que declaro, usando sus nombres logicos

#### Scenario: Crear un registro

- **WHEN** el HTML crea un registro en una fuente declarada y quien mira tiene permiso de escritura
- **THEN** el registro queda guardado en la tabla real

#### Scenario: Fuente no declarada

- **WHEN** el HTML pide datos de una fuente que no esta en el manifiesto del bloque
- **THEN** la peticion es rechazada
- **AND** no se consulta ninguna tabla

#### Scenario: Columna no declarada

- **WHEN** el HTML filtra u ordena por una columna que no esta en el manifiesto
- **THEN** la peticion es rechazada

### Requirement: Las ordenes no elevan permisos

Las ordenes de datos SHALL resolverse con la sesion de quien esta mirando la pantalla y SHALL respetar las reglas de acceso de cada tabla, incluida la de dueno por fila.

#### Scenario: Tabla con dueno por fila

- **WHEN** un miembro abre una pagina con un bloque de HTML que lista una tabla con dueno por fila
- **THEN** solo recibe sus propias filas

#### Scenario: Visitante sin permiso de escritura

- **WHEN** un visitante con permiso solo de lectura intenta crear un registro desde el HTML
- **THEN** la operacion es rechazada
- **AND** el HTML recibe el motivo del rechazo

#### Scenario: El HTML no recibe credenciales

- **WHEN** el HTML de un bloque se ejecuta
- **THEN** no dispone del token de la sesion de quien mira

### Requirement: El contenido sabe quien esta mirando

El sistema SHALL poner a disposicion del HTML la identidad de quien esta mirando la pantalla y los roles que esa persona tiene en la aplicacion, sin entregarle credencial alguna. Cuando nadie ha iniciado sesion, SHALL quedar claro que no hay nadie.

#### Scenario: Contenido que distingue por rol

- **WHEN** el HTML pregunta por quien esta mirando y esa persona tiene un rol de la aplicacion
- **THEN** recibe su identidad y sus roles
- **AND** puede decidir con eso que muestra, sin guardar personas ni roles propios

#### Scenario: Nadie ha iniciado sesion

- **WHEN** el HTML se ejecuta en una pagina publica que abrio alguien sin sesion
- **THEN** recibe que no hay nadie mirando con sesion

### Requirement: Instrucciones para una IA externa

El sistema SHALL poder entregar al constructor un texto listo para pegar en un chat de inteligencia artificial, que describa los colores disponibles, las ordenes de datos, la forma del manifiesto y las tablas que el constructor elija con sus columnas y tipos.

El texto SHALL decir que la sesion, las personas y los roles los pone la plataforma, y SHALL pedir que el contenido no construya su propio inicio de sesion ni sus propias tablas de usuarios, claves o roles.

#### Scenario: Copiar las instrucciones

- **WHEN** el constructor pide las instrucciones eligiendo dos tablas
- **THEN** obtiene un texto que incluye esas dos tablas con sus columnas
- **AND** incluye las ordenes de datos y los colores disponibles

#### Scenario: Copiar sin elegir tablas

- **WHEN** el constructor pide las instrucciones sin elegir ninguna tabla
- **THEN** obtiene el texto con los colores y las ordenes, sin tablas

#### Scenario: El texto desaconseja un acceso propio

- **WHEN** el constructor copia las instrucciones
- **THEN** el texto dice que la sesion, la identidad y los roles ya los da la plataforma
- **AND** pide que el contenido no haga su propio inicio de sesion

### Requirement: Contenido guardado aparte del bloque

El contenido HTML SHALL guardarse identificado por su huella, y el bloque SHALL guardar solo esa huella. Dos bloques con el mismo contenido SHALL compartir el mismo guardado.

Lo que se sirve al bloque SHALL identificarse por la huella del contenido junto con la de lo que la plataforma le inyecta, de forma que una correccion de esa parte alcance tambien a los bloques que el navegador ya tenia guardados.

#### Scenario: Una correccion de la plataforma llega a un bloque ya visto

- **WHEN** cambia lo que la plataforma inyecta en los documentos y se vuelve a abrir un bloque que no cambio
- **THEN** el bloque recibe la version corregida

#### Scenario: Sin cambios no se vuelve a descargar

- **WHEN** se abre un bloque que el navegador ya tenia y no cambio nada
- **THEN** el contenido no se vuelve a descargar

#### Scenario: Duplicar un bloque

- **WHEN** el constructor duplica un bloque de HTML
- **THEN** los dos bloques apuntan al mismo contenido
- **AND** no se guarda una segunda copia

#### Scenario: Cambiar el contenido de un bloque

- **WHEN** el constructor reemplaza el contenido de un bloque duplicado
- **THEN** solo ese bloque cambia
- **AND** el otro conserva el contenido anterior

### Requirement: El bloque muestra el fondo de la aplicacion

Un bloque de HTML sin estilos propios SHALL verse del color de la pagina de la aplicacion, no sobre un fondo blanco. Un contenido que declare su propio fondo SHALL poder sobreescribir ese color.

#### Scenario: Bloque sin fondo propio

- **WHEN** se abre un bloque de HTML cuyo contenido no pinta ningun fondo
- **THEN** se ve del color del fondo de la aplicacion
- **AND** no aparece ningun rectangulo blanco

#### Scenario: Contenido con su propio fondo

- **WHEN** el contenido de un bloque declara su propio fondo
- **THEN** ese fondo es el que se muestra

### Requirement: Lo que se edita es el contenido tal como se guarda

El editor de codigo de un bloque de HTML SHALL cargar y guardar el contenido crudo que escribio el constructor, sin el puente ni la hoja base que la plataforma inyecta al servir. Lo que la plataforma pueda volver a inyectar SHALL NOT entrar en el almacenamiento. Si el contenido guardado ya trae nodos inyectados, SHALL reemplazarlos por la version actual en lugar de acumularlos.

#### Scenario: Formatear el codigo no incorpora la inyeccion

- **WHEN** el constructor formatea el codigo de un bloque de HTML
- **THEN** el contenido guardado sigue siendo lo que escribio, sin el puente ni la hoja base

#### Scenario: Abrir y guardar no duplica lo inyectado

- **WHEN** el constructor abre y vuelve a guardar el codigo de un bloque que ya habia servido
- **THEN** el contenido no crece con copias del puente ni de la hoja base

### Requirement: Tope de tamano

El sistema SHALL rechazar contenido HTML que supere el tamano maximo admitido, con un mensaje que diga el tamano del archivo y el maximo.

#### Scenario: Archivo demasiado grande

- **WHEN** el constructor importa un archivo que supera el maximo
- **THEN** se rechaza con un mensaje que indica ambos tamanos
- **AND** el bloque no cambia
