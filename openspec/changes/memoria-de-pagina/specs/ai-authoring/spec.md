## MODIFIED Requirements

### Requirement: La IA recibe el contexto de la pagina

Cada peticion SHALL mandar a la IA el contexto armado en ese momento, con los colores, espaciados, tablas, ordenes, quien esta mirando y los limites.

La peticion SHALL llevar ademas la memoria de la pagina: las reglas funcionales que se guardaron de pedidos anteriores. Ver `page-memory`.

Cuando quien construye haya senalado uno o mas elementos del documento, la peticion SHALL llevarlos ademas como contexto: donde estan y el HTML que tienen ahora.

#### Scenario: Peticion despues de cambiar una tabla

- **WHEN** se cambia una tabla y a continuacion se le pide algo a la IA
- **THEN** la IA trabaja con la tabla tal como quedo

#### Scenario: Peticion con un elemento senalado

- **WHEN** quien construye senala un elemento y pide un cambio sobre el
- **THEN** la IA recibe ese elemento con la peticion
- **AND** no necesita releer la pagina entera para saber cual es

#### Scenario: Peticion en una conversacion recien empezada

- **WHEN** quien construye empieza una conversacion nueva y pide un cambio
- **THEN** la IA recibe la memoria de la pagina aunque no reciba ningun turno anterior

### Requirement: Preguntar antes de construir se limita a elegir entre lo que ya existe

La IA SHALL preguntar antes de construir solo cuando la ambiguedad se resuelve eligiendo entre opciones que ya existen en la aplicacion (por ejemplo, entre varias tablas), o cuando lo pedido contradice una regla guardada en la memoria de la pagina. La IA SHALL NO preguntar por decisiones de diseno abierto (como se ve, que columnas, que orden): esas se resuelven mostrando un primer resultado.

Una contradiccion con la memoria no es una decision de diseno abierto: la opcion ya existe --es la regla guardada-- y lo que se pregunta es si se reemplaza. Ver `page-memory`.

#### Scenario: Pedido ambiguo con varias tablas posibles

- **WHEN** quien construye pide un dashboard y la aplicacion tiene mas de una tabla que podria ser la fuente
- **THEN** la IA pregunta cual de las tablas existentes usar antes de construir

#### Scenario: Pedido ambiguo de diseno

- **WHEN** quien construye pide una pantalla sin decir que columnas o que orden
- **THEN** la IA construye un primer resultado en vez de preguntar

#### Scenario: Pedido que contradice la memoria

- **WHEN** la memoria de la pagina dice que solo los auxiliares crean citas y quien construye pide que los recepcionistas tambien puedan
- **THEN** la IA pregunta si se cambia esa regla antes de tocar la pagina
