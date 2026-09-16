## Why

El proyecto dice que todo el español (interfaz, mensajes, texto que escribe la IA) debe llevar tildes y ñ correctos, pero dos instrucciones vigentes contradicen esa regla y autorizan justo lo contrario: `AGENTS.md` exime a `openspec/` de usar tildes, y el prompt `USE_SYSTEM` de `server/aiPage.ts` le pide explícitamente a la IA que responda "in plain Spanish without accents" cuando explica para qué sirve una columna. Mientras esas dos fuentes sigan diciendo lo contrario, cualquier corrección de texto ya escrito se revierte sola: la IA sigue generando explicaciones sin tildes y quien escribe en `openspec/` sigue teniendo permiso de omitirlas. Antes de corregir el texto que ya existe, hay que cerrar las dos fuentes que autorizan a no usarlos.

## What Changes

- `AGENTS.md`: quitar la excepción de la línea 3 que permite a `openspec/` mantener "docs en la forma no acentuada anterior"; dejar explícito que tildes y ñ son obligatorios en todo el proyecto, sin excepción de carpeta.
- `server/aiPage.ts`: corregir el prompt `USE_SYSTEM` (usado por `explainPageUse`, el detalle de "para qué" del diálogo de impacto) para que pida español con tildes y ñ correctos, en vez de pedir explícitamente que no los use.
- Revisar el resto del repositorio en busca de otras instrucciones equivalentes (prompts de IA, convenciones en `.claude/skills/`, comentarios de configuración) que autoricen texto en español sin tildes ni ñ; no se encontró ninguna otra además de las dos anteriores.
- **Fuera de alcance, a propósito:** este cambio no reescribe el texto en español que ya existe sin tildes (specs archivadas de `openspec/`, `README-HTML.md` generado por `bun run docs`, comentarios sueltos en el código). Corregir esas dos fuentes primero evita que la IA seguir generando texto sin tildes mientras se hace esa limpieza en un cambio posterior.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `data-impact`: el texto que `explainPageUse` genera para explicar el uso de una columna (el detalle de "para qué" del diálogo de impacto) debe usar tildes y ñ correctos, igual que el resto de los textos que ve quien construye.

## Impact

- `AGENTS.md`: documentación del proyecto, sin efecto en tiempo de ejecución.
- `server/aiPage.ts`: cambia el texto del prompt `USE_SYSTEM`; afecta únicamente la redacción de la respuesta de la IA en `explainPageUse`, sin cambiar la lógica ni la firma de la función.
- No se toca ningún archivo de `openspec/` existente ni ningún otro texto ya escrito: la corrección masiva queda para un cambio posterior.
