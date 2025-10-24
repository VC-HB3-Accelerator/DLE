#!/bin/sh

# Проверка и установка значений по умолчанию
export DOMAIN=${DOMAIN:-localhost}
export BACKEND_CONTAINER=${BACKEND_CONTAINER:-dapp-backend}

echo "🔧 Настройка nginx с параметрами:"
echo "   DOMAIN: $DOMAIN"
echo "   BACKEND_CONTAINER: $BACKEND_CONTAINER"

# Выбор конфигурации в зависимости от домена
if echo "$DOMAIN" | grep -qE '^localhost(:[0-9]+)?$|^production\.local$'; then
    echo "   Режим: ЛОКАЛЬНАЯ РАЗРАБОТКА (без SSL)"
    TEMPLATE_FILE="/etc/nginx/nginx-local.conf.template"
else
    echo "   Режим: ПРОДАКШН (с SSL)"
    TEMPLATE_FILE="/etc/nginx/nginx-ssl.conf.template"
fi

# Обработка переменных окружения для nginx конфигурации
envsubst '${DOMAIN} ${BACKEND_CONTAINER}' < $TEMPLATE_FILE > /etc/nginx/nginx.conf

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
