-- Migration: Add deploy_result field to deploy_params table
-- Copyright (c) 2024-2025 Тарабанов Александр Викторович

-- Добавляем поле для хранения результатов деплоя
ALTER TABLE deploy_params 
ADD COLUMN IF NOT EXISTS deploy_result JSONB;

-- Добавляем комментарий к новому полю
COMMENT ON COLUMN deploy_params.deploy_result IS 'Полные результаты деплоя контрактов в формате JSON (адреса, хеши транзакций, газ, верификация)';

-- Создаем индекс для быстрого поиска по результатам деплоя
CREATE INDEX IF NOT EXISTS idx_deploy_params_deploy_result ON deploy_params USING GIN (deploy_result);
