## 1. La marca de columna única deja de perderse

- [x] 1.1 Copiar `unique` al traducir lo que propone la IA a columnas, junto a lo que ya se copia.
- [x] 1.2 Comprobar con el servidor arriba que una tabla creada por la IA con una columna marcada queda con su índice único, y que marcarla no falla sobre una tabla con filas.

## 2. La IA puede crear columnas de relación

- [x] 2.1 Añadir `relation` al listado de tipos que ve la IA al crear columnas, con el texto que dice cuándo usarlo y que la tabla de personas es un destino más.
- [x] 2.2 Añadir al esquema de una columna `relationTable` (nombre técnico del destino) y `displayColumn` (opcional, la columna del destino que se enseña).
- [x] 2.3 Pasar las tablas de la aplicación a la función que traduce las columnas, y resolver ahí el nombre técnico del destino a su identificador.
- [x] 2.4 Rellenar `displayField` con lo declarado, o con la primera columna que sirva de llave en el destino cuando no se declare.
- [x] 2.5 Comprobar que una relación creada así se ve y se escribe en la cuadrícula igual que una creada desde el panel.

## 3. Los rechazos

- [x] 3.1 Rechazar la orden entera cuando el destino no existe, sin crear ninguna tabla ni ninguna columna, diciendo qué tabla se nombró.
- [x] 3.2 Rechazar la orden entera cuando el destino no tiene ninguna columna que sirva de llave, diciendo que hay que marcar una columna única en esa tabla. Usar las columnas que pueden servir de llave, no la marca: la tabla de personas no la lleva.
- [x] 3.3 Rechazar la orden entera cuando la columna declarada como la que se enseña no existe en el destino, diciendo cuál se nombró.
- [x] 3.4 Comprobar que ninguno de los tres rechazos deja aviso en el panel, y que la orden sí aparece en el detalle de lo que la IA hizo.

## 4. Convertir a relación no le corresponde a la IA

- [x] 4.1 Rechazar en el ejecutor de la orden que un cambio de tipo pida `relation`, diciendo que la conversión se hace desde el panel.
- [x] 4.2 Dejar `relation` fuera del listado de tipos de esa orden.
- [x] 4.3 Comprobar que no queda ningún cambio esperando autorización, y que un cambio de tipo corriente sigue archivándose igual.

## 5. Cobertura

- [x] 5.1 Cubrir la creación de tablas por la IA, que hoy no se ejerce en ninguna prueba: una tabla con una columna marcada como única y una tabla que apunta a otra.
- [x] 5.2 Cubrir que la IA se recupera sola de un rechazo dentro de la misma petición: pide una relación hacia una tabla sin llave, marca la llave y vuelve a pedirla.
- [x] 5.3 Cubrir que apuntar a la tabla de personas funciona sin marcar nada, y que la columna que se enseña puede ser el documento y no el correo.
- [x] 5.4 Cubrir que un cambio de tipo a relación se rechaza y no archiva nada.

## 6. Cierre

- [x] 6.1 `bun run typecheck`, `bun run lint` y `bunx prettier --check .` limpios.
- [x] 6.2 `bun run docs` y las tres baterías de humo con el servidor arriba.
- [x] 6.3 Pedir a mano en el panel una tabla que dependa de otra y confirmar que sale enlazada, sin tocar nada después.

> Se corrió como guion contra un servidor vivo, por el mismo endpoint que usa el panel y con la IA de verdad: se pidió llevar los pedidos de unos clientes con su NIT, y salieron dos tablas con la columna de pedidos apuntando a clientes y enseñando el NIT, que nació marcado como llave. Lo que no cubre es el clic.
