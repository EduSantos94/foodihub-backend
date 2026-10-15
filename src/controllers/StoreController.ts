import { Request, Response } from 'express';
import { StoreService } from '../services/StoreService.js';
import { UpdateStoreRequest } from '../types/index.js';
import { invalidateAuthCache } from '../middleware/auth.js';
import { pick } from '../utils/pick.js';

// A store admin edits contact data only; the CNPJ and the active flag are not theirs to change.
const OWN_STORE_FIELDS = ['name', 'email', 'phone', 'address', 'city', 'state', 'zip_code', 'country'] as const;
const ANY_STORE_FIELDS = [...OWN_STORE_FIELDS, 'document'] as const;

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
      const isAdminRoute = req.baseUrl.startsWith('/api/admin/');
      const data: UpdateStoreRequest = pick(req.body as UpdateStoreRequest, isAdminRoute ? ANY_STORE_FIELDS : OWN_STORE_FIELDS);
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

  async listStores(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.storeService.listStores({
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 10,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async activateStore(req: Request, res: Response): Promise<void> {
    try {
      const store = await this.storeService.activateStore(req.params.id);
      invalidateAuthCache();
      res.json({ success: true, data: store, message: 'Store activated successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deactivateStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (id === (req as any).user.store_id) throw new Error('You cannot deactivate your own store');
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
      if (id === (req as any).user.store_id) throw new Error('You cannot delete your own store');
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
