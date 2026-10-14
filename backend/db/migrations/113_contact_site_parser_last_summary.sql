-- UP Migration
-- Храним последний AI-summary без маркеров === AUTO ENRICH === в comment

ALTER TABLE contact_site_parser_state
  ADD COLUMN IF NOT EXISTS last_summary TEXT;

-- DOWN Migration
-- ALTER TABLE contact_site_parser_state DROP COLUMN IF EXISTS last_summary;
