#!/bin/bash
# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
#
# This software is proprietary and confidential.
# Unauthorized copying, modification, or distribution is prohibited.
#
# For licensing inquiries: info@hb3-accelerator.com
# Website: https://hb3-accelerator.com
# GitHub: https://github.com/VC-HB3-Accelerator
#
# Дефолты шаблона:
#   RPC: только Ethereum Sepolia (11155111)
#   auth_tokens: два DLE на sepolia, min_balance=1, RO/Editor=1/1
#     0x743abDaFFd4FC668aD95E49021a569dD38C11763 (HB3A)
#     0x0d2f4Df97A6cb7b34fBb0D3f66220909f6238cE6 (643)
#   roles readonly/editor, is_rag_source

set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-dapp-postgres}"
DB_USER="${DB_USER:-dapp_user}"
DB_NAME="${DB_NAME:-dapp_db}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
KEY_FILE="${KEY_FILE:-$PROJECT_ROOT/ssl/keys/full_db_encryption.key}"

DLE_TOKEN_HB3A="0x743abDaFFd4FC668aD95E49021a569dD38C11763"
DLE_TOKEN_643="0x0d2f4Df97A6cb7b34fBb0D3f66220909f6238cE6"
SEPOLIA_CHAIN_ID=11155111
SEPOLIA_NETWORK_ID="sepolia"
SEPOLIA_RPC_URL="${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"

if ! docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
  echo "postgres not ready: $POSTGRES_CONTAINER" >&2
  exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
  echo "encryption key missing: $KEY_FILE" >&2
  exit 1
fi

ENCRYPTION_KEY=$(tr -d '\n\r' < "$KEY_FILE")

docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE
  readonly_id INTEGER;
  editor_id INTEGER;
BEGIN
  SELECT id INTO readonly_id FROM roles WHERE decrypt_text(name_encrypted, get_encryption_key()) = 'readonly' LIMIT 1;
  IF readonly_id IS NULL THEN
    BEGIN
      INSERT INTO roles (id, name_encrypted) VALUES (1, encrypt_text('readonly', get_encryption_key()));
    EXCEPTION WHEN unique_violation THEN
      INSERT INTO roles (name_encrypted) VALUES (encrypt_text('readonly', get_encryption_key()));
    END;
  END IF;

  SELECT id INTO editor_id FROM roles WHERE decrypt_text(name_encrypted, get_encryption_key()) = 'editor' LIMIT 1;
  IF editor_id IS NULL THEN
    BEGIN
      INSERT INTO roles (id, name_encrypted) VALUES (2, encrypt_text('editor', get_encryption_key()));
    EXCEPTION WHEN unique_violation THEN
      INSERT INTO roles (name_encrypted) VALUES (encrypt_text('editor', get_encryption_key()));
    END;
  END IF;
END \$\$;
"

docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
INSERT INTO is_rag_source (id, name_encrypted) VALUES
  (1, encrypt_text('Да', '$ENCRYPTION_KEY')),
  (2, encrypt_text('Нет', '$ENCRYPTION_KEY'))
ON CONFLICT (id) DO UPDATE SET
  name_encrypted = EXCLUDED.name_encrypted;
"

# RPC: только Sepolia
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
DELETE FROM rpc_providers
WHERE chain_id IS DISTINCT FROM $SEPOLIA_CHAIN_ID
   OR decrypt_text(network_id_encrypted, get_encryption_key()) IS DISTINCT FROM '$SEPOLIA_NETWORK_ID';

UPDATE rpc_providers SET
  network_id_encrypted = encrypt_text('$SEPOLIA_NETWORK_ID', get_encryption_key()),
  rpc_url_encrypted = encrypt_text('$SEPOLIA_RPC_URL', get_encryption_key()),
  chain_id = $SEPOLIA_CHAIN_ID,
  updated_at = NOW()
WHERE chain_id = $SEPOLIA_CHAIN_ID;

INSERT INTO rpc_providers (network_id_encrypted, rpc_url_encrypted, chain_id)
SELECT
  encrypt_text('$SEPOLIA_NETWORK_ID', get_encryption_key()),
  encrypt_text('$SEPOLIA_RPC_URL', get_encryption_key()),
  $SEPOLIA_CHAIN_ID
WHERE NOT EXISTS (
  SELECT 1 FROM rpc_providers WHERE chain_id = $SEPOLIA_CHAIN_ID
);
"

# Auth tokens: два DLE 1/1/1 на sepolia
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
DELETE FROM auth_tokens;

INSERT INTO auth_tokens (
  name_encrypted, address_encrypted, network_encrypted,
  min_balance, readonly_threshold, editor_threshold
) VALUES
(
  encrypt_text('HB3A', get_encryption_key()),
  encrypt_text('$DLE_TOKEN_HB3A', get_encryption_key()),
  encrypt_text('$SEPOLIA_NETWORK_ID', get_encryption_key()),
  1.000000000000000000,
  1,
  1
),
(
  encrypt_text('643', get_encryption_key()),
  encrypt_text('$DLE_TOKEN_643', get_encryption_key()),
  encrypt_text('$SEPOLIA_NETWORK_ID', get_encryption_key()),
  1.000000000000000000,
  1,
  1
);
"

echo "db_init_helper: RPC=sepolia/$SEPOLIA_CHAIN_ID, auth_tokens=HB3A $DLE_TOKEN_HB3A + 643 $DLE_TOKEN_643 (1/1/1)"
