-- Migration: Create deploy_params table
-- Copyright (c) 2024-2025 Тарабанов Александр Викторович

-- Создаем таблицу для хранения параметров деплоя DLE
CREATE TABLE IF NOT EXISTS deploy_params (
    id SERIAL PRIMARY KEY,
    deployment_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(255) NOT NULL,
    location TEXT,
    coordinates VARCHAR(100),
    jurisdiction INTEGER,
    oktmo VARCHAR(50),
    okved_codes JSONB,
    kpp BIGINT,
    quorum_percentage INTEGER,
    initial_partners JSONB,
    initial_amounts JSONB,
    supported_chain_ids JSONB,
    current_chain_id INTEGER,
    logo_uri TEXT,
    private_key_encrypted TEXT,
    etherscan_api_key TEXT,
    auto_verify_after_deploy BOOLEAN DEFAULT false,
    create2_salt VARCHAR(66),
    rpc_urls JSONB,
    initializer VARCHAR(42),
    dle_address VARCHAR(42),
    modules_to_deploy JSONB,
    deployment_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_deploy_params_deployment_id ON deploy_params(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deploy_params_dle_address ON deploy_params(dle_address);
CREATE INDEX IF NOT EXISTS idx_deploy_params_status ON deploy_params(deployment_status);
CREATE INDEX IF NOT EXISTS idx_deploy_params_created_at ON deploy_params(created_at);

-- Создаем функцию для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_deploy_params_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создаем триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_deploy_params_updated_at ON deploy_params;
CREATE TRIGGER trigger_update_deploy_params_updated_at
    BEFORE UPDATE ON deploy_params
    FOR EACH ROW
    EXECUTE FUNCTION update_deploy_params_updated_at();

-- Добавляем комментарии к таблице и колонкам
COMMENT ON TABLE deploy_params IS 'Таблица для хранения параметров деплоя DLE контрактов';
COMMENT ON COLUMN deploy_params.deployment_id IS 'Уникальный идентификатор деплоя';
COMMENT ON COLUMN deploy_params.name IS 'Название DLE';
COMMENT ON COLUMN deploy_params.symbol IS 'Символ токена';
COMMENT ON COLUMN deploy_params.location IS 'Местоположение DLE';
COMMENT ON COLUMN deploy_params.coordinates IS 'Координаты местоположения';
COMMENT ON COLUMN deploy_params.jurisdiction IS 'Код юрисдикции';
COMMENT ON COLUMN deploy_params.oktmo IS 'Код ОКТМО';
COMMENT ON COLUMN deploy_params.okved_codes IS 'Коды ОКВЭД в формате JSON';
COMMENT ON COLUMN deploy_params.kpp IS 'КПП организации';
COMMENT ON COLUMN deploy_params.quorum_percentage IS 'Процент кворума';
COMMENT ON COLUMN deploy_params.initial_partners IS 'Начальные партнеры в формате JSON';
COMMENT ON COLUMN deploy_params.initial_amounts IS 'Начальные суммы в формате JSON';
COMMENT ON COLUMN deploy_params.supported_chain_ids IS 'Поддерживаемые сети в формате JSON';
COMMENT ON COLUMN deploy_params.current_chain_id IS 'Текущая сеть';
COMMENT ON COLUMN deploy_params.logo_uri IS 'URI логотипа';
COMMENT ON COLUMN deploy_params.private_key_encrypted IS 'Приватный ключ для деплоя (зашифрован)';
COMMENT ON COLUMN deploy_params.etherscan_api_key IS 'API ключ Etherscan';
COMMENT ON COLUMN deploy_params.auto_verify_after_deploy IS 'Автоматическая верификация после деплоя';
COMMENT ON COLUMN deploy_params.create2_salt IS 'CREATE2 соль для детерминированного деплоя';
COMMENT ON COLUMN deploy_params.rpc_urls IS 'RPC URLs для сетей в формате JSON';
COMMENT ON COLUMN deploy_params.initializer IS 'Адрес инициализатора';
COMMENT ON COLUMN deploy_params.dle_address IS 'Адрес задеплоенного DLE контракта';
COMMENT ON COLUMN deploy_params.modules_to_deploy IS 'Модули для деплоя в формате JSON';
COMMENT ON COLUMN deploy_params.deployment_status IS 'Статус деплоя: pending, in_progress, completed, failed (данные сохраняются для деплоя модулей)';
COMMENT ON COLUMN deploy_params.created_at IS 'Время создания записи';
COMMENT ON COLUMN deploy_params.updated_at IS 'Время последнего обновления записи';
