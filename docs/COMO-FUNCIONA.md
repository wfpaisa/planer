# Cómo funciona Planer por dentro

Los mecanismos centrales de la plataforma: los trucos que explican por qué el producto se comporta como se comporta, no la lista de qué hace. Para eso último está [docs/FUNCIONALIDADES.md](./FUNCIONALIDADES.md).

> Para lo demás: el [README principal](../README.md) cuenta qué es Planer y cómo se instala, [PRODUCT.md](../PRODUCT.md) el propósito y los principios, [docs/CHAT.md](./CHAT.md) el ciclo completo de una petición a la IA, y [docs/PAGINAS-HTML.md](./PAGINAS-HTML.md) el contrato que recibe quien escribe HTML (persona o IA).

## Las tablas de una app son colecciones reales de PocketBase

Una tabla que crea un constructor no es una fila genérica en una tabla común de "datos": es una colección real de PocketBase, con sus propios índices y su propia regla de acceso. Dos piezas por tabla:

- Un registro de metadatos en la colección interna `tables`: nombre, ícono, `fields` (el arreglo de `FieldDef` que define las columnas) y `meta` (orden y ancho de columnas, ocultas, colores de opciones).
- La colección de datos misma, llamada `d_{appSlug}_{tabla}` (`dataCollectionName()` en `server/schema.ts`).

Las colecciones internas de la plataforma (`builders`, `members`, `apps`, `tables`, `pages`, `app_access`, `settings`) están fijas en `INTERNAL` (`server/config.ts`) y nunca se nombran a mano. No hay sistema de migraciones: `server/bootstrap.ts` crea cada colección interna la primera vez y, si ya existe, solo le agrega los campos que falten.

**Renombrar una columna no pierde datos** porque cada campo carga el `id` que le asignó PocketBase la primera vez. Al actualizar los campos de una tabla se manda la lista completa con esos ids puestos, y PocketBase renombra la columna en su sitio en vez de borrarla y crear una nueva.

## Los permisos se deciden en el servidor, no en la base de datos

La regla de acceso que PocketBase guarda sobre cada colección `d_*` dice una sola cosa: solo quien es dueño de la app (el constructor) entra directo (`accessRules()` en `server/schema.ts`). No sabe nada de si la app es pública, de roles ni de columnas — esa decisión ya no vive en la base de datos.

Quién llega a qué lo decide `server/page/pageData.ts`, el único camino por el que pasa cualquier comando de datos de una página publicada. Revisa, en orden: si la app es pública o exige sesión, si quien pregunta puede abrir la página desde la que pregunta, si el comando escribe (escribir siempre exige sesión) y si la tabla está declarada en esa página. No filtra filas: quien puede abrir una página llega a **todas** las filas de las tablas que esa página declara.

**Contar no es lo mismo que listar.** `plane.listar` entrega como máximo `MAX_LIST_ROWS` filas por llamada (200) y lo dice en la respuesta (`recortado`); `plane.contar` cuenta del lado del servidor sin traer filas. Antes de este límite, una página que contaba `filas.length` contaba el tamaño de la página, no el total: una tabla de 410 filas mostraba 200 sin que nadie lo notara.

Una columna de tipo persona puede marcar al dueño de cada fila: la página filtra "lo mío" pidiéndolo al servidor (`plane.listar` con un filtro), nunca trayendo todo y descartando en el navegador. Los roles (`PageRecord.roles`) deciden qué páginas se ven — vacío es todos, `admin` solo es quien construye — y se aplican del lado del servidor en `publicBundle`: una página que el visitante no puede ver nunca llega al navegador.

## Dos sesiones independientes: quien construye y quien usa la app publicada

El navegador habla con PocketBase por dos vías separadas que nunca se cruzan:

- `builders` — quien construye. El cliente `pb` hace CRUD directo sobre las colecciones internas (`pb.collection("apps").getFullList()`, etc.), con su propia llave de sesión.
- `members` — quien usa una app publicada. Un segundo cliente, `pbApp`, con su propia llave, habla directo contra las colecciones `d_*` de datos, protegido por las reglas de acceso.

La API propia (`/api/*`) solo existe para lo que el navegador no puede hacer directo contra PocketBase: crear o cambiar la estructura de una app o tabla, miembros, configuración de IA, generación de páginas. Los datos de una tabla — leer, crear, editar, borrar filas — nunca pasan por `/api`: van directo a PocketBase.

## Cada publicación guarda una versión, y se puede volver a una anterior

Cada vez que se publica una app queda guardada la versión que estaba en producción; también se puede guardar una versión manual en cualquier momento, por ejemplo antes de un cambio grande. El listado de versiones dice qué cambió en cada una y permite restaurarla para dejarla activa de nuevo — restaurar una versión es, otra vez, publicar, así que también deja su propio punto de vuelta atrás.

## El mecanismo de creación y modificación de páginas (`server/html/htmlBlocks.ts`)

- Cada bloque se identifica por un atributo `data-plane="nombre"` en su elemento raíz. La primera vez que la IA toca un elemento, el servidor le estampa ese nombre (el que propuso la IA, o si no lo dio, uno derivado del título/id/clase/etiqueta del propio trozo). Una vez nombrado, esa identidad queda fija.
- Para editar, la IA llama `reemplazar_bloque` mandando **solo el HTML del trozo nuevo**, no la página entera. El servidor usa `HTMLRewriter` (el parser en streaming de Bun) para localizar el único elemento que matchea `[data-plane="nombre"]`, reemplazarlo por el nuevo fragmento, y dejar **todo lo demás byte a byte igual** — el propio código lo dice explícito: un documento que pasa por esta transformación sin coincidencias sale idéntico, doctype, comentarios, scripts y todo.
- `insertar_bloque` y `quitar_bloque` funcionan igual: agregan antes/después de un bloque existente, o lo eliminan con todo su contenido, sin tocar el resto.
- Si la IA devuelve el fragmento sin su `data-plane` (lo olvidó), el servidor se lo repone él mismo sobre el primer elemento del trozo — así el bloque no "nace de nuevo" y pierde su identidad aunque la IA no haya sido prolija.

### Cuándo se reescribe la página completa en vez de un bloque

`escribir_pagina` reemplaza el documento completo, y el propio mensaje de sistema que recibe la IA (`TOOL_GUIDE`, en `server/ai/aiPage/prompts.ts`, escrito en inglés porque así se le dan todas las instrucciones al modelo) le dice cuándo usar cada herramienta:

> A local change --a title, a table, a card-- is made with "reemplazar_bloque"/"insertar_bloque"/"quitar_bloque". **Redoing the screen** --a different structure, a different layout-- is made with "escribir_pagina", which replaces the whole document. When you use it, say so at the end and say why.

En español: un cambio local se hace con las herramientas de bloque; solo cuando cambia la estructura o el layout completo se usa `escribir_pagina`, y la IA tiene que decir al final por qué lo hizo. La reescritura completa es la excepción explícita para cambios estructurales, no el camino por defecto.

### El catálogo de estilos que la IA no debe reinventar

Las instrucciones que recibe la IA (`shared/htmlContract.ts`) le hablan de "the catalogue": no son componentes por-app ni algo que la IA generó en un turno anterior, sino **una sola hoja de estilos real y fija de toda la plataforma** — `/plane/estilos.css`, la misma con la que se dibuja el propio panel de Planer (`server/page/pageStyles.ts`). Botones, cards, tablas, tags, campos de formulario, KPIs, tabs, timeline, modales, etc. — todos ya existen como clases CSS reales, compartidas por todas las apps.

### Cómo la IA recibe el catálogo de componentes UI

En `shared/htmlContract.ts`, la función `catalogSection()` describe ese catálogo de componentes en **prosa en inglés con snippets de HTML de ejemplo** — no una lista de nombres, sino código real mostrando cómo se usa cada pieza (`<button class="btn btn-primary">`, `<div class="card">…`, etc.), más las reglas de uso: el modificador va después de la clase base, una clase propia va primero y describe, y nunca se redefine una clase del catálogo.

`buildHtmlContract()` junta esa descripción del catálogo con otras secciones igual de fijas — colores, medidas, reglas de "craft" (jerarquía, aire, menos cajas, iconos), gráficas, datos, quién mira la pantalla, límites, nombres de bloque — y todo ese bloque de instrucciones (`contract`) se manda **entero, en cada petición a la IA**, sin importar si el pedido es reescribir la página completa o cambiar el texto de un botón. No hay selección de "solo lo relevante a este pedido": es el mismo contrato de punta a punta siempre.

#### Cómo el servidor comprueba que la IA respetó el contrato

En `server/html/htmlAudit.ts`, las listas `KNOWN_VARS` y `KNOWN_CLASSES` —las variables y clases CSS que existen de verdad en la plataforma— **no están escritas a mano**: se extraen con una expresión regular directamente de `PAGE_STYLES`, la hoja de CSS real que se sirve:

```
export const KNOWN_VARS = new Set(
  [...PAGE_STYLES.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1].toLowerCase()),
);
```

Así esa lista "de lo que existe" nunca se desincroniza de lo que realmente hay servido — si mañana se agrega una clase al CSS de la casa, el auditor la reconoce automáticamente, sin tocar este archivo. Con esas dos listas, la herramienta `revisar_errores` (la que la IA llama para revisar el HTML que acaba de escribir) detecta: colores puestos a mano en vez de `var(--algo)`, variables inventadas que no existen en la hoja real, o piezas reinventadas cuando ya había una clase del catálogo para eso.

## La grilla se escribe por celdas, y lo pegado pasa por la misma conversión que una importación

La cuadrícula de una tabla dejó de ser solo de lectura. El clic sobre una celda la elige y el siguiente clic sobre esa misma celda la abre para escribir —el doble clic hace las dos cosas de una vez—, la fila completa se abre desde su columna fija de expandir, y el rango se marca con el ratón o con Mayúsculas más las flechas. Ese segundo clic se resuelve al soltar el botón y no al apretarlo: abrir el editor en cuanto se aprieta dejaría sin arrastre justo a la celda que tiene el cursor. El cursor y el rango se guardan **por sitio** (fila y columna de lo que se está viendo), nunca por id: la grilla se ordena, se filtra y se repagina, y una selección guardada por id acabaría señalando filas que ya no están donde estaban. Por eso se suelta al cambiar de orden, filtro o página, y sobrevive a una relectura de la misma página — la de justo después de pegar.

**Lo que se escribe desde una celda tiene frontera, y está escrita en un solo sitio** (`inlineEditable()`, en `web/src/lib/dataGridEdit.ts`): quedan fuera las columnas del sistema (`id`, `creado`, `actualizado`), los archivos, las relaciones múltiples, y el correo y los roles de la tabla de personas — esos tres últimos no están en la colección, viven en la cuenta y en el enlace con la aplicación, así que un PATCH a la fila no los tocaría. Todo eso sigue escribiéndose en el cajón lateral, que da sitio a cada columna con su etiqueta.

**El correo y los roles de una persona se escriben desde su celda, pero nunca en bloque.** Esas dos columnas no están en la colección de la tabla: viven en la cuenta y en el enlace con la aplicación, y se cambian por la API de miembros, que no tiene lote. De ahí que la frontera sean dos y no una: `inlineEditable()` dice qué se escribe desde una celda y `bulkEditable()` qué entra en un pegado o un vaciado. Pegar una columna de roles sobre doscientas personas serían doscientas peticiones encadenadas, así que se rechaza y se dice por qué.

**Pegar no guarda texto.** Lo que llega del portapapeles se trocea como cualquier hoja de cálculo (tabulador entre columnas) y cada celda pasa por `convertValue()` — la misma función que usan la importación manual y `llenar_tabla` del lado del servidor —, así que una columna de fecha recibe una fecha y una de número, un número. Las columnas de relación van más lejos: sus llaves se emparejan con `matchRelationColumns()` de una sola vez para toda el área pegada (cincuenta filas con la misma cédula son una consulta, no cincuenta) y cada celda queda enlazada al registro que le toca, o con su valor a la vista y sin enlace, que es un estado válido y no un error. La escritura sale por `writeBatches()`, en tramos de 200 y con el mismo reintento por límite de tasa que la importación.

Lo que no cabe se pregunta antes de escribir nada: pegar más filas de las que hay ofrece crearlas o quedarse con las que caben, y crear filas no se hace en silencio porque no tiene vuelta atrás. En la tabla de personas nunca se ofrece — una fila suya es una cuenta invitada, y eso lo hace el servidor. Lo que sobra por la derecha se queda fuera siempre: para traer columnas nuevas está la importación, que además adivina su tipo.

**El ancho de una columna se guarda en la tabla, no en el navegador.** Vive en `meta.widths` (`shared/types.ts`), junto al orden y a las columnas escondidas, así que quien abra esa tabla la ve como se dejó. Mientras dura el arrastre el ancho no se guarda: vive en la grilla y solo viaja al soltar el botón — guardar en cada píxel serían cien peticiones por un tirón de ratón, y cada una releería la tabla entera. Un doble clic sobre el tirador borra el ancho en vez de guardar un cero, que es como se pide que la columna vuelva a medirse sola.

Después de pegar o vaciar se vuelve a leer la tabla en vez de remendar la grilla a mano: una relación se guarda como el id del registro que encontró y una fecha como la normalizó la base, así que lo que hay que mostrar no es lo que se pegó.

## Los archivos que se adjuntan a la IA se guardan una sola vez, por su contenido

Un archivo soltado en el editor se sube al momento a la colección interna `ai_files`, con clave el sha256 de su contenido (`server/ai/aiFiles.ts`): subir el mismo contenido dos veces ocupa una sola fila. La petición que va al modelo carga solo la referencia, nunca el contenido, y un adjunto dura mientras alguna conversación guardada lo nombre.

**El modelo recibe una muestra, nunca el archivo entero.** `sampleAiFile()` decide qué viaja según el tipo: columnas más ~20 filas y el total para un CSV o una hoja, claves más los primeros elementos para una lista JSON, el archivo completo mientras quepa bajo 20 000 caracteres para texto o código, y una imagen viaja como base64. Toda muestra dice su tamaño, si está recortada y el nombre por el que se la nombra — así preguntar por un archivo dos turnos después no exige volver a adjuntarlo.
