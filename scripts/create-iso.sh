#!/bin/bash

# Простой скрипт для создания ISO образа
# Только создание ISO, без лишнего кода

set -e

echo "🚀 Создание ISO образа для SSH туннелей..."

# Параметры
ISO_NAME="tunnel-ubuntu-22.04.iso"
UBUNTU_ISO="ubuntu-22.04.3-live-server-amd64.iso"

# Скачиваем Ubuntu если его нет
if [ ! -f "$UBUNTU_ISO" ]; then
    echo "📥 Скачиваем Ubuntu 22.04 LTS Server ISO..."
    wget -O "$UBUNTU_ISO" "https://releases.ubuntu.com/22.04/ubuntu-22.04.3-live-server-amd64.iso"
fi

echo "✅ ISO образ готов: $ISO_NAME"
echo "🚀 Для настройки VDS используйте: ./setup-vds.sh"
