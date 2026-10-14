#!/bin/bash
# Смонтировать D: (ALBACKUP) в WSL при необходимости.
# В cron sudo обычно недоступен — если диск подключён, WSL часто сам даёт /mnt/d.
set -euo pipefail

if df -h /mnt/d 2>/dev/null | grep -qE '^D:|/mnt/d'; then
  # убедиться что это не корневой FS WSL
  size=$(df -BG /mnt/d 2>/dev/null | awk 'NR==2{gsub(/G/,"",$2); print $2}')
  if [ -n "${size:-}" ] && [ "$size" -lt 500 ] 2>/dev/null; then
    echo "OK: $(df -h /mnt/d | tail -1)"
    exit 0
  fi
fi

mkdir -p /mnt/d 2>/dev/null || true
if mount -t drvfs D: /mnt/d -o "metadata,uid=$(id -u),gid=$(id -g),umask=0077" 2>/dev/null; then
  echo "mounted: $(df -h /mnt/d | tail -1)"
  exit 0
fi

echo "WARN: не удалось смонтировать D:. Подключите диск и откройте WSL, либо: sudo mount -t drvfs D: /mnt/d"
exit 1
