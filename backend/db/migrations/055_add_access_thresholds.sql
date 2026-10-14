-- Добавление полей для настройки порогов доступа в таблицу auth_tokens
-- Copyright (c) 2024-2025 Тарабанов Александр Викторович

-- Добавляем новые колонки для порогов доступа
ALTER TABLE auth_tokens 
ADD COLUMN IF NOT EXISTS readonly_threshold INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS editor_threshold INTEGER DEFAULT 2;

-- Обновляем существующие записи значениями по умолчанию
UPDATE auth_tokens 
SET 
    readonly_threshold = 1,
    editor_threshold = 2
WHERE readonly_threshold IS NULL OR editor_threshold IS NULL;

-- Добавляем комментарии к колонкам
COMMENT ON COLUMN auth_tokens.readonly_threshold IS 'Минимальное количество токенов для получения прав Read-Only';
COMMENT ON COLUMN auth_tokens.editor_threshold IS 'Минимальное количество токенов для получения прав Editor';
