CREATE TABLE IF NOT EXISTS energy_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  amount     SMALLINT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT energy_transactions_type_check
    CHECK (type IN ('credit', 'spend', 'refill_24h', 'gold_spend', 'refund'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_energy_tx_order_credit
  ON energy_transactions(user_id, order_id)
  WHERE type = 'credit' AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_energy_tx_user_id ON energy_transactions(user_id);
