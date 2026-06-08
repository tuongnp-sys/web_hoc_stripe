CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_settings (key, value) VALUES
  ('refund_policy', '{"windowHours": 48}')
ON CONFLICT (key) DO NOTHING;
