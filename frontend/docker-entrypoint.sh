#!/bin/sh

# Проверка и установка значений по умолчанию
export DOMAIN=${DOMAIN:-localhost}
export BACKEND_CONTAINER=${BACKEND_CONTAINER:-dapp-backend}

echo "🔧 Настройка nginx с параметрами:"
echo "   DOMAIN: $DOMAIN"
echo "   BACKEND_CONTAINER: $BACKEND_CONTAINER"

# Обработка переменных окружения для nginx конфигурации
envsubst '${DOMAIN} ${BACKEND_CONTAINER}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Проверка синтаксиса nginx конфигурации
echo "🔍 Проверка синтаксиса nginx конфигурации..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx конфигурация корректна"
else
    echo "❌ Ошибка в nginx конфигурации!"
    exit 1
fi

echo "🚀 Запуск nginx..."
exec "$@"
