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
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO roles (id, name_encrypted) VALUES 
  (1, encrypt_text('readonly', '$ENCRYPTION_KEY')),
  (2, encrypt_text('editor', '$ENCRYPTION_KEY'))
ON CONFLICT (id) DO UPDATE SET 
  name_encrypted = EXCLUDED.name_encrypted;"

# Заполняем справочную таблицу is_rag_source
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO is_rag_source (id, name_encrypted) VALUES 
  (1, encrypt_text('Да', '$ENCRYPTION_KEY')),
  (2, encrypt_text('Нет', '$ENCRYPTION_KEY'))
ON CONFLICT (id) DO UPDATE SET 
  name_encrypted = EXCLUDED.name_encrypted;"

docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO rpc_providers (network_id_encrypted, rpc_url_encrypted, chain_id)
VALUES
  (encrypt_text('sepolia', '$ENCRYPTION_KEY'), encrypt_text('https://1rpc.io/sepolia', '$ENCRYPTION_KEY'), 11155111),
  (encrypt_text('arbitrum-sepolia', '$ENCRYPTION_KEY'), encrypt_text('https://sepolia-rollup.arbitrum.io/rpc', '$ENCRYPTION_KEY'), 421614),
  (encrypt_text('base-sepolia', '$ENCRYPTION_KEY'), encrypt_text('https://sepolia.base.org', '$ENCRYPTION_KEY'), 84532)
ON CONFLICT DO NOTHING;"
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO auth_tokens (name_encrypted, address_encrypted, network_encrypted, min_balance, readonly_threshold, editor_threshold)
VALUES
  (encrypt_text('DLE', '$ENCRYPTION_KEY'), encrypt_text('0xdD27a91692da59d1Ee7dD1Fb342B9f1B5FF29386', '$ENCRYPTION_KEY'), encrypt_text('sepolia', '$ENCRYPTION_KEY'), 1.000000000000000000, 1, 1),
  (encrypt_text('DLE', '$ENCRYPTION_KEY'), encrypt_text('0xdD27a91692da59d1Ee7dD1Fb342B9f1B5FF29386', '$ENCRYPTION_KEY'), encrypt_text('arbitrum-sepolia', '$ENCRYPTION_KEY'), 1.000000000000000000, 1, 1),
  (encrypt_text('DLE', '$ENCRYPTION_KEY'), encrypt_text('0xdD27a91692da59d1Ee7dD1Fb342B9f1B5FF29386', '$ENCRYPTION_KEY'), encrypt_text('base-sepolia', '$ENCRYPTION_KEY'), 1.000000000000000000, 1, 1)
ON CONFLICT DO NOTHING;"
