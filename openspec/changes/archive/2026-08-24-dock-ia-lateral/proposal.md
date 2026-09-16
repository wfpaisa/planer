## Why

La conversacion con la IA vive hoy en una pildora flotante que, al abrirse, crece hasta un panel centrado de 42rem y tapa el documento. Eso obliga a elegir: o hablas con la IA, o ves lo que la IA hizo. Y como todo lo que se pide se construye sobre el documento, elegir es justo lo que no se quiere.

Este cambio saca la conversacion de encima del documento y la pone a su lado, en una columna propia que se puede ensanchar y esconder. Y arregla lo que peor se ve hoy: mientras la IA trabaja, la barra solo dice "Generando".

## What Changes

**El dock de la IA**

- La conversacion SHALL vivir en una columna propia a la izquierda del panel de construccion, que ocupa su espacio en vez de dibujarse encima del documento.
- El ancho SHALL poder ajustarse arrastrando su borde, con un minimo y un maximo, y SHALL recordarse por aplicacion en el navegador de cada persona.
- El dock SHALL poder esconderse por completo, y SHALL volver solo desde un boton en la barra superior. Ese boton lleva el halo animado `aura aura-rainbow` de daisyUI.
- El sidebar de paginas SHALL seguir funcionando igual: cada persona lo ancla o lo deja flotando. Abrir el dock SHALL NO plegarlo.

**La pildora desaparece**

- **BREAKING** Se retira la barra Todo En Uno como superficie flotante: la pildora, su crecimiento a panel centrado, su viaje al centro de la pagina en blanco y su campo de texto.
- Lo que era pildora dentro de la conversacion --los atajos de peticion-- SHALL pasar a badges dentro del propio chat.
- Un badge que quien construye haya anadido a lo que esta escribiendo SHALL poder quitarse antes de enviar, sin borrar el texto. Arrepentirse no cuesta reescribir la peticion.
- El aviso de impacto en los datos SHALL dibujarse dentro del dock, encadenado a la conversacion que lo provoco, como hasta ahora.

**Se ve pensar**

- Mientras la IA trabaja, SHALL verse en una sola linea lo ultimo que va pensando, desplazandose sola para seguir el final del texto. Al terminar, esa linea SHALL quedarse en el principio del razonamiento.
- Esa linea SHALL poder desplegarse para leer el razonamiento entero, y SHALL seguir desplegada mientras dure la peticion.
- Las actualizaciones de la conversacion mientras llega la respuesta SHALL agruparse por intervalos de dibujado, en vez de aplicarse en cada trozo recibido.

**Se retiran dos capacidades**

- **BREAKING** Se retira `builder-omnibar`. Describia una superficie flotante que deja de existir. De sus quince requisitos, ocho hablan de la pildora o de entradas que nunca llegaron a ella --publicar, compartir, los dos iconos de ajustes, el codigo y los cambios-- y los otros siete pasan a `builder-ai-dock`.
- **BREAKING** Se retira `builder-topbar-retirement`. Describia la retirada de la barra superior del panel, sus entradas repartidas y la base de datos abierta como capa encima de la pagina. Nada de eso llego al codigo: la barra superior sigue dibujandose, publicar y las personas siguen en ella, y la base de datos sigue siendo una seccion hermana. La barra superior se conserva, y es donde vive el boton del dock.

## Capabilities

### New Capabilities

- `builder-ai-dock`: La columna de la IA en el panel de construccion: donde vive, como se ajusta su ancho, como se esconde y como se trae de vuelta, y lo que recoge de la barra retirada.

### Modified Capabilities

- `ai-authoring`: La conversacion deja de vivir dentro de la barra y pasa al dock. La entrada a la IA deja de ser el campo de una barra flotante. Se ve en una linea lo que la IA va pensando, con el razonamiento completo a un despliegue.

### Removed Capabilities

- `builder-omnibar`: La superficie flotante deja de existir. Siete de sus requisitos pasan a `builder-ai-dock`; los otros ocho describian la pildora o entradas que nunca llegaron a ella.
- `builder-topbar-retirement`: Describia una retirada que nunca se hizo. La barra superior se conserva.

## Impact

- Panel de construccion: gana una columna a la izquierda y pierde la superficie flotante. La barra superior se conserva y suma el boton del dock.
- `web/src/components/Omnibar.tsx`: se retira.
- `web/src/components/AiPanel.tsx`, `OmniPanel.tsx`, `ImpactPanel.tsx`: pasan a dibujarse dentro del dock.
- `web/src/components/AppTopBar.tsx`: suma el boton con el halo.
- `web/src/styles.css`: `omnibar-ring` y `omnibar-buttons` quedan sin uso al retirarse la pildora.
- `web/src/routes/PageStage.tsx`: reparte el ancho entre dock, sidebar y documento.
- Vista publicada: no cambia. El dock es solo para quien construye.
- Los specs de `builder-omnibar` describen entradas que nunca se mudaron a la barra; este cambio los pone al dia con lo que existe.

## Non-goals

Fuera de este cambio, y previstos para los siguientes:

- Adjuntar archivos a la conversacion y arrastrarlos al chat. Por eso **se conserva de momento** el arrastre que crea una tabla o una pagina: quitarlo ahora dejaria el gesto sin ningun significado hasta que lleguen los adjuntos.
- Que la IA edite trozos del HTML en vez de reescribirlo entero, y el cursor para señalar un elemento como contexto.
- Que la IA pregunte con opciones y construya por bloques pidiendo autorizacion.
- Retirar la varita magica de importar HTML.
- Editar contenido en caliente sobre el documento.
