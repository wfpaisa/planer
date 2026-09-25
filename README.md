# Planer

Plataforma propia para **crear aplicaciones y Base de datos sin programar**, pensada para correr en tu servidor.

Cada aplicación tiene dos caras: una **base de datos** que se maneja como una hoja de cálculo, y una **aplicación** de pantallas armadas con bloques sobre esas tablas. Cuando está lista, se publica con un enlace (abierta a cualquiera, o privada con invitados).

## Producto

### Funcionalidades

<!-- generado:features -->

### Crea páginas con inteligencia artificial

Si no sabes por dónde empezar, describe lo que necesitas con tus palabras y el resto se genera automáticamente.

- Escribe una frase como "quiero una página para llevar el inventario del almacén" y se generan las tablas y las pantallas listas para usar.
- Antes de aplicar nada, se muestra una vista previa. Tú decides si lo guardas o si prefieres ajustar algo.
- Puedes usar Claude (el modelo de Anthropic) o cualquier servicio compatible con ChatGPT, como Ollama, LM Studio u OpenRouter. Eliges el que prefieras desde Ajustes.
- La clave del modelo se guarda en tu servidor y nunca llega al navegador, así que nadie más puede verla.

### Administra tus Base de datos visualmente

Las tablas se ven y se editan como una hoja de cálculo: agregar, borrar, buscar, importar y exportar sin tocar código.

- Crea tablas nuevas, renombra las que ya tienes, cambia el orden de las columnas, ajusta su ancho o escóndelas si no las necesitas en este momento.
- Borra varios registros a la vez marcándolos en la grilla, sin tener que ir uno por uno.
- Importa datos desde un archivo (CSV o JSON) y exporta lo que tienes a un archivo para llevártelo a otro lado.
- Antes de importar, la herramienta te muestra un resumen de lo que va a cambiar para que nada te tome por sorpresa.
- Las tablas admiten 11 tipos de columna: texto corto, texto largo, números, sí/no, correos, enlaces, fechas, listas de opciones, archivos, relaciones con otras tablas y personas.
- Una columna de tipo persona puede marcar al dueño de cada fila: así, si quieres, cada invitado sólo ve y edita sus propios registros.
- Si renombras una columna, los datos que ya tenías no se pierden: el sistema recuerda la identidad interna de cada campo.

### Arma pantallas por bloques

Las páginas se construyen apilando bloques ya hechos. No hay que programar nada, sólo elegir y configurar.

- Bloques disponibles: Tabla con buscador, Tarjetas, Formulario, Ficha, Indicadores y Texto.
- Cada bloque se conecta a una de tus tablas y tú eliges qué columnas muestra, cómo se ordenan y qué se puede buscar.
- Si ninguno de los bloques te sirve, puedes escribir la página en HTML a tu medida. La plataforma te da todo lo que necesitas (datos, colores, gráficas) en un contrato cerrado. La guía completa de cómo escribir páginas en HTML está en [docs/PAGINAS-HTML.md](./docs/PAGINAS-HTML.md).

### Publica tu app y compártela

Cuando la app está lista, la publicas con un enlace. Tú decides si la ve todo el mundo o sólo personas invitadas.

- Enlace público: cualquiera con el enlace puede ver la app, pero no puede modificarla.
- Enlace privado: sólo entran las personas que tú invites, con una cuenta propia.
- Cada invitado puede tener uno de tres niveles: ver, editar o administrar.
- Además del nivel, puedes crear roles con nombre libre (Conductor, Supervisor, Vendedor...) y decidir, para cada página y cada bloque, qué roles pueden verlo.
- Tu app tiene una página de inicio y un menú lateral. Tú decides qué página abre primero y de qué lado queda el menú.
- Personaliza la apariencia: nombre, icono, color principal y una paleta de colores para los rótulos de las columnas. Funciona en modo claro y oscuro.

### Llévate tu aplicación cuando quieras

Una aplicación entera cabe en un archivo: te la llevas a otro servidor, la guardas de respaldo o la duplicas para empezar otra parecida.

- Desde los ajustes de tu cuenta eliges una aplicación y la duplicas, la guardas en un archivo o traes una de vuelta. El archivo se llama como tu aplicación y termina en ".planer".
- Dentro va todo lo que la aplicación es: las tablas con sus columnas, las pantallas con su contenido, los colores, los roles, las filas y los archivos adjuntos.
- Puedes elegir llevarte sólo la estructura, sin los datos: te queda una plantilla con las mismas tablas y pantallas, vacías, lista para empezar de nuevo.
- Las personas invitadas viajan con los datos: su correo, su nombre, sus roles y las columnas que les pusiste. Lo que no viaja es la clave, así que cada una entra con su correo y tú se la pones desde su fila.
- Como las personas llegan con su misma identidad, las columnas que las nombran siguen enlazadas. Si eliges llevarte sólo la estructura no viaja nadie, y entonces lo que cada fila decía de ellas se conserva a la vista, sin enlace.
- También puedes importar desde la pantalla de tus aplicaciones. Al elegir el archivo se te pregunta con qué nombre quieres que entre: importar nunca reemplaza nada, siempre crea una aplicación nueva, y entra como borrador para que tú decidas cuándo publicarla.

### Vuelve atrás cuando quieras

Todos los cambios importantes dejan una versión guardada. Si algo no salió como esperabas, regresas al estado anterior en un clic.

- Cada vez que publicas, queda guardada la versión que estaba en producción.
- También puedes guardar una versión manual en cualquier momento, por ejemplo, antes de hacer un cambio grande.
- El listado de versiones muestra qué cambió en cada una y te deja restaurarla para dejarla activa de nuevo.

### Instalación simple, un solo puerto

No hay servicios externos ni piezas sueltas: Planer corre en tu propio servidor con un único comando.

- Para empezar, un solo comando: bun run setup. Para arrancar cada vez, bun run dev.
- Todo corre en el mismo puerto (3000): el panel, las apps publicadas y la base de datos.
- La base de datos (PocketBase) viene incluida y se inicia sola como parte del servidor. No tienes que instalar nada aparte.
- Las reglas de acceso se aplican en la base de datos, no en el navegador. Eso significa que un invitado no puede, ni intentándolo, ver registros que no le corresponden.
- Incluye una prueba de humo (bun run smoke) que recorre todo el camino: crear app, agregar tablas, publicar e invitar a alguien. Sirve para comprobar que la instalación está sana.

<!-- fin:features -->

### Puesta en marcha

La primera vez, un solo comando: instala, descarga PocketBase, prepara la configuración y arranca.

```bash
bun run setup
```

Las siguientes veces:

```bash
bun run dev
```

Abre **http://localhost:3000** y entra con el correo y la clave del archivo `.env` (por defecto `admin@planer.local` / `planer-admin-1234`). Cambia esa clave antes de usarlo con datos reales.

#### Probar con un ejemplo

Con el servidor encendido, en otra terminal:

```bash
bun run demo
```

Crea un directorio de empleados con datos, tres pantallas y la app ya publicada.

#### Importar y exportar en lote

La carga y la importación por lotes usa la "batch API" de PocketBase. Cuando montes una instalación nueva, confirma este checklist en la consola de administración de PocketBase (`http://localhost:8090/_/` con el superuser del `.env`):

- La **batch API** queda habilitada (`GET /api/settings` debe devolver `batch.enabled == true`).
- **Max requests** del batch queda en **200** (campo `batch.maxRequests`).

Si no se cumple, la importación y las sustituciones por lote fallan con "The length must be no more than 50" porque el panel manda tramos de 200.

#### Llevarlo a producción

```bash
bun run build
bun run start
```

Todo queda en un solo puerto (3000 por defecto): el panel, las apps publicadas y la API.

#### Llevarlo a producción con Docker

Planer cabe en una sola imagen: el servidor y PocketBase van dentro, y los datos quedan fuera, en un volumen. Sirve para desplegar en un servidor sin instalar Bun ni descargar nada a mano.

Construir la imagen:

```bash
docker build -t planer:1.0.0 .
```

En el servidor, copia `.env.docker.example` a `.env.docker`, cambia la clave de administrador y levanta:

```bash
docker compose up -d
```

El detalle —qué lleva cada etapa de la construcción, cómo actualizar, cómo respaldar el volumen y qué poner delante para tener HTTPS— está en [docs/DOCKER.md](./docs/DOCKER.md).

## Desarrollo

### Cómo está hecho

Dos programas, un solo comando.

| Pieza | Para qué sirve |
|---|---|
| **PocketBase** | Guarda los datos, las cuentas, los permisos y los archivos. Se arranca solo. |
| **Servidor Bun** | Entrega el panel, atiende las apps publicadas y es el único que puede cambiar la estructura de las tablas. |

Las tablas que crea el usuario se convierten en tablas reales dentro de PocketBase, con sus índices y sus reglas de acceso. No son filas genéricas.

```
server/    servidor, API propia y creación de tablas
web/       panel y visor de apps publicadas
shared/    tipos usados por ambos lados
scripts/   arranque, ejemplo y pruebas
pb/        PocketBase y sus datos
```

### Documentación adicional

- [docs/FUNCIONALIDADES.md](./docs/FUNCIONALIDADES.md) — listado resumido de todas las funcionalidades, por área. Se actualiza con cada cambio que agrega, modifica o retira una funcionalidad.
- [docs/COMO-FUNCIONA.md](./docs/COMO-FUNCIONA.md) — los mecanismos centrales de la plataforma: el modelo de datos, los permisos, las dos sesiones, versiones, y cómo se crean y modifican las páginas.
- [docs/PAGINAS-HTML.md](./docs/PAGINAS-HTML.md) — guía para escribir páginas de una app en HTML propio: contrato `window.plane`, variables de estilo, datos, gráficas y límites.
- [docs/CHAT.md](./docs/CHAT.md) — cómo funciona el chat de IA: el bucle de rondas, cómo prueba una página antes de darla por buena, y los cambios con riesgo.
- [docs/DOCKER.md](./docs/DOCKER.md) — desplegar con Docker: cómo se construye la imagen, qué lleva dentro, los nombres que usa, actualizaciones y copias de seguridad.
- [PRODUCT.md](./PRODUCT.md) — propósito, público, capacidades y principios del producto.

### Comprobar que todo funciona

Con el servidor encendido, en otra terminal:

```bash
bun run smoke
```

Recorre el camino completo: crear una app, crear tablas, cambiar columnas sin perder datos, publicar, invitar a alguien, comprobar que nadie más puede entrar y que la clave de la IA no sale del servidor.
