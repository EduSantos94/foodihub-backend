-- Migration 016: Create sales and sale_items tables
-- Description: Sales (orders) with individual items. Stock is simple: selling a
-- product decrements products.amount (handled by the application, atomically).

-- ==================== sales ====================

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  customer_id UUID,
  sale_number VARCHAR(50),
  sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivery_type VARCHAR(20) NOT NULL DEFAULT 'takeout' CHECK (delivery_type IN ('takeout', 'delivery', 'dine_in')),
  delivery_address VARCHAR(500),
  subtotal DECIMAL(12, 2) NOT NULL,
  discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMP,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_store_status ON sales(store_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_date ON sales(payment_status, paid_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

COMMENT ON TABLE sales IS 'Sales header: orders placed in each store';
COMMENT ON COLUMN sales.status IS 'Flow: pending -> preparing -> ready -> delivered (or cancelled)';
COMMENT ON COLUMN sales.delivery_type IS 'takeout | delivery | dine_in';
COMMENT ON COLUMN sales.payment_status IS 'pending | paid | cancelled';

-- ==================== sale_items ====================

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_size_id UUID,
  product_name VARCHAR(255),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sale_items_product_size FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

COMMENT ON TABLE sale_items IS 'Individual items sold in a sale';
COMMENT ON COLUMN sale_items.product_name IS 'Snapshot of the product name at sale time';
COMMENT ON COLUMN sale_items.unit_price IS 'Unit price at sale time (kept for history)';
