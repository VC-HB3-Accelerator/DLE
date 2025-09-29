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


if ! docker exec dapp-postgres pg_isready -U dapp_user -d dapp_db > /dev/null 2>&1; then
    exit 1
fi

if [ ! -f "./ssl/keys/full_db_encryption.key" ]; then
    exit 1
fi

ENCRYPTION_KEY=$(cat ./ssl/keys/full_db_encryption.key)

# Создаем роли Read-Only и Editor
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO roles (id, name, description) VALUES 
  (1, 'readonly', 'Read-Only доступ - только просмотр данных'),
  (2, 'editor', 'Editor доступ - просмотр и редактирование данных')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;"

docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO rpc_providers (network_id_encrypted, rpc_url_encrypted, chain_id)
VALUES
  (encrypt_text('sepolia', '$ENCRYPTION_KEY'), encrypt_text('https://1rpc.io/sepolia', '$ENCRYPTION_KEY'), 11155111),
  (encrypt_text('holesky', '$ENCRYPTION_KEY'), encrypt_text('https://ethereum-holesky.publicnode.com', '$ENCRYPTION_KEY'), 17000)
ON CONFLICT DO NOTHING;"
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO auth_tokens (name_encrypted, address_encrypted, network_encrypted, min_balance, readonly_threshold, editor_threshold)
VALUES
  (encrypt_text('DLE', '$ENCRYPTION_KEY'), encrypt_text('0x2F2F070AA10bD3Ea14949b9953E2040a05421B17', '$ENCRYPTION_KEY'), encrypt_text('holesky', '$ENCRYPTION_KEY'), 1.000000000000000000, 1, 1),
  (encrypt_text('DLE', '$ENCRYPTION_KEY'), encrypt_text('0x2F2F070AA10bD3Ea14949b9953E2040a05421B17', '$ENCRYPTION_KEY'), encrypt_text('sepolia', '$ENCRYPTION_KEY'), 1.000000000000000000, 1, 1)
ON CONFLICT DO NOTHING;"
