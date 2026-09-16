## Why

Hoy la verificacion de calidad (Biome format + lint) es manual: se corre `bun run check` y depende de la disciplina de cada quien. Los commits con formato o lint sucios entran al historial y ensucian `git blame` y el diff. Se quiere garantizar que lo que se commitea ya paso por Biome, corrigiendo automaticamente los archivos staged.

## What Changes

- Agregar `husky` y `lint-staged` como devDependencies.
- Crear hook `pre-commit` de husky que corre `lint-staged`.
- Configurar `lint-staged` para ejecutar `biome check --write` sobre los archivos staged (corrige formato y lint en el lugar, y re-stages los archivos tocados).
- Asegurar que `bun install` instale el hook de husky (via `prepare` + `trustedDependencies`).
- Verificar que Biome respete su scope actual (`server/`, `web/src/`, `shared/`, `scripts/`) y que `web/dist/`, `pb/`, `.css`, `.md` queden fuera.

## Capabilities

### New Capabilities

Este es un cambio de tooling (hooks de git) sin cambios de comportamiento a nivel de specs de la plataforma. No introduce ni modifica capacidades. Se marca con `skip_specs: true` en `.openspec.yaml`.

### Modified Capabilities

- _(ninguna)_

## Impact

- `package.json`: nuevas devDependencies (`husky`, `lint-staged`), script `prepare`, config `lint-staged`, posible `trustedDependencies`.
- Nuevo directorio `.husky/` con el hook `pre-commit`.
- `.gitignore`: decidir si `.husky/_` (scripts de husky) se ignora; el archivo `pre-commit` se versiona.
- No afecta runtime, API, base de datos ni el flujo de request. Solo la experiencia de desarrollo al commiteear.
