-- Migration: 120_blog_subscribers_privacy_consent
-- Description: Согласие с Политикой при подписке на блог
-- Date: 2026-07-23

ALTER TABLE blog_subscribers
  ADD COLUMN IF NOT EXISTS privacy_consent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE blog_subscribers
  ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ;

ALTER TABLE blog_subscribers
  ADD COLUMN IF NOT EXISTS privacy_consent_url TEXT;

COMMENT ON COLUMN blog_subscribers.privacy_consent IS 'Согласие с Политикой и согласиями при подписке';
COMMENT ON COLUMN blog_subscribers.privacy_consent_at IS 'Когда отмечен чекбокс согласия';
COMMENT ON COLUMN blog_subscribers.privacy_consent_url IS 'URL документа Политики, на который согласился подписчик';

-- DOWN
-- ALTER TABLE blog_subscribers DROP COLUMN IF EXISTS privacy_consent_url;
-- ALTER TABLE blog_subscribers DROP COLUMN IF EXISTS privacy_consent_at;
-- ALTER TABLE blog_subscribers DROP COLUMN IF EXISTS privacy_consent;
