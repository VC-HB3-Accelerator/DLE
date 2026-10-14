-- Migration: 069_create_identity_link_tokens
-- Description: Создание таблицы identity_link_tokens для токенов связывания идентификаторов
-- Date: 2025-10-09

CREATE TABLE IF NOT EXISTS identity_link_tokens (
  id SERIAL PRIMARY KEY,
  
  -- Уникальный токен
  token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Кого связываем (источник)
  source_provider VARCHAR(20) NOT NULL,  -- 'telegram', 'email'
  source_identifier_encrypted TEXT NOT NULL,
  
  -- Опциональный user_id если уже создан
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Состояние токена
  is_used BOOLEAN DEFAULT false NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  linked_wallet TEXT,  -- Кошелек, который привязали
  
  -- TTL (Time To Live)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint для провайдера
  CONSTRAINT check_source_provider CHECK (source_provider IN ('telegram', 'email'))
);

-- Индексы для быстрого поиска
CREATE INDEX idx_link_tokens_token ON identity_link_tokens(token);
CREATE INDEX idx_link_tokens_expires ON identity_link_tokens(expires_at);
CREATE INDEX idx_link_tokens_used ON identity_link_tokens(is_used);
CREATE INDEX idx_link_tokens_provider ON identity_link_tokens(source_provider);

-- Комментарии
COMMENT ON TABLE identity_link_tokens IS 'Токены для связывания Telegram/Email идентификаторов с Web3 кошельками';
COMMENT ON COLUMN identity_link_tokens.token IS 'Уникальный токен для одноразового использования';
COMMENT ON COLUMN identity_link_tokens.source_provider IS 'Источник идентификатора: telegram или email';
COMMENT ON COLUMN identity_link_tokens.expires_at IS 'Время истечения токена (обычно 1 час после создания)';
COMMENT ON COLUMN identity_link_tokens.is_used IS 'Флаг использования токена';

