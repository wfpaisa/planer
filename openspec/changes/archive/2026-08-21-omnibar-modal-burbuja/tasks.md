# Tareas: el viaje de la barra al modal

## 1. La barra y su modal

- [x] 1.1 En `Omnibar.tsx`, definir el conjunto de paneles que viajan: todos menos `code`.
- [x] 1.2 Dejar la tarjeta siempre en el mismo envoltorio (`#omnibar`), sin desmontarla al abrir: lo unico que cambia entre barra y modal es donde se ancla (`top` y `transform`) y cuanto mide (ancho y alto del mapa `SIZE`, con limites para pantallas pequenas).
- [x] 1.3 Escribir el alto de la barra a secas en numero (`2.875rem`) en vez de `auto`, para que el crecer y el encoger se puedan animar.
- [x] 1.4 Recortar el contenido del panel en un hueco con `overflow: hidden`, para que se descubra mientras la tarjeta crece y su pie no se desborde encima de la fila de botones.
- [x] 1.5 Sacar el fondo oscurecido a un plano `fixed inset-0 z-40` que se funde de 0 a 1, con la barra siempre a z-50 por encima.
- [x] 1.6 Actualizar el comentario de cabecera de `Omnibar.tsx`: los paneles viajan al centro con fondo desenfocado (el codigo sigue creciendo en su sitio), y el viaje lo hace la tarjeta de verdad, no una foto suya.

## 2. Los estilos del viaje

- [x] 2.1 En `web/src/styles.css`, dejar la duracion (unos 300 ms) y las curvas en variables CSS propias, afinables sin tocar el codigo: `--travel-curve` con un rebote pequeno para el movimiento y `--travel-fade` sin rebote para los fundidos.
- [x] 2.2 Apagar las transiciones de la barra, su contenido y el fondo con "reducir animaciones" activo.
- [x] 2.3 Dar a la tarjeta el vidrio de la barra: fondo con algo de transparencia, desenfoque de lo que hay detras, halo y brillo fino en el borde de arriba, en claro y en oscuro.
- [x] 2.4 Borde animado en el estado pequeno: un cono de luz gira por el borde de la pildora (clase `omnibar-ring`), tenue en reposo y encendido con el hover o el foco; al ampliarse la tarjeta vuelve a su borde normal. Los botones se vuelven circulos solo en ese estado pequeno.

## 3. Comprobaciones

- [x] 3.1 `bun run typecheck` sin errores.
- [x] 3.2 `bun run check` limpio en los archivos tocados.
- [x] 3.3 Con `bun run dev`, comprobar: cada panel viaja al centro y vuelve con su encogido; la fila de botones se conserva abajo en el modal; el codigo HTML sigue creciendo en su sitio; la cadena IA a impacto no salta; la pagina en blanco abre el modal casi en el sitio; cerrar con equis, escape y clic en el fondo.
- [x] 3.4 Comprobar el caso con "reducir animaciones" activo: el cambio es al instante y todo sigue funcionando.

## 4. La conversacion con IA dentro del modal

- [x] 4.1 La portada de bienvenida sube y se desvanece al mandar la primera peticion; vuelve a entrar al empezar de cero.
- [x] 4.2 Entrada escalonada: quien pide, "Generando" y la respuesta suben y se asoman una tras otra.
- [x] 4.3 El contenedor del codigo en generacion se despliega suavemente como acordeon.

## 5. Comprobaciones de la conversacion

- [x] 5.1 Con `bun run dev`, comprobar en IA: la portada sale y se desvanece con la primera peticion; mensaje, "Generando" y respuesta entran escalonados; el codigo se despliega como acordeon.
- [x] 5.2 Comprobar que con "reducir animaciones" activo todo entra al instante y nada se rompe.
