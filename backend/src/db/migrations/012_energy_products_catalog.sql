INSERT INTO product_catalog (product_key, name, mode, enabled) VALUES
  ('energy_refill', 'Energy Refill', 'payment', TRUE),
  ('energy_pack_5', 'Energy Pack (+5)', 'payment', TRUE)
ON CONFLICT (product_key) DO NOTHING;
