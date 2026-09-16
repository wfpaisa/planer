## 1. Infraestructura: API Batch al arranque

- [x] 1.1 En el arranque del servidor, tras `startPocketBase()`, leer `GET /api/settings`, marcar `batch.enabled = true` y guardar con `PATCH /api/settings` usando el token de administrador
- [x] 1.2 Verificar que el ajuste es idempotente en cada arranque y no pisa otras configuraciones de settings

## 2. Columnas del sistema en la grilla

- [x] 2.1 Definir la lista fija de columnas del sistema (`id`, `created`, `updated`)
- [x] 2.2 Incluirlas en el calculo de columnas visibles de la grilla, ocultas por defecto via `meta.hidden`
- [x] 2.3 Listarlas en el menu "Mostrar columnas" con su estado oculta/visible
- [x] 2.4 Renderizarlas como columnas de solo lectura (id en texto corto; created/updated como fecha)
- [x] 2.5 Excluirlas de la busqueda y del ordenamiento de la grilla

## 3. Exportar datos

- [x] 3.1 Agregar boton "Exportar" en la barra de la grilla con las cuatro opciones (exportar/copiar CSV/JSON)
- [x] 3.2 Traer todas las filas de la tabla con `getFullList` paginado
- [x] 3.3 Generar CSV con el separador elegido (punto y coma por defecto) incluyendo la columna id y los nombres tecnicos como cabecera
- [x] 3.4 Generar JSON incluyendo la columna id
- [x] 3.5 Implementar descarga de archivo y copia al portapapeles (con respaldo si el portapapeles esta bloqueado)
- [x] 3.6 Selector de separador coma o punto y coma para el CSV

## 4. Importar: dialogo y parseo

- [x] 4.1 Agregar boton "Importar" en la tabla abierta que abre el dialogo
- [x] 4.2 Soporte para arrastrar un archivo o pegar un texto
- [x] 4.3 Parser de CSV propio (separador elegido, campos entre comillas, comillas escapadas, saltos de linea)
- [x] 4.4 Parser de JSON (array de objetos o de arrays)
- [x] 4.5 Detectar formato no soportado, mostrar error y no habilitar la previsualizacion

## 5. Importar: mapeo y conversion

- [x] 5.1 Emparejar columnas del archivo con las de la tabla (por nombre o etiqueta)
- [x] 5.2 Ofrecer crear columnas nuevas para las del archivo que no existen
- [x] 5.3 Convertir valores por tipo de columna (number, bool, date, texto y lista)
- [x] 5.4 No convertir archivo/persona/relacion; guardar el id tal cual o dejar el valor vacio
- [x] 5.5 Recoger errores por celda y por fila con el motivo

## 6. Importar: previsualizacion

- [x] 6.1 Modal a pantalla completa con los datos, el total de filas y el listado de errores
- [x] 6.2 Marcar cada fila como nueva o "actualizara la fila X" en el modo Sobrescribir
- [x] 6.3 Boton "filas fallidas" para descargar las filas con error
- [x] 6.4 Deshabilitar Guardar y mostrar aviso de advertencia cuando hay errores

## 7. Importar: guardado

- [x] 7.1 Selector de modo Añadir / Sobrescribir / Reemplazar todo
- [x] 7.2 Añadir: crear registros nuevos sin tocar los existentes e ignorando las ids
- [x] 7.3 Sobrescribir: diferenciar por id (actualizar si existe, crear si no)
- [x] 7.4 Reemplazar: borrar las filas y cargar conservando las ids (con confirmacion)
- [x] 7.5 Casillas "las celdas vacias borran el valor guardado" y "continuar aunque alguna fila falle"
- [x] 7.6 Escrituras por lotes con la API Batch y manejo de la respuesta por fila
- [x] 7.7 Tope de filas importables con aviso claro

## 8. Verificacion

- [x] 8.1 Ejecutar `bun run typecheck`
- [x] 8.2 Probar el flujo con `bun run dev` + `bun run smoke`
- [x] 8.3 Aplicar formato y lint sobre los archivos tocados
