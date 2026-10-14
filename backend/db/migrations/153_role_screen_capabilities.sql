CREATE TABLE IF NOT EXISTS role_screen_capabilities (
  role_key TEXT PRIMARY KEY,
  screens JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER NULL
);

INSERT INTO role_screen_capabilities (role_key, screens)
VALUES
  ('guest', '{}'::jsonb),
  ('readonly', '{}'::jsonb),
  ('editor', '{}'::jsonb)
ON CONFLICT (role_key) DO NOTHING;
