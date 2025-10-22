-- Миграция: создание таблиц для RPC провайдеров и токенов аутентификации

-- Таблица RPC провайдеров
CREATE TABLE IF NOT EXISTS rpc_providers (
    id SERIAL PRIMARY KEY,
    network_id_encrypted TEXT NOT NULL,
    rpc_url_encrypted TEXT NOT NULL,
    chain_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Таблица токенов аутентификации
CREATE TABLE IF NOT EXISTS auth_tokens (
    id SERIAL PRIMARY KEY,
    name_encrypted TEXT NOT NULL,
    address_encrypted TEXT NOT NULL,
    network_encrypted TEXT NOT NULL,
    min_balance NUMERIC(36, 18) NOT NULL,
    readonly_threshold INTEGER DEFAULT 1,
    editor_threshold INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Дефолтные данные заполняются через db_init_helper.sh 