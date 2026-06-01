# Etapa 1: Construcción
FROM node:20-alpine AS builder
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
FROM node:20-alpine AS runner
RUN apk add --no-cache nginx bash
RUN npm install -g pnpm

WORKDIR /app

# Copiar la aplicación compilada de la etapa anterior
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/http.d/default.conf

# Instalar solo dependencias de producción del monorepo
RUN pnpm install --prod --frozen-lockfile

# Crear un script de inicio para levantar el servidor SSR y Nginx
RUN echo '#!/bin/bash\n\
echo "Iniciando TanStack Start SSR en puerto 3000..."\n\
PORT=3000 node apps/web/dist/server/server.js &\n\
echo "Iniciando Nginx Proxy Inverso en puerto 80..."\n\
nginx -g "daemon off;"' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 80

# Healthcheck robusto apuntando al puerto local 3000 del SSR
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
