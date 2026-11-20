-- Migration 023: Create external_mappings table
-- Description: Links a FoodiHub record to its counterpart on an external platform (aiqfome, iFood...),
-- per integration. Used for products, sizes, categories, payment methods and customers.

CREATE TABLE IF NOT EXISTS external_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,
  store_id UUID NOT NULL,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('product', 'product_size', 'category', 'payment_method', 'customer')),
  -- VARCHAR (not UUID): payment methods are identified locally by a code such as 'pix'
  local_id VARCHAR(100) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMP,
  last_synced_hash VARCHAR(64),
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_external_mappings_local UNIQUE (integration_id, entity_type, local_id),
  CONSTRAINT uq_external_mappings_external UNIQUE (integration_id, entity_type, external_id),
  CONSTRAINT fk_external_mappings_integration FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_mappings_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_external_mappings_store ON external_mappings(store_id);
CREATE INDEX IF NOT EXISTS idx_external_mappings_integration_type ON external_mappings(integration_id, entity_type);

COMMENT ON TABLE external_mappings IS 'FoodiHub record <-> external platform record, per integration';
COMMENT ON COLUMN external_mappings.entity_type IS 'product | product_size | category | payment_method | customer';
COMMENT ON COLUMN external_mappings.local_id IS 'Id of the FoodiHub record (payment methods use their code, e.g. pix)';
COMMENT ON COLUMN external_mappings.external_id IS 'Id of the record on the external platform';
COMMENT ON COLUMN external_mappings.sync_enabled IS 'Opt-in per record: only enabled mappings are pushed to the platform';
COMMENT ON COLUMN external_mappings.last_synced_hash IS 'Hash of the last payload sent, used to skip unchanged records';
