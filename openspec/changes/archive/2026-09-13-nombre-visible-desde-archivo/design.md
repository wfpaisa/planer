## Context

Ver `proposal.md` — Why.

Ya existe media solución: la función que nombra una columna nueva al importar pone la mayúscula inicial y baja un encabezado escrito entero en mayúsculas. Lo que no hace es separar las palabras, y no la usan los dos caminos que crean desde un archivo soltado.

## Goals / Non-Goals

**Goals:**

- Que lo que nace de un archivo se pueda leer sin renombrarlo a mano.
- Una sola regla, en un solo sitio, para la tabla y para las columnas.

**Non-Goals:**

- Cambiar nombres ya guardados.
- Cambiar cómo se deriva el nombre técnico, ni cómo se empareja un archivo con su tabla. Emparejar ya normaliza los dos lados.
- Adivinar mayúsculas de siglas que vengan en minúsculas.

## Decisions

### D1. Solo se traduce lo que viene escrito como nombre técnico

Un texto con espacios ya está escrito para leerse, y uno con mayúsculas propias las tiene por algo. Solo se convierte el que no tiene espacios y trae guiones o guiones bajos entre palabras.

La alternativa --convertir siempre-- destruye `IVA_2026` y `Chequeo Preoperacional`, que es justo lo que hoy funciona bien cuando el archivo lo escribió una persona.

### D2. La regla vive donde ya vive media

La función que nombra una columna nueva al importar se extiende con la separación de palabras y pasa a usarse también para el nombre de la tabla y para las columnas de los dos caminos de soltar. Hoy hay tres sitios que usan el texto crudo y uno que ya la usa.

Alternativa descartada: una función nueva al lado. Dejaría dos reglas de nombrar columnas conviviendo, y la de importar seguiría poniendo "Codigo_empleado".

### D3. Las siglas en minúsculas se pierden, y se acepta

`nit-empleado` se convierte en "Nit empleado", no en "NIT empleado". Distinguir una sigla de una palabra requiere una lista de siglas, que hay que mantener y que acierta a medias.

Lo mismo vale para una palabra que lleve guion de verdad: `pre-operacional` pasa a "Pre operacional". Es poco frecuente y se renombra desde el panel en un clic, que es donde está el nombre visible de todas formas.

## Risks / Trade-offs

- Un nombre con guion legítimo se separa → se renombra desde el panel; el nombre técnico y los datos no se enteran.
- Un archivo con cabeceras ya legibles pasa por la regla y no la cumple, así que no se toca → es el caso que hoy funciona y sigue igual.

## Migration Plan

No hay. Nada guardado cambia.
