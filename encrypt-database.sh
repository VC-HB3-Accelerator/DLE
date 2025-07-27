#!/bin/bash

# Скрипт для полного шифрования всех таблиц в базе данных DLE
# Использование: ./encrypt-all-tables.sh

# Проверяем наличие OpenSSL
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL не установлен. Установите: sudo apt-get install openssl"
    exit 1
fi

# Создаём папку для ключей
mkdir -p ./ssl/keys

# Генерируем ключ шифрования (если его нет)
if [ ! -f "./ssl/keys/full_db_encryption.key" ]; then
    echo "🔑 Генерация ключа шифрования для всех таблиц..."
    openssl rand -base64 32 > ./ssl/keys/full_db_encryption.key
    chmod 600 ./ssl/keys/full_db_encryption.key
    echo "✅ Ключ создан: ./ssl/keys/full_db_encryption.key"
fi

echo "🔒 Полное шифрование всех таблиц в базе данных..."

# Проверяем подключение к БД
if ! docker exec dapp-postgres pg_isready -U dapp_user -d dapp_db > /dev/null 2>&1; then
    echo "❌ Не удалось подключиться к базе данных"
    exit 1
fi

# Создаём функции шифрования в PostgreSQL
echo "📝 Создание функций шифрования в PostgreSQL..."

docker exec dapp-postgres psql -U dapp_user -d dapp_db << 'EOF'
-- Создаём расширение для шифрования
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Функция для шифрования текста
CREATE OR REPLACE FUNCTION encrypt_text(data text, key text)
RETURNS text AS $$
BEGIN
    IF data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(encrypt_iv(data::bytea, decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Функция для расшифровки текста
CREATE OR REPLACE FUNCTION decrypt_text(encrypted_data text, key text)
RETURNS text AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN convert_from(decrypt_iv(decode(encrypted_data, 'base64'), decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'utf8');
END;
$$ LANGUAGE plpgsql;

-- Функция для шифрования JSON
CREATE OR REPLACE FUNCTION encrypt_json(data jsonb, key text)
RETURNS text AS $$
BEGIN
    IF data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(encrypt_iv(data::text::bytea, decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Функция для расшифровки JSON
CREATE OR REPLACE FUNCTION decrypt_json(encrypted_data text, key text)
RETURNS jsonb AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN convert_from(decrypt_iv(decode(encrypted_data, 'base64'), decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'utf8')::jsonb;
END;
$$ LANGUAGE plpgsql;
EOF

# Читаем ключ шифрования
ENCRYPTION_KEY=$(cat ./ssl/keys/full_db_encryption.key)

echo "🔐 Начинаем шифрование всех таблиц..."

# Получаем список всех таблиц
TABLES=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;")

echo "📋 Найдены таблицы для шифрования:"
echo "$TABLES"

# Функция для шифрования таблицы
encrypt_table() {
    local table_name="$1"
    echo "🔐 Шифрование таблицы: $table_name"
    
    # Получаем информацию о колонках
    local columns=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = '$table_name' 
    AND table_schema = 'public'
    AND data_type IN ('text', 'varchar', 'character varying', 'json', 'jsonb')
    AND column_name NOT LIKE '%_encrypted'
    AND column_name NOT IN ('created_at', 'updated_at', 'id')
    ORDER BY ordinal_position;")
    
    if [ -z "$columns" ]; then
        echo "   ⏭️  Нет текстовых колонок для шифрования"
        return
    fi
    
    echo "   📝 Колонки для шифрования:"
    echo "$columns" | while read -r column_info; do
        if [ -n "$column_info" ]; then
            echo "      $column_info"
        fi
    done
    
    # Создаём зашифрованные колонки и шифруем данные
    echo "$columns" | while read -r column_info; do
        if [ -n "$column_info" ]; then
            column_name=$(echo "$column_info" | awk '{print $1}')
            data_type=$(echo "$column_info" | awk '{print $2}')
            
            echo "   🔐 Шифрование колонки: $column_name"
            
            # Добавляем зашифрованную колонку
            if [ "$data_type" = "jsonb" ] || [ "$data_type" = "json" ]; then
                docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
                ALTER TABLE $table_name ADD COLUMN IF NOT EXISTS ${column_name}_encrypted TEXT;
                UPDATE $table_name 
                SET ${column_name}_encrypted = encrypt_json($column_name, '$ENCRYPTION_KEY')
                WHERE $column_name IS NOT NULL AND ${column_name}_encrypted IS NULL;"
            else
                docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
                ALTER TABLE $table_name ADD COLUMN IF NOT EXISTS ${column_name}_encrypted TEXT;
                UPDATE $table_name 
                SET ${column_name}_encrypted = encrypt_text($column_name, '$ENCRYPTION_KEY')
                WHERE $column_name IS NOT NULL AND ${column_name}_encrypted IS NULL;"
            fi
        fi
    done
}

# Шифруем каждую таблицу
echo "$TABLES" | while read -r table_name; do
    if [ -n "$table_name" ]; then
        encrypt_table "$table_name"
    fi
done

echo "✅ Шифрование всех таблиц завершено!"

# Создаём скрипт для расшифровки
cat > decrypt-all-tables.sh << 'EOF'
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
            if [ "$data_type" = "jsonb" ] || [ "$data_type" = "json" ]; then
                # Расшифровываем json/jsonb
                docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
                SELECT id, decrypt_json($column_name, '$ENCRYPTION_KEY') as ${column_name%_encrypted}_decrypted
                FROM $table_name WHERE $column_name IS NOT NULL LIMIT 5;"
            else
                # Расшифровываем текстовые
                docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
                SELECT id, decrypt_text($column_name, '$ENCRYPTION_KEY') as ${column_name%_encrypted}_decrypted
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
EOF

chmod +x decrypt-all-tables.sh

# Создаём скрипт для удаления незашифрованных колонок
cat > remove-unencrypted-columns.sh << 'EOF'
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
        local unencrypted_columns=$(docker exec dapp-postgres psql -U dapp_user -d dapp_db -t -c "
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
EOF

chmod +x remove-unencrypted-columns.sh

echo ""
echo "🎯 Что было сделано:"
echo "1. ✅ Создан ключ шифрования: ./ssl/keys/full_db_encryption.key"
echo "2. ✅ Добавлены функции шифрования в PostgreSQL"
echo "3. ✅ Зашифрованы ВСЕ текстовые колонки во ВСЕХ таблицах"
echo "4. ✅ Создан скрипт расшифровки: ./decrypt-all-tables.sh"
echo "5. ✅ Создан скрипт удаления: ./remove-unencrypted-columns.sh"
echo ""
echo "⚠️  ВАЖНО:"
echo "- Ключ шифрования: ./ssl/keys/full_db_encryption.key"
echo "- Храните ключ в безопасном месте!"
echo "- Сделайте резервную копию ключа!"
echo ""
echo "🔧 Следующие шаги:"
echo "1. Протестируйте расшифровку: ./decrypt-all-tables.sh"
echo "2. Обновите код приложения для работы с зашифрованными данными"
echo "3. После проверки удалите незашифрованные колонки: ./remove-unencrypted-columns.sh" 