-- UP Migration
-- ИИ-бот парсера сайтов контактов: настройки, состояние, задания

CREATE TABLE IF NOT EXISTS contact_site_parser_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  interval_days INTEGER NOT NULL DEFAULT 7,
  max_pages INTEGER NOT NULL DEFAULT 5,
  max_blog_pages INTEGER NOT NULL DEFAULT 1,
  allow_path_keywords TEXT NOT NULL DEFAULT 'about,company,team,product,products,service,services,pricing,contact,contacts,о-нас,компания,команда,продукт,услуги,контакты',
  deny_path_keywords TEXT NOT NULL DEFAULT 'login,signin,signup,cart,checkout,wp-admin,admin,cdn,tag,page,account,auth',
  use_email_domain_fallback BOOLEAN NOT NULL DEFAULT true,
  provider VARCHAR(50) NOT NULL DEFAULT 'ollama',
  model VARCHAR(255),
  system_prompt_encrypted TEXT,
  temperature NUMERIC(4,2) NOT NULL DEFAULT 0.20,
  max_tokens INTEGER NOT NULL DEFAULT 600,
  timeout_ms INTEGER NOT NULL DEFAULT 420000,
  fetch_timeout_ms INTEGER NOT NULL DEFAULT 10000,
  max_body_bytes INTEGER NOT NULL DEFAULT 524288,
  schedule_batch_size INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO contact_site_parser_settings (id, enabled, provider)
VALUES (1, false, 'ollama')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS contact_site_parser_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_source_url TEXT,
  last_content_hash TEXT,
  last_status VARCHAR(32),
  last_error TEXT,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_site_parser_jobs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  trigger VARCHAR(32) NOT NULL DEFAULT 'manual',
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_ids INTEGER[],
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_site_parser_jobs_created
  ON contact_site_parser_jobs (created_at DESC);

CREATE TABLE IF NOT EXISTS contact_site_parser_results (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES contact_site_parser_jobs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source_url TEXT,
  status VARCHAR(32) NOT NULL,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  summary_preview TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_site_parser_results_job
  ON contact_site_parser_results (job_id, id DESC);

-- DOWN Migration
-- DROP TABLE IF EXISTS contact_site_parser_results;
-- DROP TABLE IF EXISTS contact_site_parser_jobs;
-- DROP TABLE IF EXISTS contact_site_parser_state;
-- DROP TABLE IF EXISTS contact_site_parser_settings;
