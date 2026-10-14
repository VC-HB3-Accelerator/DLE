-- Реквизиты оператора для конструктора пакета документов (/content/settings).
-- Одна строка на инстанс (id = 1).

CREATE TABLE IF NOT EXISTS legal_operator_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  jurisdiction TEXT,
  pack_id TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO legal_operator_settings (id, variables)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE legal_operator_settings IS 'Реквизиты формы конструктора legal-packs (ТЗ TZ_LEGAL_PACK_CONSTRUCTOR)';
COMMENT ON COLUMN legal_operator_settings.variables IS 'JSON ключей pack.variables (company_name, inn, …)';
