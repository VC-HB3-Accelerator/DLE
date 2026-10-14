#!/bin/bash
# Прямые /32 маршруты в обход VPN (v2rayA / tun) для своих серверов.
# Запуск: sudo ./scripts/vpn/add-direct-routes.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Нужен root: sudo $0" >&2
  exit 1
fi

# Физический default (не docker/veth/tun/wg)
read -r GW DEV < <(
  ip -4 route show default |
    awk '
      /default via/ {
        gw=""; dev="";
        for (i=1;i<=NF;i++) {
          if ($i=="via") gw=$(i+1);
          if ($i=="dev") dev=$(i+1);
        }
        if (dev ~ /^(wlp|wlan|enp|eth|eno|ens)/ && gw != "") {
          print gw, dev; exit
        }
      }'
)

if [ -z "${GW:-}" ] || [ -z "${DEV:-}" ]; then
  echo "ERROR: не найден физический шлюз Wi‑Fi/Ethernet. Отключите VPN и повторите." >&2
  ip -4 route show default >&2 || true
  exit 1
fi

echo "Шлюз=${GW} интерфейс=${DEV}"

IPS=(
  178.212.14.211   # b2-b4.com
  185.221.214.77   # hb3-accelerator.com
  185.26.121.127   # ssh / сервер
  185.26.122.131   # hostland.ru
  185.26.122.10    # hostland panel
)

for ip in "${IPS[@]}"; do
  ip route replace "${ip}/32" via "$GW" dev "$DEV" metric 50
  echo "OK ${ip}/32 -> ${GW} dev ${DEV}"
done

# Форвардинг для Docker (часто сбрасывается transparent-прокси)
sysctl -w net.ipv4.ip_forward=1 >/dev/null
iptables -P FORWARD ACCEPT 2>/dev/null || true

echo
echo "Проверка:"
for ip in "${IPS[@]}"; do
  ip -4 route get "$ip" | head -1
done
echo
echo "Готово. В v2rayA добавьте эти IP и 172.16.0.0/12 в direct (см. README.ru.md)."
echo "После смены Wi‑Fi/роутера запустите скрипт снова."
