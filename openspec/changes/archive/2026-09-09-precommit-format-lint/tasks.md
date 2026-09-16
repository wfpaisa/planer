## 1. Dependencias y config de package.json

- [x] 1.1 Agregar `husky` y `lint-staged` a `devDependencies` en `package.json` (via `bun add -d`).
- [x] 1.2 Agregar `"prepare": "husky"` a `scripts` en `package.json`.
- [x] 1.3 Agregar `"trustedDependencies": ["husky"]` en `package.json` para que `bun install` corra el script de instalacion del hook.
- [x] 1.4 Agregar el bloque `"lint-staged"` en `package.json` con `"*": "biome check --write"`.

## 2. Crear el hook de husky

- [x] 2.1 Inicializar husky (`bunx husky init`) y revisar que el `prepare` generado sea compatible con Bun (ajustar si asume npm).
- [x] 2.2 Escribir `.husky/pre-commit` con `bun run lint-staged`.
- [x] 2.3 Agregar `.husky/_` al `.gitignore` (scripts internos generados), manteniendo `.husky/pre-commit` versionado.

## 3. Verificacion

- [x] 3.1 Correr `bun install` y confirmar que `.husky/pre-commit` existe tras la instalacion.
- [x] 3.2 Test end-to-end: crear un `.ts` dentro de `server/` (o `web/src/`) con formato sucio, `git add`, hacer commit, y confirmar que `biome check --write` lo corrige y re-stagea antes del commit.
- [x] 3.3 Confirmar que archivos fuera del scope (`.css`, `.md`, `web/dist/`, `pb/`) no bloquean el commit.
- [x] 3.4 Confirmar que `bun run typecheck` sigue pasando sin cambios de reglas Biome.
