-- Migration 015: Create integrations, webhooks and webhook_events tables
-- Description: External platform integrations (iFood, aiQFome, custom) and webhook delivery log

-- ==================== integrations ====================

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('ifood', 'aiqfome', 'custom')),
  api_key VARCHAR(500),
  api_secret VARCHAR(500),
  webhook_url VARCHAR(500),
  webhook_token VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync TIMESTAMP,
  last_error TEXT,
  config JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_integrations_store_type UNIQUE (store_id, type),
  CONSTRAINT fk_integrations_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integrations_store_status ON integrations(store_id, status);
CREATE INDEX IF NOT EXISTS idx_integrations_store_active ON integrations(store_id, active);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);

COMMENT ON TABLE integrations IS 'External platform integrations configured by each store';
COMMENT ON COLUMN integrations.type IS 'ifood | aiqfome | custom';
COMMENT ON COLUMN integrations.status IS 'active | inactive | error';
COMMENT ON COLUMN integrations.api_key IS 'API key (must be encrypted in production)';
COMMENT ON COLUMN integrations.api_secret IS 'API secret (must be encrypted in production)';
COMMENT ON COLUMN integrations.config IS 'Extra settings as JSON (e.g. auto_accept_orders, category_mapping)';

-- ==================== webhooks ====================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  endpoint_url VARCHAR(500) NOT NULL,
  webhook_token VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_webhooks_integration FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_integration_type ON webhooks(integration_id, event_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
CREATE INDEX IF NOT EXISTS idx_webhooks_event_type ON webhooks(event_type);

COMMENT ON TABLE webhooks IS 'Webhook endpoints that receive events from each integration';
COMMENT ON COLUMN webhooks.event_type IS 'Event that triggers this webhook (e.g. order.created, order.updated)';
COMMENT ON COLUMN webhooks.webhook_token IS 'Token used to validate incoming requests';
COMMENT ON COLUMN webhooks.retry_count IS 'How many delivery attempts were already made';
COMMENT ON COLUMN webhooks.max_retries IS 'Maximum attempts before giving up';

-- ==================== webhook_events ====================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP,
  next_retry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_webhook_events_webhook FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_status ON webhook_events(webhook_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_next_retry ON webhook_events(next_retry);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

COMMENT ON TABLE webhook_events IS 'Log of every webhook event dispatched, with retry control';
COMMENT ON COLUMN webhook_events.status IS 'pending | sent | delivered | failed | skipped';
COMMENT ON COLUMN webhook_events.response_status IS 'HTTP status of the response, NULL if the connection failed';
COMMENT ON COLUMN webhook_events.next_retry IS 'Next attempt date/time, NULL if no more attempts will be made';
