## Why

Hoy el constructor solo puede agregar filas de a una en el editor de tablas. No existe manera de cargar ni descargar datos en bloque, lo que vuelve lento y propenso a errores meter conjuntos grandes o datos que ya viven en otro programa (hojas de calculo, bases, archivos). Esta mejora agrega importar y exportar datos de una tabla, y de paso deja visibles las columnas del sistema (id, created, updated).

## What Changes

- Boton **Importar** en el editor de la tabla abierta. Abre un dialogo para arrastrar un archivo o pegar un texto, solo **CSV o JSON**.
- Emparejamiento de columnas del archivo con las columnas de la tabla. Las columnas del archivo que no existen se pueden crear; las de la tabla que no vienen quedan vacias.
- Conversion automatica de valores segun el tipo de la columna (numero, si/no, fechas al formato mas usado). Las columnas de archivo, persona y relacion no se convierten; si el valor es un id se guarda tal cual.
- Previsualizacion a pantalla completa con todos los datos, total de filas, listado de errores y, en el modo Sobrescribir, cada fila marcada como **nueva** o **actualizara la fila X**.
- Si hay errores, el boton **Guardar** queda deshabilitado, se muestra un aviso con advertencia y aparece un boton **filas fallidas** para descargarlas.
- Selector de modo antes de guardar:
  - **Añadir**: crea registros nuevos y no toca los existentes. Las ids del archivo se ignoran.
  - **Sobrescribir**: actualiza los que coinciden por id y crea los que no.
  - **Reemplazar todo**: borra la coleccion y carga el archivo conservando las ids (para no romper relaciones).
- Casillas opcionales: **"Las celdas vacias borran el valor guardado"** y **"Continuar aunque alguna fila falle"**.
- Guardado masivo mediante la API Batch de PocketBase.
- Boton **Exportar** con cuatro opciones: exportar CSV, copiar CSV, exportar JSON, copiar JSON. Incluyen la columna id y todo el contenido de la tabla. El separador del CSV se elige (coma o punto y coma, punto y coma por defecto).
- Las columnas del sistema **id**, **created** y **updated** aparecen en "Mostrar columnas", ocultas por defecto y de solo lectura.
- Al arrancar, el servidor activa la API Batch de PocketBase (detalle de implementacion, sin cambio visible para el constructor).

## Capabilities

### New Capabilities

- `builder/tables`: importar y exportar datos en el editor de tablas del constructor, y mostrar/ocultar las columnas del sistema (id, created, updated) en la grilla.

### Modified Capabilities

- Ninguna.

## Impact

- **Panel**: editor de tablas (barra de herramientas de la grilla, botonera de exportar, dialogo de importar, previsualizacion a pantalla completa, render de columnas de solo lectura).
- **Servidor**: activacion de la API Batch de PocketBase al arrancar (configuracion interna, no expuesta al navegador).
- **Datos**: no cambia el esquema de colecciones ni los datos existentes.
- **Dependencias**: un parser de CSV (se puede escribir a mano o sumar una libreria ligera); no hace falta libreria nueva para JSON.
