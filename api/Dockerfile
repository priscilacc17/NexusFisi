# syntax=docker/dockerfile:1
# Imagen de la API de NexusFisi: compila TypeScript y ejecuta con un usuario sin privilegios.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/uploads
WORKDIR /app
RUN addgroup -S nexus && adduser -S nexus -G nexus && mkdir -p /data/uploads && chown nexus:nexus /data/uploads
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
USER nexus
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null || exit 1
CMD ["node", "dist/index.js"]
