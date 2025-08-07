#!/bin/bash

# Скрипт мониторинга безопасности для DLE
# Автоматически блокирует подозрительные IP адреса и домены

LOG_FILE="/var/log/nginx/access.log"
SUSPICIOUS_LOG_FILE="/var/log/nginx/suspicious_domains.log"
BLOCKED_IPS_FILE="/tmp/blocked_ips.txt"
SUSPICIOUS_DOMAINS_FILE="/tmp/suspicious_domains.txt"
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
    docker exec "$NGINX_CONTAINER" sh -c "
        cat > $WAF_CONF_FILE << 'EOF'
# WAF конфигурация для блокировки подозрительных IP
geo \$bad_ip {
    default 0;
    # Заблокированные IP будут добавляться сюда автоматически
EOF
    "
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
    
    # Добавляем IP в nginx WAF конфигурацию
    docker exec "$NGINX_CONTAINER" sh -c "
        if [ ! -f $WAF_CONF_FILE ]; then
            create_waf_config
        fi
        
        # Добавляем IP в WAF конфигурацию
        sed -i '/default 0;/a\\    $ip 1; # Автоматически заблокирован: $reason' $WAF_CONF_FILE
        
        # Перезагружаем nginx
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

# Функция для анализа Docker логов nginx
analyze_docker_logs() {
    echo "🔍 Анализ Docker логов nginx на предмет атак..."
    
    # Анализируем логи nginx контейнера
    docker logs --follow "$NGINX_CONTAINER" | while read line; do
        # Ищем HTTP запросы в логах
        if echo "$line" | grep -qE "(GET|POST|HEAD|PUT|DELETE|OPTIONS)"; then
            # Извлекаем IP адрес
            ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}')
            
            # Извлекаем домен из Host заголовка
            domain=$(echo "$line" | grep -oE 'Host: [^[:space:]]+' | sed 's/Host: //')
            
            # Извлекаем User-Agent
            user_agent=$(echo "$line" | grep -oE 'User-Agent: [^[:space:]]+' | sed 's/User-Agent: //')
            
            # Извлекаем URI
            uri=$(echo "$line" | grep -oE '(GET|POST|HEAD|PUT|DELETE|OPTIONS) [^[:space:]]+' | awk '{print $2}')
            
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
while true; do
    echo "🔄 Проверка безопасности... $(date)"
    
    # Анализируем логи в фоне
    analyze_docker_logs &
    
    # Показываем статистику каждые 5 минут
    show_stats
    
    # Ждем 5 минут перед следующей проверкой
    sleep 300
done 