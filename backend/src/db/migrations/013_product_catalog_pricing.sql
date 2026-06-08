ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS savings TEXT;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS price_overridden BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE product_catalog SET sort_order = 10 WHERE product_key = 'energy_refill';
UPDATE product_catalog SET sort_order = 20 WHERE product_key = 'energy_pack_5';
UPDATE product_catalog SET sort_order = 30 WHERE product_key = 'gold_starter';
UPDATE product_catalog SET sort_order = 40 WHERE product_key = 'gold_popular';
UPDATE product_catalog SET sort_order = 50 WHERE product_key = 'gold_pro';
UPDATE product_catalog SET sort_order = 60 WHERE product_key = 'gold_mega';
UPDATE product_catalog SET sort_order = 70 WHERE product_key = 'premium_monthly';
