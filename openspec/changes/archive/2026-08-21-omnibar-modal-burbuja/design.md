# Diseno: el viaje de la barra al modal

## Context

- La barra (Omnibar.tsx) vive dentro de `#page-stage-main` en un envoltorio `#omnibar` (`absolute left-1/2 z-30`), centrado si la pagina esta en blanco y anclado abajo si tiene contenido. Dentro, una tarjeta (la shell) cambia de alto y ancho con transiciones inline de 260 ms segun el panel abierto (mapa `SIZE`).
- El modal compartido del panel (ui.tsx) es `fixed inset-0 z-50` con un fondo `bg-black/35 backdrop-blur-[2px]`, y aparece al instante, sin animacion.
- Escalera de z de partida: barra 30, desplegables 40, modal 50, capas completas (base de datos, vista previa) 60.
- No hay ninguna animacion de este tipo en la app hoy; la unica transicion real es el crecer de la barra.
- La conversacion de la IA no vive en el componente (se guarda en `aiConversation`, por aplicacion y pagina), asi que montar y desmontar el contenido no la borra.

## Goals / Non-Goals

**Goals:**

- Que la apertura y el cierre de los paneles se sientan como un viaje continuo de la barra: al centro con fondo desenfocado, y de vuelta con un encogido tipo burbuja.
- Que el movimiento se vea natural: el borde recto mientras crece, el contenido
  recolocandose en vez de deformandose, y sin saltos secos.
- Que nada se rompa con "reducir animaciones" activo.

**Non-Goals:**

- Cambiar el contenido o el comportamiento de ningun panel (IA, publicar, compartir, ajustes, cambios, importar HTML, impacto).
- Tocar el panel de codigo HTML: sigue creciendo en su sitio.
- Rediseñar el modal compartido del panel: el viaje es propio de la barra.
- Tocar el servidor, la API ni los datos.

## Decisions

### 1. Animar la tarjeta de verdad, no una foto suya

La tarjeta de la barra vive siempre en el mismo sitio del arbol y en el mismo
envoltorio. Abrir un panel no la desmonta ni la cambia de padre: solo cambia sus
medidas y su sitio, y de eso se encargan transiciones CSS normales.

Alternativa descartada: la API de transiciones de vista del navegador
(`document.startViewTransition`). Se probo y no sirve para este viaje: no mueve
el elemento, hace una foto del estado viejo y la estira hasta el tamano del
nuevo. Como la barra es plana (46 px de alto) y el modal es alto (hasta 608 px),
el estirado se nota en todo:

- El redondeo de 12 px se convierte en una elipse enorme; el borde deja de verse
  recto a mitad del viaje.
- El contenido no se recoloca, se escala: los botones y el texto se deforman.
- Si ya hay una transicion en curso, o la ventana pierde el foco, el navegador
  la descarta y el cambio sale de golpe, sin viaje.

Animar el elemento no tiene ninguno de esos problemas, y ademas es interrumpible:
un cambio de idea a mitad de camino se recoge desde donde va en vez de saltar.

### 2. Un solo envoltorio, dos juegos de medidas

- La tarjeta esta siempre dentro de `#omnibar`, el envoltorio `absolute
  left-1/2` de `#page-stage-main`. Lo que cambia entre los dos estados es donde
  se ancla y cuanto mide:
  - Sin panel: anclada por su borde inferior (`top: calc(100% - 22px)`,
    `translate(-50%, -100%)`), 42 rem de ancho y el alto de sus botones.
  - Con un panel que viaja: centrada (`top: 50%`, `translate(-50%, -50%)`) y con
    el ancho y el alto del mapa `SIZE`, con topes de `calc(100vw - 3rem)` y
    `calc(100vh - 3rem)` para pantallas pequenas.
- El alto de la barra a secas se escribe en numero (`2.875rem`) y no en `auto`,
  porque `auto` no se puede animar.
- El contenido del panel se monta entero desde el primer momento y lo recorta un
  hueco con `overflow: hidden`. Asi la tarjeta lo va descubriendo mientras crece,
  como una persiana, y el pie del panel no se desborda encima de la fila de
  botones cuando la tarjeta todavia es baja.
- El fondo oscurecido es un plano aparte, `fixed inset-0`, que se funde de 0 a 1.
  No es un boton: cerrar ya lo hacen escape, la equis y el clic fuera. Lleva
  `bg-black/40` y unos 6 px de desenfoque, mas marcado que el del modal del panel.

Cambiar entre dos paneles que ya viajan (por ejemplo IA a impacto) no tiene nada
de especial: las medidas nuevas se animan igual que las primeras, y si son las
mismas no se mueve nada.

### 3. El codigo no viaja

El codigo se queda anclado abajo y crece en su sitio, sin fondo oscurecido,
porque ya ocupa casi toda la pantalla y el viaje no aportaria nada. Sale solo:
es el unico panel que no marca `isModal`, asi que su envoltorio no se recentra.

### 4. Duracion y curva en los estilos

- El viaje dura 320 ms y se ajusta desde `web/src/styles.css` con variables CSS
  propias, para afinar sin tocar el codigo.
- `--travel-curve` es la curva del movimiento: sale rapido y llega con un rebote
  pequeno, el gesto de una burbuja que se posa. La misma al abrir y al cerrar.
- `--travel-fade` es la curva de los fundidos (el fondo oscurecido), sin rebote:
  lo que aparece no rebota.
- Con "reducir animaciones" activo, una regla de `styles.css` apaga las
  transiciones de la barra, de su contenido y del fondo: el cambio es al
  instante y no hace falta preguntar nada desde el codigo.

### 5. Z de la barra y del fondo

La barra esta siempre a z-50 y el fondo oscurecido a z-40. La barra no puede
cambiar de z a medio viaje sin que se vea el salto, y sus desplegables viven
dentro de ella, asi que suben con ella. Las capas completas (base de datos,
vista previa) siguen a z-60, por encima de todo.

### 6. El campo de la barra no se transforma en el del chat

Con la IA abierta se escribe arriba, en la conversacion, y el campo de la barra
deja su hueco para que los botones no se muevan de sitio. La idea de que un
campo se convirtiera en el otro dependia de la transicion de vista, que es lo
que se descarto en la decision 1.

### 7. La portada de la conversacion vacia sale y se desvanece

La conversacion vacia muestra una portada (hero) en el centro. Al mandar la
primera peticion, pasa por `hero` → `leaving` → `gone`: la portada sube y se
desvanece (slide up + fade) mientras el primer mensaje entra desde abajo. Al
empezar una conversacion de cero, la portada vuelve a entrar.

### 8. Entrada escalonada de la conversacion

Cada mensaje, la pildora de "Generando" y la respuesta entran con la misma curva
del viaje (fade + slide up) y con retraso escalonado: quien pide a los 0 ms,
"Generando" a los 140 ms y la respuesta a los 100 ms. Asi se ve la secuencia que
describe quien construye: primero su burbuja, luego la pildora, y al final la
respuesta.

### 9. El codigo en generacion se despliega como acordeon

El cuerpo de "Generando" (los pasos y el codigo HTML que va escribiendo) se
pliega y despliega con `grid-template-rows` de 0fr a 1fr: la altura crece sola,
sin medir nada a mano.

## Risks / Trade-offs

- [El contenido del panel se monta entero aunque la tarjeta todavia sea baja] Durante el crecimiento el panel se recoloca en un hueco cada vez mas alto. Es trabajo de mas para el navegador, pero es lo mismo que ya hacia el codigo HTML al crecer en su sitio, y a cambio el contenido nunca se deforma.
- [La barra sube a z-50 de forma permanente] Sus desplegables viven dentro de ella y suben con ella; las capas completas siguen por encima a z-60. Lo que se pierde es la distincion entre "barra" y "modal" en la escalera de z, que ya no significa nada cuando son la misma pieza.
- [El rebote puede verse raro en viajes cortos (pagina en blanco, el modal abre casi en el sitio)] La curva usa un rebote pequeno y afinable desde CSS; en viajes cortos el movimiento casi no se nota.
- [El viaje dura 320 ms y durante esos instantes ya se puede interactuar] La interfaz responde de inmediato y la animacion es decorativa. Y como es una transicion CSS, un cambio a mitad de camino se recoge desde donde va.
