# syntax=docker/dockerfile:1
# Imagen del frontend (TanStack Start) como servidor Node. El proyecto usa bun.lock.
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g bun@1
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
# VITE_* se fija en tiempo de build. Por defecto la API está en el mismo origen (/api/v1, vía gateway).
ARG VITE_API_URL=/api/v1
ARG VITE_MOSTRAR_DEMO=true
ENV VITE_API_URL=$VITE_API_URL VITE_MOSTRAR_DEMO=$VITE_MOSTRAR_DEMO
RUN NITRO_PRESET=node-server npx vite build

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
RUN addgroup -S nexus && adduser -S nexus -G nexus
COPY --from=build --chown=nexus:nexus /app/.output ./.output
USER nexus
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
