import { createDataSource } from '../database/connection.js';

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** Reads the vw_* report views (last 30 days) and the stock tables. Everything is filtered by store. */
export class ReportService {
  private async query<T = any>(sql: string, params: unknown[]): Promise<T[]> {
    const ds = await createDataSource();
    return ds.query(sql, params);
  }

  async overview(storeId: string) {
    const [byStatus, daily, topProducts, lowProducts, supplies, integrations, errors] = await Promise.all([
      this.query(
        'SELECT status, total_sales, total_revenue, avg_value FROM vw_sales_by_status WHERE store_id = $1 ORDER BY total_sales DESC',
        [storeId]
      ),
      this.query(
        `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date, COUNT(*) AS total_sales, SUM(total_amount) AS revenue
           FROM sales
          WHERE store_id = $1 AND status <> 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY created_at::date
          ORDER BY created_at::date`,
        [storeId]
      ),
      this.query(
        'SELECT product_id, name, total_quantity, total_revenue, num_sales FROM vw_top_products WHERE store_id = $1 LIMIT 10',
        [storeId]
      ),
      this.query(
        'SELECT id, name, amount FROM products WHERE store_id = $1 AND active = true ORDER BY amount ASC, name ASC LIMIT 10',
        [storeId]
      ),
      this.query(
        'SELECT supply_id, name, unit_measure, amount, next_expiry_date FROM vw_supplies_stock WHERE store_id = $1 LIMIT 10',
        [storeId]
      ),
      this.query(
        'SELECT integration_id, name, type, status, pending_events, last_event, last_sync, last_error FROM vw_integration_status WHERE store_id = $1 ORDER BY name',
        [storeId]
      ),
      this.query(
        `SELECT id, integration_name, event_type, status, attempt_count, response_status, created_at, next_retry
           FROM vw_webhook_errors WHERE store_id = $1 LIMIT 10`,
        [storeId]
      ),
    ]);

    const counted = byStatus.filter((r) => r.status !== 'cancelled');
    const total_sales = counted.reduce((s, r) => s + num(r.total_sales), 0);
    const total_revenue = counted.reduce((s, r) => s + num(r.total_revenue), 0);

    return {
      period_days: 30,
      summary: {
        total_sales,
        total_revenue,
        avg_ticket: total_sales > 0 ? Math.round((total_revenue / total_sales) * 100) / 100 : 0,
        cancelled_sales: byStatus.filter((r) => r.status === 'cancelled').reduce((s, r) => s + num(r.total_sales), 0),
      },
      sales_by_status: byStatus.map((r) => ({
        status: r.status,
        total_sales: num(r.total_sales),
        total_revenue: num(r.total_revenue),
        avg_value: num(r.avg_value),
      })),
      daily: daily.map((r) => ({ date: r.date, total_sales: num(r.total_sales), revenue: num(r.revenue) })),
      top_products: topProducts.map((r) => ({
        product_id: r.product_id,
        name: r.name,
        total_quantity: num(r.total_quantity),
        total_revenue: num(r.total_revenue),
        num_sales: num(r.num_sales),
      })),
      low_stock_products: lowProducts.map((r) => ({ id: r.id, name: r.name, amount: num(r.amount) })),
      low_stock_supplies: supplies.map((r) => ({
        supply_id: r.supply_id,
        name: r.name,
        unit_measure: r.unit_measure,
        amount: num(r.amount),
        next_expiry_date: r.next_expiry_date,
      })),
      integrations: integrations.map((r) => ({ ...r, pending_events: num(r.pending_events) })),
      webhook_errors: errors,
    };
  }
}
