-- Migration 003: Create audit_logs table
-- Created at: Initial setup
-- Description: Comprehensive audit trail for all store actions

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT')),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  description TEXT,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance - optimized for common queries
CREATE INDEX IF NOT EXISTS idx_audit_store_id ON audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_store_created ON audit_logs(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_store_action_created ON audit_logs(store_id, action, created_at DESC);

-- Add table comment
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail - immutable log of all actions in the system';
COMMENT ON COLUMN audit_logs.old_values IS 'JSON values before update (null for CREATE/READ/DELETE)';
COMMENT ON COLUMN audit_logs.new_values IS 'JSON values after update (null for DELETE)';
COMMENT ON COLUMN audit_logs.status IS 'success or error - whether the action completed successfully';
