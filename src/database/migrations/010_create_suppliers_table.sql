-- Migration 010: Create suppliers table
-- Description: Suppliers associated with a store

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  phone VARCHAR(20),
  email VARCHAR(255),
  contact_person VARCHAR(255),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  CONSTRAINT fk_suppliers_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suppliers_store_active ON suppliers(store_id, active);
CREATE INDEX IF NOT EXISTS idx_suppliers_cnpj ON suppliers(cnpj);
CREATE INDEX IF NOT EXISTS idx_suppliers_store_id ON suppliers(store_id);

COMMENT ON TABLE suppliers IS 'Suppliers associated with each store';
