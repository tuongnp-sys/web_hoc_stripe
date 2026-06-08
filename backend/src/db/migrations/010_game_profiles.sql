CREATE TABLE IF NOT EXISTS game_profiles (
  user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  high_score             INTEGER NOT NULL DEFAULT 0,
  max_layer              SMALLINT NOT NULL DEFAULT 0 CHECK (max_layer BETWEEN 0 AND 7),
  energy                 SMALLINT NOT NULL DEFAULT 5 CHECK (energy BETWEEN 0 AND 10),
  last_energy_refill_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_profiles_high_score ON game_profiles(high_score DESC);
