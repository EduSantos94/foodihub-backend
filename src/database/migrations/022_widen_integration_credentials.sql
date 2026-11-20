-- Migration 022: Room for long encrypted credentials
-- Description: integrations.api_key / api_secret were VARCHAR(500). The value is stored encrypted
-- (enc:v1:<iv>:<tag>:<cipher>, about 4/3 of the size plus a ~60 character prefix), so a long OAuth
-- access token or refresh token would not fit. TEXT removes the limit; existing values are untouched.

ALTER TABLE integrations ALTER COLUMN api_key TYPE TEXT;
ALTER TABLE integrations ALTER COLUMN api_secret TYPE TEXT;

COMMENT ON COLUMN integrations.api_key IS 'API key or access token (stored encrypted, see utils/crypto.ts)';
COMMENT ON COLUMN integrations.api_secret IS 'API secret or refresh token (stored encrypted, see utils/crypto.ts)';
