-- Migration 013: Create purchases and purchase_items tables
-- Description: Purchase orders from suppliers with individual items

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  purchase_number VARCHAR(50),
  purchase_date DATE NOT NULL,
  delivery_date DATE,
  invoice_number VARCHAR(50),
  invoice_date DATE,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'cancelled')),
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'bank_transfer', 'pix', 'other')),
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchases_store_supplier ON purchases(store_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_store_id ON purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON purchases(payment_status);

COMMENT ON TABLE purchases IS 'Purchase orders issued to suppliers';
COMMENT ON COLUMN purchases.payment_status IS 'pending | partial | paid | cancelled';
COMMENT ON COLUMN purchases.payment_method IS 'cash | credit_card | debit_card | bank_transfer | pix | other';

-- ==================== purchase_items ====================

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL,
  supply_id UUID NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL,
  unit_price DECIMAL(10, 4) NOT NULL,
  total_price DECIMAL(12, 4) NOT NULL,
  batch_number VARCHAR(50),
  manufacturing_date DATE,
  expiry_date DATE,
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_supply FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_supply ON purchase_items(supply_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_expiry ON purchase_items(expiry_date);

COMMENT ON TABLE purchase_items IS 'Individual items within a purchase order';
