-- Migration: 172_sidebar_notice_header_description
-- Description: Описание в шапке (отдельно от текста сайдбара)
-- Date: 2026-09-12

-- UP Migration

ALTER TABLE sidebar_notice
  ADD COLUMN IF NOT EXISTS header_description TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN sidebar_notice.header_description IS 'Короткое описание рядом с названием в шапке сайта';

-- DOWN Migration
-- ALTER TABLE sidebar_notice DROP COLUMN IF EXISTS header_description;
