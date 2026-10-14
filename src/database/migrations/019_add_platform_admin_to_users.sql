-- Migration 019: Platform administrator flag
-- Description: Categories are global and managed only by platform administrators.
-- A platform admin is a regular user with is_platform_admin = true. The flag can only be
-- changed directly in the database (npm run platform-admin -- <email>), never through the API.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_platform_admin ON users(is_platform_admin) WHERE is_platform_admin = true;

COMMENT ON COLUMN users.is_platform_admin IS 'Platform administrator: manages global data such as categories. Not related to the store role.';
