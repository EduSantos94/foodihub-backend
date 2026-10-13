import { Request, Response } from 'express';
import { SaleService } from '../services/SaleService.js';
import { CreateSaleRequest, UpdateSaleRequest, PaginationQuery, SaleStatus } from '../types/index.js';

const SALE_STATUSES: SaleStatus[] = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];

export class SaleController {
  private saleService: SaleService;

  constructor() {
    this.saleService = new SaleService();
  }

  async createSale(req: Request, res: Response): Promise<void> {
    try {
      const { store_id: storeId, id: userId } = (req as any).user;
      const data: CreateSaleRequest = req.body;

      if (!data.items || data.items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Sale must have at least one item',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const sale = await this.saleService.createSale(storeId, userId, data);
      res.status(201).json({ success: true, data: sale, message: 'Sale created successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSale(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const sale = await this.saleService.getSale(id, storeId);
      res.json({ success: true, data: sale });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listSales(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const status = req.query.status as SaleStatus | undefined;

      if (status && !SALE_STATUSES.includes(status)) {
        res.status(400).json({
          success: false,
          error: `status must be one of: ${SALE_STATUSES.join(', ')}`,
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const query: PaginationQuery & { status?: SaleStatus } = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        status,
      };
      const sales = await this.saleService.listSales(storeId, query);
      res.json({ success: true, data: sales.data, pagination: sales.pagination });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateSale(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const data: UpdateSaleRequest = req.body;

      // Cancelling (which restores stock) is restricted, same as POST /:id/cancel
      if (data.status === 'cancelled' && !['admin', 'manager'].includes((req as any).user.role)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          status_code: 403,
          timestamp: new Date(),
        });
        return;
      }

      const sale = await this.saleService.updateSale(id, storeId, data);
      res.json({ success: true, data: sale, message: 'Sale updated successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async cancelSale(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const sale = await this.saleService.cancelSale(id, storeId);
      res.json({ success: true, data: sale, message: 'Sale cancelled successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    const message = error.message || 'Internal server error';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: message, status_code: status, timestamp: new Date() });
  }
}
