-- Migration 007: Create categories table
-- Description: Global product categories managed by platform admin

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);

COMMENT ON TABLE categories IS 'Global product categories managed by platform admin (e.g. Pizza, Beverage, Dessert).';
