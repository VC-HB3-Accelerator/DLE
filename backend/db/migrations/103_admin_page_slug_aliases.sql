-- Migration: история slug для 301/редиректов блога и published-страниц
CREATE TABLE IF NOT EXISTS admin_page_slug_aliases (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  page_id INTEGER NOT NULL REFERENCES admin_pages_simple(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_page_slug_aliases_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_admin_page_slug_aliases_page_id
  ON admin_page_slug_aliases(page_id);

-- Известный битый slug (soft hyphen в title) → канонический
INSERT INTO admin_page_slug_aliases (slug, page_id)
SELECT 'vc-hb3-accelerator-investits-onnyy-tizer', p.id
FROM admin_pages_simple p
WHERE p.slug = 'vc-hb3-accelerator-investitsionnyy-tizer'
ON CONFLICT (slug) DO UPDATE SET page_id = EXCLUDED.page_id;
