-- Copyright (c) 2024-2026 Тарабанов Александр Викторович
-- Срез C: перевод чата + analytics snapshot при завершении

ALTER TABLE conference_transcript_items
  ADD COLUMN IF NOT EXISTS text_translated_encrypted TEXT;

ALTER TABLE conference_sessions
  ADD COLUMN IF NOT EXISTS analytics_json JSONB;
