## Context

Ver `proposal.md` para el motivo.

Lo que condiciona el diseño:

- El contexto de la IA y la documentación del constructor salen del mismo archivo, `shared/htmlContract.ts`, por secciones que las dos salidas llaman. `buildHtmlContract` ya tiene precedente de sección exclusiva del modelo: `opts.blocks` añade `blocksSection()` solo cuando quien escribe puede editar trozos.
- El prompt de la IA es el contrato **más** `TOOL_GUIDE`, unidos en un solo texto. Un texto escrito en el contrato ya le llega al modelo; no hace falta repetirlo en la guía.
- `admin` existe en toda aplicación desde que nace y no se puede quitar (`ADMIN_ROLE` en `shared/people.ts`). Pero el poder de quien construye viene de ser dueño de la aplicación, no del nombre del rol: dárselo a una persona invitada no le da nada del panel.
- El panel ya asume la equivalencia: el selector de vista previa arranca en `admin`.

## Goals / Non-Goals

**Goals:**

- Que el modelo pueda resolver a quién va dirigida una pantalla sin preguntar.
- Que un supuesto equivocado se corrija con una frase.

**Non-Goals:**

- No se tocan las reglas de acceso del servidor ni `PageRecord.roles`. Filtrar por rol dentro del HTML sigue siendo presentación.
- No se amplía el contexto con las demás páginas de la aplicación. Es una decisión aparte, abierta en `ia-comportamiento-conversacional`.
- No se cambia cuándo la IA pregunta. La regla nueva reduce las preguntas, no añade ninguna.

## Decisions

### D1. La equivalencia va en el contrato; la regla de lectura, en una sección solo para el modelo

Son dos cosas distintas y por eso son dos secciones, aunque vivan en el mismo archivo.

El **hecho** --quien escribe es el dueño, su rol dentro de la aplicación es `admin`-- va en `viewerSection()`, donde ya vive "quién está mirando". Llega igual a la documentación del constructor, y le sirve: explica por qué la vista previa arranca en `admin`.

La **regla de lectura** --cómo interpretar "yo" o "los usuarios"-- va en una sección nueva que solo entra cuando el contexto se arma para el modelo, con el mismo interruptor que usa `blocksSection()`.

Alternativas descartadas:

- Escribirla en `TOOL_GUIDE` (`server/aiPage.ts`). Encaja conceptualmente --ahí ya está "cuándo preguntar, cuándo proponer"-- pero parte la explicación en dos archivos: el hecho en uno y su uso en otro.
- Un solo texto compartido por las dos salidas. Metería una instrucción de cómo leer frases en la documentación del constructor, donde es ruido.

### D2. "Yo" significa `admin` solo cuando la petición nombra también a otras personas

La contraposición es la señal fiable. *"Quiero ver el listado de todos los usuarios"* pone a quien escribe frente a otras personas; *"quiero ver quién leyó el manual"* es solo la forma normal de pedir algo.

Alternativas descartadas:

- "Yo" siempre significa `admin`. Predecible, pero cierra a `admin` pantallas que nadie pidió cerrar, y el coste de abrirlas otra vez es un turno.
- No deducir nada nunca. Es lo de hoy, y es lo que hace que una petición como la del caso real se resuelva por casualidad.

Se combina con decir el supuesto en el resumen (`ai-authoring`). Cuesta una línea y convierte un error de público en una corrección de una frase.

### D3. Un nombre de grupo que no coincide con ningún rol se construye para todos, no se pregunta

`TOOL_GUIDE` ya reserva las preguntas para lo que de verdad bloquea, y esto no bloquea: se puede construir para todos. Además, filtrar por rol dentro del HTML no protege nada, así que equivocarse cuesta una corrección y no un fallo de acceso.

Alternativa descartada: preguntar ofreciendo los roles de la aplicación. Los roles son un conjunto cerrado, así que la pregunta sería legítima, pero gastaría un turno entero en algo que se corrige leyendo el resumen.

### D4. La visibilidad por rol se decide antes de pintar

Entra en este cambio porque este cambio la hace más frecuente. El patrón que la IA usa hoy --sección con `hidden`, mostrada al terminar de dibujarla-- convierte cualquier excepción del guion en una pantalla vacía sin aviso. Ocurrió: una llamada a una función inexistente dejó oculto un panel entero, y desde fuera parecía un fallo de permisos.

Alternativa descartada: dejarlo fuera por alcance. Son dos frases en el contexto y evitan el fallo que ya se dio.

### D5. Se comprueba en `smoke:ia`, con las dos clases que ese script ya distingue

Tres casos de juicio --contraposición, sin contraposición, nombre sin rol-- que no tumban la batería, porque dependen del modelo. Y una comprobación mecánica de que el contexto incluye la sección nueva cuando la aplicación define roles, que sí la tumba: eso no depende del modelo.

`scripts/harness-estilos.ts` no sirve. Comprueba el sistema de estilos contra el catálogo y la auditoría, sin servidor ni modelo.

## Risks / Trade-offs

- **Confundir la convención con autorización** → El texto dice expresamente que el poder de quien construye viene de ser dueño de la aplicación, no del nombre del rol. Sin esa frase, tanto el modelo como quien lee la documentación pueden creer que dar el rol `admin` a alguien le abre el panel.
- **Falsos positivos al emparejar palabra con rol** → La tolerancia a plural y tildes solo se aplica a palabras que nombran personas. Sin ese límite, una aplicación con un rol llamado `manual` haría que "quién leyó el manual" se leyera como un rol.
- **Más filtros por rol, más superficie para el fallo de pantalla vacía** → Es justo lo que cubre D4.
- **Los casos de juicio dependen del modelo** → Se cuentan aparte y no tumban la batería, que es el patrón que `smoke-ia-conversacion.ts` ya estableció. Un fallo ahí es señal para afinar el texto, no un error de código.

## Migration Plan

No hay nada que migrar. Es texto de contexto: las páginas ya escritas no cambian, y la regla solo afecta a las peticiones siguientes.

## Open Questions

- Quien construye no es una persona invitada, así que no tiene fila propia en la aplicación. Una petición de "quiero ver lo mío" no tiene nada concreto que enseñar en la vista previa mientras no se elija una persona en el selector. Se puede resolver más adelante sin tocar ninguna de estas reglas.
