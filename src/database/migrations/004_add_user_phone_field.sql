-- Migration 004: Add phone field to users (if not exists)
-- Created at: Enhancement
-- Description: Ensures phone field exists with proper constraints

-- This is already included in 002_create_users_table.sql
-- But if you need to add it to an existing table:
-- ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL;

-- Add index on phone for lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.phone IS 'Contact phone number for the user';
