# Docker

Planer se empaqueta en **una sola imagen**: el servidor Bun y PocketBase van juntos, porque `server/index.ts` arranca PocketBase como proceso hijo y guarda en SQLite. Separarlos en dos contenedores no aporta nada: la base no se reparte entre máquinas.

Lo único que vive fuera de la imagen son los datos, en un volumen.

## Nombres

Todo queda fijado en `compose.yml`, para que no cambie según la carpeta desde la que se despliegue.

| Pieza | Nombre |
|---|---|
| Imagen | `planer:latest` (o la etiqueta que publiques) |
| Servicio | `planer` |
| Contenedor | `planer` |
| Volumen | `planer_pb_data` |
| Red | `planer_default` |

## Cómo se construye la imagen

Cuatro etapas. Las tres primeras sólo existen durante la construcción; nada de lo que sobra llega a la imagen final.

| Etapa | Qué hace |
|---|---|
| `pocketbase` | Descarga el programa de PocketBase para la arquitectura de destino (versión en el argumento `PB_VERSION`) |
| `panel` | `bun install` completo y `bun run build`: compila el panel a `web/dist` |
| `deps` | `bun install --production`: sólo las dependencias que hacen falta con el servidor encendido |
| `runtime` | La imagen que se despliega |

La imagen final lleva:

- `server/` y `shared/` — el código del servidor, que Bun ejecuta directamente desde TypeScript.
- `web/dist/` — el panel compilado.
- `web/src/` — **hace falta encendido**. `server/pageStyles.ts` lee las hojas de `web/src/styles/` al arrancar para servir `/plane/estilos.css`. Sin ellas, las páginas publicadas salen sin estilos.
- `node_modules/` de producción — entre otras cosas, de ahí sale `chart.js`, que se sirve en `/plane/graficas.js`.
- `pb/pocketbase` — el programa, sin datos.

Corre con el usuario `bun`, no como root, y expone sólo el puerto 3000. PocketBase escucha en `127.0.0.1:8090`, dentro del contenedor: no se publica hacia fuera, se llega a él por el proxy `/pb/` del propio servidor.

### Construir

```bash
docker build -t planer:1.0.0 .
```

Para fijar otra versión de PocketBase:

```bash
docker build --build-arg PB_VERSION=0.39.11 -t planer:1.0.0 .
```

Si el servidor de destino no es de la misma arquitectura que tu equipo, constrúyela para la suya:

```bash
docker buildx build --platform linux/amd64 -t tu-registro/planer:1.0.0 --push .
```

## Desplegar

En el servidor, junto a `compose.yml`:

```bash
cp .env.docker.example .env.docker
```

Cambia `PB_ADMIN_PASSWORD` en ese archivo. Es la cuenta de administrador de PocketBase y también la primera cuenta de constructor, y **se reescribe en cada arranque del contenedor** con lo que diga ahí. Eso tiene dos consecuencias: la clave nunca queda dentro de la imagen, y cambiarla ahí y reiniciar es la forma de recuperarla si se pierde.

```bash
docker compose up -d
```

Queda en http://localhost:3000. Para publicar en otro puerto:

```bash
PLANER_PORT=8080 docker compose up -d
```

`.env.docker` es un archivo aparte del `.env` de desarrollo a propósito: Compose lee el `.env` del proyecto para rellenar los `${...}` del `compose.yml`, así que compartirlos colaría la clave por defecto de desarrollo en el servidor.

### Desde un registro

Si la imagen se construye en otro sitio, comenta el bloque `build:` del `compose.yml` y nombra la imagen:

```bash
PLANER_IMAGE=tu-registro/planer:1.0.0 docker compose up -d
```

Sin registro, la imagen también viaja como archivo:

```bash
docker save planer:1.0.0 | gzip > planer-1.0.0.tgz
```

Y en el servidor:

```bash
gunzip -c planer-1.0.0.tgz | docker load
```

## Actualizar

```bash
docker compose pull && docker compose up -d
```

El volumen no se toca. Al arrancar, `server/bootstrap.ts` añade a las colecciones internas los campos que falten, así que una versión nueva se acomoda sola sobre los datos que ya había.

## Comprobar que quedó bien

Con el contenedor encendido:

```bash
BASE=http://127.0.0.1:3000 bun run smoke
```

Las credenciales salen de `PB_ADMIN_EMAIL` y `PB_ADMIN_PASSWORD` del entorno, que tienen que ser las mismas de `.env.docker`. La prueba recorre el camino completo: crear una app, cambiar columnas, publicar, invitar y borrar.

El contenedor también se vigila solo: el `HEALTHCHECK` pide `/pb/api/health` a través del proxy, así que comprueba el servidor y PocketBase de una vez.

```bash
docker inspect --format '{{.State.Health.Status}}' planer
```

## Los datos

Todo vive en el volumen `planer_pb_data`: la base SQLite, los archivos subidos y la configuración de PocketBase.

Copiar ese volumen con el contenedor encendido puede dar una base a medio escribir. Para una copia fiable, usa la orden de respaldo de PocketBase desde su consola de administración, o para y copia:

```bash
docker compose stop && docker run --rm -v planer_pb_data:/datos -v "$PWD":/salida alpine tar czf /salida/planer-datos.tgz -C /datos . && docker compose start
```

## Lo que falta poner delante

La imagen sirve HTTP plano. Para un dominio con certificado, pon un proxy inverso (Caddy, nginx o Traefik) delante del puerto publicado. El servidor no termina TLS ni lo pretende.
