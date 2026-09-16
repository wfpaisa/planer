## 1. Documentación del proyecto

- [x] 1.1 En `AGENTS.md:3`, quitar la excepción de `openspec/` ("Note: the `openspec/` directory keeps its own docs in the older unaccented form by convention; do not propagate that to other files.") y dejar la regla de tildes/ñ sin excepciones de carpeta.

## 2. Prompt de IA

- [x] 2.1 En `server/aiPage.ts`, corregir el prompt `USE_SYSTEM` para que pida español con tildes y ñ correctos en vez de "plain Spanish without accents".
- [x] 2.2 Verificar manualmente en el panel: abrir el diálogo de impacto de una tabla, pedir el detalle de "para qué" de una página, y comprobar que la respuesta de la IA llega con tildes y ñ correctos.

## 3. Verificación de que no queden más fuentes

- [x] 3.1 Confirmar (ya hecho durante la propuesta, repetir si pasa tiempo antes de aplicar) que ninguna otra instrucción del repositorio — prompts de IA en `server/`, convenciones en `.claude/skills/`, `CLAUDE.md` si existe — autoriza texto en español sin tildes ni ñ.
- [x] 3.2 `bun run typecheck` para confirmar que el cambio de texto en `server/aiPage.ts` no rompe nada.
