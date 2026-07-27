# Etapa 1: Construcción
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copiar archivos de control del monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Instalar dependencias y compilar
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

# Etapa 2: Producción
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY --from=builder /app/apps/web/public/robots.txt /usr/share/nginx/html/robots.txt
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el script de inyección de entorno dinámico
COPY apps/web/inject-env.sh /docker-entrypoint.d/50-inject-env.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/50-inject-env.sh && chmod +x /docker-entrypoint.d/50-inject-env.sh

EXPOSE 80
EXPOSE 3000
