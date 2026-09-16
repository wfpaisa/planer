## MODIFIED Requirements

### Requirement: Lo senalado es un badge de la conversacion

Cada elemento senalado SHALL aparecer como un badge dentro de la conversacion, con un nombre legible que permita saber a que se refiere. Un badge SHALL poder quitarse antes de enviar, sin que se pierda el texto ya escrito.

Al enviar la peticion, el nombre legible de cada elemento senalado SHALL quedar en la burbuja de esa peticion, y SHALL seguir ahi al volver a abrir la conversacion mas tarde. El HTML del elemento SHALL NO guardarse en la conversacion.

#### Scenario: Señalar y describir lo que se quiere

- **WHEN** quien construye senala una tabla y escribe "agrega una columna de telefono"
- **THEN** la peticion viaja con esa tabla como contexto
- **AND** el badge dice de que elemento se trata

#### Scenario: Quitar lo senalado

- **WHEN** quien construye quita el badge de un elemento senalado
- **THEN** ese elemento deja de ir en la peticion
- **AND** lo que llevaba escrito sigue intacto

#### Scenario: Despues de enviar

- **WHEN** quien construye envia una peticion con dos elementos senalados
- **THEN** la burbuja de esa peticion nombra los dos
- **AND** el campo de texto queda sin badges para la siguiente
