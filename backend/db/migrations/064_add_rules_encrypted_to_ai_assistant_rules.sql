-- Миграция: добавление столбца rules_encrypted в ai_assistant_rules
-- Автор: Тарабанов Александр Викторович
-- Дата: 2025-10-08
-- Описание: Добавляет зашифрованный столбец для хранения правил AI ассистента

BEGIN;

-- Добавляем столбец rules_encrypted для хранения зашифрованных правил
ALTER TABLE ai_assistant_rules
ADD COLUMN IF NOT EXISTS rules_encrypted TEXT;

-- Комментарий для документации
COMMENT ON COLUMN ai_assistant_rules.rules_encrypted IS 'Зашифрованные правила для AI ассистента в формате JSON';

COMMIT;

