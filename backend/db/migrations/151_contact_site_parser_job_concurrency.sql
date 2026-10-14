-- Parallel contact enrichment for site parser jobs
ALTER TABLE contact_site_parser_settings
  ADD COLUMN IF NOT EXISTS job_concurrency INTEGER NOT NULL DEFAULT 4;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_site_parser_settings_job_concurrency_chk'
  ) THEN
    ALTER TABLE contact_site_parser_settings
      ADD CONSTRAINT contact_site_parser_settings_job_concurrency_chk
      CHECK (job_concurrency >= 1 AND job_concurrency <= 10);
  END IF;
END $$;
