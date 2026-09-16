## Context

Ver `proposal.md` - Why. Se ubicaron dos fuentes concretas que autorizan español sin tildes ni ñ:

- `AGENTS.md:3` — exime a `openspec/` de la regla general de tildes/ñ del resto del proyecto.
- `server/aiPage.ts` (prompt `USE_SYSTEM`, usado por `explainPageUse`) — le pide explícitamente a la IA "plain Spanish without accents".

Se revisó también `scripts/docs.ts` y `shared/features.ts` (el generador de README que el propio `openspec/changes/archive/2026-08-30-permisos-por-rol/tasks.md` señala como fuente de texto sin tildes): el texto que ese generador produce ya lleva tildes correctas; lo que carece de ellas son los comentarios `/** ... */` del código fuente, que quedan fuera de este cambio (ver proposal.md - Capabilities, alcance acordado con el usuario).

## Goals / Non-Goals

**Goals:**
- Dejar sin excepciones la regla de tildes/ñ en la documentación del proyecto (`AGENTS.md`).
- Corregir la única instrucción de IA que pide explícitamente texto sin tildes, para que no seguir generando violaciones nuevas mientras se corrige el texto viejo.

**Non-Goals:**
- Reescribir el texto en español que ya existe sin tildes (specs archivadas de `openspec/`, `README-HTML.md`, comentarios de código). Eso se hace en un cambio posterior, una vez que las dos fuentes de arriba dejen de autorizarlo.
- Añadir verificación automática (lint/CI) que detecte texto en español sin tildes. Se descartó a pedido del usuario para este cambio.

## Decisions

**Corregir las instrucciones antes que el contenido.** Si se corrigiera primero el texto ya escrito, `server/aiPage.ts` seguiría generando respuestas sin tildes en cada uso del diálogo de impacto, y `AGENTS.md` seguiría autorizando a quien escriba en `openspec/` a omitirlas — la corrección de contenido se revertiría sola. Alternativa descartada: corregir todo en un solo cambio grande; se descartó porque mezcla una edición de dos líneas con una reescritura de cientos de archivos, y porque el usuario pidió explícitamente resolver primero las instrucciones.

**Alcance de `AGENTS.md`: quitar la excepción, no reescribir `openspec/`.** La frase "the `openspec/` directory keeps its own docs in the older unaccented form by convention; do not propagate that to other files" dejaría de ser cierta en cuanto exista al menos un archivo nuevo de `openspec/` escrito con tildes (como este mismo cambio). Se reemplaza por una regla sin excepción; los archivos ya archivados sin tildes no se tocan retroactivamente.

## Risks / Trade-offs

- **[Inconsistencia temporal]** → Tras este cambio, `openspec/changes/archive/**` sigue sin tildes mientras que los cambios nuevos (incluido este) sí las llevan. Es aceptado: son registros históricos, no se editan cambios ya archivados.
- **[El prompt corregido cambia la respuesta de la IA]** → No hay prueba automática para prompts de IA (no hay framework de pruebas unitarias en el proyecto, por `AGENTS.md`); la verificación es manual, abriendo el diálogo de impacto y pidiendo el detalle de una página.
