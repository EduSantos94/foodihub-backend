-- Migration 018: Create report views
-- Description: Read-only reporting views (last 30 days). Cancelled sales are excluded from revenue.

-- Sales grouped by status (cancelled sales are listed, but their value is not "revenue")
CREATE OR REPLACE VIEW vw_sales_by_status AS
SELECT
  s.store_id,
  s.status,
  COUNT(*) AS total_sales,
  SUM(s.total_amount) AS total_revenue,
  AVG(s.total_amount) AS avg_value
FROM sales s
WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.store_id, s.status;

COMMENT ON VIEW vw_sales_by_status IS 'Sales summary by status in the last 30 days';

-- Best selling products (cancelled sales excluded)
CREATE OR REPLACE VIEW vw_top_products AS
SELECT
  p.store_id,
  p.id AS product_id,
  p.name,
  SUM(si.quantity) AS total_quantity,
  SUM(si.total_price) AS total_revenue,
  COUNT(DISTINCT si.sale_id) AS num_sales
FROM sale_items si
JOIN products p ON si.product_id = p.id
JOIN sales s ON si.sale_id = s.id
WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND s.status <> 'cancelled'
GROUP BY p.store_id, p.id, p.name
ORDER BY total_revenue DESC;

COMMENT ON VIEW vw_top_products IS 'Best selling products in the last 30 days (cancelled sales excluded)';

-- Integration health with pending webhook events
CREATE OR REPLACE VIEW vw_integration_status AS
SELECT
  i.id AS integration_id,
  i.store_id,
  i.name,
  i.type,
  i.status,
  COUNT(we.id) AS pending_events,
  MAX(we.created_at) AS last_event,
  i.last_sync,
  i.last_error
FROM integrations i
LEFT JOIN webhooks w ON i.id = w.integration_id
LEFT JOIN webhook_events we ON w.id = we.webhook_id AND we.status = 'pending'
GROUP BY i.id, i.store_id, i.name, i.type, i.status, i.last_sync, i.last_error;

COMMENT ON VIEW vw_integration_status IS 'Integration status and number of pending webhook events';

-- Webhook events that failed or are waiting for a retry
CREATE OR REPLACE VIEW vw_webhook_errors AS
SELECT
  we.id,
  i.store_id,
  w.integration_id,
  i.name AS integration_name,
  we.event_type,
  we.status,
  we.attempt_count,
  we.response_status,
  we.created_at,
  we.next_retry
FROM webhook_events we
JOIN webhooks w ON we.webhook_id = w.id
JOIN integrations i ON w.integration_id = i.id
WHERE we.status = 'failed'
   OR (we.status = 'pending' AND we.attempt_count > 0)
ORDER BY we.created_at DESC;

COMMENT ON VIEW vw_webhook_errors IS 'Webhook events that failed or are waiting for a retry after an error';

-- Supplies with stock info, lowest stock first
CREATE OR REPLACE VIEW vw_supplies_stock AS
SELECT
  su.store_id,
  su.id AS supply_id,
  su.name,
  su.type,
  su.unit_measure,
  su.amount,
  (SELECT MIN(pi.expiry_date)
     FROM purchase_items pi
     JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.supply_id = su.id AND pi.expiry_date >= CURRENT_DATE) AS next_expiry_date
FROM supplies su
WHERE su.active = true
ORDER BY su.amount ASC;

COMMENT ON VIEW vw_supplies_stock IS 'Active supplies with current amount and the nearest future expiry date from purchases (informational)';
