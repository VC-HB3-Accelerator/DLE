#!/bin/bash

# Скрипт для расшифровки всех таблиц
# Использование: ./decrypt-all-tables.sh

ENCRYPTION_KEY=$(cat ./ssl/keys/full_db_encryption.key)

echo "🔓 Расшифровка всех таблиц..."

# Получаем список всех таблиц
TABLES=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;")

# Функция для расшифровки таблицы
decrypt_table() {
    local table_name="$1"
    echo "🔓 Расшифровка таблицы: $table_name"
    
    # Получаем зашифрованные колонки
    local encrypted_columns=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = '$table_name' 
    AND table_schema = 'public'
    AND column_name LIKE '%_encrypted'
    ORDER BY ordinal_position;")
    
    if [ -z "$encrypted_columns" ]; then
        echo "   ⏭️  Нет зашифрованных колонок"
        return
    fi
    
    echo "   📝 Зашифрованные колонки:"
    echo "$encrypted_columns" | while read -r column_name; do
        if [ -n "$column_name" ]; then
            echo "      $column_name"
            # Определяем тип колонки
            data_type=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
                SELECT data_type FROM information_schema.columns 
                WHERE table_name = '$table_name' AND column_name = '$column_name' AND table_schema = 'public';" | xargs)
            # Определяем первичный ключ для таблицы
            primary_key=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
                SELECT column_name FROM information_schema.key_column_usage 
                WHERE table_name = '$table_name' AND constraint_name LIKE '%_pkey' 
                AND table_schema = 'public' LIMIT 1;" | xargs)
            
            if [ "$data_type" = "jsonb" ] || [ "$data_type" = "json" ]; then
                # Расшифровываем json/jsonb
                docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
                SELECT $primary_key, decrypt_json($column_name, '$ENCRYPTION_KEY') as ${column_name%_encrypted}_decrypted
                FROM $table_name WHERE $column_name IS NOT NULL LIMIT 5;"
            else
                # Расшифровываем текстовые
                docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
                SELECT $primary_key, decrypt_text($column_name, '$ENCRYPTION_KEY') as ${column_name%_encrypted}_decrypted
                FROM $table_name WHERE $column_name IS NOT NULL LIMIT 5;"
            fi
        fi
    done
}

# Расшифровываем каждую таблицу
echo "$TABLES" | while read -r table_name; do
    if [ -n "$table_name" ]; then
        decrypt_table "$table_name"
    fi
done

echo "✅ Расшифровка завершена!"
