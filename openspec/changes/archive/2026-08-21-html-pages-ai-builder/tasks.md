## 1. Contexto unico y documentacion

- [x] 1.1 Ampliar el generador del contexto con espaciados y tamanos de texto, ademas de los colores que ya describe
- [x] 1.2 Anadir al contexto el nivel de acceso de la pagina y los roles de la aplicacion
- [x] 1.3 Anadir al contexto la seccion de limites explicitos: sin inicio de sesion propio, sin guardar en el navegador, sin salir de la pagina
- [x] 1.4 Separar el generador en dos salidas desde la misma fuente: contexto para la IA y seccion de documentacion
- [x] 1.5 Crear el script que escribe la seccion del README desde esa fuente
- [x] 1.6 Ejecutar el script y versionar la seccion generada en el README

## 2. La pagina como documento HTML

- [x] 2.1 Anadir `doc` y `sources` a `PageRecord` en los tipos compartidos, conservando `blocks`
- [x] 2.2 Anadir esos campos a la coleccion interna de paginas en el arranque
- [x] 2.3 Extender el guardado por contenido para que acepte documentos de pagina, no solo de bloque
- [x] 2.4 Extender el recorte de documentos huerfanos para que mire tambien el `doc` de las paginas
- [x] 2.5 Rutas de la API para leer y guardar el HTML de una pagina, con el limite de tamano ya existente
- [x] 2.6 Ruta publica para leer el HTML de una pagina de la app publicada
- [x] 2.7 Garantizar que toda aplicacion nace con una pagina de inicio y que borrarla se rechaza
- [x] 2.8 Anadir el nivel de acceso de tres valores a la pagina y aplicarlo en el servidor al servir su contenido

## 3. Archivos inyectados

- [x] 3.1 Crear el archivo de estilos con las variables de color, espaciado y tipografia, servido en una ruta estable
- [x] 3.2 Crear el archivo del puente de datos, servido en una ruta estable, con las mismas ordenes que hoy expone `window.plane`
- [x] 3.3 Inyectar al guardar las dos referencias con su comentario en espanol, si faltan
- [x] 3.4 Devolver constancia de la reposicion para que el panel pueda avisarla
- [x] 3.5 Retirar de los dos archivos cualquier contenido pegado en linea que quede del bloque de HTML

## 4. Dibujar la pagina

- [x] 4.1 Adaptar el marco aislado para recibir la pagina completa en vez de un bloque
- [x] 4.2 Ampliar el envio de tema para que incluya espaciados y tipografia, no solo colores
- [x] 4.3 Resolver las ordenes de datos contra el `sources` de la pagina
- [x] 4.4 Conservar el limite de reposiciones ante un documento que insiste en salir de la pagina
- [x] 4.5 Ruta del panel que abre una pagina por su HTML cuando tiene `doc`, y por bloques cuando no

## 5. Sidebar

- [x] 5.1 Componente de sidebar con la lista de paginas, su icono y la pagina actual marcada
- [x] 5.2 Filtrar la lista segun el permiso de quien mira
- [x] 5.3 Acciones de crear, borrar y decidir quien ve cada pagina, visibles solo para quien construye
- [x] 5.4 Salida al panel de aplicaciones, solo para quien construye
- [x] 5.5 Plegar y desplegar, con el estado recordado
- [x] 5.6 Ajustes de posicion y comportamiento en la apariencia de la aplicacion
- [x] 5.7 Pintar el sidebar con la paleta de la aplicacion en claro y oscuro

## 6. Barra Todo En Uno

- [x] 6.1 Componente de la barra con boton de IA, campo de texto, compartir y los dos iconos de ajustes
- [x] 6.2 Mostrarla solo a quien construye
- [x] 6.3 Colocarla centrada con la pagina en blanco y abajo con contenido, con transicion continua
- [x] 6.4 Animacion de apertura y cierre que nace de la barra y vuelve a ella, con cierre por escape
- [x] 6.5 Dialogo de ajustes de la aplicacion: nombre, icono, paleta, base de datos, personas y roles, importar HTML
- [x] 6.6 Dialogo de ajustes de la pagina: nombre, icono, quien puede verla, codigo HTML y cambios
- [x] 6.7 Interfaz de tres niveles para decidir quien ve la pagina, con roles solo en el tercer nivel
- [x] 6.8 Dialogo de compartir con los dos enlaces, su alcance y copiar
- [x] 6.9 Aceptar archivos soltados en cualquier parte de la pagina: HTML crea pagina, archivo de datos crea tabla
- [x] 6.10 Renombrar en toda la interfaz: "Conversaciones" para la IA, "Cambios" para las versiones de pagina
- [x] 6.11 Pintar la barra y sus dialogos con la paleta de la aplicacion

## 7. IA

- [x] 7.1 Coleccion interna de conversaciones por aplicacion, con la pagina donde se hizo cada una
- [x] 7.2 Dialogo de la IA con el mensaje inicial precargado desde el campo de la barra
- [x] 7.3 Boton de IA que abre conversacion nueva y da acceso a las anteriores
- [x] 7.4 Reemplazar las ordenes de IA que generaban bloques por la que escribe el HTML de la pagina abierta
- [x] 7.5 Mandar el contexto armado en el momento en cada peticion
- [x] 7.6 Orden de solo lectura para que la IA consulte datos y responda sin tocar la pagina
- [x] 7.7 Registrar cada peticion como un solo paso de los cambios de la pagina, con el texto que lo pidio
- [x] 7.8 Cuando algo queda fuera del alcance de una pagina, decirlo de forma expresa en la respuesta

## 8. Impacto en la base de datos

- [x] 8.1 Consulta que devuelve las paginas que declaran una tabla o una columna
- [x] 8.2 Clasificar cada cambio de estructura en sin riesgo o con riesgo
- [x] 8.3 Aplicar sin preguntar los cambios sin riesgo, con aviso corto donde corresponda
- [x] 8.4 Dialogo de impacto con que, para que, paginas afectadas y opciones, con la opcion inocua primero
- [x] 8.5 Agrupar todos los cambios con riesgo de una peticion en un solo dialogo
- [x] 8.6 Detalle de "para que" bajo demanda, resuelto con una consulta a la IA en ese momento
- [x] 8.7 Autorizar desde el dialogo que la IA arregle las paginas afectadas
- [x] 8.8 Guardar el cambio de tabla y el de las paginas como un unico paso reversible
- [x] 8.9 Colocar el dialogo antes de la secuencia de bloqueo de reglas que exige una tabla con dueno de fila

## 9. Historial

- [x] 9.1 Guardar en cada version el `doc` y el `sources` de cada pagina en vez de sus bloques
- [x] 9.2 Referenciar el HTML por su huella, sin copiarlo dentro de la version
- [x] 9.3 Marcar como solo lectura las versiones creadas antes del cambio
- [x] 9.4 Avisar antes de restaurar cuando la estructura de tablas cambio desde esa version
- [x] 9.5 Confirmar que restaurar sigue sin tocar filas ni columnas

## 10. Conversion de las aplicaciones existentes

- [x] 10.1 Accion asistida que genera con la IA el HTML equivalente a los bloques de una pagina
- [x] 10.2 Dejar revisar el resultado antes de reemplazar la pagina
- [x] 10.3 Rellenar el `sources` de la pagina con las tablas y columnas que usaban sus bloques

## 11. Retirada de los bloques

- [x] 11.1 Retirar los tipos de bloque de tabla, tarjetas, formulario, ficha, indicadores y texto
- [x] 11.2 Retirar el dibujado de bloques y el inspector
- [x] 11.3 Retirar la revision de referencias y su panel
- [x] 11.4 Retirar el campo `blocks` de las paginas y de las versiones nuevas
- [x] 11.5 Retirar del contrato de la IA lo que ya no existe
- [x] 11.6 Archivar el spec `block-checks` con este cambio

## 12. Verificacion

- [x] 12.1 `bun run typecheck` sin errores
- [x] 12.2 `bun run check` limpio sobre los archivos tocados
- [x] 12.3 Ampliar la prueba de humo: crear app, crear pagina con HTML, declarar una tabla, publicar, invitar y comprobar que un rol sin permiso no recibe el contenido
- [x] 12.4 Comprobar que renombrar una columna no rompe una pagina que la usa (queda en la prueba de humo)
- [x] 12.5 Comprobar a mano que borrar una columna abre el dialogo de impacto con las paginas correctas
- [x] 12.6 Comprobar a mano que cambiar la paleta repinta el sidebar, la barra y la pagina
