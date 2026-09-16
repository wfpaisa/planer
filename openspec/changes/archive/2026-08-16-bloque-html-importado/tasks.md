## 1. Tipos y almacenamiento

- [x] 1.1 Anadir a `shared/types.ts` el tipo de bloque `html` con su huella de documento, su manifiesto de fuentes y su tope de alto, e incluirlo en la union `Block` y en `BlockType`
- [x] 1.2 Anadir a `shared/types.ts` los tipos del diagnostico, de los pasos de la varita y de su resultado
- [x] 1.3 Registrar la coleccion interna de documentos HTML en `INTERNAL` (`server/config.ts`) y crearla de forma idempotente en `server/bootstrap.ts`, con la huella como campo unico
- [x] 1.4 Escribir el modulo de documentos en el servidor: guardar por huella reutilizando el existente, leer por huella, y calcular la huella del texto crudo
- [x] 1.5 Definir el tope de tamano de un documento y rechazar por encima de el con mensaje que diga ambos tamanos

## 2. Servir el documento y el puente

- [x] 2.1 Escribir el guion del puente: recibe colores y modo por mensaje, los escribe en la raiz del documento, observa el alto y lo reporta, y expone las cinco ordenes de datos
- [x] 2.2 Escribir la hoja base corta (tipografia, botones, tarjetas, tablas) que acompana al puente
- [x] 2.3 Anadir la ruta que sirve un documento por su huella, envuelto solo con el guion del puente, con cabeceras de cache inmutable
- [x] 2.4 Registrar la ruta en `server/index.ts` y comprobar que responde igual para el constructor y para un visitante de una app publicada

## 3. El bloque en el editor y en el publicado

- [x] 3.1 Escribir el componente de la caja aislada: marco con permisos minimos, envio de colores y modo al cargar y al cambiar, y ajuste de alto con tope
- [x] 3.2 Anadir el caso `html` a `BlockView` en `web/src/blocks/render.tsx`, con el mensaje de bloque vacio en el editor y omision en la app publicada, respetando `showIssues`
- [x] 3.3 Anadir el bloque al catalogo (`BLOCK_MENU`) y a `emptyBlock` en `web/src/routes/AppEditor.tsx`
- [x] 3.4 Anadir la seccion del bloque en `web/src/components/BlockInspector.tsx`: acceso a importar, tope de alto y lista de fuentes declaradas
- [x] 3.5 Comprobar que el bloque hereda el filtro por roles sin codigo nuevo, tanto de pagina como de bloque

## 4. Ordenes de datos

- [x] 4.1 Escribir en el panel el resolutor de mensajes: identifica el marco por su ventana, valida que la fuente este en el manifiesto del bloque y traduce nombres logicos a columnas reales
- [x] 4.2 Implementar listar y obtener, devolviendo las filas con los nombres logicos declarados
- [x] 4.3 Implementar crear, actualizar y borrar, usando el cliente de la sesion activa
- [x] 4.4 Devolver al HTML un motivo legible cuando la operacion es rechazada por permisos
- [x] 4.5 Rechazar toda fuente o columna no declarada, sin consultar la base

## 5. Revision e historial

- [x] 5.1 Cubrir el bloque `html` en la revision de referencias: tabla ausente como `broken`, columna ausente como `warning` nombrando la fuente y el nombre logico
- [x] 5.2 Comprobar que el arreglo automatico por renombrado deja intactos el manifiesto y el contenido del bloque, y no anade avisos informativos por el
- [x] 5.3 Recolectar las huellas nombradas por el borrador y por las versiones supervivientes, y borrar los documentos no nombrados justo despues de `pruneVersions()`
- [x] 5.4 Comprobar que una version antigua sigue previsualizandose con su contenido despues de cambiar el del borrador

## 6. Importar y diagnostico

- [x] 6.1 Escribir el analizador del diagnostico sin IA: tamano, si los colores estan reunidos, puntos que guardan en el navegador, datos de ejemplo reconocibles y recursos externos
- [x] 6.2 Anadir la ruta de importacion que recibe el contenido, lo guarda por huella y devuelve el diagnostico
- [x] 6.3 Escribir el modal de importacion: zona para arrastrar el archivo, area para pegar codigo, rechazo de archivos que no sean HTML, y opciones apagadas mientras no haya contenido
- [x] 6.4 Mostrar el diagnostico bajo la zona de importacion y habilitar la accion de guardar
- [x] 6.5 Guardar sin optimizar: el bloque queda con el contenido importado y nada mas cambia

## 7. Varita magica

- [x] 7.1 Escribir el modulo compartido que genera el texto de instrucciones (colores, ordenes, forma del manifiesto y tablas elegidas con sus columnas)
- [x] 7.2 Derivar del diagnostico que casillas se ofrecen marcadas y con que motivo se desmarcan
- [x] 7.3 Crear el punto de guardado automatico antes de ejecutar el primer paso
- [x] 7.4 Paso de crear tablas: enviar a la IA solo los datos de ejemplo encontrados, crear o reutilizar tablas y devolver el manifiesto propuesto
- [x] 7.5 Paso de cargar datos de ejemplo: transformar sin IA los datos ya leidos en filas de las tablas creadas
- [x] 7.6 Paso de adaptar estilos: enviar solo el bloque de variables de color junto a los colores de la aplicacion, y sustituir ese trozo exacto en el documento
- [x] 7.7 Paso de conectar datos: enviar solo las funciones que tocan el guardado junto al texto de instrucciones, y sustituir ese trozo exacto
- [x] 7.8 Una ruta por paso, sin estado en el servidor, con tope de tamano del trozo enviado para no pasarse del presupuesto de la IA
- [x] 7.9 Panel de la varita con la lista de pasos, cual esta en curso, cual fallo con su motivo y reintento por paso
- [x] 7.10 Apagar la varita con su explicacion cuando no hay inteligencia artificial configurada, dejando vivas las demas acciones

## 8. Comparar, aceptar, descartar

- [x] 8.1 Guardar el resultado de la varita como documento candidato sin tocar el bloque
- [x] 8.2 Mostrar la comparacion lado a lado con dos cajas aisladas, una por huella
- [x] 8.3 Aceptar: cambiar la huella y el manifiesto del bloque
- [x] 8.4 Descartar: dejar el bloque como estaba e informar de las tablas que quedaron creadas y de donde eliminarlas

## 9. Instrucciones para una IA externa

- [x] 9.1 Anadir la accion de copiar instrucciones con seleccion de tablas, usando el modulo compartido de 7.1
- [x] 9.2 Comprobar que sin tablas elegidas el texto sale igualmente con colores y ordenes

## 10. Verificacion

- [x] 10.1 `bun run typecheck` sin errores
- [x] 10.2 Ampliar `scripts/smoke.ts`: crear un bloque HTML, importar contenido, comprobar el diagnostico, publicar, y comprobar que el paquete publico lleva la huella y no el contenido
- [x] 10.3 Cubrir en smoke que una fuente no declarada es rechazada y que una tabla con dueno por fila solo devuelve las filas propias
- [x] 10.4 Cubrir en smoke el recorte: un documento deja de estar nombrado y desaparece
- [ ] 10.5 Comprobar a mano con el archivo de referencia de 117 KB: importar, diagnostico, varita completa, comparar y aceptar
  - Hecho: importar, diagnostico, dibujado del bloque, aislamiento, ordenes de datos, punto de guardado, paso de datos de ejemplo, y el camino de fallo de la varita con reintento.
  - Pendiente: los tres pasos que usan IA, la comparacion y aceptar. El servidor de IA configurado (`http://127.0.0.1:8080/v1`) no responde, asi que no se pudieron ejecutar.

## 11. Lo que aparecio al probar con un archivo con su propio acceso

Salido de importar `vacaciones-admin.html`: la varita le creo una tabla `sesion`, el bloque se fue al dominio de la app y quedo clavado en el alto de la pagina de error del navegador.

- [x] 11.1 Puente: avisar al panel cuando el documento esta saliendo hacia otra direccion, antes de que se vaya
- [x] 11.2 Puente: desactivar los enlaces que sacan del bloque y el envio de formularios que no pasa por las ordenes de datos
- [x] 11.3 Panel: al recibir el aviso, devolver el documento al marco y volver al alto de partida para que se mida de nuevo
- [x] 11.4 Panel: tope de vueltas seguidas, para que un contenido que se va nada mas cargar no encadene recargas
- [x] 11.5 Avisar al constructor de que el contenido intento salir, en el editor y en la vista previa, sin mostrarlo en la app publicada; agotado el tope, decirle que el contenido tiene su propio inicio de sesion y que la varita puede quitarselo
- [x] 11.5b Paso de conectar datos: incluir el guardia de sesion en el trozo que se envia, para que decida con quien esta mirando en vez de irse a otra pagina
- [x] 11.6 Diagnostico: contar los puntos que cambian la direccion de la pagina y listarlos como aviso, sin desactivar ninguna casilla
- [x] 11.7 Anadir los roles de quien esta mirando a lo que recibe el HTML, junto a su identidad
- [x] 11.8 Varita: descartar en los dos caminos de deduccion (datos de ejemplo y codigo) lo que sea acceso — sesiones, usuarios para entrar, claves y roles — y devolver el motivo para mostrarlo
- [x] 11.9 Texto de instrucciones: decir que la sesion, las personas y los roles los pone la plataforma, y pedir que el contenido no haga su propio inicio de sesion
- [x] 11.10 Panel: quedarse con las tablas creadas por la varita al aceptar, para que el bloque no las de por inexistentes
- [x] 11.11 Ampliar `scripts/smoke.ts`: un contenido que se manda a otra pagina sigue mostrandose, y el diagnostico cuenta sus puntos de navegacion
- [ ] 11.12 Repetir a mano la prueba con `vacaciones-admin.html`: importar, ver el bloque dibujado y a su alto, y que la varita no proponga tablas de acceso
  - Saltada a peticion: exige el flujo interactivo completo en el navegador (importar, varita, comparar y aceptar), que el entorno no pudo reproducir.

## 12. Refinamientos de presentacion y edicion

- [x] 12.1 Hoja base: el `<html>` toma de base el color de la pagina con `var(--surface-page)` y el `body` queda transparente, para que un bloque sin fondo propio se vea del color de la aplicacion y no sobre un canvas blanco
  - Vitrina: `bun run smoke` pasa; test de idempotencia comprueba que se sirve el fondo.
- [x] 12.2 El editor de codigo carga y guarda el contenido crudo (ruta `/html/:hash/crudo`) en vez de lo servido, y `wrapDocument` es idempotente (reemplaza los nodos `data-plane` en lugar de acumularlos)
  - Vitrina: `bun run smoke` pasa; test de idempotencia: envolver dos veces no duplica la base, el puente ni el contenido.
