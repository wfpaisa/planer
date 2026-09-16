## Why

Los seis bloques actuales cubren lo previsible. Todo lo demas (un calendario, un tablero, un inventario con su propio diseno) exige programar un bloque nuevo dentro de la plataforma, y eso deja al constructor esperando.

Hoy cualquiera puede pedirle a una IA en linea un HTML completo y funcional. Falta la puerta para meterlo en Planer: que se vea como la aplicacion, que lea y escriba en las tablas de verdad, y que no ponga en riesgo la sesion de los visitantes.

## What Changes

- **Bloque HTML nuevo.** Un septimo tipo de bloque que dibuja HTML del constructor dentro de una caja aislada. Hereda los colores de la app y el filtro por roles que ya tienen todos los bloques.
- **Manifiesto de datos.** El bloque declara que tablas y que columnas usa con nombres logicos. El HTML pide datos por esos nombres; la plataforma los traduce a las tablas reales. Renombrar una tabla o una columna no rompe el HTML.
- **Ordenes de datos.** El HTML pide y guarda datos con cuatro ordenes (`listar`, `obtener`, `crear`, `actualizar`, `borrar`) que viajan por mensajes. El HTML nunca ve la sesion ni el token del visitante; las reglas de acceso de cada tabla siguen mandando.
- **Importar.** Arrastrar un archivo `.html` o pegar el codigo. Se acepta hasta un tamano maximo.
- **El contenido se queda en su bloque.** Un archivo hecho para vivir suelto suele mandar a su pantalla de acceso cuando no reconoce a nadie. Dentro del bloque no hay a donde ir: el contenido vuelve a su sitio y el constructor se entera. La sesion, las personas y los roles los sigue poniendo la plataforma, y ni la varita ni las instrucciones dejan que el HTML se los vuelva a inventar.
- **Diagnostico.** Al importar, la plataforma revisa el archivo sin IA y reporta que tan preparado esta: donde estan los colores, donde guarda los datos, si trae datos de ejemplo, si depende de recursos externos. El diagnostico decide que casillas de la varita magica se pueden marcar.
- **Varita magica.** Un asistente por pasos que puede crear las tablas a partir del contenido, cargar los datos de ejemplo, adaptar los estilos y conectar el guardado. Cada paso trabaja sobre un trozo del archivo, no sobre el archivo entero.
- **Antes y despues.** El resultado de la varita se compara con el estado anterior usando la vista previa que ya existe, y se acepta o se descarta.
- **Copiar instrucciones.** Un boton que arma el texto para pegarlo en un chat de IA externo: colores de la app, ordenes de datos y las tablas elegidas.
- El contenido HTML se guarda en una coleccion propia, identificado por su huella. Los bloques y las versiones guardan la huella, no el contenido.

## Capabilities

### New Capabilities

- `html-blocks`: el bloque HTML, su caja aislada, el manifiesto de tablas y columnas, las ordenes de datos, la herencia de estilos y el texto de instrucciones para una IA externa.
- `html-import`: importar un archivo o codigo pegado, el diagnostico previo, la varita magica por pasos, la comparacion antes/despues y aceptar o descartar el resultado.

### Modified Capabilities

- `block-checks`: la revision y el arreglo automatico por renombrado pasan a cubrir tambien el bloque HTML, a traves de su manifiesto.
- `app-versions`: una fotografia guarda la referencia al documento HTML, no su contenido, y un documento se conserva mientras alguna version o el borrador lo nombren.

## Impact

- **Tipos compartidos**: un tipo de bloque nuevo, el manifiesto, el diagnostico y el resultado de la varita.
- **Servidor**: coleccion interna nueva para los documentos HTML, rutas para importar, diagnosticar y ejecutar la varita, recorte de documentos huerfanos junto al recorte de versiones, y participacion del bloque en la revision y en el renombrado.
- **Panel**: el bloque nuevo en el catalogo y en el inspector, el modal de importacion con su diagnostico, el panel de la varita con su progreso, y el boton de copiar instrucciones.
- **Publicado**: la caja aislada y el puente de datos funcionan igual en el editor, en la vista previa y en la app publicada.
- **Sin dependencias nuevas.** La caja aislada, el puente y el diagnostico se resuelven con lo que ya trae el navegador y Bun.
- **Riesgo principal**: ejecutar codigo de terceros. Se acota encerrandolo sin acceso al origen de la aplicacion y sin token.
