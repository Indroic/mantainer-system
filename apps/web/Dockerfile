# Etapa 1: Construcción
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copiar archivos de control del monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Declarar ARGs para las variables de entorno de Vite
ARG VITE_API_URL
ARG VITE_AUTH_URL

# Exponerlas como variables de entorno del proceso de build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL

# Instalar dependencias y compilar
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

# Etapa 2: Producción
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY --from=builder /app/apps/web/public/robots.txt /usr/share/nginx/html/robots.txt
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
EXPOSE 3000
