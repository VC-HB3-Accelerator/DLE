-- Migration: update AI assistant settings channel flags

ALTER TABLE ai_assistant_settings
    DROP COLUMN IF EXISTS enabled_for_chat;

ALTER TABLE ai_assistant_settings
    ADD COLUMN IF NOT EXISTS enabled_channels jsonb
        DEFAULT '{"web": true, "telegram": true, "email": true}'::jsonb;

UPDATE ai_assistant_settings
SET enabled_channels = '{"web": true, "telegram": true, "email": true}'::jsonb
WHERE enabled_channels IS NULL
   OR jsonb_typeof(enabled_channels) <> 'object';


