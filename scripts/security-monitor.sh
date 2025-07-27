#!/bin/bash

# Скрипт мониторинга безопасности для nginx
# Автоматически блокирует подозрительные IP

LOG_FILE="/var/log/nginx/access.log"
BLOCKED_IPS="/tmp/blocked_ips.txt"
MAX_REQUESTS=100  # Максимум запросов в минуту
BLOCK_TIME=3600   # Время блокировки в секундах (1 час)

# Создаем файл для заблокированных IP если его нет
touch "$BLOCKED_IPS"

echo "$(date): Запуск мониторинга безопасности..."

while true; do
    # Анализируем логи за последнюю минуту
    SUSPICIOUS_IPS=$(tail -n 1000 "$LOG_FILE" 2>/dev/null | \
        awk -v date="$(date -d '1 minute ago' '+%d/%b/%Y:%H:%M')" \
        '$4 ~ date {print $1}' | \
        sort | uniq -c | \
        awk -v max="$MAX_REQUESTS" '$1 > max {print $2}')
    
    # Блокируем подозрительные IP
    for ip in $SUSPICIOUS_IPS; do
        if ! grep -q "^$ip$" "$BLOCKED_IPS"; then
            echo "$ip" >> "$BLOCKED_IPS"
            echo "$(date): Блокируем IP $ip за подозрительную активность"
            
            # Добавляем правило в iptables (если доступно)
            if command -v iptables >/dev/null 2>&1; then
                iptables -A INPUT -s "$ip" -j DROP
                echo "$(date): IP $ip заблокирован в iptables"
            fi
        fi
    done
    
    # Очищаем старые блокировки
    while IFS= read -r ip; do
        # Проверяем, не истекло ли время блокировки
        if [ -f "$BLOCKED_IPS" ]; then
            # Простая реализация - можно улучшить
            echo "$(date): Проверка блокировок..."
        fi
    done < "$BLOCKED_IPS"
    
    # Ждем 30 секунд перед следующей проверкой
    sleep 30
done 