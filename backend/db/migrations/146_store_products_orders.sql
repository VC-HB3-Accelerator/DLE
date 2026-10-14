-- Store: settings, products, media, orders (TZ_STORE_PRODUCT_CARDS_TREASURY)

CREATE TABLE IF NOT EXISTS store_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  primary_dle_address TEXT,
  primary_chain_id INTEGER,
  treasury_address TEXT,
  order_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO store_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'product' CHECK (kind IN ('product', 'service')),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  pay_token_address TEXT NOT NULL,
  pay_token_decimals INTEGER NOT NULL CHECK (pay_token_decimals >= 0 AND pay_token_decimals <= 18),
  pay_token_symbol TEXT NOT NULL DEFAULT '',
  price_units NUMERIC(78, 0) NOT NULL CHECK (price_units > 0),
  license_token_address TEXT NOT NULL,
  license_token_decimals INTEGER NOT NULL CHECK (license_token_decimals >= 0 AND license_token_decimals <= 18),
  license_token_symbol TEXT NOT NULL DEFAULT '',
  license_amount_units NUMERIC(78, 0) NOT NULL CHECK (license_amount_units > 0),
  max_payments_per_wallet INTEGER NOT NULL DEFAULT 1 CHECK (max_payments_per_wallet >= 1),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_products_published_idx
  ON store_products (published, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS store_product_media (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  content_media_id BIGINT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, content_media_id)
);

CREATE INDEX IF NOT EXISTS store_product_media_product_idx
  ON store_product_media (product_id, sort_order);

CREATE TABLE IF NOT EXISTS store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES store_products(id),
  buyer TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN (
      'awaiting_payment',
      'paid',
      'fulfillment_proposed',
      'fulfilled',
      'refund_proposed',
      'refunded',
      'expired',
      'cancelled'
    )),
  product_title TEXT NOT NULL DEFAULT '',
  price_units NUMERIC(78, 0) NOT NULL,
  pay_token_address TEXT NOT NULL,
  pay_token_decimals INTEGER NOT NULL,
  pay_token_symbol TEXT NOT NULL DEFAULT '',
  license_token_address TEXT NOT NULL,
  license_token_decimals INTEGER NOT NULL,
  license_token_symbol TEXT NOT NULL DEFAULT '',
  license_amount_units NUMERIC(78, 0) NOT NULL,
  treasury_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  sticker_units NUMERIC(78, 0) NOT NULL,
  amount_unique_units NUMERIC(78, 0) NOT NULL,
  tail_units NUMERIC(78, 0) NOT NULL DEFAULT 0,
  tx_hash TEXT,
  tx_log_index INTEGER,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  fulfillment_proposal_id TEXT,
  fulfillment_calldata_proposal_ref TEXT,
  refund_proposal_id TEXT,
  refund_calldata_proposal_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS store_orders_tx_hash_uidx
  ON store_orders (lower(tx_hash))
  WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS store_orders_product_buyer_status_idx
  ON store_orders (product_id, lower(buyer), status);

CREATE INDEX IF NOT EXISTS store_orders_status_expires_idx
  ON store_orders (status, expires_at)
  WHERE status = 'awaiting_payment';

CREATE INDEX IF NOT EXISTS store_orders_created_idx
  ON store_orders (created_at DESC);
