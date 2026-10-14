-- UP Migration
-- 139_system_messages.sql
-- CMS system messages (welcome / first touch) + delivery log (TZ_SYSTEM_MESSAGES_WELCOME_I18N)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS system_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'generic'
    CHECK (kind IN ('welcome', 'generic')),
  channels JSONB NOT NULL DEFAULT '["web","telegram","email"]'::jsonb,
  reply_type TEXT NOT NULL DEFAULT 'inline'
    CHECK (reply_type IN ('inline', 'assistant_reply')),
  importance TEXT NOT NULL DEFAULT 'info'
    CHECK (importance IN ('info', 'warning', 'danger')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  visible_for TEXT NOT NULL DEFAULT 'guests_and_new_users',
  audience JSONB NOT NULL DEFAULT '{
    "preset": "guests_and_new_users",
    "include_guests": true,
    "include_authenticated": true,
    "use_max_age": true,
    "max_user_age_seconds": 3600,
    "roles": [],
    "tag_ids": [],
    "tag_match": "any",
    "role_tag_logic": "and"
  }'::jsonb,
  max_user_age_seconds INTEGER NOT NULL DEFAULT 3600,
  persist_to_history BOOLEAN NOT NULL DEFAULT false,
  publish_at TIMESTAMPTZ,
  expire_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_system_messages_status ON system_messages (status);
CREATE INDEX IF NOT EXISTS idx_system_messages_kind ON system_messages (kind);
CREATE INDEX IF NOT EXISTS idx_system_messages_channels ON system_messages USING GIN (channels);

CREATE TABLE IF NOT EXISTS system_message_deliveries (
  id BIGSERIAL PRIMARY KEY,
  system_message_id UUID NOT NULL REFERENCES system_messages(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (system_message_id, channel, recipient_key)
);

CREATE INDEX IF NOT EXISTS idx_system_message_deliveries_lookup
  ON system_message_deliveries (channel, recipient_key);

COMMENT ON TABLE system_messages IS
  'CMS системные сообщения (приветствие / generic). i18n+ветки в jsonb; не история чата.';
COMMENT ON TABLE system_message_deliveries IS
  'Лог доставки welcome (TG/email). Web просмотры по умолчанию не пишем.';

-- Seed: first-touch welcome (draft until editor publishes — published for local smoke)
INSERT INTO system_messages (
  slug, kind, channels, reply_type, importance, status,
  visible_for, max_user_age_seconds, persist_to_history, sort_order, i18n, audience
) VALUES (
  'welcome-default',
  'welcome',
  '["web","telegram","email"]'::jsonb,
  'inline',
  'info',
  'published',
  'guests_and_new_users',
  3600,
  false,
  0,
  '{
    "ru": {
      "title": "Добро пожаловать",
      "summary": "Ассистент VC HB3 Accelerator",
      "content": "Здравствуйте! Я ассистент VC HB3 Accelerator. Напишите вопрос или выберите тему ниже.\n\nОбычно отвечаем в течение **2–5 минут**.",
      "assistant_reply_content": null,
      "branches": [
        {
          "id": "investors",
          "ui": "button",
          "label": "Инвесторам",
          "action": "send_user_message",
          "payload": "Хочу узнать об инвестициях / Stage A"
        },
        {
          "id": "partners",
          "ui": "button",
          "label": "Партнёрам / IT",
          "action": "send_user_message",
          "payload": "Интересует партнёрство / контрибьютор"
        },
        {
          "id": "q-sla",
          "ui": "text",
          "label": "За сколько вы отвечаете?",
          "action": "send_user_message",
          "payload": "За сколько вы отвечаете?"
        }
      ]
    },
    "en": {
      "title": "Welcome",
      "summary": "VC HB3 Accelerator assistant",
      "content": "Hello! I am the VC HB3 Accelerator assistant. Ask a question or pick a topic below.\n\nWe typically reply within **2–5 minutes**.",
      "assistant_reply_content": null,
      "branches": [
        {
          "id": "investors",
          "ui": "button",
          "label": "For investors",
          "action": "send_user_message",
          "payload": "I want to learn about investing / Stage A"
        },
        {
          "id": "partners",
          "ui": "button",
          "label": "Partners / IT",
          "action": "send_user_message",
          "payload": "Interested in partnership / contributor"
        },
        {
          "id": "q-sla",
          "ui": "text",
          "label": "How fast do you reply?",
          "action": "send_user_message",
          "payload": "How fast do you reply?"
        }
      ]
    }
  }'::jsonb,
  '{
    "preset": "guests_and_new_users",
    "include_guests": true,
    "include_authenticated": true,
    "use_max_age": true,
    "max_user_age_seconds": 3600,
    "roles": [],
    "tag_ids": [],
    "tag_match": "any",
    "role_tag_logic": "and"
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- DOWN Migration
-- DROP TABLE IF EXISTS system_message_deliveries;
-- DROP TABLE IF EXISTS system_messages;
