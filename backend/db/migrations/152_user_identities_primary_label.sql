-- Multi email/phone: label + is_primary on user_identities
ALTER TABLE user_identities
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_identities
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN user_identities.is_primary IS 'Primary identity for table/broadcast (one per user+provider email|phone)';
COMMENT ON COLUMN user_identities.label IS 'Short description shown next to value in profile (max 80 in app)';

-- Backfill: oldest row per (user_id, provider ciphertext) becomes primary
UPDATE user_identities ui
SET is_primary = true
FROM (
  SELECT DISTINCT ON (user_id, provider_encrypted) id
  FROM user_identities
  ORDER BY user_id, provider_encrypted, id ASC
) picked
WHERE ui.id = picked.id;
