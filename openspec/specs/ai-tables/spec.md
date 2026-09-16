# ai-tables Specification

## Purpose
Qué tablas y qué columnas puede crear la IA por su cuenta, con qué datos las crea y qué conversiones no le corresponden a ella. Es lo que decide si las tablas que salen de una conversación nacen enlazadas entre sí o sueltas.

## Requirements

### Requirement: La IA crea columnas que apuntan a otra tabla

La IA SHALL poder crear columnas de tipo relación, tanto al crear una tabla como al añadir columnas a una que ya existe. La tabla destino SHALL nombrarse igual que en las demás órdenes: por su nombre técnico, el mismo que la IA recibe en el contexto y el que se le devuelve al crear una tabla.

La tabla de personas de la aplicación SHALL poder elegirse como destino, como cualquier otra tabla. El sistema SHALL NO ofrecer un tipo de columna aparte para apuntar a personas.

Una relación cuyo destino no sea una tabla de la aplicación SHALL rechazarse diciendo que esa tabla no existe.

#### Scenario: Una tabla nueva que apunta a otra

- **WHEN** se le pide a la IA una tabla de pedidos con el cliente de cada pedido, y la aplicación ya tiene una tabla de clientes
- **THEN** la tabla de pedidos nace con una columna que apunta a la tabla de clientes

#### Scenario: Apuntar a las personas de la aplicación

- **WHEN** se le pide a la IA una tabla donde cada fila pertenece a una persona invitada
- **THEN** la columna nace apuntando a la tabla de personas, con las mismas reglas que cualquier otra relación

#### Scenario: El destino todavía no existe

- **WHEN** la IA pide una relación hacia una tabla que no está en la aplicación
- **THEN** la orden se rechaza diciendo que esa tabla no existe, y la IA puede crearla y volver a intentarlo

### Requirement: Qué enseña la columna de relación

La IA SHALL poder declarar qué columna de la tabla destino se enseña en la celda, nombrándola por su nombre técnico. Cuando no la declare, SHALL usarse la primera columna única del destino.

Una columna declarada que no exista en el destino SHALL rechazarse diciendo cuál es.

#### Scenario: La IA elige la columna que se enseña

- **WHEN** la IA crea una relación hacia personas declarando que se enseña el documento
- **THEN** la celda enseña el documento y empareja por él

#### Scenario: La IA no la declara

- **WHEN** la IA crea una relación sin decir qué columna se enseña
- **THEN** se usa la primera columna única del destino

### Requirement: Un destino sin llave no admite relación

Una relación hacia una tabla que no tenga ninguna columna que sirva de llave SHALL rechazarse. El mensaje SHALL decir que hay que añadirle antes al destino una columna marcada como única, para que la IA pueda corregirlo sin ayuda.

La orden completa SHALL NO aplicarse: ni la tabla ni las demás columnas que pedía SHALL crearse. Crear la tabla sin la columna rechazada dejaría una tabla equivocada sin que nadie lo diga.

#### Scenario: El destino no tiene ninguna columna única

- **WHEN** la IA pide una relación hacia una tabla sin columnas únicas
- **THEN** no se crea nada y la respuesta dice que hay que añadirle una columna marcada como única

#### Scenario: La IA corrige y reintenta

- **WHEN** la IA le añade al destino una columna marcada como única y vuelve a pedir la misma tabla
- **THEN** la tabla se crea con su columna de relación

### Requirement: La marca de columna única que pone la IA se conserva

Una columna que la IA marque como única SHALL guardarse marcada. SHALL quedar disponible como llave, con las mismas reglas que una columna marcada desde el panel: sirve para emparejar al importar y para que otras tablas la apunten.

#### Scenario: La IA marca la columna que identifica

- **WHEN** la IA crea una tabla de empleados marcando la cédula como única
- **THEN** la tabla queda con esa columna marcada, y otra tabla puede apuntarla por ella

### Requirement: Convertir una columna existente a relación no le corresponde a la IA

La IA SHALL NO poder pedir que una columna que ya existe pase a ser de tipo relación. La petición SHALL rechazarse aunque el tipo llegue, y SHALL NO archivarse ningún cambio pendiente para el diálogo de impacto.

El mensaje SHALL decir que la conversión se hace desde el panel. Convertir conserva los valores que ya están guardados, y eso lo resuelve el camino del constructor.

#### Scenario: La IA pide convertir una columna de texto

- **WHEN** la IA pide cambiar a relación el tipo de una columna que ya existe
- **THEN** la petición se rechaza y no queda ningún cambio esperando autorización

#### Scenario: Los demás cambios de tipo siguen igual

- **WHEN** la IA pide cambiar una columna de texto a número
- **THEN** el cambio se archiva y lo autoriza el constructor, como hasta ahora
