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


if ! docker exec dapp-postgres pg_isready -U dapp_user -d dapp_db > /dev/null 2>&1; then
    exit 1
fi

if [ ! -f "./ssl/keys/full_db_encryption.key" ]; then
    exit 1
fi

ENCRYPTION_KEY=$(cat ./ssl/keys/full_db_encryption.key)

# Создаем роли Read-Only и Editor
# Используем DO блок для безопасной вставки с проверкой уникальности name_encrypted
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
DO \$\$
DECLARE
  readonly_id INTEGER;
  editor_id INTEGER;
BEGIN
  -- Проверяем и создаем/обновляем роль readonly
  SELECT id INTO readonly_id FROM roles WHERE decrypt_text(name_encrypted, get_encryption_key()) = 'readonly' LIMIT 1;
  IF readonly_id IS NULL THEN
    -- Если роли нет, пытаемся вставить с id=1, если занято - используем следующий доступный
    BEGIN
      INSERT INTO roles (id, name_encrypted) VALUES (1, encrypt_text('readonly', get_encryption_key()));
    EXCEPTION WHEN unique_violation THEN
      INSERT INTO roles (name_encrypted) VALUES (encrypt_text('readonly', get_encryption_key()));
    END;
  END IF;
  
  -- Проверяем и создаем/обновляем роль editor
  SELECT id INTO editor_id FROM roles WHERE decrypt_text(name_encrypted, get_encryption_key()) = 'editor' LIMIT 1;
  IF editor_id IS NULL THEN
    BEGIN
      INSERT INTO roles (id, name_encrypted) VALUES (2, encrypt_text('editor', get_encryption_key()));
    EXCEPTION WHEN unique_violation THEN
      INSERT INTO roles (name_encrypted) VALUES (encrypt_text('editor', get_encryption_key()));
    END;
  END IF;
END \$\$;"

# Заполняем справочную таблицу is_rag_source
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO is_rag_source (id, name_encrypted) VALUES 
  (1, encrypt_text('Да', '$ENCRYPTION_KEY')),
  (2, encrypt_text('Нет', '$ENCRYPTION_KEY'))
ON CONFLICT (id) DO UPDATE SET 
  name_encrypted = EXCLUDED.name_encrypted;"

# Заполняем RPC провайдеры с проверкой дубликатов
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
DO \$\$
BEGIN
  -- Sepolia
  IF NOT EXISTS (
    SELECT 1 FROM rpc_providers 
    WHERE decrypt_text(network_id_encrypted, get_encryption_key()) = 'sepolia' 
    AND chain_id = 11155111
  ) THEN
    INSERT INTO rpc_providers (network_id_encrypted, rpc_url_encrypted, chain_id)
    VALUES (encrypt_text('sepolia', get_encryption_key()), encrypt_text('https://1rpc.io/sepolia', get_encryption_key()), 11155111);
  END IF;
END \$\$;"

# Заполняем токены аутентификации с проверкой дубликатов
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
DO \$\$
BEGIN
  -- Sepolia token
  IF NOT EXISTS (
    SELECT 1 FROM auth_tokens 
    WHERE decrypt_text(network_encrypted, get_encryption_key()) = 'sepolia'
    AND decrypt_text(address_encrypted, get_encryption_key()) = '0x8e96DdB110aa1C55A4b9ded8c16E66Fbdb5E63E1'
  ) THEN
    INSERT INTO auth_tokens (name_encrypted, address_encrypted, network_encrypted, min_balance, readonly_threshold, editor_threshold)
    VALUES (
      encrypt_text('DLE', get_encryption_key()), 
      encrypt_text('0x8e96DdB110aa1C55A4b9ded8c16E66Fbdb5E63E1', get_encryption_key()), 
      encrypt_text('sepolia', get_encryption_key()), 
      1.000000000000000000, 1, 1
    );
  END IF;
END \$\$;"
