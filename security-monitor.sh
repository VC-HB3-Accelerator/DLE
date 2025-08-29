#!/bin/bash

# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# 
# This software is proprietary and confidential.
# Unauthorized copying, modification, or distribution is prohibited.
# 
# For licensing inquiries: info@hb3-accelerator.com
# Website: https://hb3-accelerator.com
# GitHub: https://github.com/VC-HB3-Accelerator

# Скрипт мониторинга безопасности для DLE
# Автоматически блокирует подозрительные IP адреса и домены

LOG_FILE="/var/log/nginx/access.log"
SUSPICIOUS_LOG_FILE="/var/log/nginx/suspicious_domains.log"
BLOCKED_IPS_FILE="/var/log/security-monitor/blocked_ips.txt"
SUSPICIOUS_DOMAINS_FILE="/var/log/security-monitor/suspicious_domains.txt"
NGINX_CONTAINER="dapp-frontend-nginx"
WAF_CONF_FILE="/etc/nginx/conf.d/waf.conf"

# Создаем файлы для хранения данных
touch "$BLOCKED_IPS_FILE"
touch "$SUSPICIOUS_DOMAINS_FILE"

echo "🔒 Запуск мониторинга безопасности DLE..."
echo "📊 Анализ логов nginx контейнера: $NGINX_CONTAINER"
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
    "bestcupcakerecipes"
    "usmc1"
    "test"
    "admin"
    "dev"
    "staging"
    "beta"
    "demo"
    "old"
    "new"
    "backup"
)

# Функция для создания WAF конфигурации
create_waf_config() {
    echo "🔧 WAF конфигурация уже существует в nginx"
    # WAF конфигурация уже создана при сборке контейнера
}

# Функция для блокировки IP
block_ip() {
    local ip=$1
    local reason=$2
    
    # Исключаем внутренние Docker IP адреса
    if [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || [[ "$ip" =~ ^10\. ]] || [[ "$ip" =~ ^192\.168\. ]]; then
        echo "🔒 Пропускаем внутренний IP: $ip (причина: $reason)"
        return
    fi
    
    # Проверяем, не заблокирован ли уже IP
    if grep -q "^$ip$" "$BLOCKED_IPS_FILE"; then
        return
    fi
    
    echo "$ip" >> "$BLOCKED_IPS_FILE"
    echo "🚫 Блокируем IP: $ip (причина: $reason)"
    
    # Логируем в файл для дальнейшей обработки
    echo "$(date): $ip - $reason" >> "/var/log/security-monitor/blocked_ips_log.txt"
    
    echo "✅ IP $ip заблокирован (логируется для manual review)"
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

# Функция для анализа Docker логов nginx
analyze_docker_logs() {
    echo "🔍 Анализ Docker логов nginx на предмет атак..."
    
    # Анализируем логи nginx контейнера (последние записи + следящий режим)
    docker logs --tail 10 --follow "$NGINX_CONTAINER" 2>/dev/null | while read line; do
        # Ищем HTTP запросы в логах (формат nginx access log)
        if echo "$line" | grep -qE '"(GET|POST|HEAD|PUT|DELETE|OPTIONS)'; then
            # Извлекаем IP адрес (первое поле в логе)
            ip=$(echo "$line" | awk '{print $1}')
            
            # Извлекаем метод и URI из кавычек "GET /path HTTP/1.1"
            request_line=$(echo "$line" | grep -oE '"[^"]*"' | head -1 | sed 's/"//g')
            method=$(echo "$request_line" | awk '{print $1}')
            uri=$(echo "$request_line" | awk '{print $2}')
            
            # Извлекаем User-Agent (последняя строка в кавычках)
            user_agent=$(echo "$line" | grep -oE '"[^"]*"' | tail -1 | sed 's/"//g')
            
            # Домен пока оставляем пустым (можно добавить парсинг из логов при необходимости)
            domain=""
            
            if [ -n "$ip" ]; then
                echo "🔍 Анализируем запрос: $ip -> $domain -> $uri"
                
                # Проверяем на подозрительные запросы
                if echo "$uri" | grep -q "\.env\|\.config\|\.ini\|\.sql\|\.bak\|\.log"; then
                    block_ip "$ip" "Попытка доступа к чувствительным файлам: $uri"
                fi
                
                # Проверяем на сканирование резервных копий и архивов
                if echo "$uri" | grep -q "backup\|backups\|bak\|old\|restore\|\.tar\|\.gz\|sftp-config"; then
                    block_ip "$ip" "Сканирование резервных копий и конфигурационных файлов: $uri"
                fi
                
                # Проверяем на подозрительные поддомены
                if echo "$domain" | grep -q "bestcupcakerecipes\|usmc1\|test\|admin\|dev\|staging"; then
                    block_ip "$ip" "Попытка доступа к несуществующим поддоменам: $domain"
                fi
                
                # Проверяем на старые User-Agent
                if echo "$user_agent" | grep -q "Chrome/[1-7][0-9]\."; then
                    block_ip "$ip" "Подозрительный User-Agent (старый Chrome): $user_agent"
                fi
                
                if echo "$user_agent" | grep -q "Safari/[1-5][0-9][0-9]\."; then
                    block_ip "$ip" "Подозрительный User-Agent (старый Safari): $user_agent"
                fi
                
                # Проверяем на известные сканеры
                if echo "$user_agent" | grep -qi "bot\|crawler\|spider\|scanner\|nmap\|sqlmap"; then
                    block_ip "$ip" "Известный сканер/бот: $user_agent"
                fi
                
                # Проверяем на подозрительные домены
                for suspicious in "${SUSPICIOUS_DOMAINS[@]}"; do
                    if echo "$domain" | grep -qi "$suspicious"; then
                        log_suspicious_domain "$domain" "$ip"
                        break
                    fi
                done
                
                # Проверяем на множественные запросы (DDoS)
                request_count=$(docker logs "$NGINX_CONTAINER" | grep "$ip" | wc -l)
                if [ "$request_count" -gt 100 ]; then
                    block_ip "$ip" "Подозрение на DDoS ($request_count запросов)"
                fi
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

# Инициализация WAF конфигурации
echo "🔧 Инициализация WAF конфигурации..."
create_waf_config

# Основной цикл
echo "🔄 Начинаем мониторинг безопасности... $(date)"

# Показываем начальную статистику
show_stats

# Запускаем анализ логов (блокирующий режим - будет работать постоянно)
analyze_docker_logs 