## MODIFIED Requirements

### Requirement: El sidebar solo lista lo que se puede abrir

El sidebar SHALL listar a cada persona unicamente las paginas que tiene permiso de abrir, segun lo que la aplicacion exija --cuenta o no-- y los roles que cada pagina tenga marcados.

#### Scenario: Visitante sin un rol

- **WHEN** un visitante sin el rol `ventas` abre la aplicacion y hay una pagina que tiene marcado ese rol
- **THEN** esa pagina no aparece en su sidebar

#### Scenario: Visitante sin cuenta en una aplicacion publica

- **WHEN** alguien sin cuenta abre una aplicacion publica que tiene paginas con roles marcados
- **THEN** el sidebar solo lista las paginas que tienen `Todos` marcada

#### Scenario: El constructor las ve todas

- **WHEN** quien construye abre la aplicacion
- **THEN** el sidebar lista todas las paginas, con los roles que cada una admite a la vista
