## MODIFIED Requirements

### Requirement: El aviso es instantaneo y el detalle se pide

El dialogo de impacto SHALL mostrarse sin espera, nombrando solo las paginas afectadas. El detalle de para que usa cada pagina lo que se va a cambiar SHALL consultarse solo cuando quien construye lo pide, y SHALL redactarse con tildes y ñ correctos, igual que el resto de los textos que ve quien construye.

#### Scenario: Abrir el dialogo

- **WHEN** se abre el dialogo de impacto
- **THEN** aparece de inmediato con la lista de paginas afectadas

#### Scenario: Pedir el detalle de una pagina

- **WHEN** quien construye pide el detalle de una de las paginas afectadas
- **THEN** la IA lo consulta en ese momento y lo responde en el mismo dialogo
- **AND** la respuesta usa tildes y ñ correctos
