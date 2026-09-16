## Context

Ver `proposal.md` para el porque. Lo que sigue es el estado actual que condiciona el como.

El bloque de HTML ya resuelve, a escala de bloque, casi todo lo que esta propuesta necesita a escala de pagina:

- **Aislamiento**: `HtmlFrame.tsx` dibuja el documento en un `iframe` con `sandbox="allow-scripts"` y sin origen propio. Sin origen no hay acceso a la sesion, ni a las cookies, ni al DOM del panel.
- **Puente de datos**: el documento llama a `window.plane`; el panel recibe el mensaje, resuelve la fuente contra el manifiesto del bloque y consulta PocketBase **con la sesion de quien mira**. Los permisos nunca se evaluan en el navegador del visitante: los aplican las reglas de acceso de las colecciones `d_*`.
- **Manifiesto de fuentes**: `HtmlSource` guarda `{ name, tableId, fields: Record<nombreLogico, idColumna> }`. Es lista blanca y traduccion a la vez, y guarda columnas por id, no por nombre.
- **Guardado por contenido**: `server/htmlDocs.ts` guarda cada documento por el sha256 de su texto, deduplicado por app, con recorte de los huerfanos.
- **Contexto para la IA**: `shared/htmlContract.ts` ya genera el texto que describe colores, ordenes de datos, tablas y limites, y ya se usa en dos sitios (copiar al portapapeles y varita magica).

La propuesta no inventa estas piezas: las sube de bloque a pagina.

Restricciones del proyecto: sin sistema de migraciones (las colecciones internas se evolucionan anadiendo campos en `bootstrap.ts`), sin framework de pruebas unitarias, todo en espanol sin acentos.

## Goals / Non-Goals

**Goals:**

- Reutilizar el aislamiento, el puente y el guardado por contenido tal cual, subiendolos de `HtmlBlock` a `PageRecord`.
- Una sola fuente para el contexto de la IA y la documentacion del constructor.
- Que el manifiesto de tablas sirva a la vez de permiso y de grafo de dependencias, sin estructura adicional.
- Que el retiro de los bloques sea el ultimo paso, con lo nuevo ya funcionando.

**Non-Goals:**

- No se introduce compilacion ni empaquetado. La pagina es HTML servido tal cual; no hay JSX, ni paso de construccion, ni instalacion de librerias.
- No se gestionan medios (imagenes, archivos subidos). Queda para despues.
- No se toca el modelo de tablas, filas, personas, roles ni las reglas de acceso.
- No se usa git como almacen del historial: las versiones siguen en PocketBase.

## Decisions

### 1. La pagina hereda el modelo del bloque de HTML, no uno nuevo

`PageRecord` pierde `blocks: Block[]` y gana `doc: string` (huella del documento) y `sources: HtmlSource[]`.

**Por que**: es el mismo par de campos que ya tiene `HtmlBlock`, con la misma semantica. `saveDoc`, `readDoc`, `pruneDocs` y `resolveSource` funcionan sin cambios de logica, solo cambia de donde se leen los campos.

**Alternativa descartada**: guardar el HTML dentro del registro de la pagina. Se descarto porque perderia la deduplicacion entre versiones: treinta versiones sin cambios ocuparian treinta veces.

### 2. La navegacion vive fuera del documento, no inyectada dentro

El sidebar y la barra Todo En Uno son chrome del panel, alrededor del `iframe`. Lo que se inyecta **dentro** del documento son dos referencias: la hoja de estilos con las variables y el guion del puente.

**Por que**: si la navegacion se dibujara dentro del HTML, la IA podria romperla en cualquier peticion y el aislamiento dejaria de valer para nada. Fuera, el peor HTML posible solo se rompe a si mismo.

**Consecuencia**: los colores tienen que cruzar la frontera del `iframe`. Ya existe el mecanismo: `readTheme()` resuelve las variables del tema y las manda por `postMessage`. Se amplia con espaciados y tamanos de texto.

**Alternativa descartada**: renunciar al `iframe` y dibujar el HTML en el mismo documento del panel. Se descarto por dos razones: colisiones de CSS y de nombres globales, y perdida del unico limite de seguridad que hoy impide que el HTML lea la sesion.

### 3. Referencias inyectadas, no contenido pegado

La pagina lleva dos lineas con `<link>` y `<script>` apuntando a rutas servidas por Planer, cada una precedida de un comentario en espanol.

**Por que**: tres beneficios de una decision. El codigo que ve el constructor se lee. Mejorar el puente actualiza todas las paginas de todas las apps sin editarlas. Y el navegador cachea los dos archivos entre paginas.

**Trade-off**: el documento deja de ser autocontenido. Un HTML exportado fuera de Planer no funcionara solo. Se acepta: la pagina no esta pensada para vivir fuera.

### 4. El contexto se genera, nunca se persiste

`buildHtmlContract` se amplia (espaciados, tipografia, permisos de la pagina) y pasa a tener dos salidas: el contexto de la IA y la seccion del README.

**Por que**: el archivo ya avisa de esto en su cabecera — escrito dos veces, uno de los dos se queda viejo. Un contexto guardado dentro del HTML tendria el mismo destino en cuanto cambie una tabla.

**Como se genera el README**: un script que escribe la seccion desde la misma funcion, ejecutado a mano y con el resultado versionado. No hace falta automatizarlo en el arranque.

### 5. Riesgo por operacion, no por confirmacion uniforme

La clasificacion se apoya en un hecho del modelo actual: las columnas se guardan por `FieldDef.id`, y el API de tablas hace round-trip de esos ids, asi que PocketBase renombra en sitio y los datos sobreviven.

| Operacion | Riesgo | Motivo |
|---|---|---|
| Crear tabla | ninguno | nadie la declara todavia |
| Anadir columna | ninguno | ninguna pagina la pide |
| Renombrar columna | ninguno | el id no cambia; el manifiesto absorbe el cambio |
| Cambiar tipo | alto | los valores existentes pueden no convertirse |
| Borrar columna o tabla | alto | las paginas que la declaran se quedan sin ella |

**Por que**: confirmar todo por igual entrena al usuario a aceptar sin leer. Confirmar solo lo que puede romper hace que la pregunta se lea.

**Nota**: con `ownerField` puesto, cambiar columnas exige bloquear primero las reglas de la coleccion (`lockDataCollection` → actualizar campos → `applyTableRules`). El dialogo de impacto se coloca **antes** de esa secuencia, no en medio.

### 6. El grafo de dependencias es el propio manifiesto

"Que paginas usan la tabla X" se responde recorriendo el `sources` de las paginas de la app. No hay indice aparte.

**Por que**: un indice separado puede quedar desincronizado; el manifiesto no, porque es lo que el puente consulta en cada llamada. Si estuviera mal, la pagina no funcionaria y se notaria antes.

**Coste**: recorrido lineal sobre las paginas de una app. Con decenas de paginas es irrelevante.

### 7. El detalle de "para que" es una llamada a la IA bajo demanda

El dialogo se abre al instante con los nombres de las paginas, que salen del manifiesto. Pedir el detalle lanza una consulta que lee el HTML de esa pagina y responde en la misma conversacion.

**Por que**: leer varias paginas con la IA antes de poder mostrar el dialogo anadiria segundos a cada confirmacion, incluso cuando el constructor ya sabe lo que hace.

### 8. El dialogo de impacto es la unica grieta del alcance de una pagina

La regla general es una pagina por peticion. La excepcion se autoriza explicitamente y produce **un solo paso** del historial que abarca la tabla y las paginas tocadas.

**Por que**: sin la excepcion, un borrado de columna dejaria paginas rotas que habria que arreglar una a una. Con la excepcion abierta por defecto, se pierde el control de lo que la IA toca.

### 9. Los bloques se retiran al final

Orden: contexto y puente → pagina HTML → chrome → IA → historial → retirada.

**Por que**: mientras el modelo nuevo no este probado, los bloques son la unica forma de que una app funcione. Retirarlos antes deja el producto sin salida si algo del camino nuevo falla.

## Risks / Trade-offs

**Las apps existentes con bloques se quedan sin equivalente automatico** → No hay conversion de bloques a HTML. Mitigacion: generar el HTML equivalente con la IA a partir de la configuracion del bloque, en una pasada unica y asistida. Se acepta que el resultado no sea identico.

**Las versiones anteriores del historial guardan bloques** → Al retirar los bloques, restaurar una version antigua no tendria que dibujar. Mitigacion: las versiones creadas antes del cambio se marcan como solo lectura y se pueden consultar pero no restaurar.

**El HTML puede pedir mas de lo que declaro y fallar en caliente** → El puente rechaza la fuente y el documento tiene que enterarse. Mitigacion: el mensaje de error ya existe y es explicito; el contexto le dice a la IA que envuelva las llamadas y muestre `error.message`.

**Un documento que insiste en salir de la pagina** → Ya resuelto en `HtmlFrame`: hasta tres reposiciones, y despues el marco se retira. Se conserva tal cual.

**Con libertad total de diseno, la IA intentara mas cosas prohibidas** (su propio login, guardar en el navegador, navegar fuera) → Los limites se declaran en el contexto y el `iframe` los impide de todas formas. El diagnostico que ya existe (`htmlAnalyze.ts`) detecta estos puntos y puede avisar al guardar.

**Dos archivos inyectados compartidos entre todas las apps** → Un cambio incompatible en el guion del puente rompe todas las paginas a la vez. Mitigacion: el puente solo crece, nunca cambia el significado de una orden existente.

**Cada peticion a la IA cuesta tiempo y dinero** → Se mitiga con la decision 7 (detalle bajo demanda) y con no llamar a la IA para nada que salga del manifiesto.

## Migration Plan

1. **Anadir sin quitar**: `PageRecord` gana `doc` y `sources` conservando `blocks`. Una pagina con `doc` se dibuja como HTML; sin `doc`, como bloques. Las dos formas conviven.
2. **Servir los dos archivos inyectados** en rutas estables, e inyectar sus referencias al guardar.
3. **Chrome nuevo** (sidebar y barra) alrededor del `iframe`, disponible solo cuando la pagina tiene `doc`.
4. **IA y dialogo de impacto** sobre el camino nuevo.
5. **Historial**: las versiones nuevas guardan `doc` y `sources`; las antiguas quedan como solo lectura.
6. **Conversion asistida** de las apps con bloques.
7. **Retirada** de los bloques, su inspector, su revision y sus ordenes de IA.

**Vuelta atras**: hasta el paso 6 inclusive, quitar el chrome nuevo devuelve el producto al estado actual sin perder datos, porque `blocks` sigue ahi. A partir del paso 7 la vuelta atras es una restauracion desde git.

## Open Questions

- Como se identifica a quien construye dentro de una app publicada, para decidir si se dibuja la barra Todo En Uno: por su sesion de constructor en paralelo a la de miembro, o por una ruta distinta. No cambia las specs ni el reparto de tareas.
- Cuantas conversaciones se conservan por aplicacion antes de recortar las mas viejas.
