-- Listing photos: один байтовый файл может быть привязан к разным page_id (разные public_id).
-- Глобальный UNIQUE(file_hash) мешал attach после dedupe shared /v/.

DROP INDEX IF EXISTS idx_content_media_file_hash_unique;

CREATE INDEX IF NOT EXISTS idx_content_media_file_hash
  ON content_media(file_hash)
  WHERE file_hash IS NOT NULL;
