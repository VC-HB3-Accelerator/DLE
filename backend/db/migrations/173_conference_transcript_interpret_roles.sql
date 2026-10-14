-- Copyright (c) 2024-2026 Тарабанов Александр Викторович
-- Роли строк лайв-перевода в журнале конференции

ALTER TABLE conference_transcript_items
  ALTER COLUMN role TYPE VARCHAR(32);

ALTER TABLE conference_transcript_items
  DROP CONSTRAINT IF EXISTS conference_transcript_role_check;

ALTER TABLE conference_transcript_items
  ADD CONSTRAINT conference_transcript_role_check
  CHECK (role IN (
    'participant',
    'agent',
    'host_coach',
    'host',
    'interpret_to_host',
    'interpret_to_primary'
  ));
