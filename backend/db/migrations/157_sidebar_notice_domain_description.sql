-- Migration: 157_sidebar_notice_domain_description
-- Description: Редактируемое описание домена (meta description) на /settings/sidebar/text
-- Date: 2026-09-02

-- UP Migration

ALTER TABLE sidebar_notice
  ADD COLUMN IF NOT EXISTS domain_description TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN sidebar_notice.domain_description IS 'Описание домена для meta description / og:description; пустое = дефолт шаблона';

-- DOWN Migration
-- ALTER TABLE sidebar_notice DROP COLUMN IF EXISTS domain_description;
