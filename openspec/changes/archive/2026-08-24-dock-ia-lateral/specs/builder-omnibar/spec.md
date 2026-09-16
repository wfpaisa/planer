## REMOVED Requirements

### Requirement: La barra es solo para quien construye

**Reason**: La superficie flotante deja de existir. La regla se conserva en `builder-ai-dock`, aplicada al dock.

**Migration**: Ninguna. El dock tampoco se muestra a un visitante.

### Requirement: Contenido de la barra

**Reason**: Describia una fila de botones --publicar, compartir, los ajustes de la aplicacion y los de la pagina-- que nunca salio de la barra superior ni de los ajustes de la pagina. Con la barra retirada, la lista no describe nada.

**Migration**: Publicar y las personas siguen en la barra superior; los ajustes de la pagina, en su propio dialogo. Nada cambia de sitio con este cambio.

### Requirement: Posicion segun el contenido de la pagina

**Reason**: La barra se colocaba centrada con la pagina en blanco y anclada abajo con contenido. El dock vive siempre a la izquierda, asi que no hay posicion que decidir.

**Migration**: Ninguna.

### Requirement: Dos iconos de ajustes con dueno claro

**Reason**: Los dos iconos nunca llegaron a la barra. Los ajustes de la aplicacion viven en la barra superior y los de la pagina en su propio dialogo.

**Migration**: Ninguna. Nada se mueve.

### Requirement: Historiales con nombres distintos

**Reason**: La regla es buena y sobrevive, pero deja de ser de la barra.

**Migration**: Pasa a `builder-ai-dock` con el mismo texto.

### Requirement: Compartir ofrece los dos enlaces con su alcance

**Reason**: Compartir nunca llego a la barra.

**Migration**: Ninguna. Compartir se queda donde esta.

### Requirement: La barra sigue la paleta de la aplicacion

**Reason**: Deja de haber barra a la que aplicarle la paleta.

**Migration**: Pasa a `builder-ai-dock`, aplicada al dock.

### Requirement: El viaje no se rompe sin la animacion

**Reason**: Describia el crecimiento animado de la pildora y su comportamiento sin animacion. Sin pildora no hay viaje.

**Migration**: Ninguna. El dock aparece y desaparece, no viaja.

### Requirement: La barra se transforma en su sitio

**Reason**: Es la definicion misma de la pildora que se retira.

**Migration**: Ninguna. El contenido pasa al dock, que no crece ni se encoge.

### Requirement: Publicar vive en la barra

**Reason**: Publicar nunca salio de la barra superior.

**Migration**: Ninguna. Publicar se queda en la barra superior.

### Requirement: La conversacion con la IA vive dentro de la barra

**Reason**: La conversacion pasa al dock.

**Migration**: Sustituida por "La IA vive en una columna propia" en `builder-ai-dock`.

### Requirement: El codigo y los cambios viven dentro de la barra

**Reason**: Nunca salieron de los ajustes de la pagina.

**Migration**: Ninguna. Siguen abriendose desde los ajustes de la pagina.

### Requirement: El aviso de impacto en los datos vive dentro de la barra

**Reason**: El aviso pasa al dock, encadenado a la conversacion igual que antes.

**Migration**: Sustituida por "El aviso de impacto en los datos vive en el dock" en `builder-ai-dock`.

### Requirement: Una sola cosa abierta a la vez

**Reason**: La regla existia porque la barra solo podia crecer a un estado. El dock muestra la conversacion y, encadenado, el aviso de impacto; no hay N superficies compitiendo.

**Migration**: Ninguna.

### Requirement: Borrar sigue preguntando aparte

**Reason**: La regla sobrevive, pero deja de ser de la barra.

**Migration**: Pasa a `builder-ai-dock` con el mismo texto.
