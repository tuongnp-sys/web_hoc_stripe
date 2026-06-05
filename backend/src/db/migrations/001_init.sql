CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id   TEXT,
  product_key                TEXT NOT NULL DEFAULT 'game_unlock',
  amount                     INTEGER NOT NULL,
  currency                   TEXT NOT NULL DEFAULT 'usd',
  status                     TEXT NOT NULL DEFAULT 'pending',
  mode                       TEXT NOT NULL DEFAULT 'payment',
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  paid_at                    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  type            TEXT NOT NULL,
  processed_at    TIMESTAMPTZ DEFAULT NOW(),
  payload         JSONB
);

CREATE TABLE IF NOT EXISTS entitlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key     TEXT NOT NULL,
  active          BOOLEAN DEFAULT TRUE,
  source_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, feature_key)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id         SERIAL PRIMARY KEY,
  filename   TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON entitlements(user_id);
