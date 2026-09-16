## 1. Antes de empezar

- [x] 1.1 Comprobar que `relaciones-por-llave` esta implementado: columna que se muestra, columna unica y emparejado por llave

## 2. Modelo de datos

- [x] 2.1 Crear por aplicacion la coleccion de datos propios de las personas, enlazada a la cuenta comun
- [x] 2.2 Crearla tambien para las aplicaciones que ya existen, vacia
- [x] 2.3 Registrar personas como tabla de la aplicacion, marcada como tabla del sistema
- [x] 2.4 Definir las columnas del sistema --cuenta, lo que puede hacer, roles-- con la marca de intocables
- [x] 2.5 Impedir borrar la tabla de personas
- [x] 2.6 Impedir borrar, renombrar y cambiar de tipo una columna del sistema, en el servidor y no solo en la pantalla
- [x] 2.7 Al quitar a una persona de una aplicacion, borrar sus datos propios de esa aplicacion y solo de esa

## 3. Escribir donde toca

- [x] 3.1 Editar la cuenta escribe en la coleccion comun; editar el nivel y los roles escribe en `app_access`; editar una columna propia escribe en la coleccion de la aplicacion
- [x] 3.2 Añadir una fila crea la cuenta si no existe y el acceso a esta aplicacion
- [x] 3.3 Borrar una fila quita el acceso, sin borrar la cuenta

## 4. La cuadricula

- [x] 4.1 Sustituir el formulario de `PeoplePanel.tsx` por la cuadricula de tablas, conservando el bloque de roles arriba
- [x] 4.2 Enseñar las columnas del sistema y permitir editarlas desde la cuadricula
- [x] 4.3 Enseñar en la cuadricula que una columna del sistema no se puede borrar ni cambiar de tipo
- [x] 4.4 Conservar el cambio de contrasena en la fila, con lo que ya hace: se enseña una vez, se copia, se cierran las sesiones
- [x] 4.5 Excluir la contrasena de la lista de columnas y de la pantalla de crear columna
- [x] 4.6 Avisar al quitar el acceso de que se pierden los datos propios de esta aplicacion
- [x] 4.7 Retirar el formulario viejo cuando la cuadricula lo cubra entero

## 5. Columnas propias

- [x] 5.1 Añadir columnas a la tabla de personas con los tipos que ya existen
- [x] 5.2 Marcar una columna propia como unica, con las mismas reglas que en cualquier otra tabla
- [x] 5.3 Comprobar que una columna de persona de otra tabla puede mostrar y emparejar por una columna unica de personas
- [x] 5.4 Limitar el emparejado a las personas invitadas a esta aplicacion

## 6. Importar y exportar

- [x] 6.1 Importar la tabla de personas con la misma pantalla que las demas
- [x] 6.2 Reconocer por correo a quien ya tiene cuenta y actualizar sus datos en vez de duplicar
- [x] 6.3 Decir cuantas cuentas se van a crear antes de guardar nada
- [x] 6.4 Casilla expresa para crear cuentas, desmarcada siempre al abrir
- [x] 6.5 Dejar fuera las filas que crearian cuenta cuando la casilla no esta marcada, diciendo por que
- [x] 6.6 Exportar la tabla de personas sin que la contrasena forme parte de lo que la exportacion puede leer
- [x] 6.7 Aceptar contrasenas al importar para el alta masiva, sin guardarlas en ningun sitio de donde se puedan releer

## 7. API

- [x] 7.1 Ampliar `/api/apps/:id/personas` con las columnas propias de la aplicacion
- [x] 7.2 Conservar la forma corta mientras siga habiendo quien la use
- [x] 7.3 Entregar de una persona solo las columnas que la pagina tenga declaradas
- [x] 7.4 Repasar `web/src/lib/people.tsx`, que hoy espera la forma corta y fija

## 8. Pruebas

- [x] 8.1 La misma persona invitada a dos aplicaciones: rellenar una columna en una y comprobar que en la otra no existe
- [x] 8.2 Quitar a esa persona de una aplicacion y comprobar que sus datos en la otra siguen intactos
- [x] 8.3 Exportar la tabla de personas en los cuatro formatos y comprobar que no hay contrasenas en ninguno
- [x] 8.4 Importar doscientas filas con la casilla sin marcar y comprobar que no se crea ninguna cuenta
- [x] 8.5 Importar las mismas doscientas con la casilla marcada y comprobar el recuento que se anuncio
- [x] 8.6 Marcar el documento como unico, importar excesos de velocidad con cedulas y comprobar que se conectan solos
- [x] 8.7 Intentar borrar la tabla de personas y una columna del sistema, llamando directamente a la API
