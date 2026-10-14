#!/bin/bash
# Очистка/ротация логов на VDS auto-lends (диск и рост json-логов Docker).
# Не трогает БД и volumes с данными.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/docker/dapp}"
LOG_TAG=vds-log-cleanup

log() { logger -t "$LOG_TAG" -- "$*"; echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

# 1) journald
if command -v journalctl >/dev/null 2>&1; then
  journalctl --vacuum-size=80M --vacuum-time=7d >/dev/null 2>&1 || true
fi

# 2) backend app logs — держим хвост
if [ -d "$APP_DIR/backend/logs" ]; then
  for f in "$APP_DIR/backend/logs"/*.log; do
    [ -f "$f" ] || continue
    # если > 5M — оставить последние 2000 строк
    sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
    if [ "$sz" -gt 5242880 ]; then
      tail -n 2000 "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"
      log "truncated $f"
    fi
  done
fi

# 3) docker container json logs truncate if huge (>50M) — rotation обычно через daemon.json
if [ -d /var/lib/docker/containers ]; then
  find /var/lib/docker/containers -name '*-json.log' -type f -size +50M 2>/dev/null | while read -r lf; do
    : > "$lf" || true
    log "truncated docker log $lf"
  done
fi

# 4) docker prune безопасный (только dangling)
if command -v docker >/dev/null 2>&1; then
  docker container prune -f >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
fi

# 5) мусорные одноразовые архивы импорта
for junk in \
  "$APP_DIR/docker-images-and-data.tar.gz" \
  "$APP_DIR"/*.tar.gz.bak
do
  if [ -f "$junk" ]; then
    rm -f "$junk"
    log "removed $junk"
  fi
done

log "cleanup done; disk=$(df -h / | awk 'NR==2{print $5}')"
