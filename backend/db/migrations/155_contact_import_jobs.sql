-- Migration: 155_contact_import_jobs
-- Фоновая очередь импорта контактов (job + прогресс)

CREATE TABLE IF NOT EXISTS contact_import_jobs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  added INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  errors_total INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_summary TEXT,
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_import_jobs_created
  ON contact_import_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_import_jobs_status
  ON contact_import_jobs (status);

-- DOWN
-- DROP TABLE IF EXISTS contact_import_jobs;
