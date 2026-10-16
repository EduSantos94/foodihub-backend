-- Migration 020: Customer CPF and supplier CNPJ are unique per store, not across the whole system
-- Description: customers.cpf and suppliers.cnpj had a global UNIQUE constraint, so two stores could not
-- register the same person/company, and a deleted record still blocked the document.
-- The new unique indexes are per store and ignore deleted rows and empty values.

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_cpf_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_store_cpf
  ON customers(store_id, cpf)
  WHERE cpf IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_cnpj_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_store_cnpj
  ON suppliers(store_id, cnpj)
  WHERE cnpj IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX uq_customers_store_cpf IS 'One customer per CPF in each store (deleted customers do not count)';
COMMENT ON INDEX uq_suppliers_store_cnpj IS 'One supplier per CNPJ in each store (deleted suppliers do not count)';
