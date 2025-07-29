#!/bin/bash

# Скрипт мониторинга безопасности для DLE
# Автоматически блокирует подозрительные IP адреса и домены

LOG_FILE="/var/log/nginx/access.log"
BLOCKED_IPS_FILE="/tmp/blocked_ips.txt"
SUSPICIOUS_DOMAINS_FILE="/tmp/suspicious_domains.txt"
NGINX_CONTAINER="dapp-frontend-nginx"

# Создаем файлы для хранения данных
touch "$BLOCKED_IPS_FILE"
touch "$SUSPICIOUS_DOMAINS_FILE"

echo "🔒 Запуск мониторинга безопасности DLE..."
echo "📊 Логирование атак в: $LOG_FILE"
echo "🚫 Заблокированные IP: $BLOCKED_IPS_FILE"
echo "🌐 Подозрительные домены: $SUSPICIOUS_DOMAINS_FILE"

# Список подозрительных доменов
SUSPICIOUS_DOMAINS=(
    "akamai-inputs-"
    "gosipgambar"
    "gitlab.cloud"
    "autodiscover.home"
    "akamai-san"
    "akamai-inputs-cleanaway"
    "akamai-inputs-hgmccarterenglish"
    "akamai-inputs-nbpdnj"
    "akamai-inputs-rvc"
    "akamai-inputs-erau"
    "akamai-inputs-notion"
)

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

# Функция для логирования подозрительных доменов
log_suspicious_domain() {
    local domain=$1
    local ip=$2
    
    # Проверяем, не логировали ли уже этот домен
    if grep -q "^$domain$" "$SUSPICIOUS_DOMAINS_FILE"; then
        return
    fi
    
    echo "$domain" >> "$SUSPICIOUS_DOMAINS_FILE"
    echo "🌐 Подозрительный домен: $domain (IP: $ip)"
    
    # Блокируем IP, который обращается к подозрительному домену
    if [ -n "$ip" ]; then
        block_ip "$ip" "Обращение к подозрительному домену: $domain"
    fi
}

# Функция для анализа логов
analyze_logs() {
    echo "🔍 Анализ логов на предмет атак..."
    
    # Ищем подозрительные запросы
    docker exec "$NGINX_CONTAINER" tail -f "$LOG_FILE" | while read line; do
        # Извлекаем IP адрес
        ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}')
        
        # Извлекаем домен из Referer
        domain=$(echo "$line" | grep -oE 'https?://[^/]+' | sed 's|https\?://||')
        
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
            
            # Проверяем на подозрительные домены
            for suspicious in "${SUSPICIOUS_DOMAINS[@]}"; do
                if echo "$domain" | grep -qi "$suspicious"; then
                    log_suspicious_domain "$domain" "$ip"
                    break
                fi
            done
            
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
    echo "Подозрительных доменов: $(wc -l < "$SUSPICIOUS_DOMAINS_FILE")"
    echo ""
    echo "Последние заблокированные IP:"
    tail -5 "$BLOCKED_IPS_FILE" 2>/dev/null || echo "Нет заблокированных IP"
    echo ""
    echo "Последние подозрительные домены:"
    tail -5 "$SUSPICIOUS_DOMAINS_FILE" 2>/dev/null || echo "Нет подозрительных доменов"
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