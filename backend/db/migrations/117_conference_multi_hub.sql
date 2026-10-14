-- Copyright (c) 2024-2026 Тарабанов Александр Викторович
-- Multi-конференция: флаг отдельного хаба (не 1:1 на странице контакта)

ALTER TABLE conference_sessions
  ADD COLUMN IF NOT EXISTS is_multi BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conference_sessions_multi_host
  ON conference_sessions (created_by, is_multi, updated_at DESC)
  WHERE is_multi = true;
