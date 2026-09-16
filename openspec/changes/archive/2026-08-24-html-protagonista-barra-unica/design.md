## Context

Hoy el panel dibuja tres capas apiladas: una barra superior fija, un sidebar que empuja el contenido y, dentro de lo que sobra, el marco aislado con el HTML. La barra Todo En Uno flota sobre ese resto y abre dialogos superpuestos con fondo oscuro.

La vista publicada repite las dos ultimas capas sin la barra superior.

Ver `proposal.md` para el porque y `specs/` para los requisitos.

## Goals / Non-Goals

**Goals:**

- Una sola caja a pantalla completa con el marco aislado dentro, igual en el panel y en el enlace publico.
- Una unica superficie de mando que crece y se encoge en su sitio, sin capas superpuestas con fondo.
- Ninguna accion perdida y ninguna duplicada.

**Non-Goals:**

- Cambiar como se guarda o se sirve el HTML de una pagina.
- Cambiar el puente de datos, los permisos o los roles.
- Rediseñar la base de datos por dentro. Solo cambia por donde se llega a ella.
- Adaptar la barra a pantallas de telefono. Se hace despues.

## Decisions

### La escena es una sola caja a pantalla completa

El panel deja de apilar barra superior y contenido. Queda una sola caja que ocupa la ventana, con el marco aislado dentro y todo lo demas superpuesto sobre el.

La vista publicada usa la misma caja. Asi las dos pantallas comparten la unica regla que importa: el documento manda, lo de Planer se pone encima.

*Alternativa descartada:* dejar la barra superior con solo publicar. Manteniendo la barra se pierde el alto, que es justo lo que hay que recuperar, por un unico boton.

### El sidebar deja de ser un ajuste de la aplicacion

Anclado o flotante deja de decidirse en los ajustes de la aplicacion, para todos, y pasa a decidirlo cada persona desde el propio sidebar, recordado por aplicacion en su navegador. Anclado sigue ocupando su espacio junto al documento; flotante se dibuja encima sin quitarselo. Empieza plegado y, cuando flota, se pliega solo al elegir pagina.

Las aplicaciones guardadas con un modo en sus ajustes no necesitan migracion de datos: ese campo deja de leerse. Solo se conserva la eleccion de lado.

*Alternativa descartada:* eliminar el modo anclado del todo y superponer siempre. El documento a pantalla completa es el modo de mirar, pero mientras se construye una aplicacion de varias paginas la lista a la vista vale mas que el ancho que cuesta. Quien quiera el documento entero, suelta el sidebar.

### La barra es una sola superficie con estados, no un contenedor de dialogos

La barra pasa de "barra + N dialogos" a "una superficie con un estado abierto". El estado decide que se dibuja dentro y hasta que tamano crece.

Los estados y su tamano:

| Estado | Que muestra | Tamano |
|---|---|---|
| minimo | campo, IA, publicar, compartir, ajustes app, ajustes pagina | barra |
| compartir | los dos enlaces | mediano |
| ajustes de la app | nombre, icono, paleta, datos, personas, importar | mediano |
| ajustes de la pagina | nombre, icono, acceso, codigo, cambios, traer HTML, borrar | mediano |
| publicar | estado y decision de publicar | pequeno |
| ia | conversacion, respuesta y lo propuesto | alto |
| impacto | el aviso y la decision, encadenado a `ia` | alto |
| codigo | el editor del HTML | casi toda la ventana |
| cambios | las versiones de la pagina | alto |
| traer html | la revision del HTML de fuera | alto |

Cambiar de estado sustituye el contenido y ajusta el tamano en el mismo movimiento. No se cierra y se vuelve a abrir.

*Alternativa descartada:* que cada entrada siga siendo su propio dialogo, solo que sin fondo oscuro. Se seguirian viendo varias cajas encima del documento y no habria un unico camino de vuelta.

### El tamano se anima, el contenido se sustituye

El crecer y el encoger es un cambio de alto, ancho y posicion sobre la misma caja, con la misma duracion que ya usa el viaje de la barra. El contenido de dentro se cambia sin animar: animar dos cosas a la vez hace que se lea como dos cajas distintas.

Cuando la barra crece mucho (codigo, IA), crece hacia arriba desde su borde inferior, para que el borde de abajo no se mueva y se entienda que sigue anclada.

### El campo de texto no se pierde

Lo que este escrito en el campo sobrevive a cualquier estado y vuelve al encoger. El campo es el punto de entrada principal y perder lo escrito por abrir unos ajustes seria el peor fallo posible de este cambio.

### La base de datos deja de ser una seccion hermana

Hoy la base de datos es una ruta hermana del editor, alcanzada desde la barra superior. Al retirar esa barra pasa a ser una capa encima de la pagina abierta, que cierra devolviendo a la misma pagina.

Se sirve igual que ya se sirven ajustes y vista previa: la direccion cambia, el fondo se queda.

### La conversacion vive fuera de la barra, no dentro

Hoy la conversacion se vacia cada vez que se abre el dialogo. Con la barra transformandose eso seria peor: cerrar y abrir pasa a ser algo que se hace todo el rato.

La conversacion en curso pasa a guardarse por aplicacion y pagina, fuera de la superficie que la dibuja. La barra solo la muestra. Cerrar la barra no la toca.

*Alternativa descartada:* guardarla en el navegador. La conversacion ya vive en el servidor por aplicacion; duplicarla en el navegador crearia dos verdades que se separan.

### La respuesta de la IA se entrega por partes

El servidor deja de responder una sola vez al final y pasa a entregar la respuesta a medida que se produce: el texto de cada vuelta segun se escribe y cada paso segun se da. El resultado de verdad --mensaje, pasos, avisos e impacto-- sigue viajando una sola vez, al final, y es el mismo de antes.

Entregar por partes es para mirar, no para decidir. Cuando la pagina y las tablas se tocan no cambia: se sigue tocando durante la peticion, como hasta ahora, y antes del primer cambio se sigue guardando el punto al que volver, con el nombre de la peticion.

Irse a mitad no cancela nada. La peticion sigue sola hasta terminar y el servidor deja de escribir al navegador que ya no esta. Cortarla en seco seria peor: dejaria justo la pagina a medias que se quiere evitar.

*Alternativa descartada:* entregar letra a letra en vez de vuelta a vuelta. Obliga a rearmar las llamadas a herramientas trozo a trozo, distinto en cada proveedor, y lo que se gana es que un parrafo aparezca escribiendose en vez de entero.

*Alternativa descartada:* dejar el servidor como esta y solo animar una espera. Es mentir sobre el avance, y en peticiones largas no dice nada util.

### El avance empieza cerrado

Lo que la IA va escribiendo es codigo HTML. Mostrarlo siempre llenaria la barra de ruido para la mayoria de peticiones. Se ofrece desplegar y se recuerda: quien quiere mirar, mira.

### El editor de codigo no cabe en una barra pequena, y no importa

El editor de HTML es el unico contenido que necesita casi toda la ventana. Se acepta: sigue naciendo de la barra, sigue siendo la misma caja creciendo, y sigue teniendo un solo camino de vuelta. Lo que se elimina no es el tamano, es la capa aparte con fondo oscuro.

## Risks / Trade-offs

- **La barra grande tapa el documento igual que un dialogo** → Se acepta para codigo e IA. En el resto de estados el tamano se limita para que el documento siga leyendose alrededor.
- **Sin fondo oscuro, un clic dentro del documento puede confundirse con un clic de cierre** → El clic fuera cierra la barra y no llega al documento. Se pierde un clic, no se ejecuta algo que no se queria.
- **La conversacion con la IA dentro de la barra da menos sitio que un dialogo** → El estado `ia` crece a alto grande y el documento se sigue viendo debajo, que es lo que se quiere mirar mientras la IA escribe.
- **Perder la barra superior quita el nombre de la aplicacion siempre a la vista** → El nombre queda en la cabecera del sidebar. Con el sidebar plegado no se ve; se acepta a cambio del alto.
- **El sidebar plegado por defecto puede desorientar en aplicaciones de varias paginas** → El estado plegado se recuerda por aplicacion, asi que solo pasa la primera vez.
- **El modo elegido en los ajustes de una aplicacion deja de valer para todos** → Cada persona lo elige desde el sidebar y se le recuerda. No se pierde ningun dato ni hay que rehacer ninguna pagina.
- **Entregar por partes puede dejar la peticion a medias si se corta la conexion** → Irse no la cancela: sigue sola hasta terminar. Y antes del primer cambio queda guardado el punto al que volver.
- **Conservar la conversacion puede hacer que alguien siga una charla vieja sin darse cuenta** → La conversacion se guarda por pagina y se indica cual esta abierta, con la lista de conversaciones a un paso.

## Migration Plan

1. Poner el documento a pantalla completa y el sidebar siempre superpuesto. A partir de aqui el HTML ya ocupa la ventana.
2. Convertir la barra en superficie con estados, empezando por los tres que ya tiene.
3. Absorber publicar, IA, impacto, codigo, cambios y traer HTML.
4. Retirar la barra superior y mover la base de datos a capa.
5. Retirar el ajuste de comportamiento del sidebar.

Los pasos 1 y 2 son independientes y se pueden ver funcionando por separado. El paso 4 solo es seguro cuando el 3 esta completo: antes, retirar la barra superior dejaria publicar sin sitio.

**Vuelta atras:** cada paso es de dibujo y no toca datos guardados. Deshacer un paso devuelve el aspecto anterior sin migracion.
