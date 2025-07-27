#!/bin/bash

# Скрипт для создания резервных копий базы данных DLE
# Запускать: ./backup-database.sh

# Настройки
BACKUP_DIR="./backups"
DB_NAME="${DB_NAME:-dapp_db}"
DB_USER="${DB_USER:-dapp_user}"
DB_PASSWORD="${DB_PASSWORD:-dapp_password}"
CONTAINER_NAME="dapp-postgres"

# Создаём папку для бэкапов если её нет
mkdir -p "$BACKUP_DIR"

# Имя файла бэкапа с датой и временем
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

echo "🔒 Создание резервной копии базы данных..."
echo "📁 Файл: $BACKUP_FILE"

# Создаём бэкап
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Бэкап успешно создан!"
    echo "📊 Размер файла: $(du -h "$BACKUP_FILE" | cut -f1)"
    
    # Удаляем старые бэкапы (оставляем только последние 10)
    echo "🧹 Удаление старых бэкапов..."
    ls -t "$BACKUP_DIR"/backup_*.sql | tail -n +11 | xargs -r rm
    
    echo "📋 Последние бэкапы:"
    ls -lh "$BACKUP_DIR"/backup_*.sql | tail -5
else
    echo "❌ Ошибка при создании бэкапа!"
    exit 1
fi 