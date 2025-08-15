#!/bin/bash

if ! docker exec dapp-postgres pg_isready -U dapp_user -d dapp_db > /dev/null 2>&1; then
    exit 1
fi

if [ ! -f "./ssl/keys/full_db_encryption.key" ]; then
    exit 1
fi

ENCRYPTION_KEY=$(cat ./ssl/keys/full_db_encryption.key)
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO rpc_providers (network_id_encrypted, rpc_url_encrypted, chain_id)
VALUES
  (encrypt_text('sepolia', '$ENCRYPTION_KEY'), encrypt_text('https://eth-sepolia.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52', '$ENCRYPTION_KEY'), 11155111),
  (encrypt_text('holesky', '$ENCRYPTION_KEY'), encrypt_text('https://ethereum-holesky.publicnode.com', '$ENCRYPTION_KEY'), 17000)
ON CONFLICT DO NOTHING;"
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c "
INSERT INTO auth_tokens (name_encrypted, address_encrypted, network_encrypted, min_balance)
VALUES
  (encrypt_text('DLE', '$ENCRYPTION_KEY'), encrypt_text('0x2F2F070AA10bD3Ea14949b9953E2040a05421B17', '$ENCRYPTION_KEY'), encrypt_text('holesky', '$ENCRYPTION_KEY'), 1.0),
  (encrypt_text('DLE', '$ENCRYPTION_KEY'), encrypt_text('0x2F2F070AA10bD3Ea14949b9953E2040a05421B17', '$ENCRYPTION_KEY'), encrypt_text('sepolia', '$ENCRYPTION_KEY'), 1.0)
ON CONFLICT DO NOTHING;"
