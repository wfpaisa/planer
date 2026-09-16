## Why

El contexto que recibe la IA nunca dice quién está escribiendo. Le dice qué roles define la aplicación y quién está invitado, pero no que quien pide es el dueño de la aplicación ni a qué rol equivale dentro de ella. Sin eso, una petición como "quiero ver quiénes leyeron el manual" no tiene forma de resolverse: la IA no sabe si "yo" es un rol, una persona o nadie.

El panel ya asume esa equivalencia --el selector de vista previa arranca en `admin`, "el rol de quien construye"-- pero es una convención que no está escrita en ninguna parte que el modelo lea.

## What Changes

- El contexto dice quién escribe: es el dueño de la aplicación, y dentro de la aplicación su rol es `admin`, que toda aplicación define desde que nace. Es un hecho de la plataforma, así que va donde ya vive "quién está mirando" y lo lee también quien construye.
- Se añade una regla de lectura, solo para el modelo: "yo", "quiero" o "mi" significan el rol `admin` **cuando la petición nombra también a otras personas**. Si la petición no nombra a nadie más, no se asume público ninguno.
- Siempre que la IA asuma para quién es una pantalla, lo dice en el resumen del turno. Corregirlo cuesta una frase; rehacer la pantalla, un turno entero.
- Se define cómo se leen los nombres de grupos de personas: los genéricos ("usuarios", "personas", "todos") son todos los invitados y no filtran por rol; una palabra que coincide con un rol --tolerando plural y tildes-- es ese rol; una que no coincide con ninguno se construye para todos y se dice. No se pregunta: los roles no protegen nada, así que equivocarse cuesta una corrección, no un fallo de acceso.
- La visibilidad por rol se decide antes de pintar, no después. Hoy la IA escribe secciones con `hidden` que muestra al terminar de dibujar, y una excepción a mitad de camino deja la sección oculta sin que nada avise.
- `bun run smoke:ia` gana tres casos de juicio para la regla de lectura, y una comprobación mecánica de que el contexto incluye la sección nueva cuando la aplicación define roles.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `page-context`: el contexto SHALL decir quién escribe la petición y a qué rol equivale dentro de la aplicación.
- `ai-authoring`: cómo se lee para quién es una pantalla a partir de la petición, la obligación de decir el supuesto en el resumen, y que un filtro por rol se resuelve antes de pintar.

## Impact

- `shared/htmlContract.ts`: `viewerSection()` gana el hecho --quién escribe y su rol--, que llega igual a la documentación del constructor. La regla de lectura va en una sección nueva que solo entra en el contexto del modelo, con el mismo interruptor que ya usa `blocksSection()`.
- `server/aiPage.ts`: nada nuevo que escribir si la sección viaja en el contrato; el prompt ya es contrato más `TOOL_GUIDE` unidos.
- `scripts/smoke-ia-conversacion.ts`: los tres casos de juicio y la comprobación mecánica.
- Se cruza con `ia-comportamiento-conversacional`, que toca los mismos tres archivos y aún tiene dos tareas abiertas. Este cambio no depende de ellas.
- No toca el servidor de datos ni las reglas de acceso: filtrar por rol dentro del HTML sigue siendo presentación, no barrera.
