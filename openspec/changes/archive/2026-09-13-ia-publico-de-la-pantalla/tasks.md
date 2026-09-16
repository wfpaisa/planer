## 1. El hecho: quién escribe y a qué rol equivale

- [x] 1.1 En `viewerSection()` (`shared/htmlContract.ts`), decir que quien escribe la petición es el dueño de la aplicación y que dentro de ella su rol es `admin`. Usar `ADMIN_ROLE` de `shared/people.ts`, no la cadena escrita a mano.
- [x] 1.2 Decir en ese mismo texto que `admin` existe en toda aplicación desde que nace y no se puede quitar, para que la equivalencia valga sin depender de que la aplicación haya nombrado roles.
- [x] 1.3 Añadir la frase que separa la convención de la autorización: el poder de quien construye viene de ser dueño de la aplicación, no del nombre del rol. Sin ella, dar el rol `admin` a alguien parece abrirle el panel.
- [x] 1.4 Comprobar que el texto sale igual en las dos salidas: `buildHtmlContract` y `buildHtmlDocs` llaman a la misma `viewerSection()`, así que no hace falta tocar `buildHtmlDocs`.

## 2. La regla de lectura, solo para el modelo

- [x] 2.1 Escribir una sección nueva en `shared/htmlContract.ts` con la regla de deducir el público: "yo/quiero/mi" significa `admin` solo cuando la petición nombra también a otras personas; sin nadie más en la frase, no se asume público ninguno.
- [x] 2.2 Añadir a esa sección la lectura de nombres de grupos: genérico ("usuarios", "personas", "todos") son todos los invitados sin filtrar; coincidencia con un rol --tolerando plural y tildes-- es ese rol; sin coincidencia se construye para todos y se dice, sin preguntar.
- [x] 2.3 Acotar la coincidencia a palabras que nombran personas. Sin ese límite, una aplicación con un rol llamado `manual` leería "quién leyó el manual" como un rol.
- [x] 2.4 Añadir a esa sección la obligación de nombrar en el resumen del turno el público que se asumió.
- [x] 2.5 Meter la sección en `buildHtmlContract` detrás de un interruptor de opciones, siguiendo el patrón de `opts.blocks` / `blocksSection()`, y dejarla fuera de `buildHtmlDocs`.
- [x] 2.6 Pasarle el interruptor desde `systemPrompt` (`server/aiPage.ts`). Decidir y dejar escrito si `server/pageConvert.ts` --que convierte páginas de bloques a HTML-- también lo necesita; si no, no pasarlo.

## 3. El filtro por rol se resuelve antes de pintar

- [x] 3.1 En `rolesSection()` (`shared/htmlContract.ts`), decir que la visibilidad por rol se decide antes de dibujar el contenido, y no escribiendo una sección oculta que se muestra al terminar.
- [x] 3.2 Decir el motivo en una frase: un error a mitad de dibujo deja la sección oculta sin aviso, y la pantalla se ve vacía en vez de rota. Va en las dos salidas: el constructor también escribe HTML a mano.

## 4. Comprobación

- [x] 4.1 En `scripts/smoke-ia-conversacion.ts`, añadir la comprobación mecánica: llamar a `buildHtmlContract` con roles y sin roles y confirmar que la sección de la regla de lectura solo aparece cuando corresponde, y que `buildHtmlDocs` no la lleva nunca. Es una función pura, así que corre antes de necesitar servidor.
- [x] 4.2 Caso de juicio: una petición con contraposición ("quiero ver el listado de todos los usuarios y cuáles leyeron el manual") reserva la pantalla al rol `admin`.
- [x] 4.3 Caso de juicio: una petición sin contraposición ("quiero ver quién leyó el manual") no reserva la pantalla a `admin`.
- [x] 4.4 Caso de juicio: una petición con un nombre de grupo que no coincide con ningún rol construye para todos, lo dice, y no abre una pregunta.
- [x] 4.5 Renumerar las secciones del script: "Recoger" es hoy la 10 y las nuevas van antes.

## 5. Verificación

- [x] 5.1 `bun run typecheck`.
- [x] 5.2 `bun run harness`. La sección nueva no toca estilos, pero `viewerSection` y `rolesSection` entran en el texto que ese banco compara contra el catálogo.
- [x] 5.3 `bun run docs` y revisar el README: el hecho del rol tiene que estar y la regla de lectura no.
- [x] 5.4 `bun run smoke:ia` con el servidor arriba. Los fallos de mecánica tumban la batería; las dudas de juicio son señal para afinar el texto.
- [x] 5.5 Probar a mano el caso que originó el cambio: pedir en el panel "quiero ver el listado de todos los usuarios y cuáles han leído el manual" y confirmar que la pantalla que sale se ve con el selector en `admin`.

Nota sobre 5.4 y 5.5: la batería entera corrió con la mecánica en verde y una
duda de juicio, la del caso que originó el cambio. La duda era de la prueba: la
IA reservaba la pantalla limitando la página al rol `admin`, y la comprobación
solo reconocía el filtro escrito dentro del HTML. Se amplió a las dos formas y
se afinó el texto de `audienceSection` para que diga qué hacer con el público
que se deduce. La sección 11 se repitió aislada --tres peticiones, no la batería
entera-- y quedó en verde. El caso de 5.5 es esa misma petición, hecha contra el
mismo endpoint del panel; no hubo clics.
