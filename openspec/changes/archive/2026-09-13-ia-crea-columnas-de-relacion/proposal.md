## Why

La IA construye tablas sueltas. No puede crear una columna que apunte a otra tabla --el cambio `relacion-automatica-con-personas` quito el tipo `person` y no puso `relation` en su lugar--, asi que cualquier vinculo hay que anadirlo despues a mano.

Debajo hay algo que ya fallaba antes: al crear una columna se le pide a la IA que marque como unica la que identifica --la cedula, la placa, el codigo-- y esa marca se descarta al guardar. Ninguna tabla que crea la IA tiene llave. Sin llave no hay relacion posible: la columna que apunta no tendria que ensenar ni con que emparejar.

## What Changes

- La IA puede crear columnas de tipo relacion, apuntando a cualquier tabla de la aplicacion, incluida la de personas.
- Al crear una relacion la IA nombra la tabla destino por su nombre tecnico, el mismo con el que nombra tablas en las demas ordenes.
- La IA puede declarar que columna del destino se ensena. Si no la declara, se usa la primera columna unica del destino.
- Una relacion hacia una tabla sin ninguna columna unica se rechaza, con un mensaje que le dice a la IA que marque la llave en el destino.
- La marca de columna unica que pone la IA deja de perderse al guardar.
- La IA no puede pedir convertir a relacion una columna que ya existe. Se rechaza de forma explicita, no solo por el listado de tipos que ve.
- Se anade cobertura automatica de la creacion de tablas por la IA, que hoy no existe.

## Capabilities

### New Capabilities

- `ai-tables`: que tablas y que columnas puede crear la IA, y con que datos. Cubre los tipos que se le ofrecen, la marca de columna unica, el destino y la columna que ensena de una relacion, y que conversiones no le corresponden a ella.

### Modified Capabilities

Ninguna. Hoy no hay ningun requisito que describa las columnas que crea la IA: `data-impact` clasifica sus cambios de estructura por riesgo sin entrar en los tipos, y `ai-authoring` no habla de tablas.

## Impact

- `server/aiPage.ts`: la lista de tipos que ve la IA, el esquema de una columna, `normalizeFieldDefs` --que pasa a necesitar las tablas de la aplicacion para resolver el destino-- y el guardia de `cambiar_tipo_columna`.
- `scripts/`: cobertura nueva de creacion de tablas por la IA.
- Sin cambios en el panel ni en la base: crear una columna de relacion ya funciona por el camino del constructor, y es el que se reutiliza.
