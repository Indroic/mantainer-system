# Etapa 1: Construcción
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copiar archivos de control y workspaces del monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Instalar dependencias y compilar
RUN pnpm install --frozen-lockfile
RUN pnpm --filter server build

# Etapa 2: Producción
FROM node:22-alpine AS runner
RUN apk add --no-cache curl
RUN npm install -g pnpm

WORKDIR /app

# Copiar artefactos construidos y workspaces del monorepo
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# Instalar solo dependencias de producción
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Healthcheck apuntando a la ruta raíz del servidor de Auth
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "apps/server/dist/index.mjs"]
