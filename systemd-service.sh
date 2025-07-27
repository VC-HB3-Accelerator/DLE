#!/bin/bash

# Скрипт для создания systemd сервиса для security-monitor
# Использование: sudo ./systemd-service.sh

SERVICE_NAME="dle-security-monitor"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SCRIPT_PATH="$(pwd)/security-monitor.sh"
USER=$(whoami)

echo "🔧 Создание systemd сервиса для security-monitor..."

# Создаём файл сервиса
sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=DLE Security Monitor
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$SCRIPT_PATH
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Перезагружаем systemd
sudo systemctl daemon-reload

# Включаем автозапуск
sudo systemctl enable "$SERVICE_NAME"

echo "✅ Сервис создан: $SERVICE_NAME"
echo ""
echo "🎯 Команды управления:"
echo "  Запуск: sudo systemctl start $SERVICE_NAME"
echo "  Остановка: sudo systemctl stop $SERVICE_NAME"
echo "  Статус: sudo systemctl status $SERVICE_NAME"
echo "  Логи: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "🚀 Сервис будет автоматически запускаться при загрузке системы" 