-- Что ассистент обрабатывает во входящих сообщениях (текст / файлы / видео / аудио).
-- SoT: docs.ru/back-docs/TZ_AI_ASSISTANT_INPUT_MODALITIES.ru.md

ALTER TABLE ai_assistant_settings
  ADD COLUMN IF NOT EXISTS accept_input jsonb
  NOT NULL DEFAULT '{"text": true, "file": true, "video": true, "audio": true}'::jsonb;

UPDATE ai_assistant_settings
SET accept_input = '{"text": true, "file": true, "video": true, "audio": true}'::jsonb
WHERE accept_input IS NULL
   OR jsonb_typeof(accept_input) <> 'object';
