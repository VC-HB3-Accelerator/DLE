#!/bin/bash
# Проверка исходящей сети на VDS.
# Если шлюз/DNS недоступны несколько циклов подряд — сначала restart networkd,
# затем soft reboot (с кулдауном).
#
# Важно: если «лежит» сеть на стороне гипервизора Hostland (как 03.09.2026),
# soft reboot из гостя часто НЕ помогает — нужен Power Off/On в панели.
# Этот скрипт чинит залипший сетевой стек гостя и ускоряет восстановление
# в части случаев; плюс пишет явный след в syslog.

set -eu

STATE_DIR=/var/lib/vds-net-watchdog
FAIL_FILE="$STATE_DIR/fail_count"
ACTION_FILE="$STATE_DIR/last_action"
LOG_TAG=vds-net-watchdog

# Сколько подряд неудачных проверок (таймер ~2 мин → ~6 мин) до restart сети
FAIL_BEFORE_NET_RESTART="${FAIL_BEFORE_NET_RESTART:-3}"
# Ещё столько же после restart → soft reboot
FAIL_BEFORE_REBOOT="${FAIL_BEFORE_REBOOT:-3}"
# Не чаще одного soft reboot за N секунд
REBOOT_COOLDOWN_SEC="${REBOOT_COOLDOWN_SEC:-1800}"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

log() {
  logger -t "$LOG_TAG" -- "$*"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

get_fail() {
  if [ -f "$FAIL_FILE" ]; then cat "$FAIL_FILE"; else echo 0; fi
}

set_fail() {
  echo "$1" > "$FAIL_FILE"
}

check_ok() {
  local gw
  gw="$(ip -4 route show default 2>/dev/null | awk '{print $3; exit}')"
  if [ -n "${gw:-}" ]; then
    if ping -c 1 -W 2 "$gw" >/dev/null 2>&1; then
      return 0
    fi
  fi
  if ping -c 1 -W 2 1.1.1.1 >/dev/null 2>&1; then
    return 0
  fi
  if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

can_reboot() {
  local now last
  now="$(date +%s)"
  if [ ! -f "$ACTION_FILE" ]; then
    return 0
  fi
  last="$(awk '/^reboot /{print $2; exit}' "$ACTION_FILE" || true)"
  if [ -z "${last:-}" ]; then
    return 0
  fi
  if [ $((now - last)) -ge "$REBOOT_COOLDOWN_SEC" ]; then
    return 0
  fi
  return 1
}

if check_ok; then
  prev="$(get_fail)"
  if [ "$prev" != "0" ]; then
    log "network OK again (was fail_count=$prev)"
  fi
  set_fail 0
  exit 0
fi

fails=$(( $(get_fail) + 1 ))
set_fail "$fails"
log "network check FAILED fail_count=$fails"

if [ "$fails" -eq "$FAIL_BEFORE_NET_RESTART" ]; then
  log "restarting systemd-networkd / resolved"
  echo "net_restart $(date +%s)" >> "$ACTION_FILE"
  systemctl try-restart systemd-networkd.service systemd-resolved.service || true
  # docker DNS иногда залипает вместе с резолвером
  if command -v docker >/dev/null 2>&1; then
    docker exec dapp-frontend-nginx nginx -s reload >/dev/null 2>&1 || true
  fi
  exit 0
fi

reboot_at=$(( FAIL_BEFORE_NET_RESTART + FAIL_BEFORE_REBOOT ))
if [ "$fails" -ge "$reboot_at" ]; then
  if can_reboot; then
    log "soft reboot (outbound network still dead after $fails checks). If this does not restore public access — use Hostland Power Off/On"
    echo "reboot $(date +%s)" >> "$ACTION_FILE"
    set_fail 0
    /sbin/shutdown -r +1 "vds-net-watchdog: outbound network unreachable"
  else
    log "reboot skipped (cooldown ${REBOOT_COOLDOWN_SEC}s). Use Hostland Power Off/On if still unreachable from Internet"
  fi
fi

exit 0
