import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService } from '../ReportService.js';
import { createDataSource } from '../../database/connection.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('ReportService', () => {
  let query: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    query = vi.fn(async (sql: string) => {
      if (sql.includes('vw_sales_by_status'))
        return [
          { status: 'delivered', total_sales: '4', total_revenue: '200.50', avg_value: '50.125' },
          { status: 'pending', total_sales: '1', total_revenue: '49.50', avg_value: '49.50' },
          { status: 'cancelled', total_sales: '2', total_revenue: '90', avg_value: '45' },
        ];
      return [];
    });
    (createDataSource as any).mockResolvedValue({ query });
  });

  it('excludes cancelled sales from the summary and converts numerics', async () => {
    const result = await new ReportService().overview('store-1');
    expect(result.summary).toEqual({ total_sales: 5, total_revenue: 250, avg_ticket: 50, cancelled_sales: 2 });
    expect(result.sales_by_status[0]).toEqual({ status: 'delivered', total_sales: 4, total_revenue: 200.5, avg_value: 50.125 });
  });

  it('filters every query by the store', async () => {
    await new ReportService().overview('store-1');
    expect(query).toHaveBeenCalled();
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain('store_id = $1');
      expect(params).toEqual(['store-1']);
    }
  });

  it('has no division by zero when there are no sales', async () => {
    query.mockResolvedValue([]);
    const result = await new ReportService().overview('store-1');
    expect(result.summary.avg_ticket).toBe(0);
  });
});
