-- CMS media: диск + чанки (не BYTEA).
-- SoT: docs.ru/back-docs/TZ_CONTENT_MEDIA_CHUNKED_UPLOAD.ru.md §5

ALTER TABLE content_media
  ADD COLUMN IF NOT EXISTS public_id TEXT,
  ADD COLUMN IF NOT EXISTS storage TEXT NOT NULL DEFAULT 'bytea',
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS upload_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS parts_json JSONB,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE content_media ALTER COLUMN file_data DROP NOT NULL;

UPDATE content_media
SET storage = 'bytea'
WHERE storage IS NULL OR storage = '';

UPDATE content_media
SET status = 'ready'
WHERE status IS NULL OR status = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_media_storage_chk'
  ) THEN
    ALTER TABLE content_media
      ADD CONSTRAINT content_media_storage_chk
      CHECK (storage IN ('bytea', 'disk'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_media_status_chk'
  ) THEN
    ALTER TABLE content_media
      ADD CONSTRAINT content_media_status_chk
      CHECK (status IN ('pending', 'ready', 'aborted'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS content_media_public_id_uidx
  ON content_media (public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_media_upload_id_uidx
  ON content_media (upload_id) WHERE upload_id IS NOT NULL;
