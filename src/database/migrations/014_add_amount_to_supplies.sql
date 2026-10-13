-- Migration 014: Simple stock on supplies and products
-- Description: Add amount to supplies and forbid negative stock on both tables

ALTER TABLE supplies ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 4) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_supplies_amount_non_negative'
  ) THEN
    ALTER TABLE supplies
    ADD CONSTRAINT chk_supplies_amount_non_negative CHECK (amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_amount_non_negative'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT chk_products_amount_non_negative CHECK (amount >= 0);
  END IF;
END$$;

COMMENT ON COLUMN supplies.amount IS 'Current stock quantity, in the unit defined by unit_measure.';
COMMENT ON COLUMN products.amount IS 'Current stock quantity of the product (units).';
