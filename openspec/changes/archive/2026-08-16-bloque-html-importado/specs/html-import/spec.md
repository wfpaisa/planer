## Purpose

Convierte un archivo HTML suelto en un bloque que funciona dentro de la plataforma: lo revisa al entrar, y opcionalmente crea sus tablas, carga sus datos de ejemplo, adapta sus estilos y conecta su guardado, dejando comparar el resultado antes de aceptarlo.

## ADDED Requirements

### Requirement: Importar arrastrando o pegando

El constructor SHALL poder dar contenido a un bloque de HTML de dos maneras: arrastrando un archivo `.html` o pegando el codigo. Las dos SHALL llevar al mismo sitio.

#### Scenario: Arrastrar un archivo

- **WHEN** el constructor arrastra un archivo `.html` sobre la zona de importacion
- **THEN** el contenido queda cargado y listo para revisar

#### Scenario: Pegar codigo

- **WHEN** el constructor pega codigo HTML en el area de texto
- **THEN** el contenido queda cargado y listo para revisar

#### Scenario: Archivo que no es HTML

- **WHEN** el constructor arrastra un archivo que no es `.html`
- **THEN** se rechaza con un mensaje que dice que solo se admiten archivos HTML

#### Scenario: Sin contenido no hay opciones

- **WHEN** todavia no se ha cargado ningun contenido
- **THEN** las opciones de guardar y de optimizar estan apagadas

### Requirement: Diagnostico al importar

Al cargar contenido, el sistema SHALL revisarlo y entregar un diagnostico sin usar inteligencia artificial, que SHALL indicar al menos: el tamano, cuantos colores tiene y donde estan, si el contenido guarda datos en el navegador y en cuantos puntos, si trae datos de ejemplo reconocibles, que recursos externos pide, y en cuantos puntos lleva la pantalla a otra direccion.

Una opcion de la varita SHALL quedar disponible siempre que haya algo sobre lo que trabajar, aunque el archivo este desordenado. Solo SHALL desactivarse cuando en el archivo no exista nada de lo que esa opcion necesita.

#### Scenario: Archivo con datos de ejemplo y colores propios

- **WHEN** se importa un archivo con datos de ejemplo y con colores propios
- **THEN** el diagnostico los cuenta
- **AND** las tres opciones de la varita quedan disponibles

#### Scenario: Archivo con los colores repartidos

- **WHEN** se importa un archivo cuyos colores estan repartidos entre variables y reglas sueltas
- **THEN** el diagnostico dice cuantos hay de cada clase
- **AND** la opcion de adaptar estilos sigue disponible

#### Scenario: Archivo sin colores propios

- **WHEN** se importa un archivo que no define ningun color
- **THEN** la opcion de adaptar estilos queda desmarcada con el motivo

#### Scenario: Recursos externos

- **WHEN** el contenido importado pide tipografias o iconos de otro servidor
- **THEN** el diagnostico los lista como aviso
- **AND** el contenido se puede guardar igual

#### Scenario: Contenido que cambia de pagina

- **WHEN** se importa un contenido que lleva la pantalla a otra direccion, como el que tiene su propio inicio de sesion
- **THEN** el diagnostico lo cuenta y lo avisa
- **AND** ninguna opcion de la varita se desactiva por eso

#### Scenario: El diagnostico no necesita IA

- **WHEN** la aplicacion no tiene inteligencia artificial configurada
- **THEN** el diagnostico se entrega igual

### Requirement: Guardar sin optimizar

El constructor SHALL poder guardar el contenido importado tal cual, sin pasar por la varita magica.

#### Scenario: Guardar directo

- **WHEN** el constructor importa un archivo y elige guardar
- **THEN** el bloque queda con ese contenido
- **AND** no se crea ninguna tabla ni se cambia ningun estilo

### Requirement: Opciones de la varita magica

Antes de optimizar, el sistema SHALL ofrecer tres opciones, marcadas por defecto cuando el diagnostico las considere aplicables: crear la base de datos a partir del contenido, cargar los datos de ejemplo, y adaptar los estilos a la aplicacion.

Conectar el guardado SHALL alcanzar tambien al guardia de sesion del contenido, si lo tiene: donde el contenido comprueba si alguien inicio sesion y se va a otra pagina si no, SHALL pasar a decidir con quien esta mirando la pantalla.

Adaptar los estilos SHALL conservar la forma y el diseno del contenido original: SHALL cambiar colores, espaciados y bordes por los de la aplicacion, y SHALL NOT reorganizar la estructura. SHALL alcanzar tanto a las variables de color como a los colores escritos sueltos en el resto de las reglas.

#### Scenario: Opciones por defecto

- **WHEN** el diagnostico considera las tres opciones aplicables
- **THEN** las tres aparecen marcadas

#### Scenario: Opcion no aplicable

- **WHEN** el contenido no trae datos de ejemplo reconocibles
- **THEN** la opcion de cargar datos de ejemplo aparece desmarcada y explicada
- **AND** la opcion de crear la base de datos sigue disponible si el contenido guarda algo

#### Scenario: Contenido con su propio guardia de sesion

- **WHEN** el contenido se va a otra pagina cuando no reconoce una sesion guardada y se conecta su guardado
- **THEN** el guardia pasa a usar a quien esta mirando la pantalla
- **AND** el contenido deja de irse a otra pagina

#### Scenario: Datos de ejemplo del propio archivo

- **WHEN** se marca cargar datos de ejemplo y el contenido trae los suyos
- **THEN** se usan esos, no unos inventados

#### Scenario: Sin inteligencia artificial configurada

- **WHEN** la aplicacion no tiene inteligencia artificial configurada
- **THEN** la varita aparece apagada con su explicacion
- **AND** importar, diagnosticar y guardar siguen funcionando

### Requirement: La varita avanza por pasos visibles

La varita SHALL ejecutarse por pasos y SHALL mostrar cual esta en curso, cuales terminaron y cual fallo. Un paso que falla SHALL NOT deshacer los pasos anteriores, y SHALL poder reintentarse.

#### Scenario: Seguir el avance

- **WHEN** el constructor lanza la varita
- **THEN** ve la lista de pasos y cual esta en curso

#### Scenario: Un paso falla

- **WHEN** falla el paso que adapta los estilos
- **THEN** se marca ese paso como fallido con su motivo
- **AND** lo conseguido en los pasos anteriores se conserva
- **AND** el constructor puede reintentar ese paso

#### Scenario: Punto de guardado automatico

- **WHEN** el constructor lanza la varita
- **THEN** antes de tocar nada se crea un punto de guardado en el historial
- **AND** ese punto queda nombrado de forma que se reconozca

### Requirement: Tablas creadas por la varita

Cuando se marca crear la base de datos, la varita SHALL crear las tablas necesarias y SHALL declararlas en el manifiesto del bloque. Las columnas SHALL deducirse de los datos de ejemplo si los hay, y del codigo que guarda los datos si no los hay.

La varita SHALL NOT crear tablas que rehagan lo que la plataforma ya provee: sesiones, personas o usuarios que sirvan para entrar, contrasenas y roles. Cuando el contenido traiga datos de esa clase, SHALL descartarlos y SHALL decir al constructor que eso ya lo pone la plataforma y que el contenido debe usar a quien esta mirando.

Las tablas creadas SHALL quedar disponibles para el bloque en cuanto el constructor acepte el resultado, sin volver a abrir la aplicacion.

#### Scenario: Crear tablas a partir de los datos de ejemplo

- **WHEN** el contenido lista equipos con sus columnas y se marca crear la base de datos
- **THEN** se crea una tabla con esas columnas
- **AND** queda declarada en el manifiesto del bloque

#### Scenario: Crear tablas a partir del codigo

- **WHEN** el contenido no trae datos de ejemplo pero guarda datos en el navegador
- **THEN** las columnas se deducen del codigo que los guarda
- **AND** las tablas quedan declaradas en el manifiesto del bloque

#### Scenario: Reutilizar una tabla existente

- **WHEN** ya existe una tabla que corresponde al contenido
- **THEN** la varita la reutiliza en vez de crear otra igual

#### Scenario: El contenido trae su propio acceso

- **WHEN** el contenido trae usuarios con sus claves, sus roles o una marca de quien inicio sesion
- **THEN** no se crea ninguna tabla para eso
- **AND** se le dice al constructor que la sesion, las personas y los roles ya los pone la plataforma

#### Scenario: Una tabla de personas que no es acceso

- **WHEN** el contenido trae una lista de personas que es contenido de la aplicacion y no sirve para entrar
- **THEN** su tabla se crea con normalidad

#### Scenario: El bloque ve las tablas recien creadas

- **WHEN** el constructor acepta un resultado en el que la varita creo tablas
- **THEN** el bloque se dibuja con su contenido
- **AND** no dice que falte ninguna de esas tablas

### Requirement: Comparar antes y despues

Terminada la varita, el sistema SHALL mostrar el contenido anterior y el nuevo uno junto al otro, ambos dibujados como se veran en la aplicacion.

#### Scenario: Ver la comparacion

- **WHEN** la varita termina
- **THEN** el constructor ve el contenido anterior y el nuevo lado a lado

#### Scenario: La comparacion no publica nada

- **WHEN** el constructor esta comparando
- **THEN** el enlace publico no cambia

### Requirement: Aceptar o descartar el resultado

El resultado de la varita SHALL NOT quedar aplicado al bloque hasta que el constructor lo acepte. Descartarlo SHALL dejar el bloque como estaba.

#### Scenario: Aceptar

- **WHEN** el constructor acepta el resultado
- **THEN** el bloque pasa a usar el contenido nuevo y su manifiesto

#### Scenario: Descartar

- **WHEN** el constructor descarta el resultado
- **THEN** el bloque conserva el contenido y el manifiesto que tenia

#### Scenario: Descartar despues de crear tablas

- **WHEN** el constructor descarta el resultado y la varita habia creado tablas
- **THEN** el bloque conserva lo que tenia
- **AND** se le informa de que tablas quedaron creadas y donde eliminarlas
