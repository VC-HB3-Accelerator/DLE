#!/bin/bash

# Скрипт мониторинга безопасности для DLE
# Автоматически блокирует подозрительные IP адреса

LOG_FILE="/var/log/nginx/access.log"
BLOCKED_IPS_FILE="/tmp/blocked_ips.txt"
NGINX_CONTAINER="dapp-frontend-nginx"

# Создаем файл для хранения заблокированных IP
touch "$BLOCKED_IPS_FILE"

echo "🔒 Запуск мониторинга безопасности DLE..."
echo "📊 Логирование атак в: $LOG_FILE"
echo "🚫 Заблокированные IP: $BLOCKED_IPS_FILE"

# Функция для блокировки IP
block_ip() {
    local ip=$1
    local reason=$2
    
    # Проверяем, не заблокирован ли уже IP
    if grep -q "^$ip$" "$BLOCKED_IPS_FILE"; then
        return
    fi
    
    echo "$ip" >> "$BLOCKED_IPS_FILE"
    echo "🚫 Блокируем IP: $ip (причина: $reason)"
    
    # Добавляем IP в nginx конфигурацию
    docker exec "$NGINX_CONTAINER" sh -c "
        echo '    $ip 1; # Автоматически заблокирован: $reason' >> /etc/nginx/conf.d/waf.conf
        nginx -s reload
    "
    
    echo "✅ IP $ip заблокирован в nginx"
}

# Функция для анализа логов
analyze_logs() {
    echo "🔍 Анализ логов на предмет атак..."
    
    # Ищем подозрительные запросы
    docker exec "$NGINX_CONTAINER" tail -f "$LOG_FILE" | while read line; do
        # Извлекаем IP адрес
        ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}')
        
        if [ -n "$ip" ]; then
            # Проверяем на подозрительные запросы
            if echo "$line" | grep -q "\.env\|\.config\|\.ini\|\.sql\|\.bak\|\.log"; then
                block_ip "$ip" "Попытка доступа к чувствительным файлам"
            fi
            
            # Проверяем на старые User-Agent
            if echo "$line" | grep -q "Chrome/[1-7][0-9]\."; then
                block_ip "$ip" "Подозрительный User-Agent (старый Chrome)"
            fi
            
            # Проверяем на известные сканеры
            if echo "$line" | grep -qi "bot\|crawler\|spider\|scanner\|nmap\|sqlmap"; then
                block_ip "$ip" "Известный сканер/бот"
            fi
            
            # Проверяем на множественные запросы (DDoS)
            request_count=$(docker exec "$NGINX_CONTAINER" grep "$ip" "$LOG_FILE" | wc -l)
            if [ "$request_count" -gt 100 ]; then
                block_ip "$ip" "Подозрение на DDoS ($request_count запросов)"
            fi
        fi
    done
}

# Функция для показа статистики
show_stats() {
    echo "📈 Статистика безопасности:"
    echo "Заблокированных IP: $(wc -l < "$BLOCKED_IPS_FILE")"
    echo "Последние заблокированные IP:"
    tail -5 "$BLOCKED_IPS_FILE" 2>/dev/null || echo "Нет заблокированных IP"
}

# Основной цикл
while true; do
    echo "🔄 Проверка безопасности... $(date)"
    
    # Анализируем логи в фоне
    analyze_logs &
    
    # Показываем статистику каждые 5 минут
    show_stats
    
    # Ждем 5 минут перед следующей проверкой
    sleep 300
done 