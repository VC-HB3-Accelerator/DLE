-- Миграция: создание таблиц для RPC провайдеров и токенов аутентификации

-- Таблица RPC провайдеров
CREATE TABLE IF NOT EXISTS rpc_providers (
    id SERIAL PRIMARY KEY,
    network_id VARCHAR(64) NOT NULL UNIQUE,
    rpc_url TEXT NOT NULL,
    chain_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Таблица токенов аутентификации
CREATE TABLE IF NOT EXISTS auth_tokens (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(64) NOT NULL,
    network VARCHAR(64) NOT NULL,
    min_balance NUMERIC(36, 18) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT auth_tokens_address_network_unique UNIQUE (address, network)
); 