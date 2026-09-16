# html-bloques Specification

## Purpose
Da a cada bloque del HTML de una pagina un nombre estable en `data-plane`, para que la IA pueda leerlo, reemplazarlo, insertarlo o quitarlo sin tocar el resto del documento.

## Requirements

### Requirement: Un bloque se nombra en el propio HTML

Un elemento del documento SHALL poder llevar un nombre estable en el atributo `data-plane`. Ese nombre SHALL ser unico dentro del documento y SHALL sobrevivir a que se edite cualquier otra parte de la pagina.

El nombre SHALL ser legible: describe lo que el bloque es, no un codigo. Quien abre "Codigo HTML" SHALL poder leerlo y entenderlo.

#### Scenario: Un bloque recibe su nombre

- **WHEN** la IA edita por primera vez la seccion que lista los clientes
- **THEN** esa seccion queda con un nombre legible en `data-plane`
- **AND** ese nombre sigue ahi al editar otras partes de la pagina

#### Scenario: Leer el codigo de la pagina

- **WHEN** quien construye abre el codigo HTML de una pagina con bloques nombrados
- **THEN** los nombres se leen y se entiende a que se refiere cada uno

### Requirement: El servidor garantiza que el nombre no se repita

La IA SHALL proponer el nombre de un bloque. El servidor SHALL comprobar que no exista ya en el documento y, si existe, SHALL derivar uno libre en vez de rechazar la operacion o pisar el bloque anterior.

#### Scenario: La IA propone un nombre ya usado

- **WHEN** la IA propone para un bloque nuevo un nombre que ya tiene otro
- **THEN** el bloque nuevo se guarda con un nombre derivado que esta libre
- **AND** el bloque que ya existia conserva el suyo

### Requirement: Solo se nombra lo que se toca

El sistema SHALL NO estampar nombres por adelantado sobre un documento. Un elemento SHALL recibir su nombre en el momento en que la IA lo edita por primera vez.

#### Scenario: Una pagina que nadie ha editado por partes

- **WHEN** se mira el HTML de una pagina que la IA solo ha escrito entera
- **THEN** no lleva ningun `data-plane` que nadie haya pedido

#### Scenario: Traer un HTML de fuera

- **WHEN** se adopta en una pagina un HTML escrito fuera de Planer
- **THEN** entra tal cual, sin nombres
- **AND** los va recibiendo a medida que la IA edita sus partes

### Requirement: Perder el nombre no es editar

Una operacion que reemplace un bloque SHALL conservar su `data-plane`. Si lo que devuelve la IA no lo lleva, el sistema SHALL reponerlo antes de guardar o SHALL rechazar la operacion explicando por que.

#### Scenario: La IA devuelve el bloque sin su nombre

- **WHEN** la IA reemplaza un bloque y el HTML que devuelve no lleva `data-plane`
- **THEN** el bloque guardado conserva el nombre que tenia
- **AND** las referencias a ese bloque siguen valiendo

### Requirement: Se puede leer, reemplazar, insertar y quitar un bloque

El sistema SHALL ofrecer, sobre un bloque nombrado: leer su HTML tal cual esta, reemplazarlo por otro, insertar un bloque nuevo antes o despues de el, y quitarlo del documento.

Cada una de esas operaciones SHALL dejar intacto todo lo que no sea el bloque nombrado.

#### Scenario: Reemplazar un bloque

- **WHEN** se reemplaza el bloque de la lista de clientes
- **THEN** el resto del documento queda byte a byte como estaba

#### Scenario: Insertar un bloque

- **WHEN** se inserta un buscador justo antes de la lista de clientes
- **THEN** el buscador aparece en ese sitio
- **AND** la lista de clientes no cambia

#### Scenario: Pedir un bloque que no existe

- **WHEN** se pide un bloque con un nombre que el documento no tiene
- **THEN** la operacion falla explicando que ese nombre no esta
- **AND** el documento no cambia

### Requirement: Editar un trozo queda registrado como un cambio de la pagina

Una edicion parcial SHALL guardarse como un cambio de la pagina igual que una reescritura completa, para que se pueda ver y deshacer desde "Cambios".

#### Scenario: Deshacer una edicion parcial

- **WHEN** quien construye deshace una edicion que solo toco un bloque
- **THEN** la pagina vuelve a como estaba antes de esa edicion
