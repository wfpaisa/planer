## Context

Ver `proposal.md` — Why.

Lo que condiciona el diseño:

- Las órdenes que ejecuta la IA le devuelven un texto que ella lee antes de decidir la siguiente. Un rechazo no es un error del sistema: es una respuesta con la que puede corregir dentro de la misma petición, que dispone de doce vueltas.
- Crear una columna de relación ya funciona por el camino del constructor. Necesita el identificador de la tabla destino y, para servir de algo, saber qué columna del destino se enseña. Sin identificador la creación falla en la base.
- La función que traduce lo que propone la IA a columnas es hoy pura: recibe el JSON y no tiene delante las tablas de la aplicación, así que no puede resolver un nombre de tabla a su identificador.
- La marca de columna única se le pide a la IA en el esquema y esa función la descarta. Nunca la copió.

## Goals / Non-Goals

**Goals:**

- Que las tablas que salgan de una conversación nazcan enlazadas cuando el pedido lo pide.
- Que un rechazo deje a la IA en condiciones de corregir sola, sin intervención del constructor.

**Non-Goals:**

- Convertir columnas existentes. Ver `specs/ai-tables/spec.md`.
- Relaciones de varios valores. La IA crea columnas de un solo valor, que es lo que el resto del sistema trata como relación.
- Cambiar el diálogo de impacto o su clasificación por riesgo.

## Decisions

### D1. El destino se nombra por su nombre técnico, no por su identificador

La IA nombra tablas por su nombre técnico en todas las demás órdenes, y es lo que recibe en el contexto y lo que se le devuelve al crear una tabla. Pedirle el identificador la obligaría a un dato que no tiene delante.

La traducción de nombre a identificador pasa a hacerse donde se traduce la columna, que para eso necesita las tablas de la aplicación. Es el único cambio de forma en esa función: deja de ser pura.

Alternativa descartada: aceptar también la etiqueta visible. Dos tablas pueden compartirla —`uniqueTableName` lo permite a propósito— y entonces el destino sería ambiguo. La búsqueda por nombre técnico es exacta.

### D2. Una tabla creada en la misma petición se puede apuntar, en orden

`crear_tabla` devuelve el nombre técnico de lo que acaba de crear. Una segunda tabla puede apuntar a la primera dentro de la misma petición nombrándola así.

Al revés no: apuntar a algo que todavía no existe se rechaza como cualquier destino inexistente, y la IA reordena. No se guardan relaciones pendientes de resolver. Una relación a medio hacer es una columna que no se puede escribir ni leer, y el estado intermedio tendría que sobrevivir a que la petición se corte.

### D3. La columna que se enseña es opcional y cae a la primera columna única

Es el respaldo que el sistema ya aplica a las columnas anteriores al cambio anterior, así que no se inventa comportamiento. La IA la declara cuando importa —una tabla de personas donde lo que se escribe es el documento y no el correo— y la omite cuando el destino tiene una sola llave, donde la respuesta es forzosa.

### D4. Un destino sin llave rechaza la orden entera

Sin columna única en el destino, la relación no tiene qué enseñar ni con qué emparejar. Podría crearse igual y quedar en blanco.

Se rechaza, y se rechaza la orden completa: ni la tabla ni sus demás columnas. Crear la tabla sin la columna rechazada deja una tabla equivocada y nadie lo dice; la IA seguiría construyendo la pantalla encima.

El mensaje dice qué hacer —añadirle una columna marcada como única—, no solo que falló. Marcar una columna que ya existe no es algo que la IA pueda hacer: no hay orden para eso, y darle una entra en terreno del diálogo de impacto. Añadir una sí, y es lo que resuelve el caso. Un mensaje que no dice el siguiente paso gasta vueltas en adivinar.

La tabla de personas es la excepción conocida: sus columnas sirven de llave sin la marca de únicas, porque llegan importando la nómina y nadie vuelve a marcarlas. La comprobación usa las columnas que pueden servir de llave, no la marca.

### D5. La marca de única se copia, y se comprueba que sirva de algo

Copiarla es una línea. Lo que hay que decidir es qué pasa con la columna única de una tabla que ya tiene filas: el índice que la impone no cuenta las celdas vacías, así que marcarla sobre filas existentes no falla. No hace falta nada especial.

### D6. La conversión a relación se rechaza en el ejecutor, no solo en el listado de tipos

El listado de tipos que ve la IA es una restricción del modelo, no una comprobación. El guardia que hay hoy acepta cualquier tipo que exista, incluido relación, así que un tipo que llegue igual archivaría una petición sin destino que revienta al aplicarse.

El rechazo va en el ejecutor de la orden. Cierra ese camino, exista o no el tipo en el listado.

### D7. Un rechazo del que la IA se recupera no deja aviso en el panel

Los avisos del panel cuentan lo que se aplicó. Un rechazo no aplicó nada, y la IA lo corrige sola en la vuelta siguiente: anunciarlo describe un problema que ya no existe cuando el constructor lo lee.

Lo que sí queda visible es la orden en el detalle de lo que la IA hizo, que es donde se mira cuando algo salió raro.

## Risks / Trade-offs

- La IA se atasca reintentando y gasta las doce vueltas → los mensajes dicen el siguiente paso concreto, y cada uno nombra la tabla o la columna que falta.
- La IA marca como única una columna que se repite en la vida real —un cargo, una ciudad— y la importación posterior falla → el constructor puede desmarcarla desde el panel, y el texto que se le da a la IA acota la marca a las columnas que identifican a alguien.
- La IA crea relaciones donde bastaba un texto, y aparecen columnas sin enlace → el destino tiene que existir y tener llave, que es lo que hoy separa una relación real de un texto con forma de código.

## Migration Plan

No hay. Nada guardado cambia de forma, y las tablas que la IA creó antes siguen como están: sin llave y sin relaciones, igual que ahora. Marcarlas es trabajo del panel, no de este cambio.
