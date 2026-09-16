> **Orden: este cambio va después de `relaciones-por-llave`.**
>
> Los dos tocan `page-context` y los dos cambian lo que recibe la página publicada. `relaciones-por-llave` fija la forma en que una celda de relación llega al documento; este cambio mueve el camino de datos de la página al servidor. Hacerlo después significa mover ese camino una sola vez, ya sobre la forma nueva.
>
> Afecta sobre todo al grupo 3 (las órdenes pasan por el servidor) y al grupo 8 (contexto de la IA), que se escriben encima de lo que aquel dejó.

## 1. Modelo de alcance

- [x] 1.1 Definir en los tipos compartidos la entrada de alcance de una tabla: rol, alcance de lectura, alcance de escritura y peldaño
- [x] 1.2 Definir el alcance como forma con tipo (`todas`, `mías`, `ninguna`) y, para `mías`, una conexión con tipo propio, dejando sitio al empate por valor de un cambio posterior
- [x] 1.3 Definir la escalera de cinco peldaños y la función que dice si un peldaño permite una orden
- [x] 1.4 Guardar la lista de entradas en la tabla y aceptarla al crear y al editar
- [x] 1.5 Validar al guardar: la columna de una conexión existe y es de tipo persona; el alcance de escritura no supera al de lectura; el rol existe en la aplicación
- [x] 1.6 Traducir el `ownerField` actual al modelo de alcance, de forma que una tabla que ya lo tenía no cambie de comportamiento
- [x] 1.7 Limpiar entradas huérfanas cuando se renombra o se borra un rol de la aplicación

## 2. Resolución del permiso

- [x] 2.1 Resolver los roles de quien pregunta a partir de su sesión, ignorando lo que envíe el navegador
- [x] 2.2 Componer, para una persona y una tabla, el alcance efectivo de lectura y el de escritura como unión de sus roles
- [x] 2.3 Resolver el peldaño efectivo como el más alto de entre sus roles
- [x] 2.4 Aplicar el caso sin entradas declaradas: comportamiento anterior al cambio, decidido por el nivel en la aplicación
- [x] 2.5 Traducir un alcance efectivo a un filtro de consulta contra la tabla
- [x] 2.6 Comprobar una fila concreta contra el alcance de escritura antes de crear, actualizar o borrar

## 3. Las órdenes de datos pasan por el servidor

- [x] 3.1 Crear la ruta del servidor que resuelve las cinco órdenes de una página publicada, con la sesión de quien pregunta
- [x] 3.2 Comprobar en cada orden que la fuente está declarada en la página y que la página está al alcance de quien pregunta
- [x] 3.3 Aplicar el filtro de lectura en listar y en obtener, y que el total de una lista cuente sólo lo que se alcanza
- [x] 3.4 Responder "no existe" cuando se pide una fila fuera de alcance, sin revelar que existe
- [x] 3.5 Aplicar el peldaño en crear, actualizar y borrar
- [x] 3.6 Cambiar el puente del panel para que las órdenes del documento vayan al servidor en vez de a la base
- [x] 3.7 Mantener la vista previa del constructor por el mismo camino, para que lo que prueba sea lo que ocurre

## 4. Comprobación de que nadie alcanza lo ajeno

- [x] 4.1 Montar el escenario de prueba: una aplicación con cuatro roles, dos tablas y personas con uno y con varios roles
- [x] 4.2 Probar cada combinación de rol y tabla contra las cinco órdenes, comprobando que no llega ninguna fila fuera de alcance
- [x] 4.3 Probar los intentos directos: pedir una fila ajena por su identificador, listar sin filtro, enviar roles falsos en la petición
- [x] 4.4 Probar que un alcance de lectura `todas` con escritura `mías` deja ver todo y cambiar sólo lo propio
- [x] 4.5 Probar los peldaños `consultar` y `registrar` en sus dos casos: leer sin borrar, y añadir sin editar después
- [x] 4.6 Probar que quien tiene dos roles recibe la unión y puede lo del peldaño más alto
- [x] 4.7 Probar que una tabla sin entradas declaradas devuelve exactamente lo mismo por el camino nuevo que por el antiguo

## 5. Cierre del camino directo a la base

- [x] 5.1 Generar las reglas de las colecciones de datos cerradas a todo lo que no sea el servidor
      (cerradas a los invitados; el constructor conserva su puerta, que es la que usa el panel
      --grilla, panel lateral, importación, exportación-- y que no da acceso a nada que el dueño
      de la aplicación no alcance ya)
- [x] 5.2 Aplicar el cierre a las tablas existentes sin perder datos
      (`closeDataCollections` en `server/bootstrap.ts`, al arrancar)
- [x] 5.3 Comprobar que una consulta a la base con una sesión de invitado se rechaza
- [x] 5.4 Dejar generable la regla antigua desde un modelo de alcance vacío, como vuelta atrás
      (`legacyAccessRules` en `server/schema.ts`)

## 6. Pantalla de quién ve qué

- [x] 6.1 Abrir el ajuste desde el editor de tablas, cerrado por defecto y sin bloquear el uso de la tabla
      (entrada "Repartirlo por rol..." dentro del menú de quién ve cada fila, en `AccessModal.tsx`)
- [x] 6.2 Una fila por rol de la aplicación, con alcance de lectura, alcance de escritura y peldaño
- [x] 6.3 Elegir la columna de conexión sólo entre las columnas de tipo persona de esa tabla
- [x] 6.4 Componer el resumen en español, una frase por rol, sin nombrar columnas técnicas ni peldaños
- [x] 6.5 Decir en el resumen que quien tiene varios roles alcanza la unión
- [x] 6.6 Mostrar el resumen del caso sin entradas: todos los invitados alcanzan todas las filas
- [x] 6.7 Avisar cuando una tabla queda sin ningún rol que la alcance, sin impedirlo

## 7. Ver la página como otro rol

- [x] 7.1 Aceptar en el servidor el rol pedido para la vista previa, sólo del dueño de la aplicación
- [x] 7.2 Resolver las órdenes con ese rol, sin ampliar nunca lo que el dueño ya alcanza
- [x] 7.3 Elegir el rol desde el constructor y recargar la pantalla
- [x] 7.4 Dejar visible en todo momento que se está mirando como otro rol
- [x] 7.5 Comprobar que un rol sin alcance se ve vacío y sin errores
      (sección 20 de `scripts/smoke-permisos.ts`, y comprobado en el navegador)

## 8. Contexto de la IA y documentación

- [x] 8.0 Partir del contexto tal como lo dejó `relaciones-por-llave`, sin deshacer lo que aquel escribió sobre las columnas de relación
- [x] 8.1 Añadir al contexto de una página el alcance de cada rol en cada tabla, con la columna que conecta
- [x] 8.2 Añadir la advertencia de que una lista puede llegar vacía y de que un total cuenta sólo lo que se alcanza
- [x] 8.3 Decir el caso sin alcances declarados de forma explícita, para que la IA no invente restricciones
- [x] 8.4 Comprobar que la documentación del constructor refleja lo mismo, por venir de la misma fuente
- [x] 8.5 Actualizar el README con el modelo de alcance y la escalera de peldaños
      (sección nueva en `README-HTML.md`, escrita a mano y no con `bun run docs`: el generador
      escribe español sin tildes y los README están con ellas, así que regenerarlos quitaría las
      tildes de 250 líneas que este cambio no toca. La deriva entre `shared/htmlContract.ts` y los
      README ya existía y queda sin resolver)

## 9. Cierre

- [x] 9.1 Recorrer con la prueba de humo el camino completo: crear tabla, declarar alcances, publicar, entrar con dos personas de roles distintos y comprobar que cada una ve lo suyo
      (secciones 1 a 19e de `scripts/smoke-permisos.ts`)
- [x] 9.2 Comprobar que una aplicación existente, sin tocar nada, sigue funcionando igual
      (sección 19 de la batería: una tabla sin alcances entrega lo mismo que entregaba la regla
      antigua. Y las secciones 14, 15 y 18 de `scripts/smoke.ts`, que prueban el `ownerField` de
      siempre, ahora por la ruta de datos en vez de contra la base)
- [x] 9.3 Revisar que los escenarios de los dos specs tienen prueba o comprobación manual anotada

### Dónde se comprueba cada escenario

`access-control` (22 escenarios). Todos en `scripts/smoke-permisos.ts` salvo donde se diga:

| Escenario | Dónde |
|---|---|
| Un rol alcanza todas y otro sólo las suyas | §8 |
| Un rol no alcanza ninguna fila | §8, §10 |
| La columna que conecta no es de tipo persona | §5 |
| Una tabla con dos columnas de persona | §8 (agendas conecta por odontólogo y por conductor) |
| Ver todas las reservas y mover sólo la propia | §13 |
| Escribir más allá de lo que se lee | §5 |
| Leer sin poder borrar | §15 |
| Añadir sin poder editar después | §16 |
| El peldaño `nada` gana sobre el alcance | §8, §10 |
| Odontólogo y conductor a la vez | §18 |
| Un rol permite más que el otro | §18 |
| Petición sin filtro desde el navegador | §8 (lista y total) |
| Alcanzar una fila ajena por su identificador | §9 |
| Roles enviados por el navegador | §11 |
| Hablar con la base directamente | §19b, §19c |
| Crear una tabla y usarla enseguida | §19 |
| La columna de dueño que ya existía | `scripts/smoke.ts` §15 |
| Resumen de una tabla con cuatro roles | **manual**: comprobado en el navegador con los cuatro roles del escenario del spec; el resumen sale de `summarize` en `shared/access.ts` |
| Tabla sin alcances declarados (resumen) | **manual**, y el mismo texto se comprueba en §19d por venir de la misma fuente |
| Mirar la agenda como odontólogo | §20 |
| Mirar como un rol que no alcanza nada | §20 |
| Comprobación de una tabla con alcances mixtos | §8, §9 |

`page-context` (6 escenarios):

| Escenario | Dónde |
|---|---|
| Aplicacion con tablas | `scripts/smoke.ts` §17 |
| Aplicacion sin tablas | `scripts/smoke.ts` §17 |
| Tabla con alcances declarados por rol | §19d |
| Tabla sin alcances declarados | §19d |
| Pantalla para un rol con alcance limitado | **sin prueba automática**: es sobre lo que escribe la IA. Lo comprobable es que el contexto lo advierte, y eso está en §19d |
| Pantalla que cuenta filas | **sin prueba automática**, por lo mismo. La advertencia del total está en §19d |
