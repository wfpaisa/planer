## ADDED Requirements

### Requirement: Los cambios de permisos y roles se clasifican por riesgo

El sistema SHALL clasificar todo cambio de permiso o rol que la IA necesite en dos grupos. Sin riesgo: quitar un permiso o retirar un rol. Con riesgo: dar un permiso nuevo o asignar un rol que amplia lo que alguien puede ver o hacer.

#### Scenario: La IA necesita dar acceso nuevo

- **WHEN** la IA necesita darle a alguien un permiso o un rol que no tenia
- **THEN** se abre el aviso de riesgo antes de aplicarlo

#### Scenario: La IA necesita quitar acceso

- **WHEN** la IA necesita quitarle a alguien un permiso o un rol
- **THEN** el cambio se aplica sin preguntar

### Requirement: El aviso de un cambio de permisos describe la consecuencia especifica

El aviso de riesgo por permisos SHALL describir en una frase, en lenguaje llano, que podra ver o hacer la persona afectada a partir del cambio. SHALL NO limitarse a un boton generico de autorizar. Quien construye SHALL confirmar esa frase, no una accion abstracta, para que el cambio se aplique.

#### Scenario: Dar un rol que ve mas datos

- **WHEN** la IA necesita darle a alguien un rol que le permite ver los pedidos de todos los clientes
- **THEN** el aviso dice explicitamente que esa persona podra ver los pedidos de todos los clientes, no solo los propios
- **AND** quien construye confirma esa frase para que el cambio se aplique

#### Scenario: Sin confirmar, no se aplica

- **WHEN** quien construye no confirma el aviso
- **THEN** el permiso o el rol no cambian
