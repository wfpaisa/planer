## Context

Ver `proposal.md` para el porqué. Lo que condiciona el diseño es el estado actual:

- Una columna definida (`FieldDef`) se traduce a exactamente una columna de PocketBase en `server/schema.ts`. Catorce sitios entre `schema.ts`, `dataImpact.ts`, `versions.ts` y `htmlBridge.ts` dan eso por hecho.
- `person` es hoy un tipo aparte: en `schema.ts` se traduce a una relación a la colección común de personas, y en `cells.tsx`, `importParse.ts` y `aiPage.ts` tiene ramas propias.
- Lo que se muestra de una relación lo decide `relationLabel` en `cells.tsx` cogiendo la primera columna de texto del registro expandido.
- La grilla del constructor habla directo con PocketBase (`pb.collection(...).getList`). La página publicada habla por el puente (`server/htmlBridge.ts`).
- `permisos-por-rol`, aún sin implementar, apoya el alcance "las mías" en `ownerField = @request.auth.id`. Depende de que el enlace guardado sea el id.

## Goals / Non-Goals

**Goals:**

- Un solo camino para persona y relación.
- Que el id no aparezca en ninguna pantalla ni en ningún archivo exportado.
- Que una fila sin enlace sea un estado en el que se puede trabajar, no un rechazo.
- Que el cambio en lo que recibe la página publicada sea gobernable, no una rotura.

**Non-Goals:**

- Relaciones múltiples por llave.
- Resolver la llave en el momento de leer, en vez de al escribir.
- Tocar el alcance por rol, que es de `permisos-por-rol`.

## Decisions

### El enlace se guarda por id, no por valor

**Por qué.** Dos razones que no dependen de gustos. La primera: `accessRules` compara `ownerField = @request.auth.id`; si la celda guardara la cédula, esa comparación deja de comparar nada y el alcance por rol se queda sin suelo. La segunda: si alguien corrige una cédula mal digitada, con el id guardado sus filas siguen siendo suyas y pasan a enseñar el número corregido solas; con el valor guardado quedan huérfanas o se re-apuntan a quien tenga ahora ese número. En una tabla de llamados de atención ninguna de las dos es aceptable.

**Alternativa descartada.** Guardar el valor y resolverlo al leer. Más simple de escribir, imposible de conciliar con lo anterior.

### Una columna definida ocupa dos columnas reales

La relación (id, o vacío) y el valor sin dueño (texto, o vacío). **Nunca están las dos llenas a la vez**: si el valor encontró registro se guarda el id y el texto se tira; si no, se guarda el texto y no hay id.

El texto no es una copia ni un caché de lo que se muestra. Lo que se muestra se lee siempre del registro enlazado, que es lo que hace que corregir un dato se propague. El texto es únicamente **el corralito de lo que no encontró dueño**, y en una tabla sana está vacío en todas las filas.

**Alternativa descartada.** Guardar solo el id y rechazar las filas que no casan. Es más barato --se cae toda esta sección-- pero deja fuera del sistema filas que son válidas: el exceso de velocidad ocurrió aunque esa cédula no esté en la lista. El empleado tendría que arreglar el CSV en Excel y reimportar, que es justo el trabajo que este producto existe para quitarle.

**Coste asumido.** Los catorce sitios que asumen "una columna definida es una columna real". Es tedioso, no difícil, y se paga en `tasks.md`, no aquí.

### `person` deja de ser un tipo con camino propio

Pasa a ser una relación a la tabla de personas de la aplicación con una llave por defecto. Desaparecen sus ramas en `schema.ts`, `cells.tsx`, `importParse.ts`, `dataImpact.ts` y `aiPage.ts`.

**Consecuencia mientras no exista `personas-como-tabla`:** la única columna única disponible en la lista de personas es el correo, que ya existe. Este cambio funciona con el correo como llave; la cédula llega con el otro cambio, por la misma puerta y sin mecanismo nuevo.

### Mostrar y emparejar son dos ajustes distintos

- **Mostrar** es de la columna y es permanente: "Conductor se ve por cédula". Vale para la grilla, la exportación y la página.
- **Emparejar** es del momento de importar y lo decide el archivo: el de Tránsito trae cédulas, el de nómina trae correos.

Al importar se propone la de mostrar, o la que encaje mirando los valores que llegan, y se puede cambiar sin que la grilla se mueva.

**Por qué separarlos.** Atarlos obligaría a cambiar lo que ve todo el mundo para poder importar un archivo distinto una vez.

### Al escribir manda la llave; al mostrar manda el registro

Una sola dirección en cada momento. El id nunca se escribe a mano: es derivado de la llave. Eso evita las dos fuentes de verdad que se separan al tercer cambio.

### Los valores sin dueño se agrupan por valor

Veinte filas suelen ser tres cédulas. La pantalla enseña los valores distintos con cuántas filas dependen de cada uno, y cada uno se resuelve creando el registro --y sus filas se enlazan de una vez-- o aceptándolo, con lo que deja de contar.

**"Aceptar" hace falta.** Sin él, las cédulas de terceros que nunca van a tener registro cuentan para siempre, el contador nunca llega a cero y se convierte en ruido que el usuario aprende a ignorar.

### La marca en la fila es neutra, no una alarma

Si veinte filas van a quedar así a propósito, un aviso de error en cada una es ruido. Se señala en neutro. La excepción sin discusión: **si esa columna es la que decide quién ve cada fila**, sin enlace la fila no la ve nadie --guardada e invisible--, y ahí sí se impide dejarla sin enlace.

### La validación al escribir bloquea el campo, no la fila

El panel lateral guarda la fila entera. Si el valor no casa se marca ese campo y el formulario sigue abierto: los otros seis campos escritos no se pierden.

Y bloquea **lo que se toca**, no lo que está mal. Si una fila ya venía con un enlace roto y se edita otra columna, no se impide guardar: si no, cada persona que sale de la aplicación convierte sus filas en intocables.

### La página recibe la llave siempre y el registro cuando lo hay

La celda llega con el valor de la columna que enseña --presente siempre-- y los datos del registro enlazado, vacíos cuando no hay enlace. La página pinta la fila igual y solo el nombre sale en blanco.

De aquí sale la regla que hay que dejar escrita en el contexto de la IA: **agrupar por el valor, nunca por el id**. Como el valor está siempre, las filas sin enlace siguen sumando. Agrupando por id se caerían de las gráficas en silencio y el total no cuadraría con la tabla. Es el fallo sutil que hay que evitar por diseño, no por cuidado de quien escriba la página.

Del registro enlazado solo llega lo que la página tenga declarado, igual que con las columnas de la tabla que se pide. Si no, la relación se convierte en un agujero por el que salen columnas que nadie declaró.

### Cómo se pinta una fila sin enlace lo dice el contexto, no cada página

Si cada página lo resuelve a su manera, el usuario no aprende a leerlo. El contexto fija una sola forma.

## Risks / Trade-offs

- **Una página ya escrita recibe otra cosa** → Es lo único que puede romper de verdad. Ver el plan de migración.
- **Los catorce sitios de una columna = dos columnas** → Se olvida uno. Cada uno es una tarea con nombre en `tasks.md`, no un "revisar el resto".
- **Marcar una columna como única sobre datos que ya se repiten** → No se aplica la marca; hay que decir cuáles chocan y cuántas son, o el usuario no sabe qué arreglar.
- **Emparejar mira a toda la tabla destino** → Para personas eso significa buscar solo entre las invitadas a esta aplicación. La lista de cuentas es común a todas, y emparejar contra ella revelaría que alguien existe en la aplicación de otro.
- **Choca con `permisos-por-rol`** → Los dos tocan `page-context` y los dos tocan lo que la página recibe. Hay que decidir el orden antes de empezar, no a mitad.

## Migration Plan

1. Lo nuevo primero: la columna que se muestra, la marca de única, la columna del valor sin dueño. Nada de esto cambia lo que ve nadie.
2. Rellenar la columna que se muestra en las columnas de relación que ya existen, con lo que `relationLabel` estuviera adivinando, para que la grilla no cambie de un día para otro.
3. Grilla, importar y exportar.
4. El puente al final, que es lo que puede romper páginas. Mientras dure la transición la forma vieja se sigue entregando junto a la nueva; se retira cuando no quede ninguna página pidiéndola.

Vuelta atrás: hasta el paso 3 se revierte solo. El paso 4 se revierte dejando de entregar la forma nueva, siempre que la vieja siga ahí.

## Open Questions

- Cuánto tiempo se conserva la forma vieja de una celda de relación en el puente, y cómo se sabe que ya no queda ninguna página pidiéndola.
- Si escribir a mano un valor que no existe debe frenar o avisar con los mismos dos botones de "conectar o dejar así". El bloqueo es la decisión tomada; la coherencia con el resto empuja hacia el aviso. No cambia specs ni tareas.
