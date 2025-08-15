-- Create encrypted secrets storage
-- Stores key/value pairs where value is encrypted via encryptedDatabaseService

CREATE TABLE IF NOT EXISTS public.secrets (
  key            text PRIMARY KEY,
  value_encrypted text,
  created_at     timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamptz DEFAULT CURRENT_TIMESTAMP
);


