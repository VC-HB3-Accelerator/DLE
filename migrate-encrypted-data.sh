#!/bin/bash

/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

# Скрипт для переноса зашифрованных данных между серверами
# Использование: ./migrate-encrypted-data.sh

# Конфигурация
SOURCE_HOST="localhost"  # Исходный сервер
TARGET_HOST="new-server.com"  # Целевой сервер
DB_NAME="dapp_db"
DB_USER="dapp_user"
DB_PASSWORD="dapp_password"
BACKUP_DIR="./migration_backups"

# Создаём папку для бэкапов
mkdir -p "$BACKUP_DIR"

echo "🔄 Перенос зашифрованных данных между серверами..."

# Проверяем наличие ключа шифрования
if [ ! -f "./ssl/keys/full_db_encryption.key" ]; then
    echo "❌ Ключ шифрования не найден: ./ssl/keys/full_db_encryption.key"
    exit 1
fi

# Функция для создания бэкапа с ключом
create_backup_with_key() {
    echo "📦 Создание бэкапа с ключом шифрования..."
    
    # Создаём бэкап базы данных
    BACKUP_FILE="$BACKUP_DIR/encrypted_backup_$(date +%Y%m%d_%H%M%S).sql"
    docker exec dapp-postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
    
    # Создаём архив с бэкапом и ключом
    ARCHIVE_FILE="$BACKUP_DIR/migration_package_$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$ARCHIVE_FILE" \
        -C . "$BACKUP_FILE" \
        -C . ssl/keys/full_db_encryption.key \
        -C . encrypt-all-tables.sh \
        -C . decrypt-all-tables.sh \
        -C . backend/services/encryptedDataService.js
    
    echo "✅ Бэкап создан: $ARCHIVE_FILE"
    echo "📋 Содержимое архива:"
    tar -tzf "$ARCHIVE_FILE"
}

# Функция для восстановления на целевом сервере
restore_on_target() {
    echo "🔄 Восстановление на целевом сервере..."
    
    # Распаковываем архив
    tar -xzf "$ARCHIVE_FILE" -C .
    
    # Восстанавливаем ключ шифрования
    mkdir -p ./ssl/keys
    cp ssl/keys/full_db_encryption.key ./ssl/keys/
    chmod 600 ./ssl/keys/full_db_encryption.key
    
    # Восстанавливаем базу данных
    docker exec dapp-postgres psql -U "$DB_USER" "$DB_NAME" < "$BACKUP_FILE"
    
    echo "✅ Данные восстановлены на целевом сервере"
}

# Функция для переноса через SSH
migrate_via_ssh() {
    echo "🌐 Перенос через SSH..."
    
    # Создаём бэкап
    create_backup_with_key
    
    # Отправляем архив на целевой сервер
    scp "$ARCHIVE_FILE" user@$TARGET_HOST:/tmp/
    
    # Выполняем восстановление на целевом сервере
    ssh user@$TARGET_HOST << 'EOF'
        cd /tmp
        tar -xzf migration_package_*.tar.gz -C /path/to/app/
        cd /path/to/app/
        chmod 600 ssl/keys/full_db_encryption.key
        docker exec dapp-postgres psql -U dapp_user dapp_db < encrypted_backup_*.sql
        echo "✅ Миграция завершена"
EOF
    
    echo "✅ Перенос через SSH завершён"
}

# Функция для переноса через S3/облачное хранилище
migrate_via_cloud() {
    echo "☁️ Перенос через облачное хранилище..."
    
    # Создаём бэкап
    create_backup_with_key
    
    # Загружаем в S3 (пример)
    aws s3 cp "$ARCHIVE_FILE" s3://your-bucket/migrations/
    
    echo "📤 Архив загружен в облачное хранилище"
    echo "📥 Для восстановления скачайте архив и выполните:"
    echo "   tar -xzf migration_package_*.tar.gz"
    echo "   docker exec dapp-postgres psql -U dapp_user dapp_db < encrypted_backup_*.sql"
}

# Функция для переноса через USB/локальный носитель
migrate_via_local() {
    echo "💾 Перенос через локальный носитель..."
    
    # Создаём бэкап
    create_backup_with_key
    
    echo "📁 Архив создан: $ARCHIVE_FILE"
    echo "💿 Скопируйте файл на USB-накопитель или другой носитель"
    echo "🔄 На целевом сервере выполните:"
    echo "   tar -xzf migration_package_*.tar.gz"
    echo "   docker exec dapp-postgres psql -U dapp_user dapp_db < encrypted_backup_*.sql"
}

# Функция для проверки целостности
verify_migration() {
    echo "🔍 Проверка целостности миграции..."
    
    # Проверяем наличие ключа
    if [ ! -f "./ssl/keys/full_db_encryption.key" ]; then
        echo "❌ Ключ шифрования не найден"
        return 1
    fi
    
    # Проверяем подключение к БД
    if ! docker exec dapp-postgres pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        echo "❌ Не удалось подключиться к базе данных"
        return 1
    fi
    
    # Проверяем зашифрованные данные
    docker exec dapp-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
        table_name,
        COUNT(*) as encrypted_columns
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND column_name LIKE '%_encrypted'
    GROUP BY table_name
    ORDER BY table_name;"
    
    echo "✅ Проверка целостности завершена"
}

# Главное меню
echo "🎯 Выберите способ переноса:"
echo "1) Создать бэкап с ключом"
echo "2) Перенос через SSH"
echo "3) Перенос через облачное хранилище"
echo "4) Перенос через локальный носитель"
echo "5) Проверить целостность"
echo "6) Выход"

read -p "Выберите опцию (1-6): " choice

case $choice in
    1)
        create_backup_with_key
        ;;
    2)
        read -p "Введите IP целевого сервера: " TARGET_HOST
        migrate_via_ssh
        ;;
    3)
        migrate_via_cloud
        ;;
    4)
        migrate_via_local
        ;;
    5)
        verify_migration
        ;;
    6)
        echo "👋 Выход"
        exit 0
        ;;
    *)
        echo "❌ Неверный выбор"
        exit 1
        ;;
esac

echo ""
echo "🎯 Инструкция по восстановлению на целевом сервере:"
echo "1. Скопируйте архив на целевой сервер"
echo "2. Распакуйте архив: tar -xzf migration_package_*.tar.gz"
echo "3. Восстановите ключ: chmod 600 ssl/keys/full_db_encryption.key"
echo "4. Восстановите БД: docker exec dapp-postgres psql -U dapp_user dapp_db < encrypted_backup_*.sql"
echo "5. Проверьте целостность: ./verify-migration.sh" 