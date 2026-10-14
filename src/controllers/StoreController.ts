import { Request, Response } from 'express';
import { StoreService } from '../services/StoreService.js';
import { UpdateStoreRequest } from '../types/index.js';
import { invalidateAuthCache } from '../middleware/auth.js';

export class StoreController {
  private storeService: StoreService;

  constructor() {
    this.storeService = new StoreService();
  }

  async getStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const store = await this.storeService.getStoreById(id);
      res.json({
        success: true,
        data: store,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateStoreRequest = req.body;
      const store = await this.storeService.updateStore(id, data);
      res.json({
        success: true,
        data: store,
        message: 'Store updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getMyStore(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const store = await this.storeService.getStoreById(storeId);
      res.json({
        success: true,
        data: {
          data: [store],
          pagination: { page: 1, limit: 1, total: 1, total_pages: 1 },
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deactivateStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const store = await this.storeService.deactivateStore(id);
      invalidateAuthCache();
      res.json({
        success: true,
        data: store,
        message: 'Store deactivated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.storeService.softDeleteStore(id);
      invalidateAuthCache();
      res.json({
        success: true,
        message: 'Store deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    const message = error.message || 'Internal server error';
    const status = message.includes('not found') ? 404 : 400;

    res.status(status).json({
      success: false,
      error: message,
      status_code: status,
      timestamp: new Date(),
    });
  }
}
