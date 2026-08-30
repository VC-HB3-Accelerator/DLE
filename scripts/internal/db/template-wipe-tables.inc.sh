# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
# Sourced by sanitize-template-db.sh and export-template-for-release.sh
#
# В шаблон копируются ДАННЫЕ только этих таблиц (+ isic_* по префиксу).
# Остальное: схема без строк, затем дефолты (hub/sidebar, db_init_helper).
# rag_chunks (векторы) и deploy_params (ключи) в KEEP нет.
# factory_addresses — адреса смарт-контрактов/фабрики.

TEMPLATE_KEEP_DATA_TABLES=(
  migrations
  roles
  role_action_capabilities
  role_screen_capabilities
  chat_role_capabilities
  auth_tokens
  rpc_providers
  factory_addresses
  is_rag_source
  blog_feed_filters
  blog_feed_filter_pages
  admin_pages_simple
  isic_rev4_codes
  isic_rev4_level_names
)

template_keep_table_data() {
  local t="$1"
  local k
  case "$t" in
    isic_*) return 0 ;;
  esac
  for k in "${TEMPLATE_KEEP_DATA_TABLES[@]}"; do
    if [ "$t" = "$k" ]; then
      return 0
    fi
  done
  return 1
}
