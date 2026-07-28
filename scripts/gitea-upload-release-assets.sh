#!/usr/bin/env bash
#
# Прикрепить файлы из папки downloads/ к релизу DLE в Gitea (через API).
# Запускать на VDS после sync, когда downloads/ уже на сервере.
#
# На VDS:
#   cd /home/docker/dapp
#   export GITEA_PASSWORD='adminhb32026'
#   export GITEA_URL='https://hb3-accelerator.com/gitea'
#   ./scripts/gitea-upload-release-assets.sh [тег] [каталог]
#   ./scripts/gitea-upload-release-assets.sh v1.0.3 ./downloads
#
# Требования: curl. Без jq (парсим id из JSON вручную).

set -e

GITEA_URL="${GITEA_URL:-https://hb3-accelerator.com/gitea}"
GITEA_USER="${GITEA_USER:-admin}"
GITEA_PASSWORD="${GITEA_PASSWORD:?Задайте GITEA_PASSWORD.}"
ORG="VC-HB3-Accelerator"
REPO="DLE"
TAG="${1:-v1.0.3}"
DIR="${2:-./downloads}"
API="${GITEA_URL}/api/v1"
AUTH="-u ${GITEA_USER}:${GITEA_PASSWORD}"
CURL_OPTS="-s --connect-timeout 15 --max-time 1200"
RETRIES=2

if [ ! -d "$DIR" ] || [ -z "$(ls -A "$DIR" 2>/dev/null)" ]; then
  echo "Каталог $DIR пуст или не найден. Запускайте на VDS после sync."
  exit 1
fi

echo "Gitea: $GITEA_URL, репо: $ORG/$REPO, тег: $TAG, каталог: $DIR"
echo "---"

# Получить или создать релиз по тегу
json=$(curl $CURL_OPTS $AUTH "${API}/repos/${ORG}/${REPO}/releases/tags/${TAG}" 2>/dev/null) || true
if [ -z "$json" ] || echo "$json" | grep -q '"message"'; then
  echo "Релиз $TAG не найден, создаём..."
  json=$(curl $CURL_OPTS -X POST $AUTH -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"${TAG}\",\"name\":\"Release ${TAG}\",\"target\":\"${TAG}\"}" \
    "${API}/repos/${ORG}/${REPO}/releases" 2>/dev/null) || true
fi
release_id=$(echo "$json" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
if [ -z "$release_id" ]; then
  echo "Не удалось получить id релиза. Проверьте GITEA_PASSWORD и GITEA_URL."
  [ -n "$json" ] && echo "Ответ API: ${json:0:200}..."
  echo "Создайте релиз $TAG в Gitea вручную (Releases → Create), затем запустите скрипт снова."
  exit 1
fi
echo "Релиз $TAG (id=$release_id). Загрузка ассетов..."

for f in "$DIR"/*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "  $name ..."
  code=""
  for try in $(seq 1 $((RETRIES+1))); do
    code=$(curl $CURL_OPTS -w "%{http_code}" -o /tmp/gitea_asset_$$.out -X POST $AUTH \
      "${API}/repos/${ORG}/${REPO}/releases/${release_id}/assets?name=${name}" \
      -F "attachment=@${f}")
    if [ "$code" = "201" ]; then
      echo "    OK"
      break
    fi
    if [ "$code" = "409" ]; then
      echo "    уже в релизе (409)"
      break
    fi
    if [ "$try" -le "$RETRIES" ] && echo "$code" | grep -qE '^5[0-9]{2}$'; then
      echo "    HTTP $code, повтор $try/$RETRIES через 10 с..."
      sleep 10
    else
      echo "    HTTP $code"
      break
    fi
  done
  rm -f /tmp/gitea_asset_$$.out
done

echo "Готово. Проверьте: ${GITEA_URL}/${ORG}/${REPO}/releases"