#!/bin/bash
# Мониторинг https://b2-b4.com с Hostland serv80.
# Hostland затирает user crontab → расписание через at (цепочка +2 min).
URL="https://b2-b4.com/"
TO="info@b2-b4.com"
FROM="info@b2-b4.com"
STATE="$HOME/.auto-lends-up"
LOG="$HOME/logs/check-auto-lends.log"
LOCK="$HOME/.auto-lends-check.lock"
SCRIPT="$HOME/bin/check-auto-lends.sh"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

mkdir -p "$HOME/logs" "$HOME/bin"

schedule_next() {
  # убрать старые задания этой цепочки, чтобы не плодить очередь
  if command -v atq >/dev/null 2>&1; then
    atq 2>/dev/null | awk '{print $1}' | while read -r job; do
      [ -n "$job" ] || continue
      if at -c "$job" 2>/dev/null | grep -qF "check-auto-lends.sh"; then
        atrm "$job" 2>/dev/null || true
      fi
    done
  fi
  # следующее выполнение через 2 минуты
  echo "$SCRIPT" | at now + 2 minutes 2>/dev/null || true
}

# простой lock от параллельных запусков
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    schedule_next
    exit 0
  fi
fi

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$URL" || echo "000")

if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]; then
  if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "down" ]; then
    echo "$TS RECOVERED http=$code" | tee -a "$LOG"
    printf "Subject: [auto-lends] site is UP again\nFrom: %s\nTo: %s\nContent-Type: text/plain; charset=UTF-8\n\nRecovered at %s (HTTP %s)\n" \
      "$FROM" "$TO" "$TS" "$code" | sendmail -t
  fi
  echo up > "$STATE"
  echo "$TS OK http=$code" >> "$LOG"
else
  echo "$TS DOWN http=$code" | tee -a "$LOG"
  if [ ! -f "$STATE" ] || [ "$(cat "$STATE")" != "down" ]; then
    printf "Subject: [auto-lends] site is DOWN\nFrom: %s\nTo: %s\nContent-Type: text/plain; charset=UTF-8\n\nDown at %s\nURL: %s\nHTTP: %s\nAction: Power Off/On in Hostland panel for VDS 178.212.14.211\n" \
      "$FROM" "$TO" "$TS" "$URL" "$code" | sendmail -t
    echo down > "$STATE"
  fi
fi

# не раздувать лог на shared-хостинге
if [ -f "$LOG" ]; then
  lines=$(wc -l < "$LOG" 2>/dev/null || echo 0)
  if [ "$lines" -gt 300 ]; then
    tail -n 150 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
  fi
fi

schedule_next
exit 0
