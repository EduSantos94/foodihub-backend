-- Migration 008: Add category_id to products table
-- Description: Add category foreign key to products table

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_category'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

COMMENT ON COLUMN products.category_id IS 'Reference to the product category.';
