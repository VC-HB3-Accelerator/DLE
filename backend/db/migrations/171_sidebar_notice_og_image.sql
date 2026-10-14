-- Migration: 171_sidebar_notice_og_image
-- Description: og:image для главной (смена / скрытие) + meta для поисковиков
-- Date: 2026-09-12

-- UP Migration

ALTER TABLE sidebar_notice
  ADD COLUMN IF NOT EXISTS og_image_url TEXT NOT NULL DEFAULT '';

ALTER TABLE sidebar_notice
  ADD COLUMN IF NOT EXISTS hide_og_image BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN sidebar_notice.og_image_url IS 'URL картинки og:image / twitter:image для главной; пустое = /og-default.png';
COMMENT ON COLUMN sidebar_notice.hide_og_image IS 'true = не отдавать og:image поисковикам и соцсетям';

-- DOWN Migration
-- ALTER TABLE sidebar_notice DROP COLUMN IF EXISTS hide_og_image;
-- ALTER TABLE sidebar_notice DROP COLUMN IF EXISTS og_image_url;
