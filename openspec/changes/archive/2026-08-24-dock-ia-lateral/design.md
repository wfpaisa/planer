## Context

Ver `proposal.md` - Why.

Lo que hay hoy, que es lo que condiciona el enfoque:

- `Omnibar.tsx` es una pildora `absolute` dentro de `#page-stage-main`, con un `backdrop` `fixed` a `bg-black/40 backdrop-blur-[6px]` y una tarjeta que crece de `2.875rem` a `34rem` cambiando `height`, `top`, `transform` y `max-width`. Dentro monta `AiPanel` e `ImpactPanel`.
- `PageStage.tsx` es `<div className="relative flex h-full">` con el sidebar y `<main className="flex-1">`. El sidebar anclado ya ocupa sitio en ese flex; flotante es `absolute`.
- `Builder.tsx` dibuja `AppTopBar` y `UrlBar` a lo ancho, y debajo el contenido.
- La conversacion ya vive fuera del componente, en `lib/aiConversation.ts`, guardada por aplicacion y pagina. Esconder el dock no la pierde sin hacer nada nuevo.
- El servidor ya entrega por partes (`AiProgress`, SSE) y `stream()` en `lib/pb.ts` ya lo lee. `AiPanel` ya recibe `razonamiento`.
- daisyUI 5.7.20 trae `.aura` y `.aura-rainbow` en `components/aura.css`, con `prefers-reduced-motion` resuelto.

## Goals / Non-Goals

**Goals:**

- Que la conversacion y el documento se vean a la vez, sin que uno tape al otro.
- Que el ancho lo decida quien construye, y se recuerde.
- Que se vea trabajar a la IA sin tener que desplegar nada.
- Dejar los specs describiendo lo que existe.

**Non-Goals:**

- No se toca la vista publicada: no hay dock para el visitante.
- No se toca el protocolo con el servidor. `AiProgress` se queda como esta.
- No se toca `AppTopBar` mas alla de anadirle el boton.
- No se cambia donde vive nada mas: publicar, compartir, el codigo y los cambios se quedan donde estan hoy.

## Decisions

### El dock es una columna del flex, no una capa

`PageStage` ya es un flex horizontal. El dock entra como primer hijo, antes del sidebar, con `width` en linea y `shrink-0`. El documento es `flex-1 min-w-0` y se estrecha solo.

*Alternativa descartada:* dibujarlo `absolute` encima y empujar el `main` con `padding-left`. Funciona, pero deja dos fuentes de verdad para el mismo ancho (el `width` del dock y el `padding` del main) que hay que mantener sincronizadas, y el navegador ya sabe repartir un flex.

*Alternativa descartada:* CSS Grid con tres columnas. El sidebar flotante no ocupa columna, asi que la rejilla tendria que cambiar de plantilla segun el estado del sidebar. El flex absorbe eso sin decir nada.

### El ancho se guarda en `localStorage` por aplicacion

Mismo patron que `useSidebarPin`: una clave `plane_ai_dock_*` por aplicacion, leida en el `useState` inicial y escrita en un efecto. Es una preferencia de quien mira, no un dato de la aplicacion, asi que no toca ni `AppRecord` ni el servidor.

Escondido se guarda igual, con su propia clave. Ancho y escondido son independientes: traer el dock de vuelta lo devuelve con el ancho que tenia.

*Alternativa descartada:* guardarlo en `AppNav`. Obligaria a un `PATCH` por cada arrastre y haria que el ancho que elige una persona se lo imponga a las demas.

### El arrastre del borde escribe el ancho en el DOM y solo confirma al soltar

Durante el arrastre se escribe `style.width` sobre el nodo directamente desde el manejador de `pointermove`; el estado de React se actualiza al soltar (`pointerup`). Un `setState` por cada `pointermove` redibuja el arbol entero de la conversacion --que puede llevar decenas de mensajes con markdown-- sesenta veces por segundo.

Se usa `setPointerCapture` para que salirse del borde no pierda el arrastre, y se fija `user-select: none` mientras dura para no ir seleccionando texto de la conversacion.

Minimo y maximo: el minimo es lo que necesita el campo de texto para no ser inservible; el maximo se expresa contra el ancho de la ventana, no en pixeles fijos, para que en una pantalla pequena el dock no se coma el documento.

### El dock lleva la paleta del panel, no la de la aplicacion

La paleta de una aplicacion se queda donde es la aplicacion: el documento HTML
mientras se construye, y el documento mas el sidebar en la vista publicada
--`Published.tsx` pone el `data-theme` sobre todo--. En el panel, `PageStage`
lo pone solo sobre el contenedor del documento, asi que el dock queda fuera y
hereda el tema del panel, igual que el encabezado y el sidebar de paginas.

*Alternativa descartada:* que el dock tomara la paleta de la aplicacion. El dock
esta pegado al sidebar de paginas, que es chrome: dos paletas una al lado de la
otra se leen como dos programas distintos.

### El pensamiento se ve en una linea que sigue el final

Es el patron de `ReasoningRow` de deepseek-harness: mientras corre, el resumen es la **ultima** linea del razonamiento y el elemento se desplaza horizontalmente hasta `scrollWidth - clientWidth`; al terminar, el resumen es la **primera** linea y el desplazamiento vuelve a cero.

Cabe en una linea, no obliga a desplegar y aun asi se ve avanzar. Hoy `Working` solo dice "Generando" hasta el final.

*Alternativa descartada:* desplegar el avance por defecto. Lo que la IA va escribiendo es HTML, y para la mayoria de peticiones eso es ruido --la razon por la que `Working` nace cerrado. La linea viva da la senal sin traer el ruido.

### Los redibujados se agrupan por intervalos de dibujado

Un `requestAnimationFrame` encadenado que coalesce a uno cada tres frames, con el ultimo valor. Hoy `stream()` llama a `setProgress` en cada trozo SSE y `AiPanel` hace `scrollIntoView({behavior:"smooth"})` en cada cambio: con una respuesta larga eso es un desplazamiento suave por token, y el desplazamiento manual pelea contra el automatico.

*Alternativa descartada:* `debounce` por tiempo. Un intervalo en milisegundos no esta alineado con el dibujado del navegador y produce saltos; los frames si.

### La retirada de las dos capacidades es de specs, no de codigo

`builder-topbar-retirement` describia codigo que nunca se escribio: retirarla no toca nada. `builder-omnibar` describia la pildora --que si existe y si se borra-- mas seis entradas que nunca llegaron a ella. Borrar `Omnibar.tsx` cubre la parte real; el resto es poner el registro al dia.

## Risks / Trade-offs

- **Con dock, sidebar anclado, barra superior y barra de direccion, el documento pierde sitio por los cuatro lados** → Los tres se esconden por separado y cada uno recuerda su estado. Construyendo se quieren los mandos delante; para mirar el resultado, el dock se esconde de un clic y el sidebar se suelta.
- **El documento cambia de ancho al arrastrar el borde, y una pagina con maquetacion sensible se redibuja constantemente** → El `iframe` reflowa solo; no hay que avisarle. Si un documento resulta caro de redibujar, el ancho se aplica al soltar y no durante el arrastre.
- **`aura` anima un gradiente conico sin parar mientras el panel este a la vista** → daisyUI ya multiplica por cuatro la duracion con `prefers-reduced-motion`. Se usa el tamano mas pequeno del halo para acotar el area que repinta.
- **En una ventana estrecha el dock deja el documento en nada** → El maximo se calcula contra el ancho de la ventana. Por debajo de cierto ancho el dock se esconde en vez de encogerse hasta ser inutil.
- **Retirar `builder-omnibar` deja huerfanas reglas que seguian valiendo** → Los siete requisitos que sobreviven se copian a `builder-ai-dock` en el mismo cambio, y cada retirada dice en su `Migration` a donde fue.
- **`omnibar-ring` y `omnibar-buttons` quedan sin uso en `styles.css`** → Se retiran en el mismo cambio. `aura` de daisyUI hace lo que hacia `omnibar-ring`, mejor y sin codigo propio.

## Migration Plan

No hay datos que migrar: todo lo que cambia de sitio vive en `localStorage` o en el propio dibujado.

- Quien tuviera una conversacion a medias la conserva: ya se guarda en `lib/aiConversation.ts`, con la misma clave por aplicacion y pagina.
- La primera vez, el dock aparece escondido y el boton de la barra superior es la senal de que esta ahi.
- Vuelta atras: es un cambio de dibujo. Recuperar `Omnibar.tsx` devuelve el estado anterior sin tocar nada guardado.
