## Context

La motivacion esta en `proposal.md`. El repo usa Bun como package manager y Biome 2.5.8 ya configurado con scope (`server/`, `web/src/`, `shared/`, `scripts/`) y un script `check` (`biome check --enforce-assist=false`). No hay hooks de git ni lint-staged. El proyecto es "private" y usa Bun, lo que condiciona como se instalan los hooks.

## Goals / Non-Goals

**Goals:**
- Que cada commit corra Biome sobre los archivos staged, corrija en el lugar y re-stage los tocados.
- Que la instalacion del hook sea automatica en `bun install` (no un paso manual olvidable).
- Respetar el scope existente de Biome; no ampliar ni modificar reglas.

**Non-Goals:**
- No cambiar reglas ni scope de Biome.
- No agregar typecheck al hook (queda como `bun run typecheck` manual/CI).
- No correr format/lint sobre archivos fuera del scope de Biome (`.css`, `.md`, `web/dist`, `pb`).

## Decisions

**1. `husky` + `lint-staged` (vs hook manual de git).**
La alternativa (escribir un hook `pre-commit` a mano con `git diff --cached --name-only`) evita dependencias pero reimplementa el filtrado de staged files y el re-stage. `lint-staged` resuelve eso de forma probada. Decision: usar husky + lint-staged.

**2. Comando sobre archivos staged: `biome check --write` (no `format` + `lint` por separado).**
`biome check` ya cubre format + lint en un solo binario, y con `--write` corrige en el lugar. Evita correr dos procesos. Config de lint-staged:

```json
"lint-staged": {
  "*": "biome check --write --no-errors-on-unmatched"
}
```

Con `"*"` pasamos todos los archivos staged; Biome filtra por su `files.includes` (ignora `.css`, `.md`, `web/dist/`, `pb/`, etc.). `--no-errors-on-unmatched` es necesario: sin el flag, Biome sale con error cuando **todos** los archivos staged estan fuera de scope (p. ej. un commit que solo toca `.md`), lo que bloquearia el commit. Con el flag, un commit que solo toca archivos ignorados sigue adelante. Alternativa considerada: filtrar por extensiones en el glob de lint-staged — rechazada porque duplica el scope de Biome y hay que mantenerlo en dos lugares.

**3. Hook `pre-commit` minimo:**

```bash
bunx lint-staged
```

`bunx lint-staged` resuelve el binario desde `node_modules/.bin`. Alternativa: `bun run lint-staged` (mas explicito, evita trafico de red si no hay binario local). Preferir `bun run lint-staged`.

**4. Instalacion del hook con Bun.**
Husky instala su hook via script de lifecycle. Bun (por seguridad) no corre lifecycle scripts de dependencias por defecto; hay que declarar `husky` en `trustedDependencies` de `package.json` y tener un script `prepare`:

```json
"scripts": {
  "prepare": "husky"
},
"trustedDependencies": ["husky"]
```

Nota: `husky init` por defecto agrega el `prepare` y crea `.husky/pre-commit`. El script `prepare` se ejecuta en `bun install` y en `git clone`/install de otros devs.

**5. Versionado de `.husky/`.**
El archivo `.husky/pre-commit` se versiona (es config del repo). Husky tambien crea `.husky/_/` con scripts internos generados; eso va al `.gitignore` (`.husky/_`). Si hubiera un `.husky/` previo inexistente hoy, se crea desde cero.

## Risks / Trade-offs

- **`bun install` que no instale el hook** → Si `trustedDependencies` falta, `prepare` no corre y el hook no existe silenciosamente. Mitigacion: declarar `trustedDependencies` y verificar en tareas que el hook exista tras `bun install` (`ls .husky/pre-commit`).
- **Commit que solo toca archivos fuera del scope de Biome** → `lint-staged` correra `biome check --write --no-errors-on-unmatched` sobre archivos ignorados; el flag evita el error "no files processed" de Biome y el commit sigue. Aceptable (es el comportamiento deseado).
- **`--write` silenciosamente re-stage** → Riesgo de que un archivo cambie sin que el dev lo revise. Mitigacion: es el flujo pedido ("corregir y re-stage"); el dev ve el diff en `git status`/diff antes de `git push`.
- **Compatibilidad `husky init` con npm vs Bun** → `husky init` puede asumir npm. Mitigacion: revisar el `prepare` generado y ajustar a `bun` si hace falta.

## Migration Plan

1. Instalar devDeps y configurar `trustedDependencies`.
2. Crear el hook `pre-commit` (husky) y la config de lint-staged.
3. Probar con un commit de prueba: modificar un `.ts` mal formateado, `git add`, commit, confirmar que biome lo corrige y re-stagea.

## Open Questions

- _(ninguna: el alcance y la config quedan determinados)_
