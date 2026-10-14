#!/usr/bin/env bash
# Поиск B на хосте → sync objfix-b → attach (по PAGE_IDS) → опционально showroom.
#
#   export PAGE_IDS='1055,1056,141'   # или JSON-массив
#   INCREMENTAL_ATTACH=1              # заливка в БД сразу после каждой карточки с 8 picked (по умолчанию 1)
#   QUERY_GEN=rules                   # по умолчанию rules (storyboard из CSV/segment, без LLM); QUERY_GEN=llm — retry/исключения
#   RUN_SHOWROOM=0                    # 1 — showroom-listing-eight.js после attach
#   OBJFIX_BIND_MOUNT=1 — skip sync (bind-mount /tmp/objfix-b); attach = дозалив в БД
#   ./backend/scripts/run-listing-b-pipeline.sh
#   Канон plan B: backend/scripts/listing-b-mass/ (не дубли в backend/scripts/*.mjs)
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCK="${LISTING_B_PIPELINE_LOCK:-/tmp/listing-b-pipeline.lock}"
LOG="${LISTING_B_LOG:-/tmp/listing-b-pipeline.log}"

if [ -z "${PAGE_IDS:-}" ] && [ -z "${TEST_IDS:-}" ]; then
  echo "Set PAGE_IDS or TEST_IDS" >&2
  exit 1
fi

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Another listing-b pipeline is running (lock $LOCK)" >&2
  exit 1
fi

export INCREMENTAL_ATTACH="${INCREMENTAL_ATTACH:-1}"
export ATTACH_MIN="${ATTACH_MIN:-1}"
export ATTACH_TARGET="${ATTACH_TARGET:-8}"
if [ "${ALLOW_LLM_QUERIES:-0}" = "1" ]; then
  export QUERY_GEN="${QUERY_GEN:-llm}"
else
  export QUERY_GEN=rules
fi
export SKIP_SERP="${SKIP_SERP:-1}"
export REVERSE_IF_SHORT="${REVERSE_IF_SHORT:-1}"
export REVERSE_MIN_PICKED="${REVERSE_MIN_PICKED:-8}"
export MAX_REVERSE_IN_PICK="${MAX_REVERSE_IN_PICK:-1}"
export YANDEX_IMAGES_ORIGIN="${YANDEX_IMAGES_ORIGIN:-https://yandex.ru}"
export YANDEX_ISIZE="${YANDEX_ISIZE:-large}"
export YANDEX_ITYPE="${YANDEX_ITYPE:-photo}"
export YANDEX_IORIENT="${YANDEX_IORIENT:-horizontal}"
export YANDEX_LR_LIST="${YANDEX_LR_LIST:-213,162,149}"
export YANDEX_LR_MODE="${YANDEX_LR_MODE:-rotate}"
export IMAGE_ENGINES="${IMAGE_ENGINES:-yandex}"
export SEARCH_TAKE_PER_PLAN="${SEARCH_TAKE_PER_PLAN:-1}"
export OBJFIX_BIND_MOUNT="${OBJFIX_BIND_MOUNT:-1}"
export LISTING_B_SCRIPT_DIR="${LISTING_B_SCRIPT_DIR:-$ROOT/backend/scripts}"
export BING_CC_LIST="${BING_CC_LIST:-RU,KZ,BY}"
export BING_CC_MODE="${BING_CC_MODE:-rotate}"
export ATTACH_MILESTONES="${ATTACH_MILESTONES:-1,4,8}"
export PICK_MIN_HAMMING="${PICK_MIN_HAMMING:-9}"
export INGEST_MIN_HAMMING="${INGEST_MIN_HAMMING:-8}"
export PAGE_IDS="${PAGE_IDS:-$TEST_IDS}"
export ATTACH_RESET_FILE_MAP="${ATTACH_RESET_FILE_MAP:-0}"
export LISTING_MIN_YEAR="${LISTING_MIN_YEAR:-2020}"
export LISTING_YEAR_HINT="${LISTING_YEAR_HINT:-2024 2025}"
export B_VISION_POST="${B_VISION_POST:-0}"
export ATTACH_QUALITY_GATE="${ATTACH_QUALITY_GATE:-0}"
export ATTACH_INGEST_ALL_FILES="${ATTACH_INGEST_ALL_FILES:-0}"
export LISTING_BLOCK_PNG_URL="${LISTING_BLOCK_PNG_URL:-1}"
export LISTING_QUERY_MINUS="${LISTING_QUERY_MINUS:--avito -drom -объявление -watermark -wallpaper -обои -люди -водитель -portrait -team -здание -facade -vintage -infographic -png -tass -ria -новост -пресс -конференц -футбол -neymar -выставк -самолет -roblox -инфографик -авария -дтп -accident -crash -crashed -wreck -collision -damaged -totaled -salvage -разбит -битый -поврежден -столкновение -перевернут -spy -prototype -camouflage -camo -motor1 -шпион -прототип -камуфляж -mule -testmule}"
export LISTING_PIXEL_GATE="${LISTING_PIXEL_GATE:-1}"

LISTING_B_MASS_DIR="${LISTING_B_MASS_DIR:-$ROOT/backend/scripts/listing-b-mass}"
ATTACH_SRC="${LISTING_B_ATTACH_JS:-$LISTING_B_MASS_DIR/attach-listing-objfix-b.js}"
if [ ! -s "$ATTACH_SRC" ]; then
  echo "{\"pipeline\":\"listing-b\",\"error\":\"missing attach script\",\"path\":\"$ATTACH_SRC\"}" >&2
  exit 1
fi
docker.exe cp "$ATTACH_SRC" dapp-backend:/app/scripts/attach-listing-objfix-b.js
docker.exe cp "$LISTING_B_MASS_DIR/normalize-listing-feed-image.js" dapp-backend:/app/scripts/normalize-listing-feed-image.js
SPAWN_JSON="$LISTING_B_MASS_DIR/listing-spawn-json.js"
if [ ! -s "$SPAWN_JSON" ]; then
  SPAWN_JSON="$ROOT/backend/scripts/listing-spawn-json.js"
fi
if [ -s "$SPAWN_JSON" ]; then
  docker.exe cp "$SPAWN_JSON" dapp-backend:/app/scripts/listing-spawn-json.js
fi
docker.exe cp "$LISTING_B_MASS_DIR/listing-photo-pixel-heuristic.js" dapp-backend:/app/scripts/listing-photo-pixel-heuristic.js
docker.exe cp "$LISTING_B_MASS_DIR/listing-extra-url-block.js" dapp-backend:/app/scripts/listing-extra-url-block.js

LISTING_B_HOST_MJS="$LISTING_B_MASS_DIR/listing-photo-search-b-host.mjs"
if [ ! -f "$LISTING_B_HOST_MJS" ]; then
  echo "{\"pipeline\":\"listing-b\",\"error\":\"missing search script\",\"path\":\"$LISTING_B_HOST_MJS\"}" >&2
  exit 1
fi
export LISTING_B_SCRIPT_DIR="${LISTING_B_SCRIPT_DIR:-$ROOT/backend/scripts}"
echo "{\"pipeline\":\"listing-b\",\"phase\":\"search\",\"log\":\"$LOG\",\"hostMjs\":\"$LISTING_B_HOST_MJS\"}"
node "$LISTING_B_HOST_MJS" 2>&1 | tee -a "$LOG"
SEARCH_EXIT=${PIPESTATUS[0]}
if [ "$SEARCH_EXIT" -ne 0 ]; then
  echo "{\"pipeline\":\"listing-b\",\"phase\":\"search\",\"exit\":$SEARCH_EXIT}" >&2
  exit "$SEARCH_EXIT"
fi

if [ "${OBJFIX_BIND_MOUNT:-1}" = "1" ]; then
  echo '{"sync":"objfix-b","skipped":true,"reason":"bind_mount"}' | tee -a "$LOG"
else
  export PAGE_IDS="$PAGE_IDS"
  "$ROOT/backend/scripts/sync-objfix-b-to-container.sh" 2>&1 | tee -a "$LOG"
fi

echo '{"pipeline":"listing-b","phase":"attach"}'
docker.exe exec -w /app \
  -e OBJFIX_ROOT=/tmp/objfix-b \
  -e PAGE_IDS="$PAGE_IDS" \
  -e ATTACH_MIN="$ATTACH_MIN" \
  -e ATTACH_TARGET="$ATTACH_TARGET" \
  -e ATTACH_RESET_FILE_MAP="$ATTACH_RESET_FILE_MAP" \
  -e ATTACH_INGEST_ALL_FILES="${ATTACH_INGEST_ALL_FILES:-0}" \
  -e ATTACH_QUALITY_GATE="${ATTACH_QUALITY_GATE:-0}" \
  -e ATTACH_MERGE_EXISTING="${ATTACH_MERGE_EXISTING:-1}" \
  -e LISTING_BLOCK_PNG_URL="${LISTING_BLOCK_PNG_URL:-1}" \
  -e LISTING_PIXEL_GATE="${LISTING_PIXEL_GATE:-1}" \
  dapp-backend node scripts/attach-listing-objfix-b.js 2>&1 | tee -a "$LOG"

if [ "${RUN_SHOWROOM:-0}" = "1" ]; then
  docker.exe cp "$ROOT/data/sku-catalog-2026.csv" dapp-backend:/tmp/sku-catalog-2026.csv
  echo '{"pipeline":"listing-b","phase":"showroom"}'
  docker.exe exec -w /app \
    -e PAGE_IDS="$PAGE_IDS" \
    -e SHOWROOM_REDO="${SHOWROOM_REDO:-1}" \
    -e SHOWROOM_MIN="$ATTACH_MIN" \
    -e SHOWROOM_CONCURRENCY="${SHOWROOM_CONCURRENCY:-2}" \
    -e SOURCE_ROOT=/tmp/objfix-b \
    -e SKU_CSV=/tmp/sku-catalog-2026.csv \
    dapp-backend node scripts/showroom-listing-eight.js 2>&1 | tee -a "$LOG"
fi

echo '{"pipeline":"listing-b","finished":true}'
