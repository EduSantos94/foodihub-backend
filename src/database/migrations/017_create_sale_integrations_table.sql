-- Migration 017: Create sale_integrations table
-- Description: Tracks which platform/integration originated a sale

CREATE TABLE IF NOT EXISTS sale_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL,
  integration_id UUID NOT NULL,
  origin VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (origin IN ('ifood', 'aiqfome', 'manual', 'app', 'web')),
  external_id VARCHAR(100),
  external_order_number VARCHAR(100),
  origin_data JSONB,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error', 'cancelled')),
  last_sync TIMESTAMP,
  CONSTRAINT uq_sale_integrations_sale UNIQUE (sale_id),
  CONSTRAINT fk_sale_integrations_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_integrations_integration FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sale_integrations_origin ON sale_integrations(origin);
CREATE INDEX IF NOT EXISTS idx_sale_integrations_external_id ON sale_integrations(external_id);
CREATE INDEX IF NOT EXISTS idx_sale_integrations_sync_status ON sale_integrations(sync_status);
CREATE INDEX IF NOT EXISTS idx_sale_integrations_integration ON sale_integrations(integration_id);

COMMENT ON TABLE sale_integrations IS 'Tracks the platform/integration that originated a sale';
COMMENT ON COLUMN sale_integrations.origin IS 'ifood | aiqfome | manual | app | web';
COMMENT ON COLUMN sale_integrations.origin_data IS 'Original payload from the integration (debug/audit)';
COMMENT ON COLUMN sale_integrations.sync_status IS 'pending | synced | error | cancelled';
