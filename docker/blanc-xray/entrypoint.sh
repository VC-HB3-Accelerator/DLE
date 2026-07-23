#!/bin/sh
# Следит за config.json / reload.flag и перезапускает xray.
set -eu
CONFIG_DIR="${CONFIG_DIR:-/etc/xray}"
CONFIG_FILE="$CONFIG_DIR/config.json"
RELOAD_FLAG="$CONFIG_DIR/reload.flag"
PID=""

mkdir -p "$CONFIG_DIR"

# Минимальный конфиг, пока backend не записал Blanc
if [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" <<'EOF'
{
  "log": { "loglevel": "warning" },
  "inbounds": [{
    "tag": "socks-in",
    "listen": "0.0.0.0",
    "port": 1080,
    "protocol": "socks",
    "settings": { "udp": true, "auth": "noauth" }
  }],
  "outbounds": [
    { "tag": "direct", "protocol": "freedom" }
  ]
}
EOF
fi

start_xray() {
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  echo "[blanc-xray] starting xray with $CONFIG_FILE"
  xray run -c "$CONFIG_FILE" &
  PID=$!
}

LAST_MTIME=""
start_xray

while true; do
  MT=$(stat -c %Y "$CONFIG_FILE" 2>/dev/null || echo 0)
  RF=$(stat -c %Y "$RELOAD_FLAG" 2>/dev/null || echo 0)
  CUR="${MT}:${RF}"
  if [ "$CUR" != "$LAST_MTIME" ]; then
    LAST_MTIME="$CUR"
    # Не рестартим на самом первом проходе после start
    if [ -n "${BOOTED:-}" ]; then
      echo "[blanc-xray] config changed, restarting"
      start_xray
    else
      BOOTED=1
    fi
  fi
  if [ -n "$PID" ] && ! kill -0 "$PID" 2>/dev/null; then
    echo "[blanc-xray] xray exited, restarting"
    start_xray
  fi
  sleep 2
done
