-- UP Migration
-- Store V2: optional receipt (token-check), max_qty, sections tree, checkout/cart

-- Product: optional license/receipt + qty + standard
ALTER TABLE store_products
  ALTER COLUMN license_token_address DROP NOT NULL;

ALTER TABLE store_products
  ALTER COLUMN license_amount_units DROP NOT NULL;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS receipt_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS receipt_standard TEXT
    CHECK (receipt_standard IS NULL OR receipt_standard IN ('erc20', 'erc721', 'erc1155'));

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS receipt_erc1155_token_id NUMERIC(78, 0);

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS max_qty INTEGER NOT NULL DEFAULT 1
    CHECK (max_qty >= 1 AND max_qty <= 99);

-- Backfill: existing rows with license address keep receipt on
UPDATE store_products
SET receipt_enabled = TRUE,
    receipt_standard = COALESCE(receipt_standard, 'erc20')
WHERE license_token_address IS NOT NULL
  AND length(trim(license_token_address)) > 0;

-- Orders: nullable license for no-receipt products
ALTER TABLE store_orders
  ALTER COLUMN license_token_address DROP NOT NULL;

ALTER TABLE store_orders
  ALTER COLUMN license_amount_units DROP NOT NULL;

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 1);

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS receipt_standard TEXT;

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS checkout_id UUID;

-- Sections (dynamic catalog tree)
CREATE TABLE IF NOT EXISTS store_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES store_sections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS store_sections_parent_idx
  ON store_sections (parent_id, sort_order, title);

CREATE TABLE IF NOT EXISTS store_product_sections (
  product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES store_sections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, section_id)
);

CREATE INDEX IF NOT EXISTS store_product_sections_section_idx
  ON store_product_sections (section_id);

-- Checkout (cart payment, one pay_token)
CREATE TABLE IF NOT EXISTS store_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN (
      'awaiting_payment',
      'paid',
      'expired',
      'cancelled'
    )),
  pay_token_address TEXT NOT NULL,
  pay_token_decimals INTEGER NOT NULL,
  pay_token_symbol TEXT NOT NULL DEFAULT '',
  treasury_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  sticker_units NUMERIC(78, 0) NOT NULL,
  amount_unique_units NUMERIC(78, 0) NOT NULL,
  tail_units NUMERIC(78, 0) NOT NULL DEFAULT 0,
  tx_hash TEXT,
  tx_log_index INTEGER,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS store_checkouts_tx_hash_uidx
  ON store_checkouts (lower(tx_hash))
  WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS store_checkouts_buyer_status_idx
  ON store_checkouts (lower(buyer), status);

CREATE INDEX IF NOT EXISTS store_checkouts_status_expires_idx
  ON store_checkouts (status, expires_at);

CREATE TABLE IF NOT EXISTS store_checkout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id UUID NOT NULL REFERENCES store_checkouts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES store_products(id),
  order_id UUID REFERENCES store_orders(id) ON DELETE SET NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 1),
  product_title TEXT NOT NULL DEFAULT '',
  unit_price_units NUMERIC(78, 0) NOT NULL,
  line_price_units NUMERIC(78, 0) NOT NULL,
  pay_token_address TEXT NOT NULL,
  receipt_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_standard TEXT,
  license_token_address TEXT,
  license_token_decimals INTEGER,
  license_token_symbol TEXT DEFAULT '',
  license_amount_units NUMERIC(78, 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_checkout_items_checkout_idx
  ON store_checkout_items (checkout_id, sort_order);

ALTER TABLE store_orders
  ADD CONSTRAINT store_orders_checkout_fk
  FOREIGN KEY (checkout_id) REFERENCES store_checkouts(id) ON DELETE SET NULL;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS max_qty_cap INTEGER NOT NULL DEFAULT 99;

-- DOWN Migration
-- ALTER TABLE store_orders DROP CONSTRAINT IF EXISTS store_orders_checkout_fk;
-- DROP TABLE IF EXISTS store_checkout_items;
-- DROP TABLE IF EXISTS store_checkouts;
-- DROP TABLE IF EXISTS store_product_sections;
-- DROP TABLE IF EXISTS store_sections;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS max_qty;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS receipt_erc1155_token_id;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS receipt_standard;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS receipt_enabled;
