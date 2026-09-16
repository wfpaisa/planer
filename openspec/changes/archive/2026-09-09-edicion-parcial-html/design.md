## Context

Ver `proposal.md` - Why.

Lo que condiciona el enfoque:

- `server/aiPage.ts` tiene ocho herramientas. La de escribir es `escribir_pagina`, descrita como "Reemplaza el documento entero: manda siempre un archivo completo".
- `server/htmlAnalyze.ts` tiene un tipo `Slice` y varias funciones que localizan trozos --`findRootBlock`, `enclosingBlock`, `storageSlices`--, **pero cuentan llaves `{}`**: sirven para el JavaScript de la pagina, no para etiquetas HTML. No hay nada que localice un elemento.
- `server/htmlBridge.ts` ya habla en las dos direcciones: manda al panel con `parent.postMessage` (linea 26) y escucha con `window.addEventListener("message")` (linea 202). Y ya intercepta clicks (linea 132) para la navegacion de la pagina.
- `AiDock.tsx` ya dibuja badges que se pueden quitar del borrador, del cambio anterior.
- El documento se guarda entero como texto (`server/htmlDocs.ts`), con sus versiones. Un atributo dentro del HTML no toca el modelo de datos.

## Goals / Non-Goals

**Goals:**

- Que un cambio pequeno cueste poco y no vuelva a generar lo que ya estaba bien.
- Que señalar con el raton sea la forma natural de decir "esto de aqui".
- Que el HTML siga siendo legible: nada de atributos por todas partes.

**Non-Goals:**

- No se toca el modelo de datos ni PocketBase.
- No se toca como se guardan las versiones de una pagina.
- No se retira `escribir_pagina`.
- No se cambia el protocolo de la conversacion (`AiProgress` sigue igual). La IA no pregunta todavia: eso es el paso siguiente.

## Decisions

### Direccionar por atributo, no por comentario ni por selector

Un bloque se nombra con `data-plane="lista-clientes"` en el propio elemento.

Lo decide el requisito futuro de señalar con el raton: el direccionamiento tiene que servir **en las dos direcciones**. Desde el navegador, `el.closest("[data-plane]")` resuelve en una linea. Desde el servidor, es un selector de atributo que `HTMLRewriter` entiende directamente. Un mismo idioma en los dos lados.

*Alternativa descartada:* comentarios `<!-- plane:bloque x -->`. Faciles de buscar como texto, pero desde el navegador hay que subir por el DOM buscando nodos comentario hermanos, y el modelo tiene que acordarse de cerrar la marca.

*Alternativa descartada:* selectores con `nth-child`. Cualquier insercion anterior los invalida, que es justo lo que este cambio hace todo el rato.

*Alternativa descartada:* reemplazo por texto exacto (`viejo` -> `nuevo`). El modelo no reproduce espacios y saltos de linea con fidelidad, y un fallo de coincidencia deja la operacion sin hacer sin que se sepa por que.

### Nombre legible que propone la IA, unicidad que garantiza el servidor

`data-plane="lista-clientes"`, no `data-plane="b7x2k9"`. Se lee en "Codigo HTML" y dice algo.

El riesgo del nombre con significado es la colision, y lo resuelve el servidor: antes de estampar, comprueba si el nombre existe y deriva uno libre. La IA nunca decide sola que un nombre esta disponible.

Es el mismo patron que `FieldDef.id` en las tablas, y por la misma razon: `AGENTS.md` ya advierte que dejar caer el id convierte un renombrado en borrar y crear. Aqui, dejar caer el `data-plane` convierte una edicion en borrar y crear. Por eso una operacion que devuelva el bloque sin su nombre lo repone antes de guardar.

### Se estampa al tocar, no por adelantado

Recorrer el documento estampando nombres en todas las secciones lo llenaria de atributos que nadie pidio, y obligaria a decidir de antemano la granularidad --la pregunta que no supimos contestar en la exploracion--.

Estampando solo lo que se edita, el documento acumula nombres unicamente donde de verdad se ha trabajado, y la granularidad la decide el uso.

Consecuencia: un HTML traido de fuera entra sin ningun nombre, y los va ganando a medida que se toca. La primera edicion de un bloque es "estampar y reemplazar" en una sola operacion.

### Escribir con `HTMLRewriter`; leer, reconstruyendo

Bun 1.3.14 trae `HTMLRewriter` (verificado). Reemplazar es directo:

```
new HTMLRewriter()
  .on('[data-plane="x"]', { element(e) { e.replace(html, { html: true }) } })
  .transform(doc)
```

**Leer es lo que no es directo**, y conviene dejarlo escrito porque cuesta descubrirlo: `HTMLRewriter` es un rewriter en streaming y no ofrece el `outerHTML` de un elemento. Un manejador sobre `*` solo ve texto suelto; dentro de `onEndTag` el `tagName` ya no esta.

La forma que funciona --verificada, round-trip exacto-- es un manejador sobre `*` con un contador de profundidad: al entrar en el elemento buscado se pone a uno, cada elemento anidado lo sube, cada `onEndTag` lo baja, y mientras sea mayor que cero se van concatenando las etiquetas de apertura con sus atributos, el texto, y las de cierre. Hace falta la lista de elementos vacios (`img`, `br`, `hr`, `input`, `meta`, `link`) porque esos no reciben `onEndTag`.

*Alternativa descartada:* un escaner propio de etiquetas con contador de profundidad sobre el texto. Es lo que habria que escribir si `HTMLRewriter` no existiera, y hay que tratar a mano comentarios, `<script>`, `<style>`, atributos con `>` dentro y elementos vacios. `HTMLRewriter` ya resuelve todo eso.

*Alternativa descartada:* meter un parser de DOM del lado del servidor. Una dependencia nueva para algo que el runtime ya trae.

### Leer desde el navegador cuando hay seleccion

Cuando quien construye senala un elemento, el `outerHTML` sale del DOM ya parseado del `iframe`: exacto y gratis. No hace falta que el servidor lo reconstruya.

La reconstruccion del punto anterior es para cuando la IA quiere leer un bloque por su nombre sin que nadie haya senalado nada.

### El cursor vive en el puente, no en el panel

El documento esta dentro de un `iframe`: el panel no puede escuchar `mouseover` dentro de el. El puente si, y ya tiene el canal montado en las dos direcciones.

El panel manda "entra en modo cursor"; el puente ilumina el candidato bajo el raton y, al hacer clic, devuelve el elemento senalado. Al salir del modo, deja de iluminar.

**Hay que silenciar la captura de clicks de la linea 132 mientras el cursor esta activo.** Es la que hoy convierte un clic en navegacion; sin silenciarla, señalar un enlace se llevaria la pagina a otro sitio.

### Que cuenta como candidato

`section, article, table, form, nav, header, footer, aside, ul, ol, figure`, los mandos de un formulario --`input, select, textarea, button, fieldset`--, mas cualquier elemento que ya lleve `data-plane`. Lo que no sea candidato sube al mas cercano hacia arriba con `closest()`.

Los mandos entran porque son la clase de cosa sobre la que mas se pide un cambio concreto --"este campo que sea obligatorio", "este boton en rojo"-- y son justo lo que no se puede señalar apuntando a su contenedor. Al ser los mas hondos, `closest()` los encuentra antes que la seccion que los rodea, asi que apuntar a un boton senala el boton y apuntar al hueco de al lado sigue senalando el formulario.

Un mando no tiene texto propio del que sacar un nombre: se busca fuera --su `<label>`, por `for` o por envoltura-- y luego en sus atributos (`placeholder`, `name`, `type`). Sin eso, tres campos seguidos darian tres badges que dicen "campo".

El riesgo conocido: un HTML hecho todo de contenedores genericos casi no tiene candidatos. La salida es quedarse con los bloques mas grandes que se reconozcan antes de llegar al cuerpo del documento, para que el raton nunca se quede sin nada que señalar.

### Varias selecciones, una edicion cada vez

Se pueden señalar varios elementos --cada uno con su badge-- y todos viajan como contexto. Pero cada operacion de edicion apunta a un bloque.

Unir dos elementos en uno pide reemplazar **un rango de hermanos consecutivos**, y `HTMLRewriter` trabaja elemento a elemento: no lo hace de una pasada. La IA puede conseguir el mismo efecto con dos operaciones --reemplazar el primero y quitar el segundo--, que es suficiente y no obliga a inventar una herramienta de rango.

## Risks / Trade-offs

- **El modelo devuelve el bloque sin su `data-plane` y una edicion se vuelve borrar y crear** → El servidor repone el nombre antes de guardar. Es la misma disciplina que ya existe con `FieldDef.id`.
- **El modelo se acostumbra al bisturi y deja de rehacer la pagina cuando de verdad hace falta** → `escribir_pagina` se conserva y el contexto dice cuando toca cada uno. Una peticion que cambia la estructura entera sigue siendo una reescritura.
- **Un bloque nombrado desaparece porque una reescritura completa lo borro** → Es correcto: rehacer la pagina rehace los nombres. Las referencias que apuntaban ahi fallan explicando que ese nombre ya no esta, en vez de tocar el bloque equivocado.
- **~~`HTMLRewriter` normaliza el HTML al reescribirlo~~** → Descartado: comprobado en Bun 1.3.14 que un documento que pasa por `transform` sin ninguna coincidencia vuelve **byte a byte identico**, incluidos doctype, comentarios, `<script>` con `<` dentro, entidades, elementos vacios y atributos con `>` en su valor. La transformacion se puede aplicar sobre el documento entero.
- **Señalar un elemento enorme manda demasiado a la IA** → Lo que viaja va recortado, con aviso de que va recortado. La IA puede pedir el bloque entero por su nombre si lo necesita.
- **El modo cursor deja el documento inutilizable si se queda activo sin querer** → Se sale con escape y desactivandolo desde el dock, y se apaga solo al seleccionar si no se pidio seleccion multiple.

## Migration Plan

No hay nada que migrar. Las paginas existentes no llevan `data-plane` y siguen funcionando igual: la primera edicion parcial de cada bloque lo estampa.

Vuelta atras: retirar las herramientas nuevas deja a la IA con `escribir_pagina`, como hoy. Los `data-plane` que hubieran quedado en documentos son atributos inertes que ningun navegador interpreta.

## Verificado antes de escribir esto

Sobre Bun 1.3.14, el runtime del proyecto:

- `HTMLRewriter` existe y reemplaza por selector de atributo: `.on('[data-plane="x"]', { element(e) { e.replace(html, { html: true }) } })`.
- Un documento sin ninguna coincidencia sale **identico byte a byte**.
- Un bloque se puede reconstruir entero --con sus etiquetas anidadas y sus atributos-- con el contador de profundidad descrito arriba.
- Lo que **no** funciona, y por eso esta escrito: leer con un manejador sobre `*` que solo atienda `text` pierde las etiquetas anidadas, y dentro de `onEndTag` el `tagName` es `undefined`.
