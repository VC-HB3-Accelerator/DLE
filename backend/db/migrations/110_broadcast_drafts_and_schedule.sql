-- UP Migration
-- Черновики рассылки + окно отправки по дням/часам

ALTER TABLE broadcast_campaigns
  ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  ADD COLUMN IF NOT EXISTS schedule_hour_start INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS schedule_hour_end INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS schedule_timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Moscow',
  ADD COLUMN IF NOT EXISTS drafts_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drafts_ready_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN broadcast_campaigns.schedule_days IS 'Дни недели ISO: 1=пн ... 7=вс';
COMMENT ON COLUMN broadcast_campaigns.schedule_hour_start IS 'Час начала окна (включительно), в schedule_timezone';
COMMENT ON COLUMN broadcast_campaigns.schedule_hour_end IS 'Час конца окна (исключая), в schedule_timezone';

ALTER TABLE broadcast_deliveries
  ADD COLUMN IF NOT EXISTS subject_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS body_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN broadcast_deliveries.subject_encrypted IS 'Тема черновика (шифр), до отправки';
COMMENT ON COLUMN broadcast_deliveries.body_encrypted IS 'Текст черновика (шифр), правится в чате';

-- DOWN Migration
-- ALTER TABLE broadcast_deliveries DROP COLUMN IF EXISTS subject_encrypted;
-- ALTER TABLE broadcast_deliveries DROP COLUMN IF EXISTS body_encrypted;
-- ALTER TABLE broadcast_deliveries DROP COLUMN IF EXISTS conversation_id;
-- ALTER TABLE broadcast_deliveries DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE broadcast_campaigns DROP COLUMN IF EXISTS schedule_days;
-- ALTER TABLE broadcast_campaigns DROP COLUMN IF EXISTS schedule_hour_start;
-- ALTER TABLE broadcast_campaigns DROP COLUMN IF EXISTS schedule_hour_end;
-- ALTER TABLE broadcast_campaigns DROP COLUMN IF EXISTS schedule_timezone;
-- ALTER TABLE broadcast_campaigns DROP COLUMN IF EXISTS drafts_total;
-- ALTER TABLE broadcast_campaigns DROP COLUMN IF EXISTS drafts_ready_count;
