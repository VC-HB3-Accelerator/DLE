#!/usr/bin/env bash
# Параллельный прогон plan B: N воркеров, каждый — свой PAGE_IDS и lock.
#
#   export PAGE_IDS='70,71,72,...'   # или TEST_IDS
#   WORKERS=4 ./backend/scripts/run-listing-b-parallel.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKERS="${WORKERS:-4}"
IDS="${PAGE_IDS:-${TEST_IDS:-}}"

if [ -z "$IDS" ]; then
  echo "Set PAGE_IDS or TEST_IDS" >&2
  exit 1
fi

mapfile -t ALL_IDS < <(echo "$IDS" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -E '^[0-9]+$')
TOTAL="${#ALL_IDS[@]}"
if [ "$TOTAL" -eq 0 ]; then
  echo "No numeric IDs" >&2
  exit 1
fi

RUN_TAG="${LISTING_B_RUN_ID:-listing-b}"
echo "{\"parallel\":\"listing-b\",\"runId\":\"$RUN_TAG\",\"workers\":$WORKERS,\"cards\":$TOTAL,\"bVisionPost\":\"${B_VISION_POST:-1}\"}"

PIDS=()
for ((w = 0; w < WORKERS; w += 1)); do
  CHUNK=""
  for ((i = w; i < TOTAL; i += WORKERS)); do
    if [ -n "$CHUNK" ]; then CHUNK+=","; fi
    CHUNK+="${ALL_IDS[$i]}"
  done
  [ -z "$CHUNK" ] && continue
  LOG="/tmp/${RUN_TAG}-par-${w}.log"
  (
    export PAGE_IDS="$CHUNK"
    export LISTING_B_PIPELINE_LOCK="/tmp/${RUN_TAG}-pipeline-${w}.lock"
    export SEARCH_LOCK="/tmp/${RUN_TAG}-search-${w}.lock"
    export LISTING_B_LOG="$LOG"
    export ALLOW_LLM_QUERIES="${ALLOW_LLM_QUERIES:-0}"
    export B_VISION_POST="${B_VISION_POST:-0}"
    export ATTACH_QUALITY_GATE="${ATTACH_QUALITY_GATE:-0}"
    export ATTACH_INGEST_ALL_FILES="${ATTACH_INGEST_ALL_FILES:-0}"
    export ATTACH_MERGE_EXISTING="${ATTACH_MERGE_EXISTING:-1}"
    export LISTING_BLOCK_PNG_URL="${LISTING_BLOCK_PNG_URL:-1}"
    export LISTING_PIXEL_GATE="${LISTING_PIXEL_GATE:-1}"
    export INCREMENTAL_ATTACH="${INCREMENTAL_ATTACH:-0}"
    export SEARCH_TAKE_PER_PLAN="${SEARCH_TAKE_PER_PLAN:-3}"
    export SEARCH_TRY_PER_PLAN="${SEARCH_TRY_PER_PLAN:-0}"
    export SEARCH_STALE_PLANS_STOP="${SEARCH_STALE_PLANS_STOP:-0}"
    export REVERSE_IF_SHORT="${REVERSE_IF_SHORT:-1}"
    export REVERSE_MIN_PICKED="${REVERSE_MIN_PICKED:-8}"
    export ATTACH_MILESTONES="${ATTACH_MILESTONES:-4,8}"
    export ATTACH_TARGET="${ATTACH_TARGET:-8}"
    export LISTING_YEAR_HINT="${LISTING_YEAR_HINT:-2024 2025}"
    exec "$ROOT/backend/scripts/run-listing-b-pipeline.sh"
  ) &
  PIDS+=($!)
  echo "{\"worker\":$w,\"pageIds\":\"$CHUNK\",\"log\":\"$LOG\",\"pid\":${PIDS[$w]}}"
done

FAIL=0
for pid in "${PIDS[@]}"; do
  if ! wait "$pid"; then FAIL=1; fi
done

if [ "$FAIL" -ne 0 ]; then
  echo '{"parallel":"listing-b","finished":false}' >&2
  exit 1
fi
echo '{"parallel":"listing-b","finished":true}'
