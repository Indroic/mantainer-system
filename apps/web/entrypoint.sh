#!/bin/sh
set -eu

echo "Iniciando TanStack Start SSR directo en puerto 3000..."
exec env PORT=3000 node apps/web/start-server.mjs
