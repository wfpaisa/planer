# El chat de IA

Cómo funciona una petición a la IA, de principio a fin. Dibujado en [Mermaid](https://mermaid.ai/): GitHub y la mayoría de los editores lo renderizan solo.

> Para lo demás: el [README principal](../README.md) cuenta qué es Planer, y [PAGINAS-HTML.md](./PAGINAS-HTML.md) explica cómo se escribe el HTML de una página.

Una petición escribe sobre **una sola página**: la que está abierta. Cuatro ideas explican casi todo lo demás:

- **La petición no vive en la conexión que la pidió.** Vive en el servidor, en memoria del proceso. Recargar, cerrar el panel o volver más tarde no la corta.
- **El servidor no tiene navegador.** Lo único que necesita ejecutar HTML de verdad —revisar errores— se le pide al navegador de quien construye.
- **La conversación es de la página**, no de la aplicación. La lista del dock muestra solo las de la página abierta, y borrar la página se las lleva.
- **Abierta hay una sola en toda la aplicación**: la última en la que se habló. La apunta la aplicación (`apps.openChat`), así que llegar a una página repone esa conversación solo si es la suya y las demás empiezan en blanco —también al volver desde otro navegador—. Lo de antes sigue a un clic, en «Conversaciones anteriores».

Desde el panel se pide en **una página a la vez**: mientras se trabaja en una, el dock de cualquier otra no admite peticiones y ofrece ir a la que está en curso. El límite vive ahí y solo ahí —`aiRuns` sigue admitiendo una petición por página y varias páginas a la vez—, así que levantarlo es quitar esa condición del panel.

## Las piezas

```mermaid
flowchart TB
  subgraph nav["Navegador de quien construye"]
    panel["AiPanel.svelte<br/>la conversación y el campo de texto"]
    probe["PageProbe.svelte<br/>dibuja la página escondida"]
    frame["HtmlFrame.svelte<br/>el marco aislado"]
  end

  subgraph srv["Servidor Bun"]
    rutas["routes.ts<br/>askPage · getPageRun · followPageRun<br/>stopPageRun · reportPageProbe"]
    runs["aiRuns.ts<br/>las peticiones en marcha"]
    motor["aiPage.ts<br/>el prompt, las herramientas y el bucle"]
    conex["ai.ts<br/>la conexión con el proveedor"]
  end

  modelo(["Claude o un compatible<br/>con ChatGPT"])

  panel -->|"POST la petición"| rutas
  rutas -->|"SSE lo que va pasando"| panel
  panel --> probe --> frame
  probe -->|"POST lo que soltó la consola"| rutas

  rutas --> runs --> motor --> conex --> modelo
```

`AiPanel` es la única entrada del chat. `aiRuns` es donde vive la petición mientras el navegador va y viene.

## Una petición de principio a fin

```mermaid
sequenceDiagram
  autonumber
  actor B as Quien construye
  participant P as AiPanel
  participant R as routes.ts
  participant M as aiPage
  participant Prov as Proveedor
  participant DB as PocketBase

  B->>P: escribe qué necesita y envía
  P->>R: POST /api/apps/:id/paginas/:pid/ia
  Note over R: dueño de la app · la página existe<br/>409 si ya hay una petición en marcha

  R-->>P: SSE abierto · evento "inicio"
  Note over P: Desde aquí, recargar o cerrar<br/>ya no pierde la petición.

  R->>M: runPageRequest, sin esperarla

  loop hasta 12 rondas
    M->>Prov: sistema + herramientas + lo pedido
    Prov-->>M: texto, razonamiento y llamadas a herramientas
    M-->>P: avisos de texto, pasos y uso, por el SSE
    M->>DB: lo que cada herramienta escribe
  end

  M->>DB: guarda la conversación, en la página donde se pidió
  M->>DB: guarda la constancia: lo que se mandó y lo que volvió
  M-->>P: evento "fin" con el resultado
  P->>B: la respuesta, los pasos y la página recargada
```

Lo que llega antes del final es **para mirar**. El resultado de verdad llega una sola vez, en `fin`.

## La constancia de cada petición

Al cerrar el turno —termine bien o mal— se guarda en `ai_debug` lo que se le mandó al modelo, lo que pensó, lo que respondió, con qué modelo y cuánto tardó. **Una fila por página**, sobrescrita en cada petición: no es un historial, es lo que hace falta para entender después un fallo que no se puede reproducir.

Se guarda siempre, sin depender del modo debug: si hubiera que encenderlo y repetir la petición, llegaría tarde justo para el fallo que vale depurar. Se escribe después de entregar el resultado, y que falle no cambia lo que recibe quien construye.

Se lee desde el despliegue «Contexto enviado» de la conversación, así que recargar después de un fallo no lo pierde. Borrar la página se lleva su constancia; los ajustes generales ofrecen borrarlas todas de una vez.

## El bucle de rondas

```mermaid
flowchart TB
  inicio(["Empieza la petición"]) --> ronda{"¿Quedan rondas<br/>y no se detuvo?"}
  ronda -->|no| cierre["Cierra la petición"]
  ronda -->|sí| pide["Se envía el siguiente paso al modelo"]
  pide --> llamo{"¿Pidió herramientas?"}
  llamo -->|no| cierre
  llamo -->|sí| corre["Ejecuta una por una"]

  corre --> tipo{"¿De qué tipo?"}
  tipo -->|"leer o escribir la página"| esc["Guarda el documento"]
  tipo -->|"base de datos sin riesgo"| apl["Se aplica al momento"]
  tipo -->|"base de datos con riesgo"| ret["No se aplica.<br/>Queda apuntado para el diálogo de impacto"]
  tipo -->|"revisar_errores"| rev["Manda la página a dibujarse<br/>y espera lo que suelte la consola"]

  esc --> vuelta["Se devuelven los resultados al modelo"]
  apl --> vuelta
  ret --> vuelta
  rev --> vuelta
  vuelta --> ronda

  cierre --> imp{"¿Quedó algo con riesgo?"}
  imp -->|sí| dialogo(["Se pregunta en el diálogo de impacto"])
  imp -->|no| fin(["Termina"])
  dialogo --> fin
```

Tope de **12 rondas**. Detener corta **entre herramientas**, nunca a media escritura: lo ya aplicado se queda aplicado, y para deshacerlo está el punto de vuelta atrás que se deja una sola vez por petición.

Los cambios con riesgo (borrar una columna, borrar una tabla, cambiar un tipo) nunca se aplican solos: se apuntan y se preguntan todos juntos al terminar, en el diálogo de impacto.

## Revisar errores

El único camino que va del servidor hacia el navegador y espera respuesta. El servidor no tiene dónde ejecutar HTML, así que se lo pide a quien sí lo tiene abierto.

```mermaid
sequenceDiagram
  autonumber
  participant M as aiPage
  participant P as AiPanel
  participant F as Marco escondido
  participant R as routes.ts

  Note over M: El modelo llamó a "revisar_errores"
  M->>P: aviso "probar" con la huella del documento, por el SSE
  P->>F: lo monta apartado de la vista, con el puente y en modo ensayo
  Note over F: Lo que escribe datos se contesta<br/>sin tocar nada de verdad.

  F-->>P: window.onerror · unhandledrejection<br/>console.error · recursos que no cargan
  F-->>P: el puente dice "listo" (+2s de gracia)
  P->>R: POST /ia/prueba con lo recogido
  R-->>M: los errores, sin repetidos y hasta 10

  alt hay errores
    M-->>M: se devuelven al modelo para corregir y volver a revisar
  else está limpia
    M-->>M: sigue y termina
  end
```

| Situación | Qué pasa |
|---|---|
| Nadie está mirando el panel | Espera 15 s, vence, la petición recibe "no se pudo probar" y continúa. |
| El documento nunca dice estar listo | Tope duro de 12 s, se cierra con lo recogido hasta ahí. |
| El modelo insiste | Dos revisiones por petición; a la tercera se le dice que pare y lo cuente. |
| Un error que solo salta al pulsar un botón | No se ve — esto solo mira lo que pasa al cargar. |
