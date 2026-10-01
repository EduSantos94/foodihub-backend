import { Request, Response } from 'express';
import { PurchaseService } from '../services/PurchaseService.js';
import { CreatePurchaseRequest, UpdatePurchaseRequest, PaginationQuery } from '../types/index.js';

export class PurchaseController {
  private purchaseService: PurchaseService;

  constructor() {
    this.purchaseService = new PurchaseService();
  }

  async createPurchase(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreatePurchaseRequest = req.body;

      if (!data.supplier_id || !data.purchase_date) {
        res.status(400).json({
          success: false,
          error: 'supplier_id and purchase_date are required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      if (!data.items || data.items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Purchase must have at least one item',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const purchase = await this.purchaseService.createPurchase(storeId, data);
      res.status(201).json({ success: true, data: purchase, message: 'Purchase created successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getPurchase(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const purchase = await this.purchaseService.getPurchase(id, storeId);
      res.json({ success: true, data: purchase });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listPurchases(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };
      const purchases = await this.purchaseService.listPurchases(storeId, query);
      res.json({ success: true, data: purchases.data, pagination: purchases.pagination });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updatePurchase(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const data: UpdatePurchaseRequest = req.body;
      const purchase = await this.purchaseService.updatePurchase(id, storeId, data);
      res.json({ success: true, data: purchase, message: 'Purchase updated successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deletePurchase(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      await this.purchaseService.deletePurchase(id, storeId);
      res.json({ success: true, message: 'Purchase deleted successfully' });
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
