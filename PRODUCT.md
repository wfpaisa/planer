# Product

<!-- impeccable:product-schema 1 -->

## Plataforma

web

## Usuarios

- Usuario principal: **el empleado de cualquier área de una empresa**, sin conocimientos de programación, que arma por su cuenta las pantallas que resuelven la necesidad de su equipo sin pasar por un departamento de tecnología ni esperar a que alguien se la construya.
- También lo usa el **autónomo o la persona que gestiona sus propios datos**, con la misma herramienta y sin una versión distinta.
- Audiencia secundaria: los **colaboradores** de una aplicación publicada, que la usan para leer, crear o editar registros; los roles que les da quien construye (nombres libres de cada aplicación) deciden qué páginas ven.
- Uso típico: llevar un registro de área (empleados, clientes, pedidos, inventario, incidencias), cruzarlo con datos que llegan de otros sistemas y mostrarlo en pantallas simples, abiertas al público o sólo para un grupo.

## Propósito del producto

Planer es una plataforma que se instala en el propio servidor del usuario y le permite **crear aplicaciones web pequeñas y sus Base de datos sin programar**. Cada aplicación tiene dos caras: una base de datos de tablas que se manejan como hoja de cálculo, y una aplicación de pantallas (páginas HTML que escribe la IA) sobre esas tablas. Cuando está lista, se publica con un enlace (abierta o privada). El éxito se mide en que el usuario pase de una idea a una app publicada funcionando, sin escribir código ni depender de un servicio en la nube.

Planer está pensado para funcionar dentro de una empresa: el que construye no es un técnico, es el empleado que tiene la necesidad. La herramienta tiene que aguantar que muchas áreas armen sus propias pantallas, con sus propios colaboradores y sus propios permisos, sin que ninguna dependa de un departamento de tecnología para arrancar.

## Posicionamiento

El diferenciador central confirmado es la **generación con inteligencia artificial**: el usuario describe lo que necesita con una frase y la IA crea las tablas y las pantallas necesarias. La IA escribe el código necesario en un html con sus estilos y scripts, de modo que todo lo generado se puede revisar, permite hacer modificaciones mediante IA. Se complementa con el carácter autocontenido (un sólo comando de instalación, un sólo puerto, sin dependencias externas) y con permisos aplicados en el servidor (qué páginas abre cada rol, y qué tablas declara cada página).

## Contexto de uso

- El usuario administra todo desde un panel: un tablero de aplicaciones, un editor de tablas tipo hoja de cálculo y un constructor de páginas.
- Cada aplicación guarda su base de datos en tablas reales (no filas genéricas), con sus reglas de acceso escritas automáticamente.
- Publicación por enlace: abierta a cualquiera o sólo para cuentas invitadas; escribir exige siempre una cuenta de la aplicación.
- Roles libres por aplicación (nombres que elige el negocio; `admin` existe siempre); deciden qué páginas se abren. Quien abre una página alcanza todas las filas de las tablas que esa página declara.
- Columna de tipo persona: enlaza una fila con alguien invitado a la aplicación.
- Opción de conectarse a un modelo de IA (Claude o compatible con ChatGPT, incluidos Ollama, LM Studio, OpenRouter); la clave se guarda en el servidor y nunca viaja al navegador.

## Capacidades y restricciones

- Editor de tablas con tipos de columna: texto, texto largo, número, sí/no, correo, enlace, fecha, lista de opciones, archivo, relación con otra tabla y persona.
- Páginas en HTML escritas por la IA con el sistema de estilos de la casa; las antiguas de bloques se pueden convertir.
- Selección de filas, borrado masivo y exportación selectiva en la grilla; importar/exportar tablas.
- Apariencia por aplicación: nombre, enlace público, icono y color; paletas de colores, modo claro y oscuro.
- Autocontenido: se instala en el servidor del usuario; todo corre en un sólo puerto (servidor Bun + PocketBase como proceso hijo).
- Sin sistema de migraciones internas; el registro de producto no impone decisiones de diseño.

## Compromisos de marca

Sin compromisos de marca fijos confirmados. El nombre actual es "Planer" y toda la interfaz está en español con los acentos y la ñ correctos; se usa por convención del proyecto, no como restricción vinculante. No hay logos, imágenes ni activos de marca establecidos.

## Evidencia disponible

- Documentación de arranque, estructura y características en el README del repositorio.
- Script de demostración que carga una app de ejemplo (directorio de empleados, tres pantallas, publicada).
- Prueba automatizada de humo que recorre el camino completo (crear app, tablas, cambiar columnas sin perder datos, publicar, invitar, verificar que la clave de IA no sale del servidor).
- No hay testimonios, casos de estudio, métricas de uso ni presupuestos; no deben inventarse.

## Principios del producto

- **El que tiene la necesidad es el que construye**: quien arma la pantalla es el empleado del área, no un técnico. Cualquier paso que obligue a pedir ayuda a tecnología es un fallo del producto.
- **De la frase a la app**: bajar la fricción de pasar de una idea a una aplicación funcionando, con la IA como atajo y el constructor visual como control.
- **Configuración, no código**: todo lo que crea la herramienta (y la IA) es configuración editable y validada, nunca código frágil.
- **Cada quien ve lo suyo**: los permisos (roles por página, tablas declaradas por página, cuenta para escribir) se aplican en el servidor, no escondiendo cosas en el navegador.
- **Autocontenido y simple**: el usuario controla sus datos y su servidor, con un arranque de un comando y un único puerto.
- **Sin pérdida de datos**: cambiar la estructura de columnas preserva los datos existentes.

## Accesibilidad e inclusión

No se estableció un requisito de accesibilidad específico del producto; la interfaz está en español y los mensajes usan un lenguaje sencillo.
