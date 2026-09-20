## Why

El requerimiento funcional de una pagina se pierde. Las conversaciones con la IA se guardan por pagina, pero solo se le mandan los diez ultimos turnos y hasta cuarenta mil caracteres, y empezar una conversacion nueva no arrastra nada de las anteriores: la IA ve el HTML que quedo, no las reglas que lo explican. Quien construye tiene que repetir "solo los auxiliares crean citas" cada pocas semanas, y cuando no lo repite, la IA reescribe la pagina rompiendola.

Hace falta un sitio, por pagina, donde esas reglas sobrevivan al recorte del historial y al boton de conversacion nueva.

## What Changes

- Cada pagina tiene una **memoria**: un texto en markdown plano, una regla funcional por vinieta, con lo que la pagina debe cumplir.
- La memoria se ve y se edita desde **Ajustes de la pagina**, en un item nuevo llamado **Memorias**.
- La memoria viaja en el contexto de cada peticion a la IA, junto al resto de lo que ya se manda.
- Al terminar un turno corre una **pasada aparte**: una llamada corta, con su propio texto de sistema, que recibe el intercambio y la memoria actual y contesta `sin cambios` o una operacion sobre una vinieta. Es automatica: nadie tiene que pedir que se guarde.
- Esa pasada solo puede **agregar, reemplazar o borrar una vinieta nombrada**, nunca devolver la memoria entera. Lo que no nombra, no cambia.
- La IA compara el pedido con la memoria antes de construir. Si lo pedido **contradice una regla guardada**, pregunta antes de tocar nada; si le dicen que no, ni construye ni cambia la memoria.
- La caja de texto de Memorias queda **bloqueada mientras la IA trabaja**, para que lo que guarda quien construye no pise lo que acaba de escribir la pasada.
- La memoria **no tiene tope**. Lo que la mantiene corta es la estrictez del texto de sistema de la pasada, no un corte.
- Las paginas que ya existen **nacen con la memoria vacia**. No se deduce nada del HTML que ya tienen.
- El modelo de la pasada es **el mismo de la peticion**, con un ajuste en la configuracion de IA para poder senalar otro distinto mas adelante.

## Capabilities

### New Capabilities

- `page-memory`: la memoria de una pagina --que guarda y que no, donde se ve, quien la escribe, que operaciones admite y como sobrevive al recorte del historial--.

### Modified Capabilities

- `ai-authoring`: la peticion lleva ademas la memoria de la pagina, y preguntar antes de construir admite un caso nuevo --la contradiccion con una regla guardada-- que hasta ahora estaba prohibido por ser una pregunta de diseno.

## Impact

- **Base de datos**: campo nuevo en la coleccion `pages` para el texto de la memoria.
- **Servidor**: `server/ai/aiPage/prompts.ts` (la memoria entra en el contexto y la regla de contradiccion en la guia), `server/ai/aiPage/index.ts` (la pasada al cerrar el turno), `server/routes.ts` (leer y guardar la memoria desde el panel), `server/ai/ai.ts` (el modelo configurable de la pasada).
- **Panel**: `web/src/components/PagePanel.svelte` (el item Memorias y su caja), `web/src/routes/AiSettings.svelte` (el ajuste del modelo).
- **Coste**: una llamada corta mas por turno, del orden del tres por ciento de lo que cuesta el turno.
- **Sin efecto** sobre las paginas publicadas: la memoria es del constructor, no viaja al HTML servido.
