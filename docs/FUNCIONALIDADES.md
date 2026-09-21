# Funcionalidades

- **Cuenta y acceso**

  - Iniciar sesión como constructor (panel)
  - Sesión aparte para miembros de una app publicada
- **Tablero de aplicaciones**

  - Crear, abrir, eliminar una aplicación
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
    - Columna persona como dueño de fila ("ver solo lo mío")
  - Filas

    - Crear, editar, borrar (una o selección múltiple)
    - Buscar/filtrar en la grilla
    - Ver impacto antes de borrar (relaciones afectadas)
    - Abrir la fila completa en el cajón lateral
    - Al crear una persona, clave opcional en su fila, con botón de generarla y
      copiarla; vacía la inventa el servidor y se enseña una sola vez
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
  - Elegir proveedor, modelo y nivel de razonamiento por petición
  - Adjuntar archivos (CSV, JSON, texto, imagen) a la conversación
  - Herramientas del modelo: ver tablas, crear tabla, agregar columnas, crear/actualizar página, leer archivo, llenar tabla desde archivo, revisar errores
  - Memoria de la página en el contexto de cada petición, y preguntar antes de contradecir una regla guardada
  - La memoria se escribe sola al cerrar cada turno, con su propio modelo configurable
  - Pedir expresamente que algo se recuerde lo guarda en la memoria, sea o no una regla funcional
  - Modo Plan: conversar y preguntar antes de construir, cerrar el plan
  - Cortar una petición en marcha
  - Diálogo de impacto para cambios riesgosos (borrar columna/tabla, cambiar tipo)
  - Autorizar accesos pedidos por la IA
  - Medidor de contexto/tokens usado
  - Historial de conversaciones por página, retomar una anterior
  - Autocomandos / preguntas rápidas
  - Constancia de depuración por petición ("contexto enviado")
  - Límite de tiempo máximo por petición y cortes de seguridad
- **Publicación**

  - Enlace público (solo lectura) o privado (con invitados)
  - Niveles de invitado: ver, editar, administrar
  - Gestión de miembros: invitar, resetear clave, quitar
  - Página de inicio y lado del menú lateral
- **Versiones e historial**

  - Versión automática en cada publicación
  - Versión manual en cualquier momento
  - Ver cambios por versión y restaurar
- **Configuración global**

  - Proveedores de IA

    - Crear, modificar, probar un proveedor (Claude/Anthropic o compatible ChatGPT: Ollama, LM Studio, OpenRouter, etc.)
    - Elegir proveedor/modelo por defecto (fallback)
    - Exportar / importar configuración de proveedores (sin claves)
  - Registros de depuración de IA (ver, borrar)
  - Tamaño de letra del panel
  - Limpiar aplicaciones (mantenimiento)
  - Catálogo de estilos de referencia (`/demo`)
- **Instalación y despliegue**

  - Arranque con un solo comando, un solo puerto
  - Base de datos (PocketBase) incluida y autoarrancada
  - Docker: una imagen, datos en volumen aparte
  - Prueba de humo end-to-end (`bun run smoke`)
  - Datos de ejemplo (`bun run demo`)
