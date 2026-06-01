#!/bin/sh
echo "Iniciando TanStack Start SSR en puerto 3000..."
PORT=3000 node apps/web/dist/server/server.js &

echo "Iniciando Nginx Proxy Inverso en puerto 80..."
nginx -g "daemon off;"
