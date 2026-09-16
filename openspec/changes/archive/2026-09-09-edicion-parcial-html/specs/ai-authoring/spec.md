## MODIFIED Requirements

### Requirement: La IA recibe el contexto de la pagina

Cada peticion SHALL mandar a la IA el contexto armado en ese momento, con los colores, espaciados, tablas, ordenes, quien esta mirando y los limites.

Cuando quien construye haya senalado uno o mas elementos del documento, la peticion SHALL llevarlos ademas como contexto: donde estan y el HTML que tienen ahora.

#### Scenario: Peticion despues de cambiar una tabla

- **WHEN** se cambia una tabla y a continuacion se le pide algo a la IA
- **THEN** la IA trabaja con la tabla tal como quedo

#### Scenario: Peticion con un elemento senalado

- **WHEN** quien construye senala un elemento y pide un cambio sobre el
- **THEN** la IA recibe ese elemento con la peticion
- **AND** no necesita releer la pagina entera para saber cual es

## ADDED Requirements

### Requirement: La IA edita trozos en vez de rehacer la pagina

La IA SHALL poder leer un bloque nombrado, reemplazarlo, insertar uno nuevo antes o despues de el, y quitarlo, sin tocar el resto del documento.

Rehacer la pagina entera SHALL seguir siendo posible, para cuando de verdad se necesita. El contexto SHALL empujar a la IA a preferir el bisturi cuando el cambio es localizado, y a decir por que cuando rehace la pagina entera.

#### Scenario: Un cambio pequeno sobre una pagina grande

- **WHEN** se le pide a la IA cambiar el titulo de una seccion de una pagina larga
- **THEN** edita solo esa seccion
- **AND** el resto de la pagina no se vuelve a generar

#### Scenario: Un cambio que sí necesita rehacer

- **WHEN** se le pide a la IA rehacer la pantalla completa con otra estructura
- **THEN** puede reescribir el documento entero
- **AND** dice que lo hizo asi

#### Scenario: Anadir algo a lo que ya existe

- **WHEN** se le pide un buscador sobre una lista que ya esta construida
- **THEN** lo inserta junto a esa lista
- **AND** la lista sigue tal como estaba
