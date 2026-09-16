## Why

Exportar una tabla la nombra por su etiqueta: "Chequeo preoperacional" sale como `chequeo-preoperacional.csv`. Volver a soltar ese archivo para crear una tabla no deshace la traducción: la tabla nace llamándose `chequeo-preoperacional`, y sus columnas `codigo_empleado`.

Encontrar la tabla sí funciona --la comparación normaliza los dos lados--, así que el problema es solo el nombre de lo que nace.

## What Changes

- Una tabla creada desde un archivo SHALL nacer con un nombre visible legible: `chequeo-preoperacional.csv` crea "Chequeo preoperacional".
- Una columna creada desde una cabecera del archivo SHALL nacer igual: `codigo_empleado` crea "Codigo empleado".
- Un nombre que ya venga escrito para leerse se respeta tal cual. `Chequeo Preoperacional.csv` y `IVA_2026` no se tocan.
- No se cambia nada ya guardado: las tablas y columnas creadas antes se quedan como están.

## Capabilities

### Modified Capabilities

- `builder/file-drop`: se añade cómo se nombra lo que nace de un archivo. Hoy la capacidad describe a qué tabla pertenece un archivo, pero no con qué nombre se crea cuando no pertenece a ninguna.

## Impact

- `web/src/lib/dropFiles.ts`: el nombre de la tabla que sale de un archivo y las etiquetas de sus columnas, en los dos caminos --crear una tabla y añadir columnas a una que ya existe--.
- `web/src/lib/importPlan.ts`: la función que hoy nombra una columna nueva pone la mayúscula pero no separa las palabras. Pasa a hacer las dos cosas y se reutiliza.
- Sin cambios en el servidor ni en la base.
