-- Migration 012: Create supplies table
-- Description: Supplies (insumos/materiais) associated with a store

DO $$ BEGIN
  CREATE TYPE supply_type AS ENUM ('ingredient', 'packaging', 'cleaning', 'utensil', 'office', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_measure AS ENUM ('un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'dz', 'm', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS supplies (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type supply_type DEFAULT 'ingredient',
  unit_measure unit_measure NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT uq_supplies_store_name UNIQUE(store_id, name),
  CONSTRAINT fk_supplies_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplies_store_id ON supplies(store_id);
CREATE INDEX IF NOT EXISTS idx_supplies_store_type ON supplies(store_id, type);
CREATE INDEX IF NOT EXISTS idx_supplies_active ON supplies(active);

COMMENT ON TABLE supplies IS 'Supplies (insumos/materiais) associated with each store';
