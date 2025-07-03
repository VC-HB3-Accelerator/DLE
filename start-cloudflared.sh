#!/bin/bash

echo "==== Содержимое /cloudflared.env ===="
cat /cloudflared.env || echo "Файл не найден"
echo "===="

# Получаем токен из переменной окружения или из файла
if [ -z "$TUNNEL_TOKEN" ] && [ -f /cloudflared.env ]; then
  . /cloudflared.env
fi

echo "TUNNEL_TOKEN=[$TUNNEL_TOKEN]"

# Функция для проверки сети
check_network() {
    echo "Проверка сетевого соединения..."
    for addr in 1.1.1.1 8.8.8.8; do
        if ping -c 1 -W 5 "$addr" > /dev/null 2>&1; then
            echo "✓ Сеть доступна ($addr)"
            return 0
        fi
    done
    echo "✗ Сетевые проблемы"
    return 1
}

# Функция для проверки доступности backend
check_backend() {
    echo "Проверка доступности backend..."
    if curl -s --connect-timeout 5 http://backend:8000 >/dev/null 2>&1; then
        echo "✓ Backend доступен"
        return 0
    else
        echo "✗ Backend недоступен"
        return 1
    fi
}

# Проверяем сеть перед запуском
echo "=== Проверка подключений ==="
check_network
check_backend

# Проверяем наличие конфигурационного файла
echo "=== Проверка конфигурации ==="
if [ -f "/etc/cloudflared/config.yml" ]; then
    echo "✓ Конфигурационный файл найден"
    cat /etc/cloudflared/config.yml
else
    echo "✗ Конфигурационный файл не найден"
fi

if [ -f "/etc/cloudflared/a765a217-5312-48f8-9bb7-5a7ef56602b8.json" ]; then
    echo "✓ Credentials файл найден"
else
    echo "✗ Credentials файл не найден"
fi

# Проверим доступность frontend
echo "=== Проверка frontend ==="
if curl -s --connect-timeout 5 http://dapp-frontend:5173 >/dev/null 2>&1; then
    echo "✓ Frontend доступен"
else
    echo "✗ Frontend недоступен, fallback на backend"
fi

# Запускаем cloudflared с токеном вместо конфигурационного файла
echo "=== Запуск cloudflared с токеном ==="
echo "Используем токен туннеля: ${TUNNEL_TOKEN:0:20}..."
exec cloudflared tunnel \
    --no-autoupdate \
    --edge-ip-version 4 \
    --protocol http2 \
    --retries 20 \
    --grace-period 60s \
    --loglevel info \
    --metrics 0.0.0.0:39693 \
    --proxy-connect-timeout 90s \
    --proxy-tls-timeout 90s \
    --proxy-tcp-keepalive 15s \
    --proxy-keepalive-timeout 120s \
    --proxy-keepalive-connections 10 \
    --proxy-no-happy-eyeballs \
    run --token "$TUNNEL_TOKEN" 