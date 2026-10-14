#!/usr/bin/env bash
# Mass plan B: страницы 2026 с <8 фото, батчами; опционально цикл до полной восьмёрки.
#
#   BATCH_SIZE=50 WORKERS=4 ./backend/scripts/run-listing-b-mass-batches.sh
#   LISTING_B_MASS_LOOP_UNTIL_FULL=1   # default 1 — крутить раунды, пока в очереди есть id
#   LISTING_MASS_LIST_BELOW=5          # очередь только photos < 5; ATTACH_TARGET=8 — цель attach
#   LISTING_B_MASS_MAX_ROUNDS=50
#   SEARCH_TAKE_PER_PLAN=2
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BATCH_SIZE="${BATCH_SIZE:-50}"
WORKERS="${WORKERS:-4}"
RUN_ID="${LISTING_B_MASS_RUN_ID:-listing-b-mass-full-$(date +%Y%m%d)}"
ORCH_LOCK="${LISTING_B_MASS_ORCH_LOCK:-/tmp/listing-b-mass-orchestrator.lock}"
MASTER_LOG="${LISTING_B_MASS_MASTER_LOG:-/tmp/${RUN_ID}-orchestrator.log}"
IDS_FILE="${LISTING_B_MASS_IDS_FILE:-/tmp/${RUN_ID}-under8-ids.txt}"
LOOP_UNTIL_FULL="${LISTING_B_MASS_LOOP_UNTIL_FULL:-1}"
MAX_ROUNDS="${LISTING_B_MASS_MAX_ROUNDS:-50}"
LISTING_MASS_CATEGORY="${LISTING_MASS_CATEGORY:-2026}"
ATTACH_TARGET="${ATTACH_TARGET:-8}"
LISTING_MASS_LIST_BELOW="${LISTING_MASS_LIST_BELOW:-}"
LIST_LOOP_THRESHOLD="${LISTING_MASS_LIST_BELOW:-8}"

exec 8>"$ORCH_LOCK"
if ! flock -n 8; then
  echo "{\"orchestrator\":\"listing-b-mass\",\"error\":\"already_running\",\"lock\":\"$ORCH_LOCK\"}" >&2
  exit 1
fi

sync_listing_b_docker_scripts() {
  docker.exe cp "$ROOT/backend/scripts/listing-b-mass/list-under8-page-ids.js" dapp-backend:/app/scripts/list-under8-page-ids.js
  docker.exe cp "$ROOT/backend/scripts/listing-b-mass/attach-listing-objfix-b.js" dapp-backend:/app/scripts/attach-listing-objfix-b.js
  docker.exe cp "$ROOT/backend/scripts/listing-b-mass/dedupe-listing-gallery-by-hash.js" dapp-backend:/app/scripts/dedupe-listing-gallery-by-hash.js
  docker.exe cp "$ROOT/backend/scripts/listing-b-mass/normalize-listing-feed-image.js" dapp-backend:/app/scripts/normalize-listing-feed-image.js
  local SPAWN_JSON="$ROOT/backend/scripts/listing-b-mass/listing-spawn-json.js"
  if [ ! -s "$SPAWN_JSON" ]; then
    SPAWN_JSON="$ROOT/backend/scripts/listing-spawn-json.js"
  fi
  if [ -s "$SPAWN_JSON" ]; then
    docker.exe cp "$SPAWN_JSON" dapp-backend:/app/scripts/listing-spawn-json.js
  fi
  docker.exe cp "$ROOT/backend/scripts/listing-b-mass/listing-photo-pixel-heuristic.js" dapp-backend:/app/scripts/listing-photo-pixel-heuristic.js
  docker.exe cp "$ROOT/backend/scripts/listing-b-mass/listing-extra-url-block.js" dapp-backend:/app/scripts/listing-extra-url-block.js
  docker.exe cp "$ROOT/backend/scripts/listing-b-mass/patch-content-media-listing-page-hash.js" dapp-backend:/app/scripts/patch-content-media-listing-page-hash.js
  docker.exe exec -w /app dapp-backend node scripts/patch-content-media-listing-page-hash.js 2>&1 || true
}
sync_listing_b_docker_scripts

count_ge8() {
  docker.exe exec -w /app -e LISTING_MASS_CATEGORY="$LISTING_MASS_CATEGORY" dapp-backend node -e "
const db=require('./db');
const cat=process.env.LISTING_MASS_CATEGORY||'';
(async()=>{
  const {rows:[r]}=await db.getQuery()(\`
    SELECT count(*)::int total,
      sum(CASE WHEN COALESCE(jsonb_array_length(settings->'listing_media'->'photos'),0)>=8 THEN 1 ELSE 0 END)::int ge8
    FROM admin_pages_simple WHERE (\$1='' OR category=\$1)
  \`,[cat]);
  console.log(JSON.stringify(r));
  process.exit(0);
})();"
}

run_dedupe_galleries() {
  echo '{"orchestrator":"listing-b-mass","phase":"dedupe_gallery_by_hash"}' | tee -a "$MASTER_LOG"
  docker.exe exec -w /app \
    -e APPLY=1 \
    -e LISTING_MASS_CATEGORY="$LISTING_MASS_CATEGORY" \
    dapp-backend node scripts/dedupe-listing-gallery-by-hash.js 2>&1 | tee -a "$MASTER_LOG"
}

run_one_pass() {
  local ROUND="$1"
  echo "{\"orchestrator\":\"listing-b-mass\",\"phase\":\"list_ids\",\"runId\":\"$RUN_ID\",\"round\":$ROUND,\"batchSize\":$BATCH_SIZE,\"workers\":$WORKERS,\"category\":\"$LISTING_MASS_CATEGORY\",\"listBelow\":\"${LISTING_MASS_LIST_BELOW:-8}\",\"attachTarget\":$ATTACH_TARGET,\"loopUntilFull\":$LOOP_UNTIL_FULL}" | tee -a "$MASTER_LOG"
  if [ "${LISTING_B_MASS_REFRESH_IDS:-1}" = "1" ]; then
    docker.exe exec -w /app \
      -e ATTACH_TARGET="$ATTACH_TARGET" \
      -e LISTING_MASS_LIST_BELOW="$LISTING_MASS_LIST_BELOW" \
      -e LISTING_MASS_CATEGORY="$LISTING_MASS_CATEGORY" \
      dapp-backend node scripts/list-under8-page-ids.js 2>>"$MASTER_LOG" | grep -E '^[0-9]+$' > "$IDS_FILE"
  else
    [ -s "$IDS_FILE" ] || { echo '{"orchestrator":"listing-b-mass","error":"missing_ids_file"}' >&2; return 1; }
  fi
  local TOTAL
  TOTAL="$(wc -l < "$IDS_FILE" | tr -d ' ')"
  echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"totalIds\":$TOTAL,\"idsFile\":\"$IDS_FILE\"}" | tee -a "$MASTER_LOG"

  if [ "$TOTAL" -eq 0 ]; then
    echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"finished\":true,\"reason\":\"nothing_to_do\"}" | tee -a "$MASTER_LOG"
    return 0
  fi

  local BATCH_N=0
  local FAIL_BATCHES=0
  while IFS= read -r chunk || [ -n "${chunk:-}" ]; do
    [ -z "$chunk" ] && continue
    BATCH_N=$((BATCH_N + 1))
    local BATCH_TAG="${RUN_ID}-r${ROUND}-batch-$(printf '%03d' "$BATCH_N")"
    echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"batch\":$BATCH_N,\"pageIds\":\"$chunk\",\"tag\":\"$BATCH_TAG\"}" | tee -a "$MASTER_LOG"

    (
      unset LISTING_B_HOST_MJS
      export PAGE_IDS="$chunk"
      export LISTING_B_RUN_ID="$BATCH_TAG"
      export WORKERS="$WORKERS"
      export B_VISION_POST=0
      export ATTACH_QUALITY_GATE=0
      export ALLOW_LLM_QUERIES=0
      export ATTACH_MERGE_EXISTING="${ATTACH_MERGE_EXISTING:-1}"
      export ATTACH_INGEST_ALL_FILES="${ATTACH_INGEST_ALL_FILES:-0}"
      export LISTING_BLOCK_PNG_URL="${LISTING_BLOCK_PNG_URL:-1}"
      export LISTING_PIXEL_GATE="${LISTING_PIXEL_GATE:-1}"
      export ATTACH_RESET_FILE_MAP="${ATTACH_RESET_FILE_MAP:-0}"
      export KEEP_OBJFIX=1
      export OBJFIX_BIND_MOUNT=1
      export INCREMENTAL_ATTACH="${LISTING_B_MASS_INCREMENTAL_ATTACH:-0}"
      export SEARCH_TAKE_PER_PLAN="${SEARCH_TAKE_PER_PLAN:-3}"
      export SEARCH_TRY_PER_PLAN="${SEARCH_TRY_PER_PLAN:-0}"
      export SEARCH_STALE_PLANS_STOP="${SEARCH_STALE_PLANS_STOP:-0}"
      export REVERSE_IF_SHORT="${REVERSE_IF_SHORT:-1}"
      export REVERSE_MIN_PICKED="${REVERSE_MIN_PICKED:-8}"
      export LISTING_YEAR_HINT="${LISTING_YEAR_HINT:-2024 2025}"
      export ATTACH_MILESTONES="${ATTACH_MILESTONES:-4,8}"
      export ATTACH_TARGET="$ATTACH_TARGET"
      bash "$ROOT/backend/scripts/run-listing-b-parallel.sh"
    ) >> "$MASTER_LOG" 2>&1 || FAIL_BATCHES=$((FAIL_BATCHES + 1))

    echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"batchDone\":$BATCH_N,\"failBatchesSoFar\":$FAIL_BATCHES}" | tee -a "$MASTER_LOG"
  done < <(
    mapfile -t _ALL_IDS < "$IDS_FILE"
    for (( _s = 0; _s < ${#_ALL_IDS[@]}; _s += BATCH_SIZE )); do
      _chunk=""
      for (( _j = _s; _j < _s + BATCH_SIZE && _j < ${#_ALL_IDS[@]}; _j += 1 )); do
        [ -n "$_chunk" ] && _chunk+=","
        _chunk+="${_ALL_IDS[_j]}"
      done
      printf '%s\n' "$_chunk"
    done
  )

  if [ "$FAIL_BATCHES" -ne 0 ]; then
    echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"finished\":false,\"failBatches\":$FAIL_BATCHES,\"batches\":$BATCH_N}" | tee -a "$MASTER_LOG"
    return 1
  fi
  echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"passFinished\":true,\"batches\":$BATCH_N,\"totalIds\":$TOTAL}" | tee -a "$MASTER_LOG"
  return 0
}

echo "{\"orchestrator\":\"listing-b-mass\",\"phase\":\"start\",\"runId\":\"$RUN_ID\",\"masterLog\":\"$MASTER_LOG\"}" | tee "$MASTER_LOG"
run_dedupe_galleries || true

ROUND=0
PASS_FAIL=0
while true; do
  ROUND=$((ROUND + 1))
  if [ "$ROUND" -gt "$MAX_ROUNDS" ]; then
    echo "{\"orchestrator\":\"listing-b-mass\",\"finished\":false,\"reason\":\"max_rounds\",\"rounds\":$MAX_ROUNDS}" | tee -a "$MASTER_LOG"
    exit 1
  fi
  if ! run_one_pass "$ROUND"; then
    PASS_FAIL=1
    break
  fi
  STATS="$(count_ge8)"
  echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"stats\":$STATS}" | tee -a "$MASTER_LOG"
  run_dedupe_galleries || true
  QUEUE_REMAINING="$(docker.exe exec -w /app \
    -e LISTING_MASS_CATEGORY="$LISTING_MASS_CATEGORY" \
    -e LIST_LOOP_THRESHOLD="$LIST_LOOP_THRESHOLD" \
    dapp-backend node -e "
const db=require('./db');const cat=process.env.LISTING_MASS_CATEGORY||'';
const th=Math.min(8,Math.max(1,Number(process.env.LIST_LOOP_THRESHOLD||8)));
(async()=>{const {rows:[r]}=await db.getQuery()(\`
  SELECT count(*)::int u FROM admin_pages_simple
  WHERE (\$1='' OR category=\$1) AND COALESCE(jsonb_array_length(settings->'listing_media'->'photos'),0)<\$2
\`,[cat,th]);console.log(r.u);process.exit(0);})();")"
  echo "{\"orchestrator\":\"listing-b-mass\",\"round\":$ROUND,\"queueRemaining\":$QUEUE_REMAINING,\"listBelow\":$LIST_LOOP_THRESHOLD}" | tee -a "$MASTER_LOG"
  if [ "$QUEUE_REMAINING" -eq 0 ]; then
    FINISH_REASON="all_ge8"
    if [ -n "$LISTING_MASS_LIST_BELOW" ]; then
      FINISH_REASON="all_ge_list_below"
    fi
    echo "{\"orchestrator\":\"listing-b-mass\",\"finished\":true,\"reason\":\"$FINISH_REASON\",\"rounds\":$ROUND,\"stats\":$STATS,\"queueRemaining\":0,\"listBelow\":$LIST_LOOP_THRESHOLD}" | tee -a "$MASTER_LOG"
    exit 0
  fi
  if [ "$LOOP_UNTIL_FULL" != "1" ]; then
    echo "{\"orchestrator\":\"listing-b-mass\",\"finished\":true,\"reason\":\"single_pass\",\"rounds\":$ROUND,\"queueRemaining\":$QUEUE_REMAINING,\"listBelow\":$LIST_LOOP_THRESHOLD,\"stats\":$STATS}" | tee -a "$MASTER_LOG"
    exit 0
  fi
done

if [ "$PASS_FAIL" -ne 0 ]; then
  exit 1
fi
