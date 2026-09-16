## Context

Ver `proposal.md` - Why.

Estado medido del codigo antes del cambio (62 archivos `.ts`/`.tsx`, ~16.300 lineas en `server/`, `web/src/`, `shared/`, `scripts/`):

| Convencion | Estado actual |
|---|---|
| Sangria | 2 espacios en el 100% de los archivos, cero tabs |
| Comillas en imports | dobles en 295/295 |
| Punto y coma | presente de forma consistente |
| Lineas > 80 caracteres | 1.050 (6%) |
| Lineas > 100 caracteres | 224 (1%) |

Restricciones que condicionan el diseno:

- Runtime Bun 1.3, sin CI, sin hooks de git, sin `web/package.json` propio (workspace unico en la raiz).
- TypeScript estricto con `verbatimModuleSyntax` e imports con extension `.ts` explicita (convencion Bun documentada en `AGENTS.md`).
- Tailwind v4 CSS-first: `web/src/styles.css` usa at-rules propias (`@theme`, `@utility`, `@custom-variant`) que un linter de CSS generico reporta como desconocidas.
- Alias `@shared/*` y `@/*` definidos en `tsconfig.json` y `vite.config.ts`.

## Goals / Non-Goals

**Goals:**

- Una sola dependencia y un solo archivo de configuracion.
- Congelar el estilo que el codigo ya tiene, en vez de imponer uno nuevo.
- Diff de formateo inicial minimo y revisable de un vistazo.
- Lint util desde el primer dia, sin que el primer `bun run lint` devuelva cientos de avisos.

**Non-Goals:**

- Reglas type-aware (requieren el proyecto TS completo y son lentas; Biome las cubre solo parcialmente).
- CI, hooks pre-commit, o bloqueo de commits.
- Formatear CSS y Markdown en esta etapa.
- Reemplazar `tsc --noEmit`: el chequeo de tipos sigue siendo responsabilidad de `bun run typecheck`.

## Decisions

### Biome 2.5.x sobre Prettier + ESLint

Se evaluaron tres caminos:

| Criterio | Biome 2.5 | Prettier 3 + ESLint 9 | Oxlint + oxfmt |
|---|---|---|---|
| Dependencias | 1 | 6-8 | 2 |
| Archivos de config | 1 | 2-3 | 2 |
| Velocidad en este repo | alta | baja | la mas alta |
| Reglas React/Hooks | buenas | excelentes | parciales |
| Madurez | alta | muy alta | media |

Se elige Biome porque el cuello de botella real de este proyecto es el **costo de mantener la configuracion**, no la velocidad ni la cobertura exhaustiva de reglas. Prettier + ESLint aporta un catalogo de reglas mas amplio a cambio de dos configuraciones que hay que mantener sincronizadas (`eslint-config-prettier`, plugins de React, resolvers de TS) — desproporcionado para 16k lineas sin CI. Oxlint es mas rapido pero su cobertura de React todavia esta incompleta y su formateador es reciente; conviene reevaluarlo cuando se estabilice.

Si en el futuro se necesitan reglas que Biome no tiene (por ejemplo, lint exhaustivo de accesibilidad o reglas type-aware), Oxlint y ESLint pueden convivir como capa adicional sin desmontar Biome.

### `lineWidth: 100` en lugar del valor por defecto (80)

Con 80 se reordenan 1.050 lineas; con 100, unas 224. El valor 100 mantiene el diff inicial casi vacio y respeta el estilo que el codigo ya adopto de forma natural (p90 = 75 caracteres). Alternativa descartada: dejar 80 "porque es el estandar" — el costo del ruido en `git blame` no lo justifica.

### El resto del formato replica el estilo existente

Comillas dobles, punto y coma siempre, sangria de 2 espacios, comas finales. No se toma ninguna decision de estilo nueva: la configuracion documenta lo que ya se hace.

### Lint en modo recomendado + dominio React, con excepciones explicitas

Se activan las reglas recomendadas y el dominio `react` (hooks y JSX). Se documenta cada regla desactivada con el motivo en un comentario dentro de `biome.json`. Las candidatas conocidas a revisar durante la implementacion:

- `noUnknownAtRules` (CSS de Tailwind v4) — irrelevante mientras CSS quede fuera del alcance, pero se deja excluido de forma explicita.
- `noExplicitAny` — evaluar si genera ruido en los puntos de frontera con PocketBase; degradar a `warn` antes que desactivar.

La regla de trabajo es: nada se desactiva sin una linea que explique por que.

### Ordenar imports como accion de asistencia, no como regla de lint

En Biome 2.x el ordenado de imports vive en `assist.actions.source.organizeImports`. Se activa, pero solo se aplica con `--write`; nunca falla un chequeo. Motivo: reordenar imports genera diffs grandes y no aporta correccion, solo consistencia.

Nota de implementacion: en Biome 2.5.x `biome check` ejecuta y **aplica por defecto** las acciones de asistencia (falla si `organizeImports` cambiaria el codigo), lo que contradice la intencion de "nunca falla un chequeo". Por eso el script `check` usa `biome check --enforce-assist=false`: sigue reportando los imports desordenados como `FIXABLE`, pero no bloquea el chequeo. `lint` y `format` no ejecutan asistencia y por tanto no requieren el flag.

### El formateo inicial va en su propio commit

Un commit que solo contiene el resultado de `biome format --write`, sin ningun cambio funcional mezclado, registrado en `.git-blame-ignore-revs` para que `git blame` lo ignore.

## Calibracion del lint (resultado real, Biome 2.5.8)

`biome.json` es JSON estricto y no admite comentarios, asi que los motivos de cada degradacion se registran aqui (y se resumen en `AGENTS.md`).

Primer `bunx biome lint` en seco: **55 errores, 11 warnings, 3 infos**. Los errores bloqueantes eran casi todos de reglas a11y (45 de 55) mas React y claves de arrays:

| Regla | Incidencias | Tratamiento |
|---|---|---|
| `a11y/useButtonType` | 38 | warn: ruidosa en el panel (botones fuera de forms); se revisa en PR |
| `a11y/useKeyWithClickEvents` | 3 | warn: requiere revision manual por elemento |
| `a11y/noAutofocus` | 2 | warn |
| `a11y/noStaticElementInteractions` | 1 | warn |
| `a11y/noLabelWithoutControl` | 1 | warn |
| `correctness/useExhaustiveDependencies` | 5 | warn: el auto-fix a veces altera comportamiento; revision manual |
| `suspicious/noArrayIndexKey` | 5 | warn: comun en listas estaticas del panel |
| `suspicious/noExplicitAny` | 2 | warn: inevitable en bordes con PocketBase |

Tras la calibracion, `bunx biome lint` devuelve **0 errores** (66 warnings, 3 infos). Warnings pendientes (registro): las 45 a11y anteriores, 5 `useExhaustiveDependencies`, 5 `noArrayIndexKey`, 1 `useOptionalChain`, 1 `noUnusedFunctionParameters`, 1 `noUnusedImports`, 2 `noNonNullAssertion`, 1 `useImportType`, 2 `noUselessEscapeInString`, 3 `useBiomeIgnoreFolder` (propia del `biome.json`).

Verificado en 3.3: los imports con extension `.ts` explicita y los alias `@/*` y `@shared/*` no generan falsos positivos de resolucion (ningun aviso `noUnknownImports`/`noUndeclaredVariables`).

## Risks / Trade-offs

- **El commit de formateo ensucia el historial y `git blame`** → Commit aislado + `.git-blame-ignore-revs`; se verifica con `bun run typecheck` y `bun run smoke` que el formateo no cambio comportamiento.
- **Conflictos con la rama `html` y el cambio `bloque-html-importado` en curso (62/64 tareas)** → Aplicar el formateo despues de cerrar ese cambio, o aceptar resolver los conflictos de formato una sola vez.
- **El lint puede devolver muchos avisos la primera vez** → Se corre `biome lint` en seco antes de fijar la configuracion y se ajustan las reglas segun el resultado real, no segun suposiciones.
- **Biome no reemplaza el chequeo de tipos** → `bun run typecheck` sigue siendo obligatorio; se documenta en `AGENTS.md`.
- **Riesgo de que la IA "formatee de mas" en cambios futuros** → `AGENTS.md` indica ejecutar `bun run format` solo sobre archivos tocados.

## Migration Plan

1. Instalar `@biomejs/biome` como devDependency.
2. Crear `biome.json` con formato y lint, sin ejecutar nada aun.
3. Correr `biome lint` en seco y ajustar reglas segun el resultado observado.
4. Correr `biome format --write` sobre las carpetas de alcance; revisar el diff completo.
5. Verificar con `bun run typecheck` y `bun run smoke`.
6. Commit aislado del formateo + `.git-blame-ignore-revs`.
7. Actualizar `AGENTS.md`.

**Rollback**: borrar `biome.json`, quitar la dependencia y los scripts. El commit de formateo puede quedarse sin efecto alguno, ya que no altera comportamiento.

## Open Questions

- ¿El formateo inicial se aplica antes o despues de cerrar `bloque-html-importado`? Afecta solo al momento de ejecutar, no al diseno.
- ¿Se extiende mas adelante el formateo a CSS y Markdown? Requiere resolver antes el ruido de las at-rules de Tailwind v4.
