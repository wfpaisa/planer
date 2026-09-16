## Why

La unica herramienta que tiene hoy la IA para escribir es `escribir_pagina`, y su descripcion lo dice sin rodeos: "Reemplaza el documento entero: manda siempre un archivo completo". Cambiar el titulo de una seccion cuesta lo mismo que construir la pagina de cero: releerla entera, reescribirla entera y esperar.

Eso hace lenta cualquier peticion pequena, y hace fragil cualquier peticion sobre una pagina grande: lo que ya estaba bien se vuelve a generar, y puede volver distinto.

Este cambio le da a la IA un bisturi --editar un trozo sin tocar el resto-- y le da a quien construye una forma de señalar el trozo con el raton.

## What Changes

**Los bloques tienen nombre**

- Un elemento del HTML SHALL poder llevar un nombre estable en el atributo `data-plane`, legible y unico dentro del documento.
- El nombre lo SHALL proponer la IA con significado (`lista-clientes`, no `b7x2k9`) y el servidor SHALL garantizar que no se repita, anadiendo un sufijo cuando haga falta.
- Solo SHALL bautizarse lo que se toca: un elemento recibe su nombre cuando la IA lo edita por primera vez, no por adelantado. Un documento no se llena de atributos que nadie pidio.
- Devolver un bloque sin su `data-plane` SHALL rechazarse: sin el nombre, una edicion se convertiria en borrar y crear.

**La IA edita trozos**

- La IA SHALL poder leer un bloque por su nombre, reemplazarlo, insertar uno nuevo antes o despues de el, y quitarlo.
- `escribir_pagina` SHALL conservarse para cuando de verdad hay que rehacer el documento, y el contexto SHALL empujar a la IA a preferir el bisturi para un cambio localizado.
- Una edicion parcial SHALL guardarse como un cambio de la pagina igual que hoy, para que se pueda deshacer.

**Se puede señalar un elemento**

- Quien construye SHALL poder activar un cursor de seleccion y señalar un elemento del documento, como se inspecciona un elemento en un navegador.
- Solo SHALL poder señalarse elementos con entidad --secciones, articulos, tablas, formularios, listas, figuras, los mandos de un formulario y lo que ya lleve nombre--. Apuntar a otra cosa SHALL subir al candidato mas cercano hacia arriba.
- Lo senalado SHALL aparecer como un badge en la conversacion, con un nombre legible, y SHALL poder quitarse antes de enviar.
- SHALL poder señalarse mas de un elemento a la vez. Cada edicion SHALL apuntar a uno; unir varios en uno no entra en este cambio.
- Mientras el cursor esta activo, un clic SHALL seleccionar y SHALL NO llegar al documento: no navega, no envia formularios.

## Capabilities

### New Capabilities

- `html-bloques`: El nombre estable de un bloque dentro del HTML, quien lo pone, como se garantiza que sea unico y que se puede hacer con el.
- `page-picker`: El cursor que senala un elemento del documento y lo convierte en contexto para la IA.

### Modified Capabilities

- `ai-authoring`: La IA gana herramientas para leer y editar un trozo del HTML en vez de reescribirlo entero, y recibe lo senalado con el cursor como parte de la peticion.
- `page-context`: El contexto que recibe la IA explica los nombres de bloque y cuando conviene el bisturi frente a rehacer la pagina.

## Impact

- `server/aiPage.ts`: herramientas nuevas junto a `escribir_pagina`, que se conserva.
- `server/htmlBlocks.ts` (nuevo): localizar, leer, reemplazar, insertar y quitar un bloque, y estampar nombres unicos. Se apoya en `HTMLRewriter`, que Bun ya trae.
- `server/htmlBridge.ts`: modo cursor, que ilumina candidatos y devuelve lo senalado. Ya habla en las dos direcciones por `postMessage`; hay que silenciar en modo cursor la captura de clicks que hoy usa para navegar.
- `web/src/components/AiDock.tsx`: el boton del cursor y los badges de lo senalado.
- `shared/types.ts`: lo que viaja del puente al panel y del panel al servidor.
- `server/pageContext.ts` o donde se arme el contexto: la explicacion de los nombres de bloque.
- No se toca el modelo de datos ni PocketBase. Un `data-plane` vive dentro del HTML de la pagina, que ya se guarda entero.

## Non-goals

- Editar contenido en caliente sobre el documento: señalar da contexto a la IA, no permite escribir encima.
- Unir varios elementos senalados en uno solo. Requiere reemplazar un rango de hermanos, que `HTMLRewriter` no hace de una pasada.
- Que la IA pregunte con opciones ni que construya por bloques pidiendo autorizacion: es el paso siguiente y se apoya en este.
- Adjuntar archivos a la conversacion.
- Retirar la varita magica de importar HTML.
