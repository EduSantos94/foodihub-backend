-- Migration 011: Create images table
-- Description: Images associated with stores, products, suppliers, banners, categories, etc.

CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('store', 'product', 'supplier', 'banner', 'category', 'promotional', 'other')),
  entity_id UUID,
  filename VARCHAR(500) NOT NULL,
  url_original VARCHAR(500) NOT NULL,
  url_thumbnail VARCHAR(500),
  file_size INT,
  mime_type VARCHAR(50),
  dimensions VARCHAR(20),
  active BOOLEAN DEFAULT TRUE,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_images_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_store_entity ON images(store_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_images_store_id ON images(store_id);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at);

COMMENT ON TABLE images IS 'Images associated with stores, products, suppliers, banners, etc.';
COMMENT ON COLUMN images.entity_type IS 'Type of entity the image belongs to';
COMMENT ON COLUMN images.entity_id IS 'UUID of the related entity (product_id, supplier_id, etc.)';
