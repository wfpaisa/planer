## 1. La regla

- [x] 1.1 Extender la función que nombra una columna nueva al importar: además de la mayúscula inicial, los guiones y guiones bajos pasan a espacios cuando el texto viene sin espacios y todo en minúsculas.
- [x] 1.2 Comprobar los casos que no se tocan: un texto con espacios, uno con mayúsculas propias y uno con sigla.

## 2. Los sitios que la usan

- [x] 2.1 Nombrar con la regla la tabla que sale de un archivo soltado.
- [x] 2.2 Nombrar con la regla las columnas de esa tabla.
- [x] 2.3 Nombrar con la regla las columnas nuevas que se añaden al importar un archivo en una tabla que ya existe.

## 3. Cobertura

- [x] 3.1 Cubrir la vuelta completa: exportar una tabla con nombre de varias palabras, soltar el archivo como tabla nueva y comprobar el nombre visible de la tabla y de sus columnas.
- [x] 3.2 Cubrir que emparejar sigue funcionando: el mismo archivo soltado cuando la tabla sí existe no crea nada.

## 4. Cierre

- [x] 4.1 `bun run typecheck`, `bun run lint` y `bunx prettier --check .` limpios.
- [x] 4.2 `bun run docs` y `smoke:relaciones` con el servidor arriba.
