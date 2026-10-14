#!/bin/bash
# На VDS: yarn build уже внутри образа frontend-nginx.
# Prod bind ./frontend/dist поверх /usr/share/nginx/html — без копии из IMAGE
# сайт продолжает отдавать старый dist с диска.
#
# Нельзя mv/переименовывать frontend/dist: backend монтирует этот inode
# как /app/frontend_dist. После mv prerender (mkdir blog/) крутит CPU 99%.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/docker/dapp}"
cd "$APP_DIR"

IMG=$(docker compose -f docker-compose.prod.yml images -q frontend-nginx | head -1)
if [ -z "$IMG" ]; then
  IMG=$(docker images -q digital_legal_entitydle-frontend-nginx:latest | head -1)
fi
if [ -z "$IMG" ]; then
  echo "Не найден образ frontend-nginx" >&2
  exit 1
fi

CID=$(docker create "$IMG")
rm -rf frontend/dist.new
mkdir -p frontend/dist.new
docker cp "$CID:/usr/share/nginx/html/." frontend/dist.new/
docker rm "$CID" >/dev/null

if [ ! -f frontend/dist.new/index.html ]; then
  echo "В образе нет index.html" >&2
  rm -rf frontend/dist.new
  exit 1
fi

mkdir -p frontend/dist
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete frontend/dist.new/ frontend/dist/
else
  find frontend/dist -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a frontend/dist.new/. frontend/dist/
fi
rm -rf frontend/dist.new

docker compose -f docker-compose.prod.yml up -d --force-recreate frontend-nginx

echo "dist обновлён: $(ls frontend/dist/index.html) ($(stat -c %y frontend/dist/index.html 2>/dev/null || stat -f %Sm frontend/dist/index.html))"
