## Why

El HTML de una pagina es lo unico que importa mirar, pero hoy nunca se ve entero: una barra superior le quita el alto y un sidebar fijo le quita el ancho, y cada dialogo que se abre lo tapa con una capa gris. Ademas, casi todo lo que hay en la barra superior ya existe en otro sitio, asi que quien construye tiene dos caminos para lo mismo.

Este cambio pone el documento a pantalla completa y deja una sola superficie de mando: la barra Todo En Uno.

## What Changes

**El HTML a pantalla completa**

- El documento de la pagina SHALL ocupar el alto y el ancho completos de la ventana, en la pantalla de quien construye y en la del publico.
- **BREAKING** Se retira de los ajustes de la aplicacion la eleccion "fijo o flotante". Anclar o dejar flotando pasa a ser una preferencia de cada persona, elegida desde el propio sidebar y recordada por aplicacion en su navegador.
- El sidebar empieza plegado y se despliega encima del documento. Elegir una pagina lo vuelve a plegar.

**Se retira la barra superior del panel**

- **BREAKING** Desaparece la barra superior de la administracion.
- Sus entradas se reparten: publicar, nombre e icono de la aplicacion, y base de datos pasan a la barra Todo En Uno; volver al panel de aplicaciones y el modo claro/oscuro ya viven en el sidebar.

**La barra se transforma en lugar de abrir modales**

- **BREAKING** La barra Todo En Uno deja de abrir dialogos superpuestos. Al elegir una entrada, la barra crece en su sitio y muestra ese contenido dentro de si misma.
- La barra absorbe todo lo que hoy vive fuera de ella: compartir, ajustes de la aplicacion, ajustes de la pagina, publicar, la conversacion con la IA, el codigo HTML, los cambios de la pagina, traer un HTML de fuera y el aviso de impacto en los datos.
- Solo se conserva como pregunta aparte la confirmacion de borrado, porque interrumpe a proposito.
- Escape y un clic fuera devuelven la barra a su tamano minimo. No hay fondo oscuro: el documento sigue visible.

**La conversacion no se pierde y se ve trabajar**

- Lo escrito y lo conversado SHALL sobrevivir a cerrar la barra. Hoy se borra todo al cerrar, y eso obliga a reescribir la peticion.
- Mientras la IA trabaja, quien construye SHALL poder desplegar lo que va escribiendo y los pasos que va dando, en vez de mirar una espera muda.
- El servidor SHALL entregar la respuesta de la IA a medida que se produce, en vez de esperar a tenerla entera.

## Capabilities

### New Capabilities

- `builder-topbar-retirement`: La retirada de la barra superior del panel y el reparto de sus entradas entre la barra Todo En Uno y el sidebar.

### Modified Capabilities

- `builder-omnibar`: La barra pasa de abrir dialogos a transformarse en su sitio, y absorbe publicar, la IA, el codigo, los cambios, traer HTML y el impacto en los datos.
- `ai-authoring`: La conversacion sobrevive a cerrar la barra, y lo que la IA va escribiendo y los pasos que va dando se pueden desplegar mientras trabaja.
- `app-navigation`: El sidebar empieza plegado y, cuando flota, se pliega al elegir pagina. El comportamiento fijo o flotante deja de ser un ajuste de la aplicacion y pasa a ser una preferencia de cada persona.
- `html-pages`: La pagina se dibuja a pantalla completa en vertical y en horizontal, para quien construye y para el publico.

## Impact

- Panel de construccion: se retira la barra superior y su navegacion por secciones; la base de datos pasa a abrirse desde la barra.
- Servidor: la peticion a la IA pasa de devolver un solo resultado al final a entregarlo por partes mientras se produce.
- Conversacion con la IA: deja de vaciarse al cerrar.
- Barra Todo En Uno: cambia de contenedor de dialogos a superficie que se expande y contrae.
- Sidebar: el modo fijo o flotante sale de los ajustes de la aplicacion y pasa al propio sidebar, como preferencia de cada persona.
- Vista publicada: el documento gana el espacio que ocupaba el sidebar.
- Ajustes de la aplicacion: se retira la eleccion de comportamiento del sidebar; se conserva la de lado.
- Las aplicaciones guardadas con un modo fijo o flotante en sus ajustes dejan de usarlo: cada persona elige el suyo desde el sidebar, y empieza anclado.
