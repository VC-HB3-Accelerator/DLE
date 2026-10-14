#!/bin/bash
# Тянет бэкап Postgres (+ .env + ключ шифрования БД) с VDS на локаль.
# Предпочтительно на съёмный диск ALBACKUP: …/b2-b4.com-backups
#
# KEEP=3 дневных копий. Ключ кладётся только на BACKUP_ROOT (не в git).

set -euo pipefail

SSH_HOST="${SSH_HOST:-b2-b4}"
KEEP="${KEEP:-3}"
INCLUDE_KEY="${INCLUDE_KEY:-1}"
STAMP="$(date +%Y-%m-%d)"
REMOTE_TMP="/tmp/b2-b4-pg.dump"

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

# Диск ALBACKUP, иначе домашний каталог
if [ -z "${BACKUP_ROOT:-}" ]; then
  if ROOT="$(resolve_albackup_root)"; then
    BACKUP_ROOT="$ROOT/b2-b4.com-backups"
  else
    BACKUP_ROOT="$HOME/backups/b2-b4.com"
    echo "WARN: ALBACKUP недоступен — пишем в $BACKUP_ROOT"
  fi
fi

DEST="$BACKUP_ROOT/$STAMP"
mkdir -p "$DEST"

echo "==> destination: $DEST"
echo "==> pg_dump on VDS ($SSH_HOST)"
ssh -o BatchMode=yes -o ConnectTimeout=30 "$SSH_HOST" bash -s <<'REMOTE'
set -euo pipefail
TMP=/tmp/b2-b4-pg.dump
docker exec dapp-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TMP"
ls -lh "$TMP"
REMOTE

echo "==> download dump"
scp -o BatchMode=yes "$SSH_HOST:$REMOTE_TMP" "$DEST/postgres.dump"
ssh -o BatchMode=yes "$SSH_HOST" "rm -f $REMOTE_TMP"

echo "==> copy .env"
scp -o BatchMode=yes "$SSH_HOST:/home/docker/dapp/.env" "$DEST/dotenv" 2>/dev/null || \
  echo "(skip .env)"

if [ "$INCLUDE_KEY" = "1" ]; then
  echo "==> copy full_db_encryption.key"
  scp -o BatchMode=yes \
    "$SSH_HOST:/home/docker/dapp/ssl/keys/full_db_encryption.key" \
    "$DEST/full_db_encryption.key" 2>/dev/null || \
    echo "(skip key — файл не найден на VDS)"
fi

chmod 600 "$DEST/postgres.dump" "$DEST/dotenv" "$DEST/full_db_encryption.key" 2>/dev/null || true

{
  echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host=$SSH_HOST"
  echo "backup_root=$BACKUP_ROOT"
  echo "include_key=$INCLUDE_KEY"
  ls -lh "$DEST" || true
} > "$DEST/MANIFEST.txt"

echo "==> rotate keep=$KEEP"
mapfile -t dirs < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' | sort -r)
n=0
for d in "${dirs[@]}"; do
  n=$((n + 1))
  if [ "$n" -gt "$KEEP" ]; then
    echo "remove $d"
    rm -rf "$d"
  fi
done

echo "==> done: $DEST"
du -sh "$DEST" "$BACKUP_ROOT"
