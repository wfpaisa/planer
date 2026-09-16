## Context

Ver `proposal.md` - Why.

Seis hechos del código de hoy sostienen todo lo que sigue:

- Una columna de persona se guarda en PocketBase como relación a la colección común de cuentas, y una columna de relación, como relación a la colección de datos de la tabla destino (`toPbField` en `server/schema.ts`). Son dos anclas distintas para la misma persona.
- La tabla de personas de cada aplicación tiene un índice único sobre la columna que enlaza con la cuenta, y `syncPersonRows` (`server/peopleTable.ts`) crea la fila que falte y borra la que sobre. La correspondencia cuenta <-> fila es uno a uno, así que convertir un ancla en la otra no pierde nada.
- Las dos nacen con `cascadeDelete: false`, así que al borrar el registro apuntado PocketBase anula el enlace por su cuenta, sin avisar y sin pasar por nuestro código. Lo único que hoy salva el valor antes de esa anulación es `parkPersonReferences`, que filtra por tipo persona y deja fuera a las demás.
- El servidor ya manda a la página publicada las columnas propias de quien pregunta, enteras (`publicPeople` en `server/routes.ts`, que quita las de los demás y conserva las suyas). Quien las descarta es `viewer` en `web/src/components/HtmlFrame.svelte`, que arma `plane.usuario` con cuatro campos y tira el resto.
- `matchingTable` (`web/src/lib/dropFiles.ts`) compara el nombre del archivo contra la **etiqueta** de cada tabla, mientras la exportación nombra el archivo con el **nombre técnico** (`DataGrid.svelte`).
- La colección de la tabla de personas guarda el enlace con la cuenta y las columnas que le ponga el constructor, y nada más. El correo vive en la cuenta y los roles en el enlace con la aplicación (`app_access`): ninguno de los dos es una columna de esa colección, aunque la tarjeta de columna los enseñe como si lo fueran (`PEOPLE_SYSTEM_FIELDS` en `shared/people.ts`). Y la colección de cuentas solo se deja leer a sí misma (`id = @request.auth.id`), así que desde el navegador no hay forma de resolver la cuenta de otra persona.

## Goals / Non-Goals

**Goals**

- Que apuntar a otra tabla sea una sola cosa, se apunte a donde se apunte.
- Que una página pueda enseñar "lo mío" con la llave que use cada tabla, sin depender de un identificador.
- Que borrar algo no vacíe en silencio las filas que lo señalaban.
- Que un archivo que salió de una tabla vuelva a esa tabla.

**Non-Goals**

- Convertir "solo lo mío" en una barrera de acceso. Sigue siendo presentación; ver D6.
- Recuperar valores ya perdidos. No están en la base.
- Tocar las reglas de acceso ni el alcance de lo que una página publicada puede declarar.
- Resolver la concurrencia --dos personas editando la misma fila--. Es un problema aparte y no se aborda aquí.

## Decisions

### D1. Un solo tipo, anclado a la fila

El tipo persona desaparece. Toda columna que apunte a otra tabla es de tipo relación, y se ancla a la fila de la tabla destino, incluida la tabla de personas.

El motivo por el que existía el ancla a la cuenta --que una página supiera cuáles son las filas de quien mira-- deja de sostenerse en cuanto hay dos tablas que enlazan a la persona por llaves distintas. Con `chequeos` emparejando por correo y `excesos` por cédula, el identificador de la cuenta no aparece en ninguna de las dos: lo que las une a la persona es el valor, no el ancla.

Filtrar por valor además gana algo que el ancla no puede dar: encuentra las filas que nunca llegaron a enlazarse. Una cédula que quedó sin dueño porque esa persona todavía no estaba invitada es, para el ancla, una fila de nadie; para el filtro por valor, una fila más de esa persona.

*Alternativa descartada:* dejar los dos tipos y explicarlos mejor. No hay explicación que arregle una diferencia que no se ve: las dos columnas se llenan igual, se leen igual y solo se distinguen cuando algo ya salió mal.

### D2. Las columnas que ya son de tipo persona se convierten, no se abandonan

Cambiar el tipo cambia a qué colección apunta la columna, y eso obliga a recrearla (`recreateChanged` en `server/schema.ts`), lo que la deja vacía. Así que la conversión no puede ser un cambio de tipo a secas: hay que leer los valores antes, traducirlos y volver a escribirlos.

Se puede hacer sin perder nada porque la correspondencia cuenta <-> fila es uno a uno. Para cada columna de tipo persona: leer el ancla de cada fila, buscar la fila de personas de esa cuenta, recrear la columna apuntando a la tabla de personas y escribir el ancla nueva. Una celda cuya cuenta ya no esté invitada no tiene fila a la que apuntar: su valor se conserva como valor sin enlace, que es lo que este mismo cambio establece para todo lo demás.

*Sobre esta instalación:* las tablas que provocaron el cambio son de prueba y se van a borrar, así que aquí no hay nada que convertir. La conversión se escribe igualmente porque el tipo desaparece y una aplicación con datos de verdad no puede quedarse con columnas de un tipo que ya no existe.

### D3. Las tres capas, en ese orden y no en otro

Las capas van de la más segura a la menos:

```
  archivo soltado
        │
        ▼   ¿su columna `id` trae ids que ya existen en una tabla?
     [1] ──────────────────────────────────────────────► esa tabla
        │ no / empate
        ▼   ¿sus columnas son exactamente las de una tabla?
     [2] ──────────────────────────────────────────────► esa tabla
        │ no / empate
        ▼   ¿su nombre coincide con el nombre técnico o la etiqueta?
     [3] ──────────────────────────────────────────────► esa tabla
        │ no / empate
        ▼
    tabla nueva (se pregunta)
```

La capa 1 va primera porque es la única que no se rompe al cambiar las columnas o el nombre del archivo: los identificadores solo pueden venir de la tabla que los emitió. La 2 antes que la 3 porque el contenido dice más que el nombre. La 3 se queda por debajo, sin cambiar lo que hace hoy salvo comparar también contra el nombre técnico.

*Sobre el coste:* la capa 1 necesita preguntar a la base por unos pocos identificadores. Se consulta una muestra corta de la columna `id`, no el archivo entero, y solo cuando la columna existe.

*Sobre el empate:* hoy `matchingTable` coge la primera coincidencia sin decir nada, y la etiqueta de una tabla no tiene que ser única (solo lo es el nombre técnico, por `uniqueTableName`). Un empate pasa a la capa siguiente y, si ninguna decide, se pregunta.

### D4. La sesión lleva a la persona entera, con los nombres planos

`plane.usuario` pasa de cuatro campos a los cuatro más las columnas propias de la aplicación, planas: `plane.usuario.cedula`, no `plane.usuario.campos.cedula`. Planas porque es lo que se escribe en el filtro, y el filtro es para lo que existe.

El precio de las planas es el choque de nombres, y se paga prohibiéndolos: la tabla de personas no admite columnas llamadas `id`, `correo` ni `roles`. Es una restricción al crear la columna, no una comprobación al armar la sesión: rechazar el nombre una vez es más claro que resolver el choque cada vez.

`nombre` queda fuera de esa lista aunque también venga en la sesión, porque no hay choque que evitar: la tabla de personas nace con una columna llamada así (`PEOPLE_DEFAULT_FIELDS`) y es de donde sale el nombre de una persona en toda la plataforma (`personDisplayName`). Prohibirla rechazaría la columna propia de cada aplicación al guardar. Tampoco hace falta reservarla para que nadie cree otra: el nombre ya está ocupado. Borrarla, que es el riesgo de verdad, ya se rechaza (`guardSystemFields`) y se repone al arrancar.

No hay que traer nada nuevo del servidor. `publicPeople` ya entrega las columnas propias de quien pregunta; el cambio está en no descartarlas al armar `plane.usuario`.

### D5. El contexto de la IA cambia en tres sitios, y uno de ellos hoy dice lo contrario

- **Qué trae la sesión.** El contexto enumera los campos de `plane.usuario` con los nombres reales de esa aplicación, no una lista fija.
- **Cómo se filtra "lo mío".** Hoy el contexto dice, literalmente, que se filtra por el identificador *al pintar*. Las dos mitades dejan de valer: el identificador ya no es el ancla, y filtrar al pintar trae la tabla entera al navegador para tirar casi todo. Pasa a decir que se filtra en el servidor, con la llave que use esa tabla --que el propio contexto ya nombra, porque de cada relación dice qué columna enseña--.
- **Cómo se nombra a una persona.** El nombre por delante; el apellido si la aplicación lo tiene; un segundo dato solo cuando distingue a dos personas que se llaman igual o cuando la pantalla trata de eso, en letra pequeña; y el ancla nunca.

Lo último parece contradecir a la cuadrícula, que enseña la cédula delante y el nombre detrás, y no la contradice: la cuadrícula es para corregir --la cédula es el único dato con el que se arregla una celda-- y la página es para leer. El contexto lo dice así, para que la IA no lo tome por una inconsistencia y la "arregle".

### D6. "Solo lo mío" es presentación, y queda escrito que lo es

El filtro lo compone el servidor, pero el valor lo manda la página. Nada comprueba que ese valor sea el de quien mira, así que quien sepa mirar desde el navegador puede pedir las filas de otro.

Se acepta: el destino son aplicaciones de entorno controlado y, cuando la aplicación está marcada como privada, el servidor ya exige sesión e invitación antes de entregar ningún dato (`pageData.ts`). Lo que no se hace es fingir lo contrario. El contexto ya advierte de esto mismo para los roles, y esa advertencia se extiende a "lo mío".

*Alternativa aplazada:* que el servidor imponga el filtro a partir de la sesión, sin que la página mande el valor. Es lo que convertiría la comodidad en garantía, y es un cambio distinto: obliga a decidir por columna cuál es la que dice "esto es tuyo".

### D7. Qué pasa al borrar lo apuntado: dos opciones, y la decisión no se pide al crear

Una columna de relación declara una de dos:

- **Conservar el valor** (por defecto): la fila se queda y la celda sigue enseñando lo que decía, marcada como valor sin enlace. Es el corralito que la aplicación ya tiene y ya pinta en ámbar.
- **Borrar también esas filas**: la cascada, para la tabla hija que sin su padre no significa nada.

No se ofrece una tercera de dejar la celda vacía, que es lo que ocurre hoy sin que nadie lo haya elegido: pierde el dato y no da nada a cambio.

La pregunta no se hace al crear la columna. Ahí ya se piden tres cosas y esta es sobre algo que quizá no pase nunca; la contestaría quien todavía no ha llegado a ese momento. Vive en la tarjeta de la columna, y el aviso al borrar dice lo que va a pasar con números reales.

*Dónde se aplica:* la conservación del valor no puede vivir en PocketBase, que solo sabe anular o cascadear. Tiene que correr antes del borrado, y hoy hay tres caminos que borran una fila: la cuadrícula, que va directa a la base desde el navegador (`DataGrid.svelte`); la orden de una página publicada (`pageData.ts`); y quitar el acceso a una persona (`routes.ts`). El primero deja de ir directo y pasa por el servidor, que es lo que permite que la regla sea una y no tres.

### D8. Enlazar lo que esperaba corre al terminar la importación, no dentro

`waitingFor` (`web/src/lib/orphans.ts`) ya sabe encontrar las filas de otras tablas que esperaban a un registro recién creado. Hoy solo lo llama la cuadrícula al crear una fila suelta. Con un solo tipo de columna, sus dos ramas se vuelven una.

La importación en bloque lo llama al terminar, una vez, con la lista de invitados ya releída. Va después y no dentro para no repetir el barrido por cada persona del archivo: un archivo de doscientas personas haría doscientas pasadas sobre las mismas tablas.

A diferencia del caso de una persona suelta, aquí no se pregunta: se enlaza y se dice. Lo decidió el constructor al importar, y una pregunta por cada valor convertiría una importación en doscientos diálogos.

### D9. La adivinanza de columnas se reutiliza, no se reescribe

`guessPersonColumns` (`web/src/lib/personGuess.ts`) ya compara el contenido de una columna contra lo que tienen los invitados en las suyas, y ya cuenta aparte los valores que nombran a dos personas. Es lo mismo que hace falta para ofrecer convertir una columna de texto: cambia cuándo se llama y qué tipo propone, no cómo compara.

Hoy se llama al soltar un archivo, antes de crear la tabla, y propone una columna de persona. Pasa a llamarse también después de importar personas, sobre las columnas de texto de las tablas que ya existen, y a proponer una relación a la tabla de personas.

### D10. La tabla de personas es una tabla destino más, salvo en dos datos que no están en ella

D1 dice que apuntar a la tabla de personas es apuntar a una tabla, y lo es: el ancla es la fila. Lo que no se sostiene sin más es que sus columnas se lean como las de cualquier otra tabla, porque dos de ellas no están en su colección --el sexto hecho del Context--.

Los dos se reconocen por un solo sitio: `isOverlayField` (`shared/people.ts`), que es la columna del sistema de la tabla de personas. Cada camino los resuelve por donde puede:

- **Emparejar, enseñar y enlazar** van por la lista de invitados, que llega por su propia ruta (`/api/apps/:id/personas`, `/api/public/:slug/personas`) porque el navegador no puede leer la cuenta de nadie más. La lista se superpone al registro expandido de la base, no lo sustituye: las columnas propias siguen viniendo del expand.
- **Filtrar en el servidor** sí puede seguir el camino largo, porque lo arma `buildFilter` y corre con la llave de administración: `campo.member.cuenta` en vez de `campo.cuenta`. Es un salto más que en cualquier otra tabla, y por eso está escrito en un solo sitio (`displayPath` en `shared/htmlSources.ts`). El correo, que antes no se podía filtrar en el servidor, ahora sí.
- **Los roles no tienen camino** --el enlace con la aplicación no cuelga de la fila-- y no hace falta que lo tengan: llevan varios valores, así que no pueden ser ni la columna que enseña ni la llave por la que se empareja. Quedan fuera por construcción, no por un remiendo.

Para que el ancla sea siempre la fila, una persona invitada viaja con el identificador de su fila además del de su cuenta (`AppPerson.fila`). Lo arman dos sitios --`withOwnColumns` y `personOfRow`, los únicos que construyen una persona invitada-- y es lo que guarda toda columna que apunte a personas.

*Alternativa descartada:* dejar que la base resuelva el correo por el camino largo también en el navegador. No puede: la colección de cuentas solo se deja leer a sí misma, así que el expand de otra persona llega vacío.

## Risks / Trade-offs

- **Se rompen las páginas que comparen el identificador de la sesión contra una columna de persona** → Es la contrapartida de D1 y no tiene mitigación parcial: esas páginas hay que regenerarlas. Lo que sí se hace es que el contexto deje de enseñar el patrón viejo, para que no se vuelvan a escribir.
- **Convertir una columna de tipo persona toca todas las filas de esa tabla** (D2) → Es una operación de una sola vez, acotada a las columnas de ese tipo, y sin ella la columna quedaría vacía. Se prueba antes en esta instalación, donde no hay nada que perder.
- **Borrar filas desde la cuadrícula pasa a dar una vuelta por el servidor** (D7) → Es más lento que la llamada directa de hoy, y es lo que permite que conservar el valor sea una regla y no una costumbre. El borrado en bloque manda los identificadores juntos.
- **"Solo lo mío" no protege nada** (D6) → Aceptado y escrito. Lo que lo cierra de verdad es marcar la aplicación como privada, que sí lo comprueba el servidor.
- **La capa 1 consulta la base por cada archivo soltado** → Se consulta una muestra de identificadores, no el archivo, y solo si el archivo trae columna `id`.
- **Cambiar el nombre del archivo exportado rompe la costumbre de quien ya tenía archivos descargados** → La capa 3 compara contra el nombre técnico *además* de la etiqueta, así que los archivos viejos siguen reconociéndose. Por eso los dos cambios van juntos.
- **Enlazar sin preguntar al importar** (D8) → Solo se enlaza lo que identifica a una sola persona y no ha sido aceptado, que es la misma regla de todo lo demás. Lo enlazado se cuenta en el aviso.

## Migration Plan

Hay migración de datos, y es la de D2: cada columna de tipo persona se convierte a relación a la tabla de personas, traduciendo el ancla de cada fila. Corre una vez, al arrancar el servidor, y es idempotente --una columna ya convertida no vuelve a mirarse--.

El orden importa en dos sitios:

- La conversión SHALL correr antes de que ninguna otra parte deje de reconocer el tipo persona. Mientras queden columnas sin convertir, el código que las lee tiene que seguir entendiéndolas.
- El nombre del archivo exportado SHALL cambiarse después o a la vez que la capa 3; al revés, durante un tiempo los archivos recién descargados no se reconocerían al volver a soltarlos.

Los nombres reservados de la tabla de personas se comprueban al guardar columnas. Una aplicación que ya tenga una columna con uno de esos nombres --que ninguna tiene, porque el nombre no se ofrecía-- se rechazaría al guardar; la comprobación se escribe para lo que nace.
