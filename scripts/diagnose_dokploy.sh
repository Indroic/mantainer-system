#!/usr/bin/env bash
# Script de diagnóstico para ejecutar dentro del contenedor `web` o desde una consola con acceso al contenedor.
set -euo pipefail

echo "1) Headers públicos (si ejecutas desde fuera del contenedor, sustituye DOMAIN)"
if [ -n "${1:-}" ]; then
  DOMAIN=$1
  echo "curl -I https://$DOMAIN/"
  curl -v "https://$DOMAIN/" || true
fi

echo "\n2) Comprobaciones internas: puerto 80 (Nginx) y 3000 (SSR)"
echo "curl -i http://127.0.0.1:80/"
curl -i http://127.0.0.1:80/ || true

echo "\ncurl -i http://127.0.0.1:3000/"
curl -i http://127.0.0.1:3000/ || true

echo "\n3) Estado de procesos (node, nginx)"
ps aux | egrep 'node|nginx' || true

echo "\n4) Comprobar existencia y permisos de server.js"
ls -l /app/apps/web/dist/server/server.js || true

echo "\n5) Logs Nginx"
if [ -f /var/log/nginx/error.log ]; then
  echo "--- /var/log/nginx/error.log (últimas 200 líneas) ---"
  tail -n 200 /var/log/nginx/error.log || true
else
  echo "No se encontró /var/log/nginx/error.log"
fi

echo "\n6) Logs de access Nginx"
if [ -f /var/log/nginx/access.log ]; then
  echo "--- /var/log/nginx/access.log (últimas 200 líneas) ---"
  tail -n 200 /var/log/nginx/access.log || true
else
  echo "No se encontró /var/log/nginx/access.log"
fi

echo "\n7) Buscar puertos escuchando"
ss -tlnp || netstat -tlnp || true

echo "\n8) Fin del diagnóstico"
