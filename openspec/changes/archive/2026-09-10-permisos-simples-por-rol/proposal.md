## Why

El sistema de permisos actual decide, por rol y por tabla, qué filas alcanza cada quien y qué puede hacer con ellas: alcances (`todas` / `las mías` / `ninguna`), una escalera de cinco peldaños, una columna de dueño por tabla y un nivel por persona aparte de sus roles. Es correcto y es caro de entender: quien construye estas aplicaciones es cualquier persona de una empresa, sin conocimientos técnicos, y cada uno de esos conceptos es una decisión que tiene que tomar antes de que su pantalla funcione.

Esta plataforma no es el destino final de una aplicación, es la escalera de entrada: alguien construye algo que funciona, se ve si tiene valor y, si lo tiene, la empresa decide construirla en serio con permisos de verdad. Bajo ese encuadre, el reparto fino de filas no paga lo que cuesta. Este cambio lo retira y deja una sola frontera real —si la aplicación pide cuenta o no— con los roles convertidos en lo que de verdad se usa: decidir qué se le muestra a quién.

## What Changes

**El reparto de filas desaparece**

- **BREAKING** Se elimina el modelo de alcances por rol y tabla: `Scope` (`todas` / `mías` / `ninguna`), la escalera `Rung` de cinco peldaños y las entradas `AccessEntry` de cada tabla. El servidor deja de filtrar filas por quien pregunta.
- **BREAKING** Se elimina la columna de dueño de fila (`TableRecord.ownerField`) y todo lo que la sostiene.
- **BREAKING** Se elimina el nivel por persona (`viewer` / `editor` / `admin`). La tabla de personas pasa de tres columnas de sistema a dos: correo y roles.
- Desaparece la pantalla "quién ve cada fila" y su entrada en el menú de la tabla.

**Quién abre una página se decide en dos sitios, sin repetición**

- **BREAKING** La aplicación decide una sola cosa: es pública, o requiere iniciar sesión.
- **BREAKING** Cada página decide otra: qué roles pueden abrirla, como una lista de marcas. `Todos` viene marcado por defecto y es excluyente; marcar roles concretos lo desmarca, y se pueden marcar varios. Sustituye a los tres niveles de acceso de página (`anyone` / `signed` / `roles`).
- Marcar roles concretos exige cuenta y uno de esos roles, aunque la aplicación sea pública.
- Al migrar, las aplicaciones privadas de hoy quedan pidiendo cuenta, las públicas quedan públicas, y todas las páginas nacen con `Todos` marcado: nadie queda expuesto ni pierde acceso.

**Los roles pasan a ser presentación**

- Restringir partes de una interfaz por rol se hace dentro del HTML de la página, comparando contra `plane.usuario.roles`. Lo escribe la IA cuando se le pide y lo verifica mirando quien construye.
- **BREAKING** El nombre de un rol se normaliza: minúsculas, sin espacios, con guiones. Se normaliza mientras se escribe, para que quien lo escribe vea cómo va a quedar.
- Toda aplicación nace con el rol `admin`, que es el de quien la construye.

**Guardar exige cuenta**

- Solo quien tiene sesión iniciada puede escribir en la base de datos. Sin sesión, el intento de guardar produce un aviso pidiendo iniciar sesión; lo emite la plataforma, no cada página.
- La IA lo advierte al implementar una página que guarda datos y al cambiar quién puede abrirla.

**Vista previa**

- El selector "ver como" pierde la opción "yo, que la construyo" y arranca en `admin`.
- Gana la opción de elegir, además del rol, una persona concreta de las que lo tienen, para probar páginas que muestran "lo mío".
- Quien construye no aparece en la tabla de personas. Si quiere estar en ella, crea el usuario a mano; no se implementa nada para facilitarlo ni se indica en ninguna parte.

**Fuera de alcance, a propósito**

- No se reconstruye la seguridad por otro camino. Con una página abierta a `Todos`, los datos de las tablas que declara viajan al navegador de cualquiera que tenga el enlace. Es una consecuencia aceptada del encuadre de arriba, no un descuido.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `access-control`: se retiran los requisitos de alcance por rol, lectura y escritura por separado, escalera de acciones, unión de roles, comprobación automática de aislamiento, el resumen en español y el valor por defecto de una tabla nueva. Queda un modelo mínimo: qué resuelve el servidor, que guardar exige cuenta iniciada --con su aviso en pantalla-- y cómo se mira la página como otro rol o como otra persona.
- `html-pages`: el nivel de acceso de una página deja de ser uno de tres (`cualquiera` / `con sesión` / `ciertos roles`) y pasa a ser una lista de roles con `Todos` por defecto, sobre la decisión de la aplicación de pedir cuenta o no. Una página nueva nace abierta a `Todos`.
- `builder/pages`: el modal de opciones de una página cambia lo de "quién la ve" por la lista de marcas de roles.
- `builder/people`: las columnas del sistema pasan de tres a dos —desaparece el nivel—, y se fija que toda aplicación nace con el rol `admin` y que quien construye no es una fila de esta tabla.
- `page-context`: lo que se le cuenta a la IA sobre permisos cambia de raíz. Se retira "lo que llega depende de quién mira" y el resumen de alcance por tabla; entra que los roles son para ajustar la pantalla, que guardar exige cuenta, y que debe advertirlo al construir.
- `app-navigation`: qué páginas aparecen en el sidebar se decide con el modelo nuevo.

## Impact

- `shared/access.ts`: se elimina casi entero (alcances, peldaños, validación, resumen en español).
- `server/access.ts`: sobrevive `resolveViewer` y la resolución de personas; se retiran `effectiveAccess`, `withScope`, `rowInScope`, `allows` y `asRole` en su forma actual.
- `server/pageData.ts`: se conserva el esqueleto —manifiesto de fuentes, resolución de relaciones y columnas de persona, las cinco órdenes— y se le retira el filtrado por alcance. Es el punto donde entra la comprobación de sesión al escribir.
- `shared/types.ts`: fuera `PageAccess` y `ownerField`; cambia la forma de `PageRecord.roles` y de `AppRecord.visibility`.
- `shared/people.ts`: fuera `LEVELS` y la columna de sistema `nivel`; normalización del nombre de un rol.
- `shared/pages.ts`: `canOpenPage` y `pageDenial` se reescriben contra el modelo nuevo.
- `shared/htmlContract.ts`: se retiran `reachSection` y `tableReach`; se reescribe lo que el contrato dice de roles y de guardar.
- `server/schema.ts`, `server/bootstrap.ts`, `server/peopleTable.ts`, `shared/relations.ts`, `server/dataImpact.ts`: dejan de tratar la columna de dueño y el nivel.
- `server/routes.ts`: normalización de roles, `pruneRoles` sin entradas de tabla, migración de aplicaciones existentes.
- `server/aiPage.ts`: `cambiar_acceso` pierde el nivel; entra la herramienta para cambiar los roles de una página.
- Panel: se elimina `AccessModal.svelte`; cambian `PageAccessPicker.svelte`, `RolesModal.svelte`, `RolePicker.svelte`, `DataGrid.svelte` y `PageStage.svelte`.
- Pruebas: `scripts/smoke-permisos.ts` se reemplaza por uno que comprueba el modelo nuevo.
- Documentación: `AGENTS.md` describe hoy el modelo viejo y hay que reescribir sus secciones de acceso y roles.
