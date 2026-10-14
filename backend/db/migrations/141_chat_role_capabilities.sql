CREATE TABLE IF NOT EXISTS chat_role_capabilities (
  role_key TEXT PRIMARY KEY,
  send_text  BOOLEAN NOT NULL DEFAULT TRUE,
  send_file  BOOLEAN NOT NULL DEFAULT TRUE,
  send_video BOOLEAN NOT NULL DEFAULT TRUE,
  send_audio BOOLEAN NOT NULL DEFAULT TRUE,
  send_call  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER NULL
);

INSERT INTO chat_role_capabilities (role_key)
VALUES ('guest'), ('readonly'), ('editor')
ON CONFLICT (role_key) DO NOTHING;
