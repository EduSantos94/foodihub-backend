-- Migration 011: Create images table
-- Description: Images associated with stores, products, suppliers, banners, etc.

CREATE TABLE IF NOT EXISTS images (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id INT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('shop', 'product', 'supplier', 'banner', 'category', 'promotional', 'others')),
  type_id INT,
  filename VARCHAR(500) NOT NULL,
  rl_original VARCHAR(500) NOT NULL,
  url_thumbnail VARCHAR(500),
  file_size INT,
  mime_type VARCHAR(50),
  dimensions VARCHAR(20),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_images_shop_type ON images (store_id, type, type_id);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images (uploaded_at);

COMMENT ON TABLE images IS 'Images associated with stores, products, suppliers, banners, etc.';