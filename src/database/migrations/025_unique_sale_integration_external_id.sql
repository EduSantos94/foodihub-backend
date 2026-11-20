-- Migration 025: A platform order can become only one sale
-- Description: sale_integrations had a plain index on external_id, so importing the same platform order
-- twice (polling + webhook, or a retry) created two sales. This index makes the import idempotent.

CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_integrations_external
  ON sale_integrations(integration_id, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON INDEX uq_sale_integrations_external IS 'One sale per external order in each integration';
