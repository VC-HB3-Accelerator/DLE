#!/bin/bash
# Снимок исходников b2-b4.com (+ опционально DLE) на ALBACKUP (без node_modules / шаблона / docker images).
set -euo pipefail

resolve_albackup_root() {
  if [ -n "${ALBACKUP_ROOT:-}" ] && [ -d "$ALBACKUP_ROOT" ]; then
    echo "$ALBACKUP_ROOT"
    return
  fi
  if [ -d /media/admin1/ALBACKUP ] && touch /media/admin1/ALBACKUP/.write_test 2>/dev/null; then
    rm -f /media/admin1/ALBACKUP/.write_test
    echo /media/admin1/ALBACKUP
    return
  fi
  if [ -d /mnt/d ] && touch /mnt/d/.write_test 2>/dev/null; then
    rm -f /mnt/d/.write_test
    echo /mnt/d
    return
  fi
  return 1
}

if ! DISK="$(resolve_albackup_root)"; then
  echo "ERROR: ALBACKUP не смонтирован (/media/admin1/ALBACKUP или /mnt/d)" >&2
  exit 1
fi

DEST="${DEST:-$DISK/code-snapshots}"
STAMP="$(date +%Y-%m-%d)"
OUT="$DEST/$STAMP"
PROJECT_SRC="${PROJECT_SRC:-$HOME/b2-b4.com}"
DLE_SRC="${DLE_SRC:-$HOME/Digital_Legal_Entity(DLE)}"

mkdir -p "$OUT/b2-b4.com"

RSYNC_EXCLUDES=(
  --exclude=node_modules/
  --exclude=frontend/node_modules/
  --exclude=backend/node_modules/
  --exclude=webssh-agent/node_modules/
  --exclude=dist/
  --exclude=frontend/dist/
  --exclude=.nuxt/
  --exclude=coverage/
  --exclude='*.log'
  --exclude=.cache/
  --exclude=tmp/
  --exclude=temp/
)

echo "==> b2-b4.com -> $OUT/b2-b4.com"
rsync -a --info=stats2 \
  "${RSYNC_EXCLUDES[@]}" \
  --exclude='ssl/keys/' \
  "$PROJECT_SRC/" "$OUT/b2-b4.com/"
# ключи ssl отдельно с правами
mkdir -p "$OUT/b2-b4.com/ssl/keys"
if [ -f "$PROJECT_SRC/ssl/keys/full_db_encryption.key" ]; then
  cp -a "$PROJECT_SRC/ssl/keys/full_db_encryption.key" "$OUT/b2-b4.com/ssl/keys/"
  chmod 600 "$OUT/b2-b4.com/ssl/keys/full_db_encryption.key"
fi

if [ -d "$DLE_SRC" ]; then
  mkdir -p "$OUT/Digital_Legal_Entity-DLE"
  echo "==> Digital_Legal_Entity(DLE) -> $OUT/Digital_Legal_Entity-DLE"
  rsync -a --info=stats2 \
    "${RSYNC_EXCLUDES[@]}" \
    --exclude='dle-template.tar.gz' \
    --exclude='dle-template.tar.gz.part-*' \
    --exclude='docker-data/images/' \
    --exclude='docker-data/volumes/' \
    "$DLE_SRC/" "$OUT/Digital_Legal_Entity-DLE/"

  chmod -R go-rwx "$OUT/Digital_Legal_Entity-DLE/ssl" "$OUT/Digital_Legal_Entity-DLE/docker-data/ssl" \
    "$OUT/Digital_Legal_Entity-DLE/ops-private" 2>/dev/null || true
else
  echo "WARN: DLE src not found ($DLE_SRC) — skip"
fi

{
  echo "stamp=$STAMP"
  echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "project_src=$PROJECT_SRC"
  echo "excluded=node_modules,dist,dle-template*.tar.gz*,docker-data/images,docker-data/volumes"
  echo "note=DB dumps in $DISK/b2-b4.com-backups and $DISK/dle-mirrors-backups"
  du -sh "$OUT"/* 2>/dev/null || true
} | tee "$OUT/MANIFEST.txt"

# keep 2 code snapshots (они тяжелее дампов)
mapfile -t dirs < <(find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' | sort -r)
n=0
for d in "${dirs[@]}"; do
  n=$((n + 1))
  if [ "$n" -gt 2 ]; then
    echo "rotate remove $d"
    rm -rf "$d"
  fi
done

echo "==> done"
du -sh "$OUT" "$DEST"
df -h "$DISK" | tail -1
