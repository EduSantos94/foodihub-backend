-- Migration 012: Create supplies table
-- Description: Supplies (insumos/materiais) associated with a store

CREATE TABLE IF NOT EXISTS supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'ingredient',
  unit_measure VARCHAR(20) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_supplies_store_name UNIQUE (store_id, name),
  CONSTRAINT fk_supplies_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplies_store_id ON supplies(store_id);
CREATE INDEX IF NOT EXISTS idx_supplies_store_type ON supplies(store_id, type);
CREATE INDEX IF NOT EXISTS idx_supplies_active ON supplies(active);

COMMENT ON TABLE supplies IS 'Supplies (insumos/materiais) associated with each store';
COMMENT ON COLUMN supplies.type IS 'ingredient | packaging | cleaning | other';
COMMENT ON COLUMN supplies.unit_measure IS 'kg, g, L, ml, un, cx, etc.';
