-- Migration 006: Create product_sizes table
-- Description: Custom sizes associated with a product (e.g. P, M, G or 300ml, 500ml)

CREATE TABLE IF NOT EXISTS product_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  store_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_sizes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_sizes_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id ON product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sizes_store_id ON product_sizes(store_id);
CREATE INDEX IF NOT EXISTS idx_product_sizes_active ON product_sizes(active);

COMMENT ON TABLE product_sizes IS 'Custom sizes per product per store.';
