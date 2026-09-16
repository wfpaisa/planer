## Purpose

Define como se elige y se aplica el color de toda la interfaz: un unico tema compartido para el panel del constructor y para cada aplicacion publicada, con los colores de etiqueta derivados del tema.

## ADDED Requirements

### Requirement: Catalogo de temas

El sistema SHALL ofrecer una lista de temas cerrada, compartida por el panel y el servidor. La lista inicial es: light, night, retro, valentine, pastel, luxury y coffee. Toda eleccion de tema en la interfaz SHALL salir de esa lista.

#### Scenario: Ampliar el catalogo

- **WHEN** se agrega un tema nuevo a la lista compartida
- **THEN** aparece en el selector del panel y en los ajustes de cualquier aplicacion, sin mas cambios

#### Scenario: Nombre invalido rechazado

- **WHEN** se intenta guardar un tema con un nombre fuera de la lista
- **THEN** el servidor lo rechaza y no se guarda

### Requirement: Tema del panel

El constructor SHALL elegir un unico tema para el panel, aplicado de inmediato a toda la interfaz y persistido en el navegador entre sesiones. El panel SHALL NOT ofrecer ademas un interruptor de claro/oscuro ni paletas separadas: el tema lo trae todo.

#### Scenario: Elegir y recargar

- **WHEN** el constructor elige el tema retro y recarga el panel
- **THEN** el panel sigue pintado con retro

#### Scenario: Primera visita de noche

- **WHEN** un constructor entra por primera vez y su sistema prefiere modo oscuro
- **THEN** el panel arranca con el tema nocturno

### Requirement: Tema de la aplicacion

En los ajustes de la aplicacion el constructor SHALL elegir un unico tema de la misma lista. La vista previa del builder y la aplicacion publicada SHALL pintarse con ese tema, tambien para visitantes sin sesion. Una aplicacion sin tema elegido SHALL mostrarse con el tema claro.

#### Scenario: Publicada con tema

- **WHEN** un visitante abre el enlace publico de una app con tema valentine
- **THEN** toda la interfaz de la app se muestra con valentine

#### Scenario: Aplicacion sin tema

- **WHEN** se abre una aplicacion que nunca eligio tema
- **THEN** se muestra con el tema claro

### Requirement: Sin colores a mano

El sistema SHALL NOT permitir asignar colores individuales (acento, escala o paleta propia) ni al panel ni a una aplicacion: la unica eleccion de apariencia es el tema.

#### Scenario: Ajustes de apariencia

- **WHEN** el constructor abre la apariencia de una aplicacion
- **THEN** solo puede escoger un tema de la lista, sin selector de color ni paletas multiples

### Requirement: Etiquetas con colores del tema

Los valores de las columnas de lista (etiquetas) SHALL recibir su color de los ocho colores semanticos del tema activo, de forma estable: el mismo valor siempre recibe el mismo color dentro de la aplicacion. No hay paleta de etiquetas configurable.

#### Scenario: Mismo valor, mismo color

- **WHEN** la misma etiqueta aparece en dos vistas de la misma aplicacion
- **THEN** recibe el mismo color en ambas

#### Scenario: Cambio de tema

- **WHEN** la aplicacion cambia de tema
- **THEN** las etiquetas se recolorean solas con los semanticos del tema nuevo

### Requirement: Compatibilidad con datos previos

Un tema guardado con el formato anterior (acento hexadecimal, escalas con nombre o paleta propia) SHALL tratarse como si no hubiera tema, sin errores, y la aplicacion se mostrara con el tema claro. Guardar de nuevo los ajustes escribe solo el formato nuevo.

#### Scenario: Aplicacion con formato viejo

- **WHEN** se abre una aplicacion guardada con un acento hexadecimal
- **THEN** se muestra con el tema claro y no hay errores en consola ni en el servidor
