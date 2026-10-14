-- Метка пакета конструктора на страницах (ru-rf-pdn-v1 / intl-neutral-v1).
-- Хаб /content/published в разделе «политика и согласия» показывает только
-- документы активного pack_id из legal_operator_settings.

ALTER TABLE admin_pages_simple
  ADD COLUMN IF NOT EXISTS pack_id TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_pages_simple_pack_id
  ON admin_pages_simple (pack_id)
  WHERE pack_id IS NOT NULL;

COMMENT ON COLUMN admin_pages_simple.pack_id IS
  'legal-packs packId; privacy hub filters by legal_operator_settings.pack_id';
