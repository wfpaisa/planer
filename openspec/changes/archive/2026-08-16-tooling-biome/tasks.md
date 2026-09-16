## 1. Instalacion

- [x] 1.1 Instalar `@biomejs/biome` 2.5.x como devDependency (`bun add -d @biomejs/biome`) y confirmar que `bunx biome --version` responde.

## 2. Configuracion

- [x] 2.1 Crear `biome.json` en la raiz con `$schema` apuntando a la version instalada.
- [x] 2.2 Configurar `files.includes`: incluir `server/`, `web/src/`, `shared/`, `scripts/`; excluir `node_modules/`, `web/dist/`, `pb/`, `bun.lock`, `**/*.css`, `**/*.md`.
- [x] 2.3 Configurar el formateador replicando el estilo existente: sangria de 2 espacios, `lineWidth: 100`, comillas dobles, punto y coma siempre, comas finales.
- [x] 2.4 Activar el linter con las reglas recomendadas y el dominio `react`.
- [x] 2.5 Activar `assist.actions.source.organizeImports`, sin que forme parte del chequeo que falla.

## 3. Calibracion del lint

- [x] 3.1 Ejecutar `bunx biome lint` en seco y guardar el recuento de avisos por regla.
- [x] 3.2 Ajustar las reglas ruidosas: degradar a `warn` o desactivar, con un comentario en `biome.json` que explique el motivo de cada una.
- [x] 3.3 Verificar que el codigo con imports `.ts` explicitos y los alias `@/*` y `@shared/*` no producen falsos positivos de resolucion.
- [x] 3.4 Repetir hasta que `bunx biome lint` no devuelva errores bloqueantes; dejar registro de los `warn` que quedan pendientes.

## 4. Scripts

- [x] 4.1 Agregar a `package.json`: `format` (`biome format --write`), `format:check`, `lint`, `lint:fix`, `check` (`biome check`).
- [x] 4.2 Verificar que cada script corre solo sobre las carpetas del alcance y termina en menos de un segundo.

## 5. Formateo inicial

- [x] 5.1 Ejecutar `bunx biome format --write` sobre las carpetas del alcance.
- [x] 5.2 Revisar el diff completo y confirmar que no hay cambios semanticos, solo de formato.
- [x] 5.3 Ejecutar `bun run typecheck` y confirmar que pasa sin errores nuevos.
- [x] 5.4 Ejecutar `bun run smoke` contra un servidor vivo y confirmar que pasa.
- [x] 5.5 Crear el commit aislado con el formateo, sin ningun cambio funcional mezclado.
- [x] 5.6 Crear `.git-blame-ignore-revs` con el hash de ese commit y configurar `blame.ignoreRevsFile` en el repositorio.

## 6. Documentacion

- [x] 6.1 Documentar en `AGENTS.md` (seccion "Code style") que el formato lo impone Biome, con la instruccion de correr `bun run format` solo sobre los archivos tocados.
- [x] 6.2 Aclarar en `AGENTS.md` que Biome no reemplaza `bun run typecheck`.
- [x] 6.3 Corregir la nota obsoleta de `AGENTS.md` que afirma que `openspec/` no tiene specs ni cambios activos.
