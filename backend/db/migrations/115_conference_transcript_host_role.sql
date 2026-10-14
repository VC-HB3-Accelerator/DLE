-- Copyright (c) 2024-2026 Тарабанов Александр Викторович
-- role host для текстового чата редактора в транскрипте конференции

ALTER TABLE conference_transcript_items
  DROP CONSTRAINT IF EXISTS conference_transcript_role_check;

ALTER TABLE conference_transcript_items
  ADD CONSTRAINT conference_transcript_role_check
  CHECK (role IN ('participant', 'agent', 'host_coach', 'host'));
