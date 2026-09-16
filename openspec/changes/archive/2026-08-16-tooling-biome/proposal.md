## Why

El proyecto no tiene formateador ni linter. El estilo actual (2 espacios, comillas dobles, punto y coma) se mantiene solo por convencion, sin nada que lo verifique. A medida que crece el codigo y mas trabajo lo genera la IA, la deriva de estilo y los errores evitables (imports sin usar, hooks mal declarados, `any` accidental) empiezan a acumularse sin que nadie los vea.

Biome cubre formato y lint con una sola dependencia y un solo archivo de configuracion, lo que encaja con un proyecto Bun sin CI ni cadena de build compleja.

## What Changes

- Agregar `@biomejs/biome` como unica dependencia de desarrollo para formato y lint.
- Crear `biome.json` en la raiz con:
  - `formatter`: 2 espacios, comillas dobles, punto y coma, `lineWidth: 100`.
  - `linter`: reglas recomendadas + dominios `react` y `test`, con las reglas ruidosas para este repo desactivadas o en `warn`.
  - `files.includes`: `server/`, `web/src/`, `shared/`, `scripts/`; excluir `web/dist/`, `pb/`, `node_modules/`, `bun.lock`.
- Agregar scripts a `package.json`: `format`, `format:check`, `lint`, `lint:fix`, `check`.
- Ejecutar un formateo inicial de todo el codigo en un commit aislado, separado de cualquier cambio funcional.
- Documentar el uso en `AGENTS.md` (seccion "Code style") y corregir la nota obsoleta que dice que `openspec/` no tiene cambios activos.
- No se agregan hooks de git ni CI en esta etapa.

## Capabilities

### New Capabilities

Ninguna. Es un cambio de tooling: no altera el comportamiento del producto ni ninguna API.

### Modified Capabilities

Ninguna.

Este cambio marca `skip_specs: true` en `.openspec.yaml`.

## Impact

- **Dependencias**: +1 devDependency (`@biomejs/biome`). Ninguna en runtime.
- **Archivos nuevos**: `biome.json`.
- **Archivos modificados**: `package.json` (scripts), `AGENTS.md` (documentacion).
- **Codigo fuente**: ~62 archivos TS/TSX tocados por el formateo inicial. El diff esperado es pequeno porque el estilo ya coincide casi por completo; con `lineWidth: 100` solo se reordena el ~1% de las lineas.
- **Riesgo**: bajo y reversible. El unico punto sensible es que el commit de formateo ensucia `git blame`; se mitiga aislandolo y registrandolo en `.git-blame-ignore-revs`.
- **Fuera de alcance**: reglas type-aware, integracion con CI, hooks pre-commit, formateo de CSS/Markdown.
