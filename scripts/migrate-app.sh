#!/bin/bash
# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# 
# This software is proprietary and confidential.
# Unauthorized copying, modification, or distribution is prohibited.
# 
# For licensing inquiries: info@hb3-accelerator.com
# Website: https://hb3-accelerator.com
# GitHub: https://github.com/HB3-ACCELERATOR

#!/bin/bash

# Скрипт для полной миграции приложения между провайдерами
# Использование: ./migrate-app.sh source-server target-server app-path

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для логирования
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
if [ $# -ne 3 ]; then
    echo "Использование: $0 <source-server> <target-server> <app-path>"
    echo "Пример: $0 user@hostland-server.com user@aws-server.com /home/user/dapp"
    exit 1
fi

SOURCE_SERVER=$1
TARGET_SERVER=$2
APP_PATH=$3
BACKUP_NAME="app-migration-$(date +%Y%m%d-%H%M%S)"

log_info "Начинаем миграцию приложения"
log_info "Источник: $SOURCE_SERVER:$APP_PATH"
log_info "Цель: $TARGET_SERVER:$APP_PATH"
log_info "Резервная копия: $BACKUP_NAME"

# Функция для проверки подключения к серверу
check_connection() {
    local server=$1
    log_info "Проверяем подключение к $server..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$server" "echo 'Connection OK'" 2>/dev/null; then
        log_error "Не удалось подключиться к $server"
        log_error "Убедитесь, что SSH ключи настроены правильно"
        exit 1
    fi
    log_success "Подключение к $server установлено"
}

# Функция для проверки Docker на сервере
check_docker() {
    local server=$1
    log_info "Проверяем Docker на $server..."
    if ! ssh "$server" "docker --version" >/dev/null 2>&1; then
        log_error "Docker не установлен на $server"
        log_error "Установите Docker: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    log_success "Docker установлен на $server"
}

# Функция для создания полного бэкапа
create_backup() {
    local server=$1
    local path=$2
    local backup_name=$3
    
    log_info "Создаём полный бэкап на $server..."
    
    # Останавливаем приложение
    log_info "Останавливаем приложение..."
    ssh "$server" "cd $path && docker compose down" || log_warning "Приложение уже остановлено"
    
    # Создаём бэкап базы данных
    log_info "Создаём бэкап PostgreSQL..."
    ssh "$server" "cd $path && docker compose up -d postgres" || true
    sleep 5  # Ждём запуска PostgreSQL
    
    # Бэкап PostgreSQL
    ssh "$server" "cd $path && docker compose exec -T postgres pg_dump -U dapp_user dapp_db > postgres-backup.sql" || {
        log_warning "Не удалось создать бэкап PostgreSQL, продолжаем без него"
    }
    

    
    # Бэкап Ollama моделей
    log_info "Создаём бэкап Ollama моделей..."
    ssh "$server" "cd $path && docker compose exec -T ollama ollama list > ollama-models.txt" || log_warning "Ollama не найден"
    
    # Создаём полный архив
    log_info "Создаём полный архив приложения..."
    ssh "$server" "cd $path && tar -czf $backup_name.tar.gz \
        . \
        postgres-backup.sql \
        ollama-models.txt \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='temp' \
        --exclude='sessions'"
    
    log_success "Бэкап создан: $backup_name.tar.gz"
}

# Функция для восстановления на целевом сервере
restore_backup() {
    local server=$1
    local path=$2
    local backup_name=$3
    
    log_info "Восстанавливаем приложение на $server..."
    
    # Создаём директорию если не существует
    ssh "$server" "mkdir -p $path"
    
    # Копируем архив
    log_info "Копируем архив на целевой сервер..."
    scp "$SOURCE_SERVER:$APP_PATH/$backup_name.tar.gz" "$server:/tmp/"
    
    # Распаковываем
    log_info "Распаковываем архив..."
    ssh "$server" "cd $path && tar -xzf /tmp/$backup_name.tar.gz"
    
    # Восстанавливаем PostgreSQL
    if ssh "$server" "test -f $path/postgres-backup.sql"; then
        log_info "Восстанавливаем PostgreSQL..."
        ssh "$server" "cd $path && docker compose up -d postgres"
        sleep 10  # Ждём запуска PostgreSQL
        ssh "$server" "cd $path && docker compose exec -T postgres psql -U dapp_user -d dapp_db < postgres-backup.sql" || {
            log_warning "Не удалось восстановить PostgreSQL, создаём новую БД"
            ssh "$server" "cd $path && docker compose exec -T postgres createdb -U dapp_user dapp_db 2>/dev/null || true"
        }
    fi
    

    
    # Восстанавливаем Ollama модели
    if ssh "$server" "test -f $path/ollama-models.txt"; then
        log_info "Восстанавливаем Ollama модели..."
        ssh "$server" "cd $path && docker compose up -d ollama"
        sleep 10  # Ждём запуска Ollama
        ssh "$server" "cd $path && cat ollama-models.txt | grep -v 'NAME' | awk '{print \$1}' | xargs -I {} docker compose exec -T ollama ollama pull {}" || {
            log_warning "Не удалось восстановить все Ollama модели"
        }
    fi
    
    # Запускаем приложение
    log_info "Запускаем приложение..."
    ssh "$server" "cd $path && docker compose up -d"
    
    log_success "Приложение восстановлено на $server"
}

# Функция для проверки статуса приложения
check_app_status() {
    local server=$1
    local path=$2
    
    log_info "Проверяем статус приложения на $server..."
    
    # Проверяем контейнеры
    ssh "$server" "cd $path && docker compose ps"
    
    # Проверяем логи
    log_info "Последние логи приложения:"
    ssh "$server" "cd $path && docker compose logs --tail=20"
    
    # Проверяем доступность сервисов
    log_info "Проверяем доступность сервисов..."
    
    # Получаем IP сервера
    SERVER_IP=$(ssh "$server" "curl -s ifconfig.me")
    
    # Проверяем порты
    for port in 80 443 8000 5173; do
        if ssh "$server" "netstat -tlnp | grep :$port" >/dev/null 2>&1; then
            log_success "Порт $port доступен"
        else
            log_warning "Порт $port недоступен"
        fi
    done
}

# Функция для очистки временных файлов
cleanup() {
    local server=$1
    local backup_name=$2
    
    log_info "Очищаем временные файлы..."
    ssh "$server" "rm -f $APP_PATH/$backup_name.tar.gz"
    ssh "$server" "rm -f $APP_PATH/postgres-backup.sql"
    ssh "$server" "rm -f $APP_PATH/ollama-models.txt"
    ssh "$server" "rm -f /tmp/$backup_name.tar.gz"
}

# Основной процесс миграции
main() {
    log_info "=== НАЧАЛО МИГРАЦИИ ПРИЛОЖЕНИЯ ==="
    
    # Проверяем подключения
    check_connection "$SOURCE_SERVER"
    check_connection "$TARGET_SERVER"
    
    # Проверяем Docker
    check_docker "$SOURCE_SERVER"
    check_docker "$TARGET_SERVER"
    
    # Создаём бэкап на исходном сервере
    create_backup "$SOURCE_SERVER" "$APP_PATH" "$BACKUP_NAME"
    
    # Восстанавливаем на целевом сервере
    restore_backup "$TARGET_SERVER" "$APP_PATH" "$BACKUP_NAME"
    
    # Проверяем статус
    check_app_status "$TARGET_SERVER" "$APP_PATH"
    
    # Очищаем временные файлы
    cleanup "$SOURCE_SERVER" "$BACKUP_NAME"
    cleanup "$TARGET_SERVER" "$BACKUP_NAME"
    
    log_success "=== МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО ==="
    log_info "Приложение перенесено с $SOURCE_SERVER на $TARGET_SERVER"
    log_info "Не забудьте обновить DNS записи на новый IP сервера"
    
    # Показываем новый IP
    NEW_IP=$(ssh "$TARGET_SERVER" "curl -s ifconfig.me")
    log_info "Новый IP сервера: $NEW_IP"
}

# Обработка ошибок
trap 'log_error "Миграция прервана из-за ошибки"; exit 1' ERR

# Запуск основной функции
main "$@" 