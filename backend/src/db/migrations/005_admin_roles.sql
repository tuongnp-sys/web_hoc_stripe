-- Admin roles & integrity constraints
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- Per-order access (gold packs / purchases admin can suspend)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending', 'paid', 'expired', 'refunded'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_mode_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_mode_check
      CHECK (mode IN ('payment', 'subscription'));
  END IF;
END $$;

-- Entitlement admin metadata
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_feature_key_check'
  ) THEN
    ALTER TABLE entitlements ADD CONSTRAINT entitlements_feature_key_check
      CHECK (feature_key IN ('premium', 'game_unlock'));
  END IF;
END $$;

-- Global product catalog (admin enable/disable storefront packages)
CREATE TABLE IF NOT EXISTS product_catalog (
  product_key  TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  mode         TEXT NOT NULL DEFAULT 'payment',
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT product_catalog_mode_check CHECK (mode IN ('payment', 'subscription'))
);

INSERT INTO product_catalog (product_key, name, mode, enabled) VALUES
  ('gold_starter', 'Starter Pack', 'payment', TRUE),
  ('gold_popular', 'Popular Pack', 'payment', TRUE),
  ('gold_pro', 'Pro Gamer Pack', 'payment', TRUE),
  ('gold_mega', 'Mega Pack', 'payment', TRUE),
  ('premium_monthly', 'Premium Monthly', 'subscription', TRUE)
ON CONFLICT (product_key) DO NOTHING;

-- Admin audit trail
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Dev admin account
UPDATE users SET role = 'admin', email_verified = TRUE WHERE email = 'admin@localhost';
