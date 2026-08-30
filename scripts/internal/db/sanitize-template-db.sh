#!/usr/bin/env bash
# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
#
# Санитация БД до дефолтов шаблона. Не трогает uploads и не спрашивает.
# Цель задаётся POSTGRES_CONTAINER (живой инстанс или временный клон).
#
# KEEP: migrations, roles, auth_tokens, rpc_providers, factory_addresses,
#       ISIC, is_rag_source, blog_feed_filters(+pages),
#       юр. шаблоны (is_system_template + published «политика и согласия»).
# WIPE: пользовательские данные, deploy_params (ключи), rag_chunks (векторы).
#
# После TRUNCATE: sidebar/hub дефолты, db_init_helper (Sepolia RPC + DLE auth).

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=template-wipe-tables.inc.sh
source "$SCRIPT_DIR/template-wipe-tables.inc.sh"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-dapp-postgres}"
DB_USER="${DB_USER:-dapp_user}"
DB_NAME="${DB_NAME:-dapp_db}"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if ! docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
  echo -e "${RED}Контейнер ${POSTGRES_CONTAINER} не запущен.${NC}" >&2
  exit 1
fi

EXISTING=$(docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT tablename FROM pg_tables WHERE schemaname='public'")

TO_WIPE=()
while IFS= read -r t; do
  [ -z "$t" ] && continue
  if template_keep_table_data "$t"; then
    continue
  fi
  TO_WIPE+=("$t")
done <<< "$EXISTING"

# factory_addresses может ссылаться на users — CASCADE снесёт адреса.
# Снимок, TRUNCATE и возврат — в одной транзакции.
HAS_FACTORY=0
if echo "$EXISTING" | grep -qx 'factory_addresses'; then
  HAS_FACTORY=1
fi

if [ "${#TO_WIPE[@]}" -eq 0 ] && [ "$HAS_FACTORY" -eq 0 ]; then
  echo -e "${YELLOW}Нет таблиц для TRUNCATE.${NC}"
else
  JOINED=""
  if [ "${#TO_WIPE[@]}" -gt 0 ]; then
    JOINED=$(IFS=,; echo "${TO_WIPE[*]}")
  fi
  echo -e "${YELLOW}TRUNCATE ${#TO_WIPE[@]} таблиц CASCADE (транзакция, KEEP factory_addresses)…${NC}"
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<EOSQL
BEGIN;
$(if [ "$HAS_FACTORY" -eq 1 ]; then
  echo "DROP TABLE IF EXISTS _bak_factory_addresses;"
  echo "CREATE TABLE _bak_factory_addresses AS TABLE factory_addresses;"
fi)
$(if [ -n "$JOINED" ]; then
  echo "TRUNCATE TABLE ${JOINED} CASCADE;"
fi)
$(if [ "$HAS_FACTORY" -eq 1 ]; then
  echo "DELETE FROM factory_addresses;"
  echo "INSERT INTO factory_addresses SELECT * FROM _bak_factory_addresses;"
  echo "DROP TABLE _bak_factory_addresses;"
fi)
COMMIT;
EOSQL
fi

if echo "$EXISTING" | grep -qx 'sidebar_notice'; then
  echo -e "${YELLOW}Сброс sidebar_notice…${NC}"
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    INSERT INTO sidebar_notice (id, body, updated_at, updated_by)
    VALUES (1, '', NOW(), NULL)
    ON CONFLICT (id) DO UPDATE SET body = '', updated_at = NOW(), updated_by = NULL;
  "
fi

if echo "$EXISTING" | grep -qx 'updates_hub_settings'; then
  echo -e "${YELLOW}Восстановление updates_hub_settings (клиентский дефолт)…${NC}"
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    INSERT INTO updates_hub_settings (
      id, hub_url, stub_mode, gitea_url, gitea_asset_template, gitea_org, gitea_repo,
      gitea_token_encrypted, hub_service_token_encrypted, updated_at, updated_by
    ) VALUES (
      1, 'https://hb3-accelerator.com', true, '', '', '', '',
      NULL, NULL, NOW(), NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      hub_url = EXCLUDED.hub_url,
      stub_mode = true,
      gitea_url = '',
      gitea_org = '',
      gitea_repo = '',
      gitea_asset_template = '',
      gitea_token_encrypted = NULL,
      hub_service_token_encrypted = NULL,
      updated_by = NULL,
      updated_at = NOW();
  "
fi

if echo "$EXISTING" | grep -qx 'sidebar_nav_settings'; then
  echo -e "${YELLOW}Восстановление sidebar_nav_settings…${NC}"
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    INSERT INTO sidebar_nav_settings (id, buttons_json)
    VALUES (1, '{\"repositories\": false}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET buttons_json = EXCLUDED.buttons_json, updated_at = NOW();
  "
fi

if echo "$EXISTING" | grep -qx 'legal_operator_settings'; then
  echo -e "${YELLOW}Восстановление legal_operator_settings (пустой дефолт)…${NC}"
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    INSERT INTO legal_operator_settings (id, variables)
    VALUES (1, '{}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      variables = '{}'::jsonb,
      updated_at = NOW();
  "
fi

if echo "$EXISTING" | grep -qx 'admin_pages_simple'; then
  echo -e "${YELLOW}Очистка admin_pages_simple (кроме шаблонов и «политика и согласия»)…${NC}"
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    DELETE FROM admin_pages_simple
    WHERE NOT (
      COALESCE(is_system_template, FALSE) = TRUE
      OR category = 'политика и согласия'
    );
  "

  echo -e "${YELLOW}«Политика и согласия»: show_in_blog=false, снять фильтр politika-i-soglasiya…${NC}"
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    UPDATE admin_pages_simple
    SET show_in_blog = FALSE, updated_at = NOW()
    WHERE LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM('политика и согласия'))
      AND status = 'published'
      AND visibility = 'public'
      AND COALESCE(is_system_template, FALSE) = FALSE;

    DELETE FROM blog_feed_filter_pages
    WHERE filter_id IN (
      SELECT id FROM blog_feed_filters WHERE slug = 'politika-i-soglasiya'
    );
    DELETE FROM blog_feed_filters WHERE slug = 'politika-i-soglasiya';
  "
fi

HELPER="$PROJECT_ROOT/scripts/internal/db/db_init_helper.sh"
if [ -x "$HELPER" ] || [ -f "$HELPER" ]; then
  echo -e "${YELLOW}db_init_helper: Sepolia RPC + DLE auth tokens 1/1…${NC}"
  chmod +x "$HELPER" 2>/dev/null || true
  POSTGRES_CONTAINER="$POSTGRES_CONTAINER" DB_USER="$DB_USER" DB_NAME="$DB_NAME" "$HELPER"
else
  echo -e "${YELLOW}Пропуск db_init_helper (нет файла): $HELPER${NC}"
fi

echo -e "${GREEN}Проверка шаблонной БД:${NC}"
VERIFY_TABLES=(
  auth_tokens rpc_providers roles role_screen_capabilities
  migrations blog_feed_filters isic_rev4_codes admin_pages_simple
  users session deploy_params rag_chunks factory_addresses
  secrets is_rag_source
)
VERIFY_SQL=""
for t in "${VERIFY_TABLES[@]}"; do
  if echo "$EXISTING" | grep -qx "$t"; then
    if [ -z "$VERIFY_SQL" ]; then
      VERIFY_SQL="SELECT '${t}' AS t, COUNT(*)::text AS c FROM ${t}"
    else
      VERIFY_SQL="${VERIFY_SQL} UNION ALL SELECT '${t}', COUNT(*)::text FROM ${t}"
    fi
  fi
done
if [ -n "$VERIFY_SQL" ]; then
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "${VERIFY_SQL} ORDER BY 1;"
fi

echo -e "${GREEN}Санитация ${POSTGRES_CONTAINER} завершена.${NC}"
echo "KEEP: auth_tokens, RPC, роли, миграции, ISIC, is_rag_source, factory_addresses,"
echo "      шаблоны политики + published «политика и согласия»."
echo "WIPE: пользователи, deploy_params, rag_chunks (векторы)."
