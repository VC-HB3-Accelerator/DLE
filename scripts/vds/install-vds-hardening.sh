#!/bin/bash
# Установка hardening / watchdog на Auto-lends VDS.
# Запуск на сервере: bash scripts/vds/install-vds-hardening.sh
# Или с локали: ssh auto-lends 'bash -s' < scripts/vds/install-vds-hardening.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/home/docker/dapp}"

echo "==> net watchdog"
install -d -m 0755 /usr/local/sbin
if [ -f "$SCRIPT_DIR/net-watchdog.sh" ]; then
  install -m 0755 "$SCRIPT_DIR/net-watchdog.sh" /usr/local/sbin/vds-net-watchdog.sh
elif [ -f "$APP_DIR/scripts/vds/net-watchdog.sh" ]; then
  install -m 0755 "$APP_DIR/scripts/vds/net-watchdog.sh" /usr/local/sbin/vds-net-watchdog.sh
else
  echo "net-watchdog.sh not found" >&2
  exit 1
fi

UNIT_SRC="$SCRIPT_DIR"
[ -f "$UNIT_SRC/vds-net-watchdog.service" ] || UNIT_SRC="$APP_DIR/scripts/vds"

install -m 0644 "$UNIT_SRC/vds-net-watchdog.service" /etc/systemd/system/vds-net-watchdog.service
install -m 0644 "$UNIT_SRC/vds-net-watchdog.timer" /etc/systemd/system/vds-net-watchdog.timer
systemctl daemon-reload
systemctl enable --now vds-net-watchdog.timer
systemctl start vds-net-watchdog.service || true

echo "==> swap (2G) if missing"
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile || true
  if ! grep -q '^/swapfile ' /etc/fstab 2>/dev/null; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  sysctl -w vm.swappiness=10 >/dev/null
  if ! grep -q '^vm.swappiness=' /etc/sysctl.d/99-vds-hardening.conf 2>/dev/null; then
    echo 'vm.swappiness=10' > /etc/sysctl.d/99-vds-hardening.conf
  fi
else
  echo "swap already active"
fi

echo "==> fail2ban jail.local (sshd only, systemd backend)"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 3600
maxretry = 8
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
backend = systemd
maxretry = 8
bantime = 3600
findtime = 3600
EOF
systemctl restart fail2ban
sleep 1
systemctl is-active fail2ban

echo "==> docker log defaults + journald limits"
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
  systemctl reload docker 2>/dev/null || systemctl restart docker || true
fi

mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/00-vds-size.conf <<'EOF'
[Journal]
SystemMaxUse=100M
RuntimeMaxUse=50M
MaxRetentionSec=7day
EOF
systemctl restart systemd-journald || true

echo "==> daily log cleanup"
if [ -f "$SCRIPT_DIR/log-cleanup.sh" ]; then
  install -m 0755 "$SCRIPT_DIR/log-cleanup.sh" /usr/local/sbin/vds-log-cleanup.sh
elif [ -f "$APP_DIR/scripts/vds/log-cleanup.sh" ]; then
  install -m 0755 "$APP_DIR/scripts/vds/log-cleanup.sh" /usr/local/sbin/vds-log-cleanup.sh
fi
if [ -f "$UNIT_SRC/vds-log-cleanup.service" ]; then
  install -m 0644 "$UNIT_SRC/vds-log-cleanup.service" /etc/systemd/system/vds-log-cleanup.service
  install -m 0644 "$UNIT_SRC/vds-log-cleanup.timer" /etc/systemd/system/vds-log-cleanup.timer
  systemctl daemon-reload
  systemctl enable --now vds-log-cleanup.timer
  systemctl start vds-log-cleanup.service || true
fi

echo "==> done"
systemctl list-timers vds-net-watchdog.timer vds-log-cleanup.timer --no-pager
free -h | head -2
df -h / | tail -1
logger -t vds-hardening "install-vds-hardening completed"
