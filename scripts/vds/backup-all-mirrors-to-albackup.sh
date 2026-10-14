#!/bin/bash
# Бэкап зеркал DLE/b2-b4 на диск ALBACKUP.
# Цели: b2-b4 VDS, 185.221.214.77, 185.26.121.127, локальный DLE volume.
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

if ! ALBACKUP="$(resolve_albackup_root)"; then
  echo "ERROR: ALBACKUP не смонтирован (/media/admin1/ALBACKUP или /mnt/d)" >&2
  exit 1
fi

DISK_ROOT="${DISK_ROOT:-$ALBACKUP/dle-mirrors-backups}"
KEEP="${KEEP:-3}"
STAMP="$(date +%Y-%m-%d)"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=30 -o IdentitiesOnly=yes)
VDS_IDENTITY="${VDS_IDENTITY:-$HOME/.ssh/b2_b4_vds}"
VDS_HOST="${VDS_HOST:-b2-b4}"

mkdir -p "$DISK_ROOT"
DEST_BASE="$DISK_ROOT/$STAMP"
mkdir -p "$DEST_BASE"

backup_remote() {
  local name="$1" host="$2" identity="$3" remote_dir="${4:-/home/docker/dapp}"
  local dest="$DEST_BASE/$name"
  local remote_tmp="/tmp/${name}-pg.dump"
  mkdir -p "$dest"
  echo "==> [$name] $host"

  ssh "${SSH_OPTS[@]}" -i "$identity" "root@$host" bash -s <<REMOTE
set -euo pipefail
TMP=$remote_tmp
docker exec dapp-postgres sh -c 'pg_dump -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -Fc' > "\$TMP"
ls -lh "\$TMP"
REMOTE

  scp "${SSH_OPTS[@]}" -i "$identity" "root@$host:$remote_tmp" "$dest/postgres.dump"
  ssh "${SSH_OPTS[@]}" -i "$identity" "root@$host" "rm -f $remote_tmp"
  scp "${SSH_OPTS[@]}" -i "$identity" "root@$host:$remote_dir/.env" "$dest/dotenv" 2>/dev/null || true
  scp "${SSH_OPTS[@]}" -i "$identity" "root@$host:$remote_dir/ssl/keys/full_db_encryption.key" \
    "$dest/full_db_encryption.key" 2>/dev/null || true
  chmod 600 "$dest"/* 2>/dev/null || true
  {
    echo "name=$name"
    echo "host=$host"
    echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    ls -lh "$dest"
  } > "$dest/MANIFEST.txt"
  echo "OK $name -> $dest"
}

backup_b2_b4() {
  local name="b2-b4.com-178.212.14.211"
  local dest="$DEST_BASE/$name"
  local remote_tmp=/tmp/b2-b4-pg.dump
  mkdir -p "$dest"
  echo "==> [$name] via Host $VDS_HOST"
  ssh "${SSH_OPTS[@]}" -i "$VDS_IDENTITY" "$VDS_HOST" bash -s <<REMOTE
set -euo pipefail
TMP=$remote_tmp
docker exec dapp-postgres sh -c 'pg_dump -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -Fc' > "\$TMP"
ls -lh "\$TMP"
REMOTE
  scp "${SSH_OPTS[@]}" -i "$VDS_IDENTITY" "$VDS_HOST:$remote_tmp" "$dest/postgres.dump"
  ssh "${SSH_OPTS[@]}" -i "$VDS_IDENTITY" "$VDS_HOST" "rm -f $remote_tmp"
  scp "${SSH_OPTS[@]}" -i "$VDS_IDENTITY" "$VDS_HOST:/home/docker/dapp/.env" "$dest/dotenv" 2>/dev/null || true
  scp "${SSH_OPTS[@]}" -i "$VDS_IDENTITY" \
    "$VDS_HOST:/home/docker/dapp/ssl/keys/full_db_encryption.key" "$dest/full_db_encryption.key" 2>/dev/null || true
  chmod 600 "$dest"/* 2>/dev/null || true
  {
    echo "name=$name"
    echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    ls -lh "$dest"
  } > "$dest/MANIFEST.txt"
  echo "OK $name"
}

backup_local_dle() {
  local name="local-Digital_Legal_Entity-DLE"
  local dest="$DEST_BASE/$name"
  local dle="$HOME/Digital_Legal_Entity(DLE)"
  local vol="digital_legal_entitydle_postgres_data"
  mkdir -p "$dest"
  echo "==> [$name] local volume $vol"

  # ключи
  if [ -f "$dle/ssl/keys/full_db_encryption.key" ]; then
    cp -a "$dle/ssl/keys/full_db_encryption.key" "$dest/"
  fi
  if [ -f "$dle/docker-data/ssl/keys/full_db_encryption.key" ]; then
    cp -a "$dle/docker-data/ssl/keys/full_db_encryption.key" "$dest/full_db_encryption.key.docker-data"
  fi
  # compose без огромных tar
  cp -a "$dle/docker-compose.yml" "$dest/" 2>/dev/null || true
  cp -a "$dle/DLE_VERSION" "$dest/" 2>/dev/null || true

  # дамп из остановленного volume через временный контейнер
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    docker rm -f dle-pg-bak-tmp >/dev/null 2>&1 || true
    docker run -d --name dle-pg-bak-tmp \
      -v "${vol}:/var/lib/postgresql/data" \
      -e POSTGRES_HOST_AUTH_METHOD=trust \
      pgvector/pgvector:pg16 >/dev/null
    for i in $(seq 1 30); do
      if docker exec dle-pg-bak-tmp pg_isready -U dapp_user -d dapp_db >/dev/null 2>&1 \
        || docker exec dle-pg-bak-tmp pg_isready -U postgres >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
    if docker exec dle-pg-bak-tmp pg_dump -U dapp_user -d dapp_db -Fc > "$dest/postgres.dump" 2>/dev/null; then
      echo "dump via dapp_user OK"
    elif docker exec dle-pg-bak-tmp pg_dump -U postgres -d dapp_db -Fc > "$dest/postgres.dump" 2>/dev/null; then
      echo "dump via postgres OK"
    else
      echo "WARN: не удалось pg_dump локального DLE volume" >&2
      rm -f "$dest/postgres.dump"
    fi
    docker rm -f dle-pg-bak-tmp >/dev/null 2>&1 || true
  else
    echo "WARN: volume $vol не найден"
  fi

  # старый sql бэкап если есть
  if [ -f "$HOME/backups/backup_20250727_020001.sql" ]; then
    cp -a "$HOME/backups/backup_20250727_020001.sql" "$dest/" 2>/dev/null || true
  fi

  chmod 600 "$dest"/full_db_encryption.key* "$dest/postgres.dump" 2>/dev/null || true
  {
    echo "name=$name"
    echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    ls -lh "$dest"
  } > "$dest/MANIFEST.txt"
  echo "OK $name"
}

backup_b2_b4
backup_remote "vds-185.221.214.77" "185.221.214.77" "$HOME/.ssh/id_rsa"
backup_remote "vds-185.26.121.127" "185.26.121.127" "$HOME/.ssh/id_rsa"
backup_local_dle

# сводка
{
  echo "stamp=$STAMP"
  echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  du -sh "$DEST_BASE"/* 2>/dev/null || true
} | tee "$DEST_BASE/MANIFEST.txt"

# ротация дневных каталогов
mapfile -t dirs < <(find "$DISK_ROOT" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' | sort -r)
n=0
for d in "${dirs[@]}"; do
  n=$((n + 1))
  if [ "$n" -gt "$KEEP" ]; then
    echo "rotate remove $d"
    rm -rf "$d"
  fi
done

echo "==> done $DEST_BASE"
du -sh "$DEST_BASE" "$DISK_ROOT"
