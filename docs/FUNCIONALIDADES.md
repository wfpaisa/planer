# Funcionalidades

- **Cuenta y acceso**

  - Iniciar sesión como constructor (panel)
  - Sesión aparte para miembros de una app publicada
- **Usuarios del panel** (ajustes de la cuenta, solo administradores)

  - Ver los usuarios con cuántas aplicaciones tienen propias y asignadas
  - Crear un usuario con nombre, correo, contraseña y permiso de administrador
  - Editar sus datos, cambiarle la contraseña, darle o quitarle el permiso de administrador
  - Asignarle aplicaciones de otros: las trabaja como propias, pero no las borra
  - Borrar un usuario; sus aplicaciones pasan a quien lo borra
  - La cuenta del `.env` es siempre administradora y no se borra
  - Solo un administrador cambia los servidores de IA
- **Tablero de aplicaciones**

  - Crear, abrir, eliminar una aplicación
  - Importar una aplicación desde un archivo `.planer`
- **Aplicación — apariencia**

  - Nombre, icono, color principal
  - Paleta de colores (46 + personalizada), modo claro/oscuro
  - Tamaño de fuente por aplicación
  - Roles libres por aplicación (nombres que decide el negocio)
  - Al quitar un rol en uso, aviso con a cuántas personas y pantallas afecta
- **Base de datos** (editor tipo hoja de cálculo)

  - Tablas

    - Crear, renombrar, duplicar, eliminar
    - Crear tabla arrastrando un archivo (CSV/JSON)
  - Columnas

    - 11 tipos: texto, texto largo, número, sí/no, correo, enlace, fecha, opciones, archivo, relación, persona
    - Reordenar, ocultar
    - Redimensionar el ancho arrastrando el borde del título (o con las flechas
      del teclado); doble clic lo devuelve al ancho automático
    - Renombrar sin perder datos
    - El título dice con un icono lo que la columna exige: obligatoria junto al
      nombre, "no se repite" al otro extremo
    - Columna persona: enlaza la fila con alguien invitado a la aplicación
  - Filas

    - Crear, editar, borrar (una o selección múltiple)
    - Buscar/filtrar en la grilla
    - Ver impacto antes de borrar (relaciones afectadas)
    - Abrir la fila completa en el cajón lateral
    - Al crear una persona, clave opcional en su fila, con botón de generarla y
      copiarla antes de guardar; si se deja vacía, la inventa el servidor y no
      se muestra: se le da una desde "Cambiar la clave", en su fila
  - Edición en vivo en la grilla

    - Cursor de celda y navegación con teclado (flechas, Tab, Inicio/Fin)
    - Selección de rango con el ratón o con Mayúsculas, y todo con Ctrl+A
    - Escribir en la celda: un clic sobre la celda ya elegida, doble clic,
      Enter o empezar a teclear
    - Cada tipo abre su control y lo despliega solo: calendario en las fechas,
      lista en las opciones, buscador de llave en las relaciones
    - Las columnas que no se escriben desde la celda lo dicen al pasar por
      encima (las del sistema, los archivos, las relaciones múltiples)
    - En personas, correo y roles se escriben, se pegan y se vacían como
      cualquier columna; por dentro van de a una, porque pasan por la cuenta
    - Al pegar correos se avisa antes de escribir: el que ya es de otra persona
      de la aplicación, el que viene repetido en lo pegado y el rol que no
      existe dejan su celda como estaba
    - Copiar el rango al portapapeles y pegarlo en Excel o en otra tabla
    - Pegar un rango convirtiendo cada celda al tipo de su columna y enlazando
      las relaciones por su llave
    - Al pegar de más: crear las filas que faltan o quedarse con las que caben
    - Vaciar el rango con Supr
  - Importar / exportar CSV y JSON, con resumen previo y reemplazo total

    - Exigirle a una columna del archivo que no se repita o que no venga vacía;
      la columna que nace del archivo se queda con esas marcas
  - Aviso de los valores que no encontraron registro: qué tabla no los tiene,
    en qué columna llegaron y cuántas filas dependen, con filtro para ver solo
    esas filas
- **Páginas** (constructor visual)

  - Crear página, ordenar el menú lateral
  - En teléfonos (menos de 48rem) el menú lateral es siempre un cajón plegado que se abre encima, también en la aplicación publicada; la barra superior y la de dirección se quedan en iconos
  - Bloques: tabla con buscador, tarjetas, formulario, ficha, indicadores, texto
  - Página en HTML propio

    - Contrato `window.plane` (datos, usuario, gráficas)
    - Catálogo de estilos compartido con el panel
    - Gráficas con Chart.js (`plane.grafica`)
  - Vista previa antes de publicar
  - Revisar errores automáticamente (consola del navegador)
  - Convertir página antigua de bloques a HTML con IA
  - Roles por página / por separador de menú
  - Memorias de la página: las reglas funcionales que debe cumplir, editables a mano en sus ajustes
- **Inteligencia artificial**

  - Generar y editar páginas/tablas por chat (una petición por página a la vez)
  - Respuestas, preguntas y avisos en lenguaje sencillo para personas sin conocimientos técnicos
  - Elegir proveedor, modelo y nivel de razonamiento por petición, en submenús del menú «+» del campo de escribir
  - El modelo elegido se ve bajo el campo de escribir; los niveles de razonamiento se nombran en español en el chat
  - La cabecera del chat nombra la página sobre la que escribe la IA
  - Mostrar u ocultar esos dos selectores con un solo interruptor en los ajustes de IA; ocultos, se usa el modelo por defecto
  - Adjuntar archivos (CSV, JSON, texto, imagen) a la conversación
  - Herramientas del modelo: ver tablas, crear tabla, agregar columnas, crear/actualizar página, leer archivo, llenar tabla desde archivo, revisar errores, buscar iconos
  - Cualquier icono de la fuente (más de 6000) en las páginas, buscado por la IA sin lista en el contexto
  - Memoria de la página en el contexto de cada petición, y preguntar antes de contradecir una regla guardada
  - La memoria se escribe sola al cerrar cada turno, con su propio modelo configurable
  - Pedir expresamente que algo se recuerde lo guarda en la memoria, sea o no una regla funcional
  - Modo Plan: conversar y preguntar antes de construir, cerrar el plan; bloqueo de escrituras en el servidor
  - Planes con estados de ejecución y continuación del trabajo incompleto
  - Contexto compacto con consulta de guías y esquemas bajo demanda
  - Límite de contexto por modelo, calibrado con el uso real, y detención de errores repetidos
  - Cortar una petición en marcha
  - Los fallos se muestran como aviso de error, con «Reintentar» cuando la petición fallida se puede reenviar tal cual
  - Tras un turno que cambió la aplicación, enlace «Deshacer o ver cambios» al Histórico de cambios (punto «Antes de: …»)
  - En ventanas estrechas (tableta, teléfono) el chat se abre como hoja a pantalla completa con «Abrir chat»
  - Diálogo de impacto para cambios riesgosos (borrar columna/tabla, cambiar tipo)
  - Autorizar accesos pedidos por la IA
  - Medidor de contexto: al pulsarlo, tarjeta con uso y espacio libre, entrada evaluada y tokens generados en la conversación, caché de la última llamada y velocidad media
  - Avisos guardados en la conversación
  - Historial de conversaciones por página, retomar una anterior; la lista marca la que está abierta
  - Acciones rápidas / preguntas rápidas
  - Constancia de depuración por petición ("contexto enviado")
  - Límite de tiempo máximo por petición y cortes de seguridad
- **Publicación**

  - Enlace público (solo lectura) o privado (con invitados)
  - Roles de invitado con nombres libres (`admin` siempre); deciden qué páginas se abren. Escribir exige cuenta
  - Gestión de miembros: invitar, resetear clave, quitar
  - Página de inicio y lado del menú lateral
- **Copias y traslados** (ajustes de la cuenta)

  - Se elige la aplicación de una lista; duplicar y exportar trabajan sobre ella
  - Duplicar la aplicación entera (tablas, columnas, páginas, filas y adjuntos), pidiendo el nombre de la copia
  - Exportar a un archivo `.planer` (un zip con otra extensión) e importarlo en otro servidor
  - Con datos o sólo la estructura, como plantilla vacía
  - Al importar se elige primero el archivo y después el nombre, avisando de que se crea una aplicación nueva y no se reemplaza ninguna
  - Importar también desde la pantalla de aplicaciones, con el mismo diálogo
  - Las personas invitadas viajan con los datos: correo, nombre, roles y columnas propias, conservando el id de su fila para que las columnas que las nombran sigan enlazadas
  - La clave no viaja: cada persona entra con su correo y se le pone la clave desde su fila
  - Sólo la estructura: no viaja ninguna persona, y lo que las filas decían de ellas queda como valor sin enlace
  - Lo importado entra siempre como borrador, con enlace propio
- **Versiones e historial**

  - Versión automática en cada publicación
  - Versión manual en cualquier momento
  - Ver cambios por versión y restaurar
- **Configuración global**

  - Pestañas por contexto, cada una con su dirección (`/ajustes/general`, `/ajustes/ia`, `/ajustes/aplicaciones`, `/ajustes/usuarios`); Usuarios solo para administradores
  - Paleta de colores del panel (46 + personalizada), guardada en la cuenta de cada usuario, con vista previa antes de guardar
  - Proveedores de IA

    - Crear, modificar, probar un proveedor (Claude/Anthropic o compatible ChatGPT: Ollama, LM Studio, OpenRouter, etc.)
    - Elegir proveedor/modelo por defecto (fallback)
    - Exportar / importar configuración de proveedores (sin claves)
  - Registros de depuración de IA (ver, borrar)
  - Tamaño de letra del panel
  - Limpiar aplicaciones (mantenimiento)
  - Catálogo de estilos de referencia (`/demo`), con previsualizaciones adaptables e interactivas
- **Instalación y despliegue**

  - Arranque con un solo comando, un solo puerto
  - Base de datos (PocketBase) incluida y autoarrancada
  - Docker: una imagen, datos en volumen aparte
  - Prueba de humo end-to-end (`bun run smoke`)
  - Datos de ejemplo (`bun run demo`)
