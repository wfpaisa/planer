## ADDED Requirements

### Requirement: El sidebar dice en que pagina esta trabajando la IA

Mientras la IA trabaje en una pagina, la fila de esa pagina en el sidebar SHALL indicarlo. Elegir esa fila SHALL llevar a esa pagina, como cualquier otra.

La marca SHALL desaparecer cuando la peticion termine, y SHALL NO quedarse encendida si la peticion deja de existir por cualquier motivo.

#### Scenario: Ver desde otra pagina que la IA trabaja

- **WHEN** la IA esta trabajando en una pagina y quien construye esta en otra
- **THEN** el sidebar marca la fila de la pagina donde trabaja

#### Scenario: Volver a la pagina que trabaja

- **WHEN** quien construye elige la fila marcada
- **THEN** se abre esa pagina
- **AND** ve el avance de la peticion

#### Scenario: La peticion termina

- **WHEN** la peticion termina
- **THEN** la fila deja de estar marcada

#### Scenario: El servidor pierde la peticion

- **WHEN** la peticion deja de existir en el servidor sin haber entregado nada
- **THEN** la fila deja de estar marcada
