-- Migration: 173_sidebar_notice_header_title
-- Название в шапке (ручное, может отличаться от on-chain name книги)

ALTER TABLE sidebar_notice
  ADD COLUMN IF NOT EXISTS header_title TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN sidebar_notice.header_title IS 'Название в шапке и document title; подставляется из книги по кнопке, правится вручную';

-- Down (manual):
-- ALTER TABLE sidebar_notice DROP COLUMN IF EXISTS header_title;
