CREATE TABLE IF NOT EXISTS cloudflare_settings (
  id SERIAL PRIMARY KEY,
  api_token TEXT,
  tunnel_token TEXT,
  domain TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
); 