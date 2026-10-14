CREATE TABLE IF NOT EXISTS role_action_capabilities (
  role_key TEXT PRIMARY KEY,
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER NULL
);

INSERT INTO role_action_capabilities (role_key, actions)
VALUES
  ('guest', '{}'::jsonb),
  ('user', '{}'::jsonb),
  ('readonly', '{}'::jsonb),
  ('editor', '{}'::jsonb)
ON CONFLICT (role_key) DO NOTHING;
