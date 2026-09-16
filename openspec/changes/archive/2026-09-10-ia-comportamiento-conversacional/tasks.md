## 1. Validacion obligatoria al cerrar el turno

- [x] 1.1 En `runPageRequest` (`server/aiPage.ts`), al salir del bucle de rondas, si `ctx.steps` no registra una llamada exitosa a `revisar_errores`, forzarla antes de devolver la respuesta.
- [x] 1.2 Si la revision forzada encuentra fallos, dejar que el modelo corrija y vuelva a revisar, respetando el limite `MAX_PROBES` que ya existe.
- [x] 1.3 Actualizar el texto de `TOOL_GUIDE` para reflejar que la revision ya no depende de que el modelo la pida por su cuenta.

## 2. Preguntar solo ante ambiguedad de conjunto cerrado

No existe hoy ninguna herramienta para preguntar: hay que construirla entera.

- [x] 2.1 En `shared/types.ts`, la forma de una pregunta: el texto, un encabezado corto y las opciones con `label` y `description`. Colgarla de `AiPageResult` y de `AiProgress`.
- [x] 2.2 En `TOOLS` (`server/aiPage.ts`), la herramienta `preguntar` --nombre en espanol, como el resto de la API--: guarda la pregunta en el contexto y cierra el turno sin abrir mas rondas.
- [x] 2.3 Devolver la pregunta en el resultado de `runPageRequest` y emitirla como paso de progreso, para que el panel la tenga antes del `fin`.
- [x] 2.4 En el panel, pintar la pregunta con sus opciones como botones, dentro de la conversacion.
- [x] 2.5 Elegir una opcion manda una peticion nueva. Como cada peticion abre una conversacion nueva, componer su prompt con la pregunta y la opcion elegida: sin eso el modelo recibe una respuesta suelta que no sabe a que contesta.
- [x] 2.6 Guardar la pregunta y lo que se eligio en la conversacion (`appendToChat`), para que al volver se lea por que se construyo lo que se construyo.
- [x] 2.7 Anadir a `TOOL_GUIDE` la regla: usar `preguntar` solo cuando la respuesta es elegir entre opciones que ya existen en la app (tablas, fuentes); nunca para decisiones de diseno abierto.

## 3. Propuesta proactiva acotada

- [x] 3.1 Anadir a `TOOL_GUIDE` las cuatro situaciones que disparan una propuesta (alcance implicito, capacidad no usada, contradiccion con lo existente, dato expuesto de mas) y las exclusiones explicitas (estetica, funciones no pedidas, reorganizar lo no tocado).
- [x] 3.2 Anadir la regla de una sola propuesta por turno.
- [x] 3.3 Definir en la guia como distinguir un turno de construccion real (escribir_pagina, crear_tabla, primer uso de una fuente) de una correccion pequena, para que la propuesta no aparezca en ajustes menores.

## 4. Tono

- [x] 4.1 Ajustar el texto de cierre de `TOOL_GUIDE` (hoy pide "resumen en espanol llano") para especificar tono profesional, sin nombre, sin animo ludico ni de interrogatorio.

## 5. Permisos y roles como categoria de riesgo

`StructureChange` es de tablas --exige `tableId`-- y el dialogo de impacto tiene cuatro salidas que no significan nada para un permiso: esto va por su lado, no ensanchando lo que hay.

- [x] 5.1 En `shared/types.ts`, el tipo de un cambio de acceso: a quien afecta, que nivel o rol se toca, en que direccion, y la frase de consecuencia. Aparte de `StructureChange`.
- [x] 5.2 En `shared/htmlContract.ts`, pasarle al modelo las personas invitadas --nombre, correo, nivel, roles-- ademas de los nombres de rol, que es lo unico que recibe hoy. Sin eso no puede nombrar a nadie en la consecuencia.
- [x] 5.3 En `server/access.ts`, exponer la lectura de personas y roles que ya hace `peopleOf`, y anadir la escritura de nivel y roles, que hoy solo esta en `updatePerson` (`server/routes.ts`).
- [x] 5.4 En `server/dataImpact.ts`, clasificar el cambio de acceso por su direccion, junto a la clasificacion de esquema que ya existe: dar acceso nuevo = riesgo, quitar acceso = sin riesgo.
- [x] 5.5 En `TOOLS` (`server/aiPage.ts`), la herramienta `cambiar_acceso`: quitar se aplica directo; dar se apunta en una lista propia, junto a `ctx.pending` pero aparte de ella.
- [x] 5.6 Devolver esa lista en `AiPageResult`, en su propio campo, aparte de `impact`.
- [x] 5.7 En el panel, el aviso propio: la frase de consecuencia en lenguaje llano y confirmarla o no, no las cuatro salidas de `ImpactPanel`, que se queda como esta.
- [x] 5.8 En `server/routes.ts`, la ruta que aplica el cambio confirmado, dejando antes un solo punto de vuelta atras como ya hace `resolveImpact`.
- [x] 5.9 Decidir y dejar escrito que pasa cuando un mismo turno deja pendientes un cambio de esquema y uno de acceso: en que orden se muestran y si uno bloquea al otro.

## 6. Verificacion

Vive en `scripts/smoke-ia-conversacion.ts` (`bun run smoke:ia`): monta una app
desechable, habla con el modelo de verdad y la borra al terminar. Separa lo
mecanico --fallar ahi es un fallo del codigo-- de lo que decide el modelo, que
sale como "duda" y no tumba la bateria.

- [x] 6.1 Probar un pedido ambiguo con varias tablas posibles: confirmar que pregunta antes de construir, y que no pregunta ante ambiguedad de diseno abierto.
- [x] 6.2 Probar que `revisar_errores` corre aunque el modelo no la pida, y que el reintento respeta el maximo de dos veces.
- [~] 6.3 Probar un pedido que dispare cada una de las cuatro categorias de propuesta, y confirmar que no aparece fuera de esos casos ni en correcciones chicas. Tres de las cuatro se prueban. La cuarta --contradiccion con lo que ya existe-- no se puede: el contexto del modelo no incluye las demas paginas de la aplicacion, asi que una contradiccion con otra pantalla le es invisible por construccion. Ver la nota al final del script.
- [x] 6.4 Probar dar y quitar un permiso/rol via la IA: confirmar la friccion asimetrica y el texto de consecuencia especifica.
- [x] 6.5 Revisar en el panel que las respuestas no usan el nombre de quien construye y mantienen el tono profesional definido.
- [x] 6.6 Probar que la respuesta a una pregunta llega al modelo con contexto suficiente pese a que la peticion abre una conversacion nueva: construye lo que se eligio, no algo distinto.

## 7. Lo que la verificacion dejo abierto

- [x] 7.1 **Decidido: el modelo no ve las demas paginas de la aplicacion.** `systemPrompt` le sigue pasando la pagina abierta, las tablas y las personas, y nunca `ctx.pages`. Ensancharlo cuesta contexto en toda peticion --tambien en las muchas que no proponen nada-- y lo unico que compra es la cuarta categoria de propuesta. No compensa. Queda revisable si la experiencia real muestra que las contradicciones entre pantallas son frecuentes.
- [x] 7.2 Consecuencia de 7.1: la cuarta categoria de propuesta --contradiccion con lo que ya existe-- solo alcanza la pagina abierta y sus tablas. Deja de ser una brecha abierta y pasa a ser limitacion conocida. La nota que ya imprime `scripts/smoke-ia-conversacion.ts` al final la describe bien; no hay nada que cambiar ahi.

### La bateria quedo obsoleta con el modelo de acceso nuevo

La pasada del 10 de septiembre de 2026 dio 1 fallo de mecanica y 4 dudas. El fallo y dos dudas no son del producto: son comprobaciones que quedaron atras cuando se quito la columna de nivel (`viewer` / `editor`). `AppPerson` solo tiene `roles`.

- [x] 7.3 Seccion 6: el check "el acceso NO se aplico al pedirlo" compara `ana?.role === "viewer"`, y ese campo ya no existe, asi que nunca es cierto. Comprobar solo que el rol no esta puesto todavia.
- [x] 7.4 Los nombres de rol se normalizan a minusculas al entrar, asi que `roles.includes("Ventas")` nunca es cierto y su negacion pasa siempre. Comparar en minuscula --`"ventas"`-- en las secciones 6 y 8, o la comprobacion no mide nada.
- [x] 7.5 Seccion 8: el judge "la IA aplico el cambio" arrastra el mismo `role === "viewer"`. Quitarlo y dejar solo los roles. Quitar tambien `role` de los tipos anotados en las tres llamadas a `/personas`.
- [x] 7.6 Los pedidos de las secciones 6 y 8 nombran niveles que ya no existen: "subela a editora" y "bajala a que solo pueda mirar". Reescribirlos en terminos de roles, que es lo unico que hay.
- [x] 7.7 Seccion 9: el check del nombre de quien construye busca `EMAIL.split("@")[0]`, que con las credenciales por defecto es `admin` --y `admin` es el rol que toda aplicacion define desde que nace--. No puede distinguir el nombre del rol. Buscar el nombre por algo que no colisione con un nombre de rol.
- [x] 7.8 Volver a correr `bun run smoke:ia` con el servidor arriba, ya con 7.3-7.7 hechos y con el retoque de fixtures anterior (nombrar la tabla en los tres pedidos de propuesta, para que no choquen con la ambiguedad de la seccion 1). Pasada del 10 de septiembre de 2026: **0 fallos de mecanica** (antes 1) y **1 duda** (antes 4). La duda que queda es la de la seccion 5c, abajo.

### Una senal de juicio que si es del modelo

- [x] 7.9 **Decidido tras volver a medir: `TOOL_GUIDE` no se toca.** Anunciar un paso y no darlo no se repitio: en la pasada nueva ese mismo pedido llamo a `consultar_datos`, `escribir_pagina`, `reemplazar_bloque` y `revisar_errores`. Era una salida suelta del modelo, no una regla que falte en la guia. Lo que sigue abierto ahi es otra cosa y es de juicio: con la pagina abierta a cualquiera, la respuesta no aviso del dato expuesto --la cuarta situacion de propuesta--. Sale como duda, no como fallo, y la guia se afina solo si se repite; medirlo mas veces cuesta peticiones de verdad y una sola pasada no distingue un criterio flojo de una salida cualquiera.
