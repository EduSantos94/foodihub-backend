-- Migration 024: Create sync_outbox table
-- Description: Queue of pending changes to push to an external platform. A change to the same record
-- is coalesced: there is at most ONE pending job per (integration, entity, operation).

CREATE TABLE IF NOT EXISTS sync_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,
  store_id UUID NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  operation VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry TIMESTAMP,
  locked_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_outbox_integration FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_sync_outbox_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Coalescing: a second change to the same record while a job is still pending reuses that job
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_outbox_pending
  ON sync_outbox(integration_id, entity_type, entity_id, operation)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sync_outbox_due ON sync_outbox(status, next_retry);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_integration ON sync_outbox(integration_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_store ON sync_outbox(store_id);

COMMENT ON TABLE sync_outbox IS 'Changes waiting to be pushed to an external platform (one pending job per record and operation)';
COMMENT ON COLUMN sync_outbox.entity_type IS 'What changed (e.g. product); values are defined by the sync layer';
COMMENT ON COLUMN sync_outbox.operation IS 'What to do (e.g. stock, item); values are defined by the sync layer';
COMMENT ON COLUMN sync_outbox.status IS 'pending | processing | done | failed';
COMMENT ON COLUMN sync_outbox.locked_at IS 'Set while a worker processes the job; a stale lock means the worker died and the job can be reclaimed';
COMMENT ON COLUMN sync_outbox.next_retry IS 'Earliest time of the next attempt, NULL = as soon as possible';
