#!/bin/bash
# Удалить прямые /32 маршруты обхода VPN.
# Запуск: sudo ./scripts/vpn/remove-direct-routes.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Нужен root: sudo $0" >&2
  exit 1
fi

IPS=(
  178.212.14.211
  185.221.214.77
  185.26.121.127
  185.26.122.131
  185.26.122.10
)

for ip in "${IPS[@]}"; do
  if ip route del "${ip}/32" 2>/dev/null; then
    echo "deleted ${ip}/32"
  else
    echo "skip ${ip}/32 (нет маршрута)"
  fi
done

echo "Готово."
