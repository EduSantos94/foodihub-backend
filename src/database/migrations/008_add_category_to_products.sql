-- Migration 008: Add category_id to products table
-- Description: Add category foreign key to products table

ALTER TABLE products ADD COLUMN category_id UUID;

ALTER TABLE products
ADD CONSTRAINT fk_products_category
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

COMMENT ON COLUMN products.category_id IS 'Reference to the product category.';
