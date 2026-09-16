## Context

El editor de datos vive en `web/src/routes/DatabaseEditor.tsx`: una grilla que lee y escribe filas directo a PocketBase desde el navegador con el cliente `pb` (por el proxy `/pb`). El esquema (columnas) se gestiona por `/api`. No existe hoy ni importar ni exportar en bloque. Ver `proposal.md` para la motivacion.

PocketBase ya esta en `0.39.x` y expone el endpoint de lote `POST /api/batch`, que llega al navegador por el mismo proxy `/pb`. La API Batch se activa con una casilla de configuracion de PocketBase que hoy el constructor encendio a mano en su instalacion; una instalacion nueva la tendria apagada.

## Goals / Non-Goals

**Goals:**
- Cargar datos en bloque (CSV/JSON) en la tabla abierta con previsualizacion, errores por fila y tres modos de guardado.
- Descargar o copiar los datos de la tabla (CSV/JSON) con su columna id.
- Mostrar las columnas del sistema (id, created, updated) en la grilla como solo lectura.
- Garantizar que la API Batch este activa en cualquier arranque de Planer.

**Non-Goals:**
- No se importan archivos binarios (xlsx); solo CSV y JSON.
- No se cambia el esquema de colecciones ni se migran datos existentes.
- No se agrega colaboracion en tiempo real ni deduplicacion fuera de la id.
- Exportar no incluye columnas del sistema (created/updated), solo la id y las columnas de la tabla.

## Decisions

### Importar y exportar corren en el navegador

La lectura de datos ya se hace directo a PocketBase desde el panel, y el usuario pidio usar la API Batch web. Importar y exportar viven en el navegador (`DatabaseEditor` y componentes nuevos), llamando a `/pb/api/batch` para las escrituras y a `getFullList` para las lecturas. No se agrega una ruta `/api` nueva.

### Parser de CSV propio (sin dependencia nueva)

CSV y JSON se parsean en el cliente. JSON se resuelve con `JSON.parse`. Para CSV se escribe un parser pequeno que respete el separador elegido (coma o punto y coma), campos entre comillas, comillas escapadas y saltos de linea dentro de un campo.
- **Alternativa considerada:** agregar una libreria (p. ej. papaparse). Se descarta para no sumar dependencias a un proyecto que las evita; el parser cubre los casos que el formato elegido exige.

### Conversion de valores por tipo de columna

Un mapa `FieldType -> funcion de conversion` normaliza cada celda: `number` (parseFloat), `bool` (si/no/1/0/true/false), `date` (acepta formatos comunes y normaliza a ISO 8601), `text`/`longtext`/`email`/`url`/`select` (passthrough). `file`, `person` y `relation` no se convierten: si el valor parece un id se guarda tal cual, si no queda vacio. Cualquier celda que no se pueda convertir produce un error con la fila, la columna y el motivo.

### Diferenciar filas para Sobrescribir

Para el modo Sobrescribir se traen las ids existentes de la coleccion (`getFullList` pidiendo solo `id`). Cada fila importada con id se clasifica como "actualizara la fila X" o "nueva", y esa marca se muestra en la previsualizacion.

### Guardado por lotes con la API Batch

Las escrituras se agrupan en peticiones `/api/batch` (por ejemplo en tramos de 200) con el token del constructor. La respuesta da el estado por cada sub-peticion, lo que permite: continuar o abortar segun la casilla, y marcar las filas que fallaron. El modo Reemplazar primero borra las filas actuales (por lotes) y luego crea las del archivo conservando las ids.

### Activar la API Batch al arrancar

En el arranque (`server/index.ts`, justo despues de `startPocketBase()` y junto a `bootstrap()`), el servidor lee `GET /api/settings`, pone `batch.enabled = true` y guarda con `PATCH /api/settings` usando el token de administrador. Se lee y modifica el objeto completo para no pisar otras configuraciones. Es idempotente en cada arranque, como el `superuser upsert` actual, y cubre instalaciones nuevas.
- **Alternativa considerada:** documentar que el constructor lo active a mano. Se descarta porque no sobrevive a instalaciones nuevas.

### Columnas del sistema en la grilla

Se define la lista fija `["id", "created", "updated"]`. La grilla mezcla esas columnas (segun lo que diga `meta.hidden`) antes de las columnas de la tabla, y las pinta como solo lectura (id en texto corto; created/updated como fecha). Quedan fuera de la busqueda y del ordenamiento. El nombre "Mostrar columnas" las lista por defecto ocultas. PocketBase ya reserva esos nombres como campos del sistema, asi que no pueden chocar con columnas creadas por el usuario.

### Contenido del CSV/JSON exportado

Exportar trae todas las filas (`getFullList` paginado). La cabecera usa los nombres tecnicos de las columnas mas `id`, de modo que un export reimportado se empareja limpio. La separacion del CSV se elige en el momento (coma o punto y coma, punto y coma por defecto). "Copiar" usa la API de portapapeles.

## Risks / Trade-offs

- [Parsing de CSV con casos raros] → El parser cubre comillas y saltos; JSON queda como alternativa robusta.
- [Archivos o tablas muy grandes] → Tope de filas importables con aviso (p. ej. 5000) y tramos de lote para no exceder el limite del endpoint.
- [Reemplazar todo es destructivo] → Confirmacion antes de borrar; se conservan las ids para no romper relaciones.
- [Portapapeles bloqueado por el navegador] → Se ofrece respaldo con un area oculta para copiar.
- [Coincidencia ambigua de fechas (p. ej. 01/02/2025)] → Se define una lista de formatos y el que no se entiende cuenta como error de fila.

## Migration Plan

No hay migracion de datos. El unico cambio de infraestructura es el ajuste de `batch.enabled` en la configuracion de PocketBase al arrancar, que se aplica solo y es idempotente. No hay estrategia de rollback mas alla de revertir el cambio de codigo.

## Open Questions

- Valor exacto del tope de filas importables y del tamano de cada tramo de lote; se pueden ajustar sin tocar especificaciones.
- Si mas adelante se quieren incluir created/updated en la exportacion, es un cambio menor de comportamiento.
