-- Store reviews, editor replies, CRM activity (TZ_STORE_CLIENT_CABINET_REVIEWS)

CREATE TABLE IF NOT EXISTS store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES store_orders(id) ON DELETE SET NULL,
  buyer TEXT NOT NULL,
  user_id TEXT,
  stars SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, buyer)
);

CREATE INDEX IF NOT EXISTS store_reviews_product_idx
  ON store_reviews (product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS store_review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES store_reviews(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_review_replies_review_idx
  ON store_review_replies (review_id, created_at ASC);

CREATE TABLE IF NOT EXISTS store_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('review', 'paid', 'store_ask')),
  contact_id TEXT,
  buyer TEXT,
  product_id UUID,
  order_id UUID,
  review_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_activity_events_created_idx
  ON store_activity_events (created_at DESC);
