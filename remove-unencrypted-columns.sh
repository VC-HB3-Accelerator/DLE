#!/bin/bash

# Скрипт для удаления незашифрованных колонок
# ВНИМАНИЕ: Это необратимая операция!
# Использование: ./remove-unencrypted-columns.sh

echo "⚠️  ВНИМАНИЕ: Это удалит все незашифрованные колонки!"
echo "Убедитесь, что шифрование работает корректно!"
read -p "Продолжить? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Операция отменена"
    exit 1
fi

# Получаем список всех таблиц
TABLES=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;")

# Удаляем незашифрованные колонки
echo "$TABLES" | while read -r table_name; do
    if [ -n "$table_name" ]; then
        echo "🗑️  Удаление незашифрованных колонок в таблице: $table_name"
        
        # Получаем незашифрованные колонки
        unencrypted_columns=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '$table_name' 
        AND table_schema = 'public'
        AND data_type IN ('text', 'varchar', 'character varying', 'json', 'jsonb')
        AND column_name NOT LIKE '%_encrypted'
        AND column_name NOT IN ('created_at', 'updated_at', 'id')
        ORDER BY ordinal_position;")
        
        echo "$unencrypted_columns" | while read -r column_name; do
            if [ -n "$column_name" ]; then
                echo "   🗑️  Удаление колонки: $column_name"
                docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
                ALTER TABLE $table_name DROP COLUMN IF EXISTS $column_name;"
            fi
        done
    fi
done

echo "✅ Незашифрованные колонки удалены!"
