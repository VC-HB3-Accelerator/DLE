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

#!/bin/bash

# Скрипт для обновления DNS записей после миграции
# Использование: ./update-dns.sh domain new-server-ip

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка аргументов
if [ $# -ne 2 ]; then
    echo "Использование: $0 <domain> <new-server-ip>"
    echo "Пример: $0 mydapp.site 123.456.789.10"
    exit 1
fi

DOMAIN=$1
NEW_IP=$2

log_info "Обновляем DNS записи для домена $DOMAIN на IP $NEW_IP"

# Функция для проверки DNS
check_dns() {
    local domain=$1
    local expected_ip=$2
    
    log_info "Проверяем DNS записи для $domain..."
    
    # Получаем A запись
    local dns_ip=$(dig +short A "$domain" | head -1)
    
    if [ "$dns_ip" = "$expected_ip" ]; then
        log_success "DNS A запись корректна: $domain -> $dns_ip"
        return 0
    else
        log_warning "DNS A запись не совпадает: ожидается $expected_ip, получено $dns_ip"
        return 1
    fi
}

# Функция для проверки доступности сайта
check_site_availability() {
    local domain=$1
    local max_attempts=30
    local attempt=1
    
    log_info "Проверяем доступность сайта $domain..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 10 "https://$domain" >/dev/null 2>&1; then
            log_success "Сайт $domain доступен!"
            return 0
        else
            log_info "Попытка $attempt/$max_attempts: сайт пока недоступен..."
            sleep 10
            attempt=$((attempt + 1))
        fi
    done
    
    log_error "Сайт $domain недоступен после $max_attempts попыток"
    return 1
}

# Функция для автоматического обновления DNS через API
update_dns_api() {
    local domain=$1
    local new_ip=$2
    
    log_info "Пытаемся автоматически обновить DNS через API..."
    
    # Проверяем различные DNS провайдеров
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
        log_info "Пробуем Cloudflare API..."
        update_cloudflare_dns "$domain" "$new_ip"
    elif [ -n "$GODADDY_API_KEY" ]; then
        log_info "Пробуем GoDaddy API..."
        update_godaddy_dns "$domain" "$new_ip"
    elif [ -n "$NAMECHEAP_API_KEY" ]; then
        log_info "Пробуем Namecheap API..."
        update_namecheap_dns "$domain" "$new_ip"
    else
        log_warning "API ключи не настроены, требуется ручное обновление DNS"
        return 1
    fi
}

# Функция для обновления DNS через Cloudflare API
update_cloudflare_dns() {
    local domain=$1
    local new_ip=$2
    
    # Получаем zone ID
    local zone_id=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones?name=$domain" | \
        jq -r '.result[0].id')
    
    if [ "$zone_id" = "null" ]; then
        log_error "Не удалось найти zone ID для домена $domain"
        return 1
    fi
    
    # Получаем record ID для A записи
    local record_id=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records?type=A&name=$domain" | \
        jq -r '.result[0].id')
    
    if [ "$record_id" = "null" ]; then
        log_error "Не удалось найти A запись для домена $domain"
        return 1
    fi
    
    # Обновляем A запись
    local response=$(curl -s -X PUT \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"type\":\"A\",\"name\":\"$domain\",\"content\":\"$new_ip\",\"ttl\":1}" \
        "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records/$record_id")
    
    if echo "$response" | jq -e '.success' >/dev/null; then
        log_success "DNS обновлён через Cloudflare API"
        return 0
    else
        log_error "Ошибка обновления DNS через Cloudflare API"
        return 1
    fi
}

# Функция для обновления DNS через GoDaddy API
update_godaddy_dns() {
    local domain=$1
    local new_ip=$2
    
    local response=$(curl -s -X PUT \
        -H "Authorization: sso-key $GODADDY_API_KEY:$GODADDY_API_SECRET" \
        -H "Content-Type: application/json" \
        -d "[{\"data\":\"$new_ip\",\"ttl\":600}]" \
        "https://api.godaddy.com/v1/domains/$domain/records/A/@")
    
    if [ $? -eq 0 ]; then
        log_success "DNS обновлён через GoDaddy API"
        return 0
    else
        log_error "Ошибка обновления DNS через GoDaddy API"
        return 1
    fi
}

# Функция для обновления DNS через Namecheap API
update_namecheap_dns() {
    local domain=$1
    local new_ip=$2
    
    local response=$(curl -s "https://api.sandbox.namecheap.com/xml.response" \
        -d "ApiUser=$NAMECHEAP_API_USER" \
        -d "ApiKey=$NAMECHEAP_API_KEY" \
        -d "UserName=$NAMECHEAP_API_USER" \
        -d "Command=namecheap.domains.dns.setHosts" \
        -d "ClientIp=$new_ip" \
        -d "SLD=$(echo $domain | cut -d. -f1)" \
        -d "TLD=$(echo $domain | cut -d. -f2)" \
        -d "HostName1=@" \
        -d "RecordType1=A" \
        -d "Address1=$new_ip" \
        -d "TTL1=600")
    
    if echo "$response" | grep -q "Status=\"OK\""; then
        log_success "DNS обновлён через Namecheap API"
        return 0
    else
        log_error "Ошибка обновления DNS через Namecheap API"
        return 1
    fi
}

# Основная функция
main() {
    log_info "=== ОБНОВЛЕНИЕ DNS ЗАПИСЕЙ ==="
    
    # Пытаемся автоматически обновить DNS
    if update_dns_api "$DOMAIN" "$NEW_IP"; then
        log_success "DNS обновлён автоматически"
    else
        log_warning "Автоматическое обновление не удалось"
        log_info "Требуется ручное обновление DNS записей"
        log_info "Домен: $DOMAIN"
        log_info "Новый IP: $NEW_IP"
        log_info "Тип записи: A"
        log_info "TTL: 600 (или минимальное значение)"
    fi
    
    # Ждём обновления DNS
    log_info "Ждём обновления DNS записей (может занять до 30 минут)..."
    
    local max_wait=30
    local wait_count=0
    
    while [ $wait_count -lt $max_wait ]; do
        if check_dns "$DOMAIN" "$NEW_IP"; then
            log_success "DNS записи обновлены!"
            break
        else
            log_info "Ожидание... ($((wait_count + 1))/$max_wait)"
            sleep 60
            wait_count=$((wait_count + 1))
        fi
    done
    
    if [ $wait_count -ge $max_wait ]; then
        log_warning "DNS записи не обновились в течение 30 минут"
        log_info "Проверьте настройки DNS в панели управления доменом"
    fi
    
    # Проверяем доступность сайта
    if check_site_availability "$DOMAIN"; then
        log_success "=== САЙТ УСПЕШНО МИГРИРОВАН ==="
        log_info "Домен: $DOMAIN"
        log_info "IP: $NEW_IP"
        log_info "Статус: Доступен"
    else
        log_error "Сайт недоступен после миграции"
        log_info "Проверьте:"
        log_info "1. DNS записи обновлены"
        log_info "2. Приложение запущено на новом сервере"
        log_info "3. Файрволы настроены правильно"
    fi
}

# Запуск основной функции
main "$@" 