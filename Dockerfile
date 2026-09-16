# syntax=docker/dockerfile:1

# Planer en una sola imagen: el servidor de Bun (panel + API + apps
# publicadas) y PocketBase, que arranca como proceso hijo desde
# `server/index.ts`. Los datos viven fuera, en el volumen de /app/pb/pb_data.

ARG BUN_VERSION=1.3.14
ARG PB_VERSION=0.39.11

# ---------------------------------------------------------------------------
# El programa de PocketBase, para la arquitectura de destino.
# ---------------------------------------------------------------------------
FROM alpine:3.22 AS pocketbase
ARG PB_VERSION
ARG TARGETARCH
# TARGETARCH lo pone BuildKit; el constructor clasico no, asi que se deduce.
RUN apk add --no-cache curl unzip \
    && arch="${TARGETARCH:-$(case "$(uname -m)" in x86_64) echo amd64 ;; aarch64) echo arm64 ;; esac)}" \
    && test -n "$arch" || { echo "Arquitectura no soportada: $(uname -m)" >&2; exit 1; } \
    && curl -fsSL -o /tmp/pb.zip \
       "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${arch}.zip" \
    && unzip -oq /tmp/pb.zip pocketbase -d /pb \
    && chmod +x /pb/pocketbase

# ---------------------------------------------------------------------------
# El panel compilado (Vite).
# ---------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS panel
WORKDIR /app
COPY package.json bun.lock ./
# --ignore-scripts: `prepare` instala husky, que aqui no pinta nada.
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

# ---------------------------------------------------------------------------
# Solo las dependencias que hacen falta encendido.
# ---------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# ---------------------------------------------------------------------------
# La imagen que se despliega.
# ---------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION}-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    PB_PORT=8090 \
    PB_URL=http://127.0.0.1:8090

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=panel /app/web/dist     ./web/dist
# El servidor lee las hojas de estilo de `web/src/styles/` al arrancar
# (ver server/pageStyles.ts), asi que las fuentes del panel tambien viajan.
COPY --from=panel /app/web/src      ./web/src
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY --from=pocketbase /pb/pocketbase ./pb/pocketbase

# El volumen hereda estos permisos la primera vez que Docker lo crea.
RUN mkdir -p /app/pb/pb_data && chown -R bun:bun /app/pb

USER bun
VOLUME ["/app/pb/pb_data"]
EXPOSE 3000

# Pasa por el proxy del servidor hasta PocketBase: comprueba las dos piezas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD bun -e "process.exit((await fetch('http://127.0.0.1:'+(process.env.PORT??3000)+'/pb/api/health').then(r=>r.ok).catch(()=>false))?0:1)"

CMD ["bun", "run", "server/index.ts"]
