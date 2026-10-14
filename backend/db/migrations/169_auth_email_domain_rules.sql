-- UP Migration
-- Корп. домены auth + provenance контактов (TZ_AUTH_CORP_DOMAINS_CRM)

CREATE TABLE IF NOT EXISTS auth_email_domain_rules (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('domain', 'email')),
  value TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'readonly')),
  domain_admin BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kind, value)
);

ALTER TABLE auth_email_domain_rules
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auth_email_domain_rules_kind_value
  ON auth_email_domain_rules (kind, value);

CREATE TABLE IF NOT EXISTS contact_provenance (
  contact_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  imported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  owner_domain TEXT,
  source VARCHAR(32) NOT NULL DEFAULT 'import',
  job_id INTEGER REFERENCES contact_import_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_provenance_imported_by
  ON contact_provenance (imported_by);

CREATE INDEX IF NOT EXISTS idx_contact_provenance_owner_domain
  ON contact_provenance (owner_domain);

-- DOWN Migration
-- DROP TABLE IF EXISTS contact_provenance;
-- DROP TABLE IF EXISTS auth_email_domain_rules;
