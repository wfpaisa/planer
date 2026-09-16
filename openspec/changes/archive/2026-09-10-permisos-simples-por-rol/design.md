## Context

Ver `proposal.md` — Why para la motivación, y las specs de este cambio para el comportamiento que hay que cumplir.

Lo que importa aquí es el estado actual del código:

- El permiso vive hoy en dos capas. `shared/access.ts` define la forma de lo declarado (alcances, peldaños) y `server/access.ts` la resuelve. `server/pageData.ts` la aplica antes de cada una de las cinco órdenes de datos.
- `server/pageData.ts` hace además tres cosas que no son permiso: comprueba que la tabla pedida esté en el manifiesto de la página, resuelve relaciones y columnas de persona, y es el único punto por el que pasan las cinco órdenes.
- Quien abre una página se decide hoy en dos sitios que se contradicen: `AppRecord.visibility` (`private` / `public`) tapa a todas las páginas, y `PageRecord.access` (`anyone` / `signed` / `roles`) decide una a una.
- `PageRecord.roles` ya existe y ya significa lo que este cambio quiere: vacío es "la abre cualquiera", con roles es "sólo esos".
- Quien construye entra con una cuenta de `builders`; las personas invitadas, con una de `members`. Son colecciones distintas y no se cruzan. La tabla de personas se apoya en `members` con una relación obligatoria y única.
- Las reglas de PocketBase ya no dependen de nada de esto: `accessRules()` en `server/schema.ts` ignora sus parámetros `visibility` y `ownerField` y cierra las colecciones a quien construye. Las aplicaciones publicadas ya sólo hablan por el servidor.

## Goals / Non-Goals

**Goals**

- Retirar el reparto de filas sin tocar el esqueleto por el que pasan las órdenes de datos.
- Dejar una sola decisión por página y una sola por aplicación, sin que se pisen.
- Que el paso de lo viejo a lo nuevo no exponga nada que hoy esté cerrado, ni siquiera de forma transitoria.
- Que ningún concepto retirado quede a medias: ni en el código, ni en la base, ni en lo que lee la IA.

**Non-Goals**

- No se rediseña la vista publicada ni la pantalla de entrar.
- No se toca cómo se importan y exportan personas más allá de quitarles el nivel.
- No se reescribe el HTML de las páginas que ya existen. Una página que hoy confía en que el servidor le recorta las filas pasará a recibirlas todas; corregirla es trabajo de quien la construyó, y la IA puede hacerlo cuando se le pida.

## Decisions

### D1. El servidor se queda en medio

`server/pageData.ts` conserva su estructura y pierde sólo el filtrado. Se retiran `effectiveAccess`, `allows`, `withScope`, `rowInScope` y `requireWrite`; se conservan la resolución de quien pregunta, la comprobación de la página, el manifiesto de fuentes, la resolución de relaciones y el reparto en las cinco órdenes.

**Alternativa descartada:** devolver el navegador a hablar directo con PocketBase, como antes del cambio que creó este archivo. Se descarta porque obligaría a reimplementar dentro del HTML el manifiesto y la resolución de relaciones —trabajo que hoy no hace quien construye— y dejaría sin un punto único donde comprobar la sesión al escribir.

### D2. Quién abre una página se guarda sólo en `roles`

`PageRecord.access` desaparece. `PageRecord.roles` pasa a ser la única declaración: vacío es `Todos`, con nombres es "sólo esos".

Es lo que ese campo ya significa hoy cuando no hay `access` guardado, así que las páginas existentes no necesitan reescribirse: una página con `roles` vacío ya se comporta como `Todos`.

La exclusión entre `Todos` y los roles no se guarda: es una consecuencia de que la lista esté vacía o no, y la pantalla la refleja. Marcar un rol vacía el estado de `Todos` porque la lista deja de estar vacía; desmarcar el último lo repone por lo mismo. No hay dos estados que puedan discrepar.

**Alternativa descartada:** guardar `Todos` como un valor más dentro de `roles` (por ejemplo la cadena `todos`). Se descarta porque crea un nombre reservado que chocaría con un rol que alguien llame así, y porque permite el estado imposible de `todos` junto a otro rol.

### D3. `visibility` conserva su forma y cambia de nombre en pantalla

`AppRecord.visibility` sigue siendo `private` / `public` en la base. Lo que cambia es lo que significa y cómo se lee: `private` pasa a presentarse como "requiere iniciar sesión" y deja de tapar la decisión de cada página; `public` como "pública".

Renombrar el campo obligaría a una migración de datos que no compra nada: los dos valores siguen siendo los dos valores.

### D4. La sesión al escribir se comprueba en el servidor; el aviso lo pone el puente

`server/pageData.ts` rechaza `crear`, `actualizar` y `borrar` cuando quien pregunta llega sin sesión, con un error que se distingue de los demás por un código propio. `resolveViewer` ya devuelve un identificador vacío en ese caso, así que la comprobación es una sola condición antes de repartir la orden.

El puente (`server/htmlBridge.ts` y `web/src/components/HtmlFrame.svelte`) reconoce ese código y muestra el aviso, sin que el HTML de la página participe. La orden sigue rechazándose con un error que la página puede capturar si quiere hacer algo mejor.

Ponerlo en el servidor y no en el navegador es lo que hace que el aviso no se pueda saltar y que no dependa de que la IA se acuerde de escribirlo.

Quien construye escribe siempre: su sesión de constructor cuenta como sesión iniciada, salvo cuando está mirando la página sin sesión a propósito (D5).

### D5. Ver como: rol, persona opcional, y sin sesión

La petición de datos acepta hoy un `rol`. Pasa a aceptar además una persona y la marca de "sin sesión", y las tres sólo de quien es dueño de la aplicación.

- Con rol y sin persona: quien mira tiene ese rol y ninguna identidad concreta.
- Con rol y persona: quien mira es esa persona, con su identificador, su nombre, su correo y sus roles reales. Es lo que permite probar una pantalla que muestra "lo mío", que en el modelo nuevo se filtra dentro de la página.
- Sin sesión: quien mira es nadie. En una aplicación que requiere iniciar sesión, esto enseña la pantalla de entrar, que es justo lo que vería alguien sin cuenta.

`asRole` se sustituye por una función que compone ese "quien mira" a partir de los tres. La comprobación de que sólo el dueño puede pedirlo ya existe y se conserva.

### D6. Los roles se normalizan en un solo sitio

Una función en `shared/people.ts` convierte un nombre escrito en su forma guardada: minúsculas, sin tildes ni signos, espacios a guiones, guiones repetidos colapsados. La usan los tres sitios por los que entra un rol: el campo donde se escribe —en cada pulsación, para que se vea el resultado—, el saneado del servidor y la importación de personas.

Al migrar, dos roles que se normalicen al mismo nombre se funden en uno: se conserva una sola entrada en la aplicación y se reescriben todas las referencias —personas y páginas— al nombre normalizado, sin duplicados.

**Alternativa descartada:** guardar el nombre escrito junto al normalizado, para enseñar "Jefe de Zona" y comparar `jefe-de-zona`. Se descarta porque convertiría una lista de textos en una lista de parejas y obligaría a distinguir cuál de los dos se usa en cada sitio —páginas, personas, contexto de la IA, HTML de las páginas—; el HTML de una página compara contra el nombre guardado, y tener dos formas es exactamente la clase de detalle que la IA acaba confundiendo.

### D7. El rol `admin` está siempre y no se borra

`admin` se añade a `AppRecord.roles` al crear la aplicación y, para las que ya existen, en el arranque. No se puede quitar desde la pantalla de roles: quien construye lo tiene siempre, la vista previa arranca en él, y quitarlo dejaría `pruneRoles` borrándolo de las páginas que lo tuvieran marcado.

Dárselo a una persona invitada no le da nada del panel. El poder de quien construye viene de ser dueño de la aplicación, no del nombre del rol; son dos cosas que coinciden en el nombre y no en el efecto, y por eso la spec lo dice explícitamente.

### D8. Lo que se deja de usar se deja de leer, no se borra de la base

`PageRecord.access`, `TableRecord.ownerField`, `TableRecord.access` y el nivel de `app_access` dejan de leerse y de escribirse. Las columnas se quedan en PocketBase.

Borrarlas obligaría a una migración destructiva sin vuelta atrás a cambio de nada: no ocupan, no se leen, y mientras estén ahí volver atrás es reponer código y no recuperar datos. Los tipos de `shared/types.ts` sí las pierden, que es lo que impide que alguien vuelva a leerlas por descuido.

### D9. Las reglas de PocketBase no se tocan

`accessRules()` ya ignora `visibility` y `ownerField`: cierra las colecciones a quien construye y nada más. Lo único que cambia es su firma, que pierde los dos parámetros que no usa, y con ella `syncAppRules`.

`legacyAccessRules()` se elimina. Existía como vuelta atrás del cambio que trajo la resolución al servidor, y ese camino ya no se va a deshacer.

## Risks / Trade-offs

- **Una página "sólo con sesión" de una aplicación pública no tiene equivalente exacto** → La migración la convierte en una página con todos los roles marcados, nunca en `Todos`. Alguien sin ningún rol puede perder el acceso, y eso se arregla dándole un rol; abrir la página a cualquiera no se arregla, porque lo que se vio ya se vio.

- **Las páginas que hoy confían en el recorte del servidor pasarán a mostrar de más** → No se pueden arreglar automáticamente: sólo el HTML sabe qué pretendía enseñar. Se documenta como consecuencia esperada y la IA puede corregir una página cuando se le pida. El caso más visible —un total que ahora cuenta todas las filas— es también el más fácil de detectar mirando.

- **La restricción por rol depende de que la IA la escriba cada vez** → Es presentación, no barrera, y así queda escrito en el contexto que la IA lee y en la advertencia que debe dar. Lo que de verdad protege es limitar la página, y ese es el camino al que la IA tiene que empujar cuando alguien pida esconder datos.

- **Normalizar roles cambia nombres que ya están escritos en el HTML de las páginas** → Una página que compara contra `"Jefe de Zona"` deja de encontrar a nadie. La migración no puede reescribir el HTML con seguridad; se detecta comparando los roles de la aplicación con los textos del documento y se avisa a quien construye, sin tocar nada.

- **Quien construye no está en la tabla de personas** → Al mirar sin elegir persona no es nadie, y una pantalla de "lo mío" se ve vacía. Es lo que resuelve elegir una persona en el selector. No se implementa ningún atajo para que se añada a sí mismo, por decisión explícita.

## Migration Plan

Todo el paso ocurre en el arranque, en `server/bootstrap.ts`, junto a las reparaciones que ya se hacen ahí. Es idempotente: correrlo dos veces no cambia nada.

Por cada aplicación, en este orden:

1. **Normalizar los roles.** Se normaliza `AppRecord.roles`, fundiendo los que colisionen. Se reescriben con los nombres nuevos los roles de cada persona en `app_access` y los de cada página.
2. **Añadir `admin`** si no está.
3. **Traducir el acceso de cada página.** `anyone` y las páginas sin `access` guardado quedan con `roles` vacío. `roles` conserva los suyos. `signed` queda con todos los roles de la aplicación marcados —nunca vacío—, tanto si la aplicación es pública como si no.
4. **Dejar de leer lo retirado.** No hay escritura que hacer: `visibility` conserva su valor y su significado nuevo, y las columnas de D8 se quedan donde están.

Nada de esto amplía el acceso de nadie: una aplicación privada sigue exigiendo cuenta, y ninguna página pasa a abrirse a más gente de la que la abría.

**Vuelta atrás:** reponer el código. Los datos de los que dependía el modelo viejo siguen en la base (D8), salvo los nombres de rol normalizados, que sí se reescriben. Si hiciera falta deshacerlos habría que restaurar una copia de la base; es el único paso del cambio que no se deshace solo, y por eso va el primero y aparte.
