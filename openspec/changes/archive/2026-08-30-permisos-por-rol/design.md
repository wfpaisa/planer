## Contexto

Ver `proposal.md - Por qué` para la motivación.

Lo que condiciona el diseño, verificado en el código actual:

- **El navegador habla directo con la base.** Las órdenes de datos de una página viajan del documento HTML al panel por `postMessage`, y el panel las resuelve contra PocketBase con la sesión de quien mira. No hay ningún paso por el servidor de Planer. Ver `web/src/components/HtmlFrame.tsx`.
- **El permiso vive en reglas escritas dentro de la base.** `accessRules` en `server/schema.ts` compone una cadena por tabla. Con dueño de fila queda: leer si eres el constructor, o administrador de la app, o invitado y la columna de dueño te nombra.
- **Los roles de una persona son una lista libre por aplicación**, guardada en `app_access.roles`. El nivel (`viewer`, `editor`, `admin`) es aparte y vale para toda la aplicación.
- **Una tabla tiene como mucho un `ownerField`**, y ese campo decide igual para todo el mundo.
- **La columna de tipo persona es una relación a la lista común de invitados**, comparada por identificador interno.
- **El servidor ya tiene sesión propia con permisos completos sobre la base**, y ya la usa para el panel.

## Objetivos y fuera del alcance

**Objetivos:**

- Que el alcance por rol quede expresado en un sitio, sea legible y se pueda comprobar con pruebas.
- Que el dato fuera de alcance no salga del servidor.
- Que la forma del alcance admita después el empate por valor y el alcance "las filas de mi gente" sin rehacer el modelo.
- Que una aplicación existente siga funcionando sin tocar nada.

**Fuera del alcance:**

- Rendimiento a gran escala. Se asume el tamaño de una aplicación de área: decenas de miles de filas, decenas de personas.
- Cachear la resolución de roles. Se resuelve por petición.
- Ver `proposal.md - Fuera del alcance` para lo que queda fuera del alcance funcional.

## Decisiones

### 1. El permiso se resuelve en el servidor, no en reglas de la base

**Decisión:** las cinco órdenes de datos de una página publicada pasan a resolverse en el servidor de Planer. El navegador deja de hablar con la base.

**Por qué:** una regla de PocketBase es una sola cadena por tabla y por operación. Expresar cuatro roles con alcances distintos obliga a encadenar condiciones sobre `@collection.app_access`, y en una regla todas las referencias a la misma colección resuelven contra la misma unión. El resultado son ramas que se contaminan entre sí de forma difícil de ver y casi imposible de probar. Con datos como llamados de atención o nómina, una regla floja no es un fallo técnico: es un incidente de la empresa.

**Alternativa considerada: seguir en la base, generando la regla.** Se descarta. El coste de escribir el generador es parecido, pero la salida no se puede probar sin levantar la base y ejercitar cada combinación, y un fallo se manifiesta como filas de más, en silencio.

**Alternativa considerada: filtrar en el panel antes de entregar al documento.** Se descarta. El panel corre en el navegador de quien mira; lo que filtra ahí ya llegó.

**Consecuencia:** las reglas de la base pasan a ser una sola cosa, cerrar la colección a todo el que no sea el servidor. Dejan de contener lógica de negocio. Es menos código en la base, no más.

### 2. El alcance se guarda como una lista, no como un campo por rol

**Decisión:** cada tabla guarda una lista de entradas. Cada entrada nombra un rol, su alcance de lectura, su alcance de escritura y su peldaño. Un alcance es, a su vez, una forma con un tipo (`todas`, `mías`, `ninguna`) y, cuando es `mías`, la conexión que lo resuelve.

**Por qué la conexión es una forma propia:** hoy sólo hay un tipo de conexión, la relación directa por columna de persona. El empate por valor (cédula, correo) es otro tipo, y llega en un cambio posterior. Si la conexión es una forma con tipo desde el principio, ese cambio añade un tipo y no toca nada más. Si fuera un nombre de columna suelto, habría que rehacerlo.

**Por qué una lista y no un mapa de rol a permiso:** los roles se renombran y se borran. Una lista permite detectar entradas huérfanas y avisar, igual que ya se hace con los roles de una página.

### 3. Ausencia de entradas significa el comportamiento de hoy

**Decisión:** una tabla sin entradas se comporta como antes de este cambio: los invitados alcanzan todas las filas, o sólo las suyas si hay columna de dueño, y lo que pueden hacer lo decide su nivel en la aplicación.

**Por qué:** es lo que permite que el ajuste sea opcional y que ninguna aplicación existente se rompa. También es lo que hace que el usuario sin experiencia no tenga que entender permisos para publicar su primera pantalla.

**Consecuencia:** el `ownerField` actual no desaparece. Se conserva como la forma corta de decir "cada quien ve lo suyo", y se traduce internamente al mismo modelo de alcance.

### 4. La unión entre roles se resuelve con un OR de condiciones

**Decisión:** quien tiene varios roles alcanza la unión de lo que alcanza cada uno, y puede lo que permita el peldaño más alto.

**Por qué la unión y no la intersección:** un odontólogo que además conduce tiene que ver las dos cosas. La intersección dejaría sin datos al caso más común de la aplicación de agenda.

**Riesgo asumido:** con la unión, añadir un rol nunca quita acceso, sólo lo amplía. Quien administra tiene que entender eso, y por eso el resumen en español lo dice cuando una persona tiene más de un rol.

### 5. La vista previa por rol se resuelve en el servidor

**Decisión:** ver una página como otro rol no simula nada en el navegador. El servidor recibe el rol pedido, comprueba que quien lo pide es el dueño de la aplicación, y resuelve las órdenes de datos como si quien preguntara tuviera ese rol.

**Por qué:** una simulación en el navegador demostraría que la pantalla se dibuja, no que el permiso funciona. La vista previa existe justo para que alguien sin conocimientos pueda confiar, y una vista previa que miente es peor que no tenerla.

**Restricción:** sólo el dueño de la aplicación puede pedirla, y nunca amplía lo que ese dueño ya alcanza.

### 6. La comprobación automática es parte del cambio, no un extra

**Decisión:** se construye una batería que, para cada combinación de rol y tabla, ejercita las cinco órdenes e intenta alcanzar filas de otro rol. Se escribe junto al servidor de datos, no después.

**Por qué:** es lo único que distingue "creo que el permiso funciona" de "está demostrado". El cambio quita el permiso de donde estaba y lo pone en otro sitio; durante ese traslado es cuando se abren las fugas.

## Riesgos y compensaciones

**Un alcance mal resuelto entrega filas ajenas, en silencio** → La batería del punto 6 corre en cada combinación de rol y tabla, no sólo en el camino feliz. Cada requisito del spec de `access-control` tiene al menos un escenario que es una prueba.

**Un salto más en cada orden de datos** → Antes el navegador iba a la base; ahora pasa por el servidor, que corre en la misma máquina y con la misma sesión privilegiada que ya usa el panel. El coste esperado es bajo. Si aparece, se mide antes de optimizar.

**El servidor pasa a ser el único camino a los datos** → Si el servidor se cae, la aplicación publicada deja de responder. Antes también: el servidor ya sirve el panel, el HTML de las páginas y el propio proceso de la base.

**Una tabla puede quedar sin ningún rol que la alcance** → El resumen en español lo dice, y la vista previa por rol lo enseña vacío. No se impide: hay tablas que sólo toca quien administra.

**Los roles se renombran o se borran y quedan entradas huérfanas** → Al cambiar los roles de la aplicación se limpian las entradas que ya no apuntan a ningún rol, con el mismo criterio que ya se aplica a los roles de una página.

**La IA escribe páginas contando con datos que no van a llegar** → El contexto pasa a incluir el alcance de cada rol y la advertencia de que una lista puede llegar vacía. Ver el spec de `page-context`.

## Plan de migración

1. El modelo de alcance se añade sin usarse. Una tabla sin entradas se comporta igual.
2. El servidor empieza a resolver las órdenes de datos. Las reglas de la base todavía permiten el camino antiguo, así que los dos caminos dan lo mismo.
3. La batería de comprobación demuestra que los dos caminos coinciden en las tablas sin alcances declarados.
4. Se cierran las colecciones de datos a todo lo que no sea el servidor. Este es el paso que no se deshace sólo.
5. Se abre el ajuste de quién ve qué en el editor de tablas.

**Vuelta atrás:** hasta el paso 4, se vuelve reabriendo las reglas de la base. Después del paso 4, hay que reponer las reglas antiguas, que se conservan generables desde el modelo de alcance vacío.

## Preguntas abiertas

- **Qué pasa cuando una columna de persona usada por un alcance se borra o cambia de tipo.** Encaja en el diálogo de impacto que ya existe para los cambios de estructura con riesgo. Se resuelve al construir, sin cambiar el spec ni el reparto de tareas.
- **Si el resumen en español se guarda o se compone en el momento.** Componerlo en el momento parece lo correcto por lo mismo que el contexto de la IA se arma en cada petición, pero no cambia nada de lo acordado.
