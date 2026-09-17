# ai-plan-mode Specification

## Purpose
Da al dock de IA un modo de planeación conversacional, previo a construir, para concretar una idea de pantalla antes de que la IA toque la página o las tablas.

## Requirements

### Requirement: Activar y desactivar el modo Plan

El composer del dock SHALL tener un botón para el modo Plan, junto al botón de señalar (`btn-toggle-picker`). El boton SHALL mostrar si el modo esta activo. Mientras no se haya cerrado un plan, quien construye SHALL poder apagarlo desde el mismo boton.

#### Scenario: Activar el modo Plan

- **WHEN** quien construye pulsa el boton de Plan estando apagado
- **THEN** el modo Plan queda activo para la conversacion de esa pagina

#### Scenario: Apagar el modo Plan antes de cerrarlo

- **WHEN** quien construye pulsa el boton de Plan estando activo, sin haber cerrado un plan todavia
- **THEN** el modo Plan queda apagado y la siguiente peticion se comporta como hoy

### Requirement: En modo Plan la IA no construye

Mientras el modo Plan este activo, la IA SHALL poder conversar, preguntar, leer la pagina abierta y consultar las tablas de la aplicacion, y SHALL NO llamar ninguna herramienta que modifique la pagina o las tablas.

#### Scenario: Pedir un cambio en modo Plan

- **WHEN** quien construye esta en modo Plan y pide una pantalla nueva
- **THEN** la IA conversa y pregunta lo que necesite
- **AND** la pagina y las tablas de la aplicacion no cambian

### Requirement: El plan se queda en una sola pagina

Un plan SHALL cubrir unicamente la pagina abierta. Cuando el plan necesite navegacion entre partes de la pantalla, SHALL resolverla con pestanas o con secciones que se muestran y esconden dentro de esa misma pagina, nunca creando ni modificando otras paginas.

#### Scenario: Un plan que necesita varias vistas

- **WHEN** la idea concretada en el plan pide separar la informacion en mas de una vista
- **THEN** el plan describe pestanas o secciones que se muestran y esconden en la pagina abierta
- **AND** no propone crear ni tocar otra pagina de la aplicacion

### Requirement: Cierre del plan

Un plan SHALL cerrarse de una de dos formas: la IA lo cierra cuando ya no tiene mas preguntas sobre la idea, o quien construye da la orden de implementar en cualquier momento, aunque la IA todavia tenga preguntas abiertas.

#### Scenario: La IA termina de concretar la idea

- **WHEN** la IA ya no tiene mas preguntas sobre lo que se esta planeando
- **THEN** cierra el plan y lo presenta para pasar a construir

#### Scenario: Quien construye corta el plan antes de tiempo

- **WHEN** quien construye ordena implementar mientras la IA todavia esta preguntando
- **THEN** el plan se cierra con lo concretado hasta ese momento
- **AND** queda listo para pasar a construir

### Requirement: El plan cerrado se presenta en el hilo

Un plan cerrado SHALL aparecer en el hilo de la conversacion como un mensaje distinguible del resto --con icono y estilo propios--, y SHALL ofrecer la opcion de pasar a modo Implementador.

#### Scenario: Ver un plan recien cerrado

- **WHEN** un plan se cierra
- **THEN** aparece en el hilo un mensaje de plan, distinto de una respuesta normal
- **AND** ese mensaje ofrece pasar a modo Implementador

### Requirement: La transicion a Implementador es de un solo sentido

Al pasar a modo Implementador desde un plan cerrado, el modo Plan SHALL apagarse para esa conversacion y la IA SHALL construir con el mismo alcance que tiene hoy fuera del modo Plan. El plan ya cerrado SHALL seguir visible en el hilo, SHALL NO poder editarse ni reabrirse. Planear otra cosa SHALL requerir activar el modo Plan de nuevo, lo que abre un plan distinto.

#### Scenario: Pasar a construir desde un plan cerrado

- **WHEN** quien construye elige implementar el plan cerrado
- **THEN** la IA empieza a construir sobre la pagina con las herramientas que ya existen
- **AND** el modo Plan queda apagado para esa conversacion

#### Scenario: Intentar volver a un plan ya implementado

- **WHEN** ya se eligio implementar un plan
- **THEN** ese plan sigue visible en el hilo pero no se puede editar ni reabrir
- **AND** para planear algo nuevo hay que activar el modo Plan otra vez
