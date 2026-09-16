## REMOVED Requirements

### Requirement: Renombrar una columna corrige los bloques

**Reason**: Los bloques se retiran. Una pagina declara sus tablas guardando la identidad interna de cada columna, no su nombre, asi que renombrar ya no obliga a corregir nada.

**Migration**: Ver `html-pages`, requisito "Renombrar una columna no rompe la pagina".

### Requirement: Revision de referencias

**Reason**: Los bloques se retiran. La deteccion pasa de ser una revision posterior a un aviso previo: el sistema mira que paginas declaran una tabla antes de dejar que se borre o se cambie de tipo.

**Migration**: Ver `data-impact`, requisitos "Los cambios se clasifican por riesgo" y "El dialogo de impacto dice que, para que, quien y que salidas". La consulta de que paginas usan una tabla queda en `html-pages`, requisito "Tablas declaradas por pagina".

### Requirement: Hueco marcado en vez de columna escondida

**Reason**: Los bloques se retiran. El HTML de una pagina decide por si mismo que hacer cuando un dato no llega, y el aviso previo evita que una columna desaparezca sin que nadie lo sepa.

**Migration**: Ver `data-impact`, requisito "El dialogo de impacto dice que, para que, quien y que salidas".

### Requirement: Tabla ausente frente a tabla sin elegir

**Reason**: Los bloques se retiran. Una pagina no elige una tabla: declara la lista de las que puede pedir, y una peticion a una tabla no declarada se rechaza con un mensaje propio.

**Migration**: Ver `html-pages`, requisito "Tablas declaradas por pagina".

### Requirement: Panel de revision con acceso al bloque

**Reason**: Los bloques se retiran y con ellos el panel de revision. El aviso se da antes de romper y ya nombra las paginas afectadas, con acceso a cada una.

**Migration**: Ver `data-impact`, requisito "El dialogo de impacto dice que, para que, quien y que salidas".

### Requirement: Avisos informativos de la app

**Reason**: Los bloques se retiran. El unico arreglo automatico que queda es la reposicion de las referencias inyectadas en una pagina, que deja su propia constancia.

**Migration**: Ver `html-pages`, requisito "Reposicion de lo inyectado".
