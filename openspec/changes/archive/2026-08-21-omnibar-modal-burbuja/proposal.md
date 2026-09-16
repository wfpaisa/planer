# Omnibar: los paneles viajan al centro como modal con fondo desenfocado

## Why

Hoy, al abrir una opcion de la barra (IA, publicar, compartir), el contenido aparece al instante dentro de la barra, que crece en su sitio. No hay viaje ni peso: no se siente que se abrio una pantalla nueva, y al cerrar no hay regreso. Quien construye quiere ver a la barra viajar al centro de la ventana, con el documento desenfocado atras, y volver a su sitio con un encogido tipo burbuja.

## What Changes

- Al abrir cualquier panel de la barra (IA, publicar, compartir, ajustes de la aplicacion, ajustes de la pagina, cambios, importar HTML e impacto en los datos), la barra viaja hasta el centro de la ventana y se convierte en un modal centrado, con el documento de atras oscurecido y desenfocado.
- La fila de botones de la barra viaja con el modal y se conserva abajo, para que se entienda que es la misma barra.
- Al cerrar (equis, escape o clic en el fondo), el modal se encoge con un efecto de burbuja y vuelve a la posicion que ocupaba la barra, y el fondo desenfocado se disuelve.
- El panel de codigo HTML no viaja: sigue creciendo en su sitio, porque ya ocupa casi toda la pantalla.
- El fondo del modal usa un oscurecido con un desenfoque mas marcado que el de los demas modales del panel.
- El viaje dura unos 300 ms y llega con un pequeno rebote. Lo hace la tarjeta de verdad, no una foto suya: el borde se mantiene recto mientras crece, el contenido se recoloca en vez de deformarse, y un cambio de idea a mitad de camino se recoge desde donde va.
- La barra lleva vidrio: deja pasar algo de lo que hay detras y lo desenfoca, con un halo y un brillo fino en el borde de arriba.
- Con la opcion del sistema "reducir animaciones" activa, no hay viaje: el cambio es al instante.
- Dentro del modal, la conversacion con la IA tiene entrada propia: la portada de bienvenida sube y se desvanece al mandar la primera peticion, los mensajes entran escalonados (quien pide, "Generando", respuesta) y el contenedor del codigo en generacion se despliega suavemente.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `builder-omnibar`: los paneles de la barra pasan de crecer en su sitio a viajar hasta un modal centrado con fondo oscurecido y desenfocado, y al cerrar vuelven a la barra con un encogido tipo burbuja. El codigo HTML se queda creciendo en su sitio.

## Impact

- Panel de construccion: `web/src/components/Omnibar.tsx` mantiene un unico contenedor, y son sus medidas y su anclaje los que cambian entre los dos estados (barra y modal centrado); el fondo oscurecido pasa a ser un plano aparte que se funde.
- Estilos: los tiempos y las curvas del viaje viven en `web/src/styles.css`.
- Sin cambios en el servidor, en la API ni en los datos.
