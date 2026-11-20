-- Migration 021: Identify records created by a spreadsheet import
-- Description: sales, purchases, suppliers and products created by a history import carry the id of the batch,
-- so a wrong import can be undone as a whole (DELETE .../import-history/:batchId).

ALTER TABLE sales ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS import_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_import_batch ON sales(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_import_batch ON purchases(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_import_batch ON suppliers(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_import_batch ON products(import_batch_id) WHERE import_batch_id IS NOT NULL;

COMMENT ON COLUMN sales.import_batch_id IS 'Set when the sale came from a spreadsheet history import';
COMMENT ON COLUMN purchases.import_batch_id IS 'Set when the purchase came from a spreadsheet history import';
COMMENT ON COLUMN suppliers.import_batch_id IS 'Set when the supplier was created by a purchases history import';
COMMENT ON COLUMN products.import_batch_id IS 'Set when the product was created by a sales history import (an old product that was not in the catalog)';
